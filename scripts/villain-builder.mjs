/**
 * Villain Builder: build Forlorne Lykona together at session zero.
 * Folded prompt slips lie on the table (or the players roll a d4 and a d10); in turn, each player
 * opens a prompt and answers it, the others may ask follow-ups, and the answers become a journal.
 */
import { ART, HF_PAGES, L, MODULE_ID } from './constants.mjs';
import { PROMPTS, PROMPT_NUMBERS } from './data.mjs';
import { MODULE_TEMPLATES, WeredragonApp, person } from './app-base.mjs';
import { dispatch } from './store.mjs';
import { broadcast } from './relay.mjs';
import { answeredCount, promptNumber, turnUser, usedPrompts } from './state.mjs';
import { writeDossier } from './journal.mjs';

/** Default seating: connected players first (in the user list order), then the GM if nobody else is here. */
export function defaultSeats() {
    const players = game.users.filter(u => !u.isGM && u.active).map(u => u.id);
    return players.length ? players : [game.user.id];
}

export class VillainBuilder extends WeredragonApp {
    static STORE = 'villain';

    static DEFAULT_OPTIONS = {
        id: 'dh-weredragon-villain',
        classes: ['dh-weredragon', 'wd-villain'],
        window: { title: 'DHWD.Villain.Title', icon: 'fa-solid fa-crown', resizable: true },
        position: { width: 1180, height: 820 },
        actions: {
            mode: VillainBuilder.#onMode,
            seat: VillainBuilder.#onSeat,
            moveSeat: VillainBuilder.#onMoveSeat,
            start: VillainBuilder.#onStart,
            draw: VillainBuilder.#onDraw,
            rollPrompt: VillainBuilder.#onRollPrompt,
            answer: VillainBuilder.#onAnswer,
            pass: VillainBuilder.#onPass,
            discard: VillainBuilder.#onDiscard,
            followUp: VillainBuilder.#onFollowUp,
            followAnswer: VillainBuilder.#onFollowAnswer,
            dropFollowUp: VillainBuilder.#onDropFollowUp,
            skipTurn: VillainBuilder.#onSkipTurn,
            reseat: VillainBuilder.#onReseat,
            finish: VillainBuilder.#onFinish,
            resume: VillainBuilder.#onResume,
            editEntry: VillainBuilder.#onEditEntry,
            journal: VillainBuilder.#onJournal,
            summon: VillainBuilder.#onSummon,
            reset: VillainBuilder.#onReset
        }
    };

    static PARTS = {
        main: { template: MODULE_TEMPLATES('villain-builder'), scrollable: ['.vb-log', '.vb-dossier', '.vb-followups'] }
    };

    /** Seating chosen in setup (GM only, local until the game starts). */
    seats = null;
    #rolling = false;
    #lastOpened = null;

    async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        const state = this.state;
        const isGM = game.user.isGM;
        const me = game.user.id;
        const turn = turnUser(state);

        // Setup
        this.seats ??= defaultSeats();
        const seatList = [...this.seats.map(id => game.users.get(id)).filter(Boolean), ...game.users.filter(u => !this.seats.includes(u.id))];
        const seats = seatList.map((u, i) => ({ ...person(u.id), seated: this.seats.includes(u.id), first: i === 0, last: i === this.seats.length - 1 }));

        // Play
        const nameOf = id => person(id).name;
        const order = state.order.map(id => ({ ...person(id), isTurn: id === turn && state.phase === 'play' }));
        const cur = state.current;
        const current = cur
            ? {
                  n: cur.n,
                  prompt: PROMPTS[cur.n],
                  by: person(cur.by),
                  mine: cur.by === me,
                  canAnswer: isGM || cur.by === me,
                  rolls: cur.rolls?.length > 1 ? cur.rolls.slice(0, -1).join(', ') : null,
                  fresh: this.#lastOpened !== cur.n,
                  passTargets: state.order.filter(id => id !== cur.by).map(person),
                  followUps: cur.followUps.map(f => ({ ...f, who: person(f.by), canAnswer: isGM || cur.by === me, canDrop: isGM || f.by === me }))
              }
            : null;
        this.#lastOpened = cur?.n ?? null;
        const canDraw = state.phase === 'play' && !cur && (isGM || turn === me);

