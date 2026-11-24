/**
 * Shared state of the two table apps, as pure reducers (no Foundry calls), so the active GM can apply
 * requests from every client in one place and the rules can be tested outside Foundry.
 *
 * Every reducer gets (state, args, ctx) with ctx = { user, isGM, random } and returns the new state,
 * or throws a ReduceError explaining why the request was refused.
 */
import { NIGHT_SKY, PROMPT_NUMBERS, REVELATION_KEYS } from './data.mjs';

export class ReduceError extends Error {}
const refuse = key => {
    throw new ReduceError(key);
};
const gmOnly = ctx => ctx.isGM || refuse('GMOnly');
const clone = obj => JSON.parse(JSON.stringify(obj));
const uid = random => Math.floor(random() * 2 ** 32).toString(36).padStart(7, '0');

/* ================================================================== */
/*  Night Sky Reading                                                  */
/* ================================================================== */

export const DICE = 5;
export const ALLY_HOPE = 3;

export function emptySky() {
    return {
        dice: [], // { id, value, by }
        assign: {}, // revelation key -> die id
        revealed: false,
        overrides: {}, // "row.col" -> replacement text
        allyHope: ALLY_HOPE,
        prepared: { secret: false, ally: false, key1: false, key2: false },
        rev: 0
    };
}

/** Table entry for a revelation column and die value (1–6), with the GM's replacements applied. */
export function skyEntry(state, col, value) {
    const row = NIGHT_SKY[value - 1];
    if (!row) return null;
    const base = row[col];
    const text = state?.overrides?.[`${value}.${col}`];
    if (text == null) return { ...base };
    return { name: text, text: '', place: text, custom: true };
}

/** The revelation entries chosen so far: { key: { value, entry } }. */
export function chosen(state) {
    const out = {};
    for (const key of REVELATION_KEYS) {
        const die = state.dice.find(d => d.id === state.assign[key]);
        if (die) out[key] = { value: die.value, die, entry: skyEntry(state, key, die.value) };
    }
    return out;
}

/** Locations that more than one revelation sends the party to ("spread out where the PCs have to go"). */
export function crowdedPlaces(state) {
    const seen = new Map();
    for (const [key, { entry }] of Object.entries(chosen(state))) {
        if (!entry?.place) continue;
        seen.set(entry.place, [...(seen.get(entry.place) ?? []), key]);
    }
    return [...seen].filter(([, keys]) => keys.length > 1).map(([place, keys]) => ({ place, keys }));
}

export const SKY = {
    roll(state, { value }, ctx) {
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        if (state.dice.length >= DICE) refuse('Sky.AllRolled');
        const v = Math.floor(Number(value));
        if (!(v >= 1 && v <= 6)) refuse('BadValue');
        state.dice.push({ id: uid(ctx.random), value: v, by: ctx.user });
        return state;
    },
    assign(state, { die, col }, ctx) {
        gmOnly(ctx);
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        if (!REVELATION_KEYS.includes(col)) refuse('BadValue');
        if (!state.dice.some(d => d.id === die)) refuse('BadValue');
        for (const k of REVELATION_KEYS) if (state.assign[k] === die) delete state.assign[k];
        state.assign[col] = die;
        return state;
    },
    unassign(state, { col }, ctx) {
        gmOnly(ctx);
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        delete state.assign[col];
        return state;
    },
    /** Put each unplaced die into the first free column, in rolling order. */
    autoAssign(state, args, ctx) {
        gmOnly(ctx);
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        const placed = new Set(Object.values(state.assign));
        const free = REVELATION_KEYS.filter(k => !state.assign[k]);
        for (const d of state.dice) {
            if (placed.has(d.id) || !free.length) continue;
            state.assign[free.shift()] = d.id;
        }
        return state;
    },
    reroll(state, { die, value }, ctx) {
        gmOnly(ctx);
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        const d = state.dice.find(x => x.id === die);
        const v = Math.floor(Number(value));
        if (!d || !(v >= 1 && v <= 6)) refuse('BadValue');
        d.value = v;
        return state;
    },
    clearDice(state, args, ctx) {
        gmOnly(ctx);
        if (state.revealed) refuse('Sky.AlreadyRevealed');
        state.dice = [];
        state.assign = {};
        return state;
    },
    reveal(state, args, ctx) {
        gmOnly(ctx);
        if (REVELATION_KEYS.some(k => !state.assign[k])) refuse('Sky.NotAllAssigned');
        state.revealed = true;
        state.allyHope = ALLY_HOPE;
        return state;
    },
    conceal(state, args, ctx) {
        gmOnly(ctx);
        state.revealed = false;
        return state;
    },
    override(state, { value, col, text }, ctx) {
        gmOnly(ctx);
        if (!REVELATION_KEYS.includes(col) || !(value >= 1 && value <= 6)) refuse('BadValue');
        const key = `${value}.${col}`;
        const t = String(text ?? '').trim();
        if (!t || t === NIGHT_SKY[value - 1][col].name) delete state.overrides[key];
        else state.overrides[key] = t.slice(0, 300);
        return state;
    },
    resetOverrides(state, args, ctx) {
        gmOnly(ctx);
        state.overrides = {};
        return state;
    },
    spendAllyHope(state, args, ctx) {
        if (!state.revealed) refuse('Sky.NotRevealed');
        if (state.allyHope <= 0) refuse('Sky.NoAllyHope');
        state.allyHope -= 1;
        return state;
    },
    refillAllyHope(state, args, ctx) {
        gmOnly(ctx);
        state.allyHope = ALLY_HOPE;
        return state;
    },
    prepare(state, { key, value }, ctx) {
        gmOnly(ctx);
        if (!(key in state.prepared)) refuse('BadValue');
        state.prepared[key] = !!value;
        return state;
    },
    reset(state, args, ctx) {
        gmOnly(ctx);
        return emptySky();
    }
};

