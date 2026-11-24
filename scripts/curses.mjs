/**
 * Curses: the Weredrake Curse and the Petrified Curse as status conditions (token HUD, actions,
 * the Curses compendium), token visuals while cursed, and the curse breakers that clear them.
 */
import { ART, CURSE, L, MODULE_ID } from './constants.mjs';
import { handle, request } from './relay.mjs';

const CURSE_IDS = Object.values(CURSE);
export const CURSE_ICONS = {
    [CURSE.weredrake]: 'icons/creatures/abilities/dragon-breath-purple.webp',
    [CURSE.petrified]: 'icons/magic/earth/strike-body-stone-crumble.webp'
};
const STONE_TINT = '#9c968c';

/** Same data the Curses compendium items carry, so both routes give the same condition. */
export function petrifiedChanges() {
    return ['major', 'severe'].map(k => ({ key: `system.damageThresholds.${k}`, type: 'add', value: 10, phase: 'initial', priority: null }));
}

/** Add the two curses to the status conditions. Runs in "setup", after the system sets its own. */
export function registerCurseStatuses() {
    if (!game.settings.get(MODULE_ID, 'curseConditions')) return;
    CONFIG.statusEffects.push(
        {
            id: CURSE.weredrake,
            _id: 'dhwdWeredrakeCrs',
            name: L('Curse.weredrakeCurse.Name'),
            img: CURSE_ICONS[CURSE.weredrake],
            description: L('Curse.weredrakeCurse.Short')
        },
        {
            id: CURSE.petrified,
            _id: 'dhwdPetrifiedCrs',
            name: L('Curse.petrifiedCurse.Name'),
            img: CURSE_ICONS[CURSE.petrified],
            description: L('Curse.petrifiedCurse.Short'),
            statuses: ['restrained', 'vulnerable'],
            system: { changes: petrifiedChanges() }
        }
    );
}

/* ------------------------------------------------------------------ */
/*  Clearing curses                                                   */
/* ------------------------------------------------------------------ */

const isCurseEffect = e => CURSE_IDS.some(id => e.statuses?.has?.(id) || e.statuses?.includes?.(id));
const isCurseItem = i => !!i.getFlag?.(MODULE_ID, 'curse');

export function cursesOn(actor) {
    return CURSE_IDS.filter(id => actor?.statuses?.has(id));
}

/** Remove every curse condition and curse item from an actor. Returns how many were removed. */
export async function clearCursesFrom(actor) {
    if (!actor) return 0;
    const effects = actor.effects.filter(isCurseEffect).map(e => e.id);
    const items = actor.items.filter(isCurseItem).map(i => i.id);
    if (effects.length) await actor.deleteEmbeddedDocuments('ActiveEffect', effects);
    if (items.length) await actor.deleteEmbeddedDocuments('Item', items);
    return effects.length + items.length;
}

handle('clearCurses', async ({ uuids }) => {
    const freed = [];
    for (const uuid of uuids ?? []) {
        const doc = await fromUuid(uuid);
        const actor = doc?.actor ?? doc;
        if (!(actor instanceof Actor)) continue;
        if (await clearCursesFrom(actor)) freed.push(actor.name);
    }
    return freed;
});

/** Clear the curses of the given actors (through the GM when we don't own them). */
export async function clearCurses(actors) {
    const uuids = actors.filter(Boolean).map(a => a.uuid);
    if (!uuids.length) return [];
    return request('clearCurses', { uuids });
}

/**
 * Lady Lavender's Longsword and the Zoetrope of the Bright Bacchanal carry a "curseBreaker" flag naming
 * their curse-breaking action. Using that action frees the user's targets.
 */
export function registerCurseBreakers() {
    Hooks.on('daggerheart.postUseAction', (action, config) => {
        const breaker = action?.item?.getFlag?.(MODULE_ID, 'curseBreaker');
        if (!breaker || (breaker.action && breaker.action !== (action.id ?? action._id))) return;
        const targets = [...game.user.targets].map(t => t.actor).filter(Boolean);
        if (!targets.length) {
            ui.notifications.info(L('Curse.NoTargets'));
            return;
        }
        const cursed = targets.filter(a => cursesOn(a).length || a.items.some(isCurseItem));
        if (!cursed.length) {
            ui.notifications.info(L('Curse.NoneCursed'));
            return;
        }
        clearCurses(cursed)
            .then(freed => {
                if (!freed?.length) return;
                ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: action.actor }),
                    content: `<div class="dh-weredragon-chat curse-broken"><img src="${action.item.img}" alt=""><p>${L('Curse.Broken', {
                        item: action.item.name,
                        names: freed.join(', ')
                    })}</p></div>`
                });
            })
            .catch(err => ui.notifications.error(err.message));
    });
}

/* ------------------------------------------------------------------ */
/*  Token visuals                                                     */
/* ------------------------------------------------------------------ */

/** Put cursed tokens in weredrake shape or turn them to stone, and back when the curse ends. */
async function syncVisuals(actor) {
    if (!actor || !game.user.isActiveGM || !game.settings.get(MODULE_ID, 'curseVisuals')) return;
    const drake = actor.statuses.has(CURSE.weredrake);
    const stone = actor.statuses.has(CURSE.petrified);
    const tokens = actor.isToken ? [actor.token] : actor.getActiveTokens(true, true);
    for (const token of tokens) {
        if (!token) continue;
        const saved = token.getFlag(MODULE_ID, 'curseLook') ?? {};
        const update = {};
        const look = { ...saved };
        if (drake && !saved.drake) {
            look.src = saved.src ?? token.texture.src;
            look.drake = true;
            update['texture.src'] = ART.weredrake;
        } else if (!drake && saved.drake) {
            update['texture.src'] = saved.src;
            look.drake = false;
        }
        if (stone && !saved.stone) {
            look.tint = saved.tint ?? token.texture.tint?.css ?? '#ffffff';
            look.stone = true;
            update['texture.tint'] = STONE_TINT;
        } else if (!stone && saved.stone) {
            update['texture.tint'] = saved.tint ?? '#ffffff';
            look.stone = false;
        }
        if (!Object.keys(update).length) continue;
        if (!look.drake && !look.stone) update[`flags.${MODULE_ID}.-=curseLook`] = null;
        else update[`flags.${MODULE_ID}.curseLook`] = look;
        await token.update(update);
    }
}

const queued = new Set();
function queueSync(doc) {
    let actor = doc?.parent;
    if (actor instanceof Item) actor = actor.parent;
    if (!(actor instanceof Actor) || queued.has(actor)) return;
    queued.add(actor);
    setTimeout(() => {
        queued.delete(actor);
        syncVisuals(actor).catch(err => console.warn(`${MODULE_ID} | curse visuals`, err));
    }, 50);
}

export function registerCurseVisuals() {
    for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'createItem', 'deleteItem']) {
        Hooks.on(hook, doc => queueSync(doc));
    }
}
