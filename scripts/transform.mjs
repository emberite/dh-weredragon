/**
 * Forlorne's "Transform": using the feature swaps her token between the Faun Form and Dragon Form
 * adversaries, keeping the HP and Stress she has marked and the conditions she suffers.
 */
import { L, MODULE_ID, PACKS } from './constants.mjs';
import { handle, request } from './relay.mjs';

const FORMS = ['faun', 'dragon'];

/** The world actor for a form, imported from the compendium the first time it's needed. */
async function formActor(form) {
    const existing = game.actors.find(a => a.getFlag(MODULE_ID, 'form') === form);
    if (existing) return existing;
    const pack = game.packs.get(PACKS.adversaries);
    const index = await pack?.getIndex({ fields: [`flags.${MODULE_ID}.form`] });
    const entry = index?.find(e => foundry.utils.getProperty(e, `flags.${MODULE_ID}.form`) === form);
    if (!entry) throw new Error(L('Transform.Missing'));
    return game.actors.importFromCompendium(pack, entry._id, {}, { renderSheet: false });
}

handle('transform', async ({ tokenUuid }) => {
    const token = await fromUuid(tokenUuid);
    const actor = token?.actor;
    const form = actor?.getFlag(MODULE_ID, 'form');
    if (!FORMS.includes(form)) throw new Error(L('Transform.NotForlorne'));
    const next = FORMS.find(f => f !== form);
    const target = await formActor(next);

    const hp = actor.system.resources.hitPoints.value;
    const stress = actor.system.resources.stress.value;
    const conditions = actor.effects.filter(e => e.statuses.size && !e.origin).map(e => e.toObject());
    const proto = target.prototypeToken;

    const update = {
        actorId: target.id,
        name: proto.name,
        width: proto.width,
        height: proto.height,
        'texture.src': proto.texture.src
    };
    // Grow or shrink around the token's center.
    const grid = token.parent?.grid?.size ?? canvas.grid?.size ?? 100;
    update.x = Math.round(token.x + ((token.width - proto.width) * grid) / 2);
    update.y = Math.round(token.y + ((token.height - proto.height) * grid) / 2);

    if (!token.actorLink) {
        // Start from the new form's own sheet: drop whatever the old form's token had changed.
        update.delta = { items: null, effects: null, system: {} };
    }
    await token.update(update, { diff: false, recursive: true });

    const now = token.actor;
    await now.update({ 'system.resources.hitPoints.value': hp, 'system.resources.stress.value': stress });
    const have = new Set(now.effects.contents.flatMap(e => [...e.statuses]));
    const carry = conditions.filter(c => !c.statuses.some(s => have.has(s)));
    if (carry.length) await now.createEmbeddedDocuments('ActiveEffect', carry);
    return { from: form, to: next, name: now.name };
});

/** Transform the given token (or Forlorne's controlled token). */
export async function transform(token = canvas.tokens?.controlled[0]?.document) {
    const doc = token?.document ?? token;
    if (!doc) {
        ui.notifications.warn(L('Transform.SelectToken'));
        return null;
    }
    const result = await request('transform', { tokenUuid: doc.uuid });
    if (result) {
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ token: doc }),
            content: `<div class="dh-weredragon-chat transform ${result.to}"><p>${L(`Transform.To.${result.to}`)}</p></div>`
        });
    }
    return result;
}

export function registerTransform() {
    Hooks.on('daggerheart.postUseAction', action => {
        if (!action?.item?.getFlag?.(MODULE_ID, 'transform')) return;
        const actor = action.actor;
        const token = actor?.isToken ? actor.token : actor?.getActiveTokens(false, true)[0];
        if (!token) {
            ui.notifications.warn(L('Transform.NoToken'));
            return;
        }
        transform(token).catch(err => ui.notifications.error(err.message));
    });
}