/* ================================================================== */
/*  Villain Builder                                                    */
/* ================================================================== */

export const DEFAULT_PROMPTS = 15;

export function emptyVillain() {
    return {
        phase: 'setup', // setup | play | done
        mode: 'slips', // slips (cut out and folded) | roll (d4 tens + d10 ones)
        total: DEFAULT_PROMPTS,
        slips: [], // { n, x, y, rot } still folded on the table
        current: null, // { n, by, rolls, followUps: [{ id, q, by, a }] }
        log: [], // { n, by, answer, followUps, status: answered | discarded }
        order: [],
        turn: 0,
        rev: 0
    };
}

/** Prompt numbers no longer available (answered, discarded or open). */
export function usedPrompts(state) {
    const used = new Set(state.log.map(e => e.n));
    if (state.current) used.add(state.current.n);
    return used;
}

export const answeredCount = state => state.log.filter(e => e.status === 'answered').length;
export const turnUser = state => state.order.length ? state.order[state.turn % state.order.length] : null;

/** Turn a d4 (tens) and d10 (ones, 10 counts as 0) into a prompt number. */
export function promptNumber(d4, d10) {
    return Number(d4) * 10 + (Number(d10) % 10);
}

/** Scatter `count` folded slips over the table without too much overlap. */
export function scatterSlips(numbers, random) {
    const cols = Math.ceil(Math.sqrt(numbers.length * 1.6));
    const rows = Math.ceil(numbers.length / cols);
    const cells = numbers.map((n, i) => i);
    // shuffle cell assignment so numbers aren't in order
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return numbers.map((n, i) => {
        const cell = cells[i];
        const cx = (cell % cols) + 0.5;
        const cy = Math.floor(cell / cols) + 0.5;
        return {
            n,
            x: Math.round(((cx + (random() - 0.5) * 0.5) / cols) * 1000) / 10,
            y: Math.round(((cy + (random() - 0.5) * 0.45) / rows) * 1000) / 10,
            rot: Math.round((random() - 0.5) * 50)
        };
    });
}

