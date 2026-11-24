/**
 * Socket relay. Players can't write world settings or other players' actors, so they ask the active GM.
 * Only the operations registered with `handle` are accepted.
 */
import { L, MODULE_ID } from './constants.mjs';

const CHANNEL = `module.${MODULE_ID}`;
const pending = new Map();
const handlers = new Map();
const listeners = new Map();

/** Register a GM-side operation. fn(data, fromUserId) */
export function handle(op, fn) {
    handlers.set(op, fn);
}

/** Subscribe to a broadcast message. fn(data, fromUserId) */
export function listen(type, fn) {
    listeners.set(type, fn);
}

/** Send a message to every other connected client. */
export function broadcast(type, data) {
    game.socket.emit(CHANNEL, { type, data, from: game.user.id });
}

/** Run an operation on the active GM (directly if that's us). */
export async function request(op, data) {
    if (game.user.isActiveGM || (game.user.isGM && !game.users.activeGM)) return enqueue(() => handlers.get(op)(data, game.user.id));
    if (!game.users.activeGM) throw new Error(L('Errors.NoGM'));
    const id = foundry.utils.randomID();
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        game.socket.emit(CHANNEL, { type: 'request', id, op, data, from: game.user.id });
        setTimeout(() => {
            if (pending.delete(id)) reject(new Error(L('Errors.Timeout')));
        }, 15000);
    });
}

// The GM handles requests one at a time so concurrent edits to the same state don't overwrite each other.
let queue = Promise.resolve();
function enqueue(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
}

export function registerRelay() {
    game.socket.on(CHANNEL, msg => {
        if (msg.type === 'response') {
            const p = pending.get(msg.id);
            if (!p || msg.to !== game.user.id) return;
            pending.delete(msg.id);
            msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
            return;
        }
        if (listeners.has(msg.type)) {
            try {
                listeners.get(msg.type)(msg.data, msg.from);
            } catch (err) {
                console.error(`${MODULE_ID} | ${msg.type}`, err);
            }
            return;
        }
        if (msg.type !== 'request' || !game.user.isActiveGM) return;
        enqueue(async () => {
            let result;
            let error;
            try {
                const fn = handlers.get(msg.op);
                if (!fn) throw new Error(`Unknown operation ${msg.op}`);
                result = await fn(msg.data, msg.from);
            } catch (err) {
                if (!err.refusal) console.error(`${MODULE_ID} | relay ${msg.op}`, err);
                error = err.message;
            }
            game.socket.emit(CHANNEL, { type: 'response', id: msg.id, to: msg.from, result, error });
        });
    });
}
