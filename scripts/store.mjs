/**
 * Shared app state kept in world settings. Every change goes through the active GM (see relay.mjs),
 * which applies the reducers from state.mjs; the settings update then re-renders the apps everywhere.
 */
import { L, MODULE_ID } from './constants.mjs';
import { handle, request } from './relay.mjs';
import { ReduceError, SKY, VILLAIN, emptySky, emptyVillain, reduce } from './state.mjs';

const STORES = {
    nightSky: { reducers: SKY, empty: emptySky },
    villain: { reducers: VILLAIN, empty: emptyVillain }
};

export function registerStores() {
    for (const [key, { empty }] of Object.entries(STORES)) {
        game.settings.register(MODULE_ID, key, { scope: 'world', config: false, type: Object, default: empty() });
    }
    handle('dispatch', async ({ store, op, args }, from) => {
        const def = STORES[store];
        if (!def) throw new Error(`Unknown store ${store}`);
        const user = game.users.get(from);
        const state = read(store);
        let next;
        try {
            next = reduce(def.reducers, state, op, args, { user: from, isGM: !!user?.isGM });
        } catch (err) {
            if (err instanceof ReduceError) {
                const e = new Error(L(`Refuse.${err.message}`));
                e.refusal = true;
                throw e;
            }
            throw err;
        }
        await game.settings.set(MODULE_ID, store, next);
        return next.rev;
    });
}

/** Current state of a store (always a complete object, even for old or empty saves). */
export function read(store) {
    const def = STORES[store];
    const saved = game.settings.get(MODULE_ID, store);
    return foundry.utils.mergeObject(def.empty(), saved ?? {}, { inplace: false, insertKeys: true, insertValues: true });
}

/**
 * Ask for a change. Refusals are shown as a notification and resolve to null.
 * @returns {Promise<number|null>} the new revision
 */
export async function dispatch(store, op, args = {}) {
    try {
        return await request('dispatch', { store, op, args });
    } catch (err) {
        ui.notifications.warn(err.message);
        return null;
    }
}

/** Re-render callback for whenever a store changes on this client. */
export function onStoreChange(fn) {
    Hooks.on('updateSetting', setting => {
        const [ns, ...rest] = String(setting.key).split('.');
        if (ns !== MODULE_ID) return;
        const key = rest.join('.');
        if (key in STORES) fn(key);
    });
    Hooks.on('createSetting', setting => {
        const [ns, ...rest] = String(setting.key).split('.');
        if (ns === MODULE_ID && rest.join('.') in STORES) fn(rest.join('.'));
    });
}