function sample(list, count, random) {
    const pool = [...list];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function isFinished(state) {
    if (state.current) return false;
    if (state.mode === 'slips') return state.slips.length === 0;
    return answeredCount(state) >= state.total || usedPrompts(state).size >= PROMPT_NUMBERS.length;
}

function advance(state) {
    if (state.order.length) state.turn = (state.turn + 1) % state.order.length;
    if (isFinished(state)) state.phase = 'done';
}

const mayAct = (state, ctx) => ctx.isGM || turnUser(state) === ctx.user;
const isAnswerer = (state, ctx) => ctx.isGM || state.current?.by === ctx.user;

export const VILLAIN = {
    configure(state, { mode, total }, ctx) {
        gmOnly(ctx);
        if (state.phase !== 'setup') refuse('Villain.AlreadyStarted');
        if (mode) state.mode = mode === 'roll' ? 'roll' : 'slips';
        if (total != null) state.total = Math.max(1, Math.min(PROMPT_NUMBERS.length, Math.floor(Number(total)) || DEFAULT_PROMPTS));
        return state;
    },
    start(state, { order }, ctx) {
        gmOnly(ctx);
        if (state.phase !== 'setup') refuse('Villain.AlreadyStarted');
        state.order = (order ?? []).filter(Boolean);
        if (!state.order.length) state.order = [ctx.user];
        state.turn = 0;
        state.log = [];
        state.current = null;
        state.slips = state.mode === 'slips' ? scatterSlips(sample(PROMPT_NUMBERS, state.total, ctx.random), ctx.random) : [];
        state.phase = 'play';
        return state;
    },
    /** Open a prompt: a slip from the table, or a rolled number in roll mode. */
    draw(state, { n, rolls }, ctx) {
        if (state.phase !== 'play') refuse('Villain.NotPlaying');
        if (state.current) refuse('Villain.PromptOpen');
        if (!mayAct(state, ctx)) refuse('Villain.NotYourTurn');
        n = Number(n);
        if (!PROMPT_NUMBERS.includes(n)) refuse('BadValue');
        if (state.mode === 'slips') {
            const i = state.slips.findIndex(s => s.n === n);
            if (i < 0) refuse('BadValue');
            state.slips.splice(i, 1);
        } else if (usedPrompts(state).has(n)) refuse('Villain.Used');
        state.current = { n, by: turnUser(state) ?? ctx.user, rolls: Array.isArray(rolls) ? rolls.slice(0, 20) : null, followUps: [] };
        return state;
    },
    answer(state, { text }, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        if (!isAnswerer(state, ctx)) refuse('Villain.NotYours');
        const answer = String(text ?? '').trim().slice(0, 4000);
        if (!answer) refuse('Villain.EmptyAnswer');
        const { n, by, followUps } = state.current;
        state.log.push({ n, by, answer, followUps, status: 'answered' });
        state.current = null;
        advance(state);
        return state;
    },
    pass(state, { to }, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        if (!isAnswerer(state, ctx)) refuse('Villain.NotYours');
        if (!to || to === state.current.by) refuse('BadValue');
        state.current.by = to;
        return state;
    },
    /** Take the prompt out of play; the same player draws again. */
    discard(state, args, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        if (!isAnswerer(state, ctx)) refuse('Villain.NotYours');
        const { n, by, followUps } = state.current;
        state.log.push({ n, by, answer: '', followUps, status: 'discarded' });
        state.current = null;
        if (isFinished(state)) state.phase = 'done';
        return state;
    },
    followUp(state, { q }, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        const question = String(q ?? '').trim().slice(0, 1000);
        if (!question) refuse('Villain.EmptyAnswer');
        if (state.current.followUps.length >= 12) refuse('BadValue');
        state.current.followUps.push({ id: uid(ctx.random), q: question, by: ctx.user, a: '' });
        return state;
    },
    followAnswer(state, { id, a }, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        if (!isAnswerer(state, ctx)) refuse('Villain.NotYours');
        const f = state.current.followUps.find(x => x.id === id);
        if (!f) refuse('BadValue');
        f.a = String(a ?? '').trim().slice(0, 2000);
        return state;
    },
    dropFollowUp(state, { id }, ctx) {
        if (!state.current) refuse('Villain.NoPrompt');
        const f = state.current.followUps.find(x => x.id === id);
        if (!f) refuse('BadValue');
        if (!ctx.isGM && f.by !== ctx.user) refuse('Villain.NotYours');
        state.current.followUps = state.current.followUps.filter(x => x.id !== id);
        return state;
    },
    skipTurn(state, args, ctx) {
        gmOnly(ctx);
        if (state.current) refuse('Villain.PromptOpen');
        if (state.order.length) state.turn = (state.turn + 1) % state.order.length;
        return state;
    },
    setOrder(state, { order }, ctx) {
        gmOnly(ctx);
        const list = (order ?? []).filter(Boolean);
        if (!list.length) refuse('BadValue');
        const current = turnUser(state);
        state.order = list;
        state.turn = Math.max(0, list.indexOf(current));
        return state;
    },
    editEntry(state, { index, text }, ctx) {
        gmOnly(ctx);
        const e = state.log[index];
        if (!e) refuse('BadValue');
        e.answer = String(text ?? '').trim().slice(0, 4000);
        if (e.answer && e.status === 'discarded') e.status = 'answered';
        return state;
    },
    finish(state, args, ctx) {
        gmOnly(ctx);
        if (state.current) refuse('Villain.PromptOpen');
        state.phase = 'done';
        return state;
    },
    /** Back to the table after finishing early. */
    resume(state, args, ctx) {
        gmOnly(ctx);
        if (state.phase !== 'done') refuse('BadValue');
        state.phase = 'play';
        if (isFinished(state)) refuse('Villain.NothingLeft');
        return state;
    },
    reset(state, args, ctx) {
        gmOnly(ctx);
        const fresh = emptyVillain();
        fresh.mode = state.mode;
        fresh.total = state.total;
        return fresh;
    }
};

/** Apply one named operation to a copy of the state. */
export function reduce(reducers, state, op, args, ctx) {
    const fn = reducers[op];
    if (!fn) throw new ReduceError('BadValue');
    const next = fn(clone(state), args ?? {}, { random: Math.random, ...ctx });
    next.rev = (state.rev ?? 0) + 1;
    return next;
}