        const log = state.log
            .map((e, index) => ({
                ...e,
                index,
                prompt: PROMPTS[e.n],
                who: person(e.by),
                discarded: e.status === 'discarded',
                followUps: (e.followUps ?? []).map(f => ({ ...f, who: nameOf(f.by) }))
            }))
            .reverse();

        const answered = answeredCount(state);
        const goal = state.mode === 'slips' ? answered + state.slips.length + (cur ? 1 : 0) : state.total;
        return Object.assign(ctx, {
            isGM,
            art: ART,
            phase: state.phase,
            mode: state.mode,
            isRoll: state.mode === 'roll',
            total: state.total,
            max: PROMPT_NUMBERS.length,
            seats,
            seatedCount: this.seats.length,
            order,
            turn: turn ? person(turn) : null,
            myTurn: turn === me,
            slips: state.slips.map(s => ({ ...s, canDraw })),
            canDraw,
            rolling: this.#rolling,
            current,
            log,
            answered,
            goal,
            progress: goal ? Math.round((answered / goal) * 100) : 0,
            left: Math.max(0, goal - answered),
            usedCount: usedPrompts(state).size,
            canResume: state.phase === 'done' && (state.mode === 'slips' ? state.slips.length > 0 : answered < state.total),
            rulesLink: await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@UUID[${HF_PAGES.queen}]{${L('Villain.RulesLink')}}`)
        });
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.restoreDrafts();
        const total = this.element.querySelector('input[name="total"]');
        total?.addEventListener('change', ev => dispatch('villain', 'configure', { total: Number(ev.currentTarget.value) }));
        const out = this.element.querySelector('.vb-total-out');
        total?.addEventListener('input', ev => out && (out.textContent = ev.currentTarget.value));
        // ctrl/cmd + enter submits an answer
        for (const field of this.element.querySelectorAll('textarea[data-submit]')) {
            field.addEventListener('keydown', ev => {
                if (ev.key !== 'Enter' || !(ev.ctrlKey || ev.metaKey)) return;
                ev.preventDefault();
                this.element.querySelector(`[data-action="${field.dataset.submit}"]${field.dataset.id ? `[data-id="${field.dataset.id}"]` : ''}`)?.click();
            });
        }
    }

    /** Put text back into a field after a refused request. */
    #restore(key, text) {
        this.drafts ??= {};
        this.drafts[key] = text;
        const el = this.element?.querySelector(`[data-keep="${key}"]`);
        if (el) el.value = text;
    }

    /* ---------------------------------------- */
    /*  Actions                                 */
    /* ---------------------------------------- */

    static #onMode(event, target) {
        dispatch('villain', 'configure', { mode: target.dataset.mode });
    }

    static #onSeat(event, target) {
        const id = target.dataset.user;
        this.seats = this.seats.includes(id) ? this.seats.filter(s => s !== id) : [...this.seats, id];
        this.render();
    }

    static #onMoveSeat(event, target) {
        const id = target.dataset.user;
        const i = this.seats.indexOf(id);
        const j = i + Number(target.dataset.dir);
        if (i < 0 || j < 0 || j >= this.seats.length) return;
        [this.seats[i], this.seats[j]] = [this.seats[j], this.seats[i]];
        this.render();
    }

    static async #onStart() {
        if (!this.seats.length) return ui.notifications.warn(L('Villain.NoSeats'));
        await dispatch('villain', 'start', { order: this.seats });
        broadcast('open', { app: 'villain' });
    }

    static #onDraw(event, target) {
        dispatch('villain', 'draw', { n: Number(target.dataset.n) });
    }

    /** Roll a d4 (tens) and a d10 (ones); reroll prompts that were already used. */
    static async #onRollPrompt() {
        if (this.#rolling) return;
        this.#rolling = true;
        this.render();
        try {
            const used = usedPrompts(this.state);
            if (used.size >= PROMPT_NUMBERS.length) return ui.notifications.warn(L('Refuse.Villain.NothingLeft'));
            const rolls = [];
            for (let tries = 0; tries < 30; tries++) {
                const roll = await new Roll('1d4 + 1d10').evaluate();
                const [d4, d10] = roll.dice.map(d => d.total);
                const n = promptNumber(d4, d10);
                rolls.push(n);
                const flavor = used.has(n) ? L('Villain.RolledUsed', { n }) : L('Villain.Rolled', { n });
                if (game.settings.get(MODULE_ID, 'rollsToChat')) await roll.toMessage({ flavor, speaker: ChatMessage.getSpeaker() });
                else if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                if (!used.has(n)) break;
            }
            const n = rolls.at(-1);
            if (used.has(n)) return;
            await dispatch('villain', 'draw', { n, rolls });
        } finally {
            this.#rolling = false;
            this.render();
        }
    }

    static async #onAnswer() {
        const n = this.state.current?.n;
        const field = this.element.querySelector(`[data-keep="answer-${n}"]`);
        const text = field?.value?.trim();
        if (!text) return ui.notifications.warn(L('Refuse.Villain.EmptyAnswer'));
        this.forgetDraft(`answer-${n}`);
        if ((await dispatch('villain', 'answer', { text })) == null) this.#restore(`answer-${n}`, text);
    }

    static #onPass(event, target) {
        const select = this.element.querySelector('select[name="passTo"]');
        const to = select?.value;
        if (!to) return;
        dispatch('villain', 'pass', { to });
    }

    static async #onDiscard() {
        const n = this.state.current?.n;
        if ((await dispatch('villain', 'discard')) != null) this.forgetDraft(`answer-${n}`);
    }

    static async #onFollowUp() {
        const n = this.state.current?.n;
        const field = this.element.querySelector(`[data-keep="follow-${n}"]`);
        const q = field?.value?.trim();
        if (!q) return;
        this.forgetDraft(`follow-${n}`);
        field.value = '';
        if ((await dispatch('villain', 'followUp', { q })) == null) this.#restore(`follow-${n}`, q);
    }

    static async #onFollowAnswer(event, target) {
        const id = target.dataset.id;
        const field = this.element.querySelector(`[data-keep="fa-${id}"]`);
        const a = field?.value ?? '';
        this.forgetDraft(`fa-${id}`);
        if ((await dispatch('villain', 'followAnswer', { id, a })) == null) this.#restore(`fa-${id}`, a);
    }

    static #onDropFollowUp(event, target) {
        dispatch('villain', 'dropFollowUp', { id: target.dataset.id });
    }

    static #onSkipTurn() {
        dispatch('villain', 'skipTurn');
    }

    static async #onReseat() {
        const seats = defaultSeats();
        this.seats = seats;
        await dispatch('villain', 'setOrder', { order: seats });
    }

    static #onFinish() {
        dispatch('villain', 'finish');
    }

    static #onResume() {
        dispatch('villain', 'resume');
    }

    static async #onEditEntry(event, target) {
        const index = Number(target.dataset.index);
        const entry = this.state.log[index];
        if (!entry) return;
        const text = await foundry.applications.api.DialogV2.prompt({
            window: { title: L('Villain.EditAnswer') },
            content: `<p><strong>${foundry.utils.escapeHTML(PROMPTS[entry.n])}</strong></p><textarea name="text" rows="6" style="width:100%">${foundry.utils.escapeHTML(entry.answer)}</textarea>`,
            ok: { label: L('Villain.Save'), callback: (ev, button) => button.form.elements.text.value }
        }).catch(() => null);
        if (text != null) dispatch('villain', 'editEntry', { index, text });
    }

    static async #onJournal() {
        const entry = await writeDossier(this.state, id => person(id).name);
        entry.sheet.render(true);
        ui.notifications.info(L('Villain.JournalWritten', { name: entry.name }));
    }

    static #onSummon() {
        broadcast('open', { app: 'villain' });
        ui.notifications.info(L('Summoned'));
    }

    static async #onReset() {
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Villain.Reset') },
            content: `<p>${L('Villain.ResetConfirm')}</p>`
        });
        if (!ok) return;
        this.drafts = {};
        await dispatch('villain', 'reset');
    }
}
