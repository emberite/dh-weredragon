/**
 * Night Sky Reading: the Astromancer's reading at Heaven's Eye.
 * The players roll 5d6 together, the GM places each die in a revelation column (the die picks the row),
 * then reveals the five revelations to everyone and writes them to a journal.
 */
import { ART, HF_PAGES, L, MODULE_ID } from './constants.mjs';
import { NIGHT_SKY, REVELATIONS } from './data.mjs';
import { MODULE_TEMPLATES, WeredragonApp, person } from './app-base.mjs';
import { dispatch } from './store.mjs';
import { broadcast, request } from './relay.mjs';
import { ALLY_HOPE, DICE, chosen, crowdedPlaces, skyEntry } from './state.mjs';
import { listSecrets, openReadingJournal, revelationEntryHTML, revelationRule, writeReading } from './journal.mjs';

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pips = v => Array.from({ length: 9 }, (_, i) => PIPS[v]?.includes(i));

/** Roll d6s for the reading, shown in 3D and/or in chat. */
async function rollD6(count) {
    const roll = await new Roll(`${count}d6`).evaluate();
    if (game.settings.get(MODULE_ID, 'rollsToChat')) {
        await roll.toMessage({ flavor: L('Sky.RollFlavor'), speaker: ChatMessage.getSpeaker() });
    } else if (game.dice3d) {
        await game.dice3d.showForRoll(roll, game.user, true);
    }
    return roll.dice[0].results.map(r => r.result);
}

export class NightSkyReading extends WeredragonApp {
    static STORE = 'nightSky';

    static DEFAULT_OPTIONS = {
        id: 'dh-weredragon-night-sky',
        classes: ['dh-weredragon', 'wd-night-sky'],
        window: { title: 'DHWD.Sky.Title', icon: 'fa-solid fa-star-and-crescent', resizable: true },
        position: { width: 1180, height: 820 },
        actions: {
            rollOne: NightSkyReading.#onRollOne,
            rollAll: NightSkyReading.#onRollAll,
            selectDie: NightSkyReading.#onSelectDie,
            cell: NightSkyReading.#onCell,
            column: NightSkyReading.#onColumn,
            autoAssign: NightSkyReading.#onAutoAssign,
            clearDice: NightSkyReading.#onClearDice,
            rerollDie: NightSkyReading.#onRerollDie,
            toggleEdit: NightSkyReading.#onToggleEdit,
            resetTable: NightSkyReading.#onResetTable,
            reveal: NightSkyReading.#onReveal,
            conceal: NightSkyReading.#onConceal,
            switchTab: NightSkyReading.#onTab,
            spendHope: NightSkyReading.#onSpendHope,
            refillHope: NightSkyReading.#onRefillHope,
            prepare: NightSkyReading.#onPrepare,
            whisper: NightSkyReading.#onWhisper,
            forgetSecret: NightSkyReading.#onForgetSecret,
            summon: NightSkyReading.#onSummon,
            journal: NightSkyReading.#onJournal,
            reset: NightSkyReading.#onReset
        }
    };

    static PARTS = {
        main: { template: MODULE_TEMPLATES('night-sky'), scrollable: ['.ns-revelations', '.ns-secrets-list'] }
    };

    selected = null;
    editing = false;
    tab = null;
    #wasRevealed = null;
    #rolling = false;

    async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        const state = this.state;
        const isGM = game.user.isGM;
        const justRevealed = this.#wasRevealed === false && state.revealed;
        if (justRevealed) this.tab = 'revelations';
        if (!state.revealed && this.tab === 'revelations') this.tab = 'sky';
        this.#wasRevealed = state.revealed;
        const tab = this.tab ?? (state.revealed ? 'revelations' : 'sky');

        const placedIn = Object.fromEntries(Object.entries(state.assign).map(([col, id]) => [id, col]));
        if (this.selected && !state.dice.some(d => d.id === this.selected)) this.selected = null;
        const dice = state.dice.map(d => ({
            ...d,
            pips: pips(d.value),
            who: person(d.by),
            placed: placedIn[d.id] ?? null,
            placedLabel: placedIn[d.id] ? L(`Sky.Col.${placedIn[d.id]}`) : null,
            selected: this.selected === d.id
        }));
        const empty = Array.from({ length: Math.max(0, DICE - dice.length) }, (_, i) => ({ index: dice.length + i }));

        const showChoices = isGM || state.revealed;
        const values = new Set(state.dice.map(d => d.value));
        const crowded = crowdedPlaces(state);
        const crowdedSet = new Set(crowded.flatMap(c => c.keys.map(k => `${state.dice.find(d => d.id === state.assign[k])?.value}.${k}`)));
        const columns = REVELATIONS.map((r, i) => {
            const die = dice.find(d => d.id === state.assign[r.key]);
            return {
                ...r,
                ordinal: L(`Sky.Ordinal.${i + 1}`),
                label: L(`Sky.Col.${r.key}`),
                filled: !!die && showChoices,
                die: showChoices ? die : null
            };
        });
        const rows = NIGHT_SKY.map((row, i) => {
            const value = i + 1;
            return {
                value,
                pips: pips(value),
                rolled: values.has(value),
                cells: REVELATIONS.map(r => {
                    const entry = skyEntry(state, r.key, value);
                    const die = showChoices ? dice.find(d => d.id === state.assign[r.key] && d.value === value) : null;
                    return {
                        col: r.key,
                        value,
                        name: entry.name,
                        text: entry.text,
                        custom: !!entry.custom,
                        unique: !!entry.unique,
                        die,
                        chosen: !!die,
                        crowded: !!die && crowdedSet.has(`${value}.${r.key}`),
                        open: isGM && !state.revealed && values.has(value)
                    };
                })
            };
        });

        const picks = chosen(state);
        const revelations = [];
        if (state.revealed) {
            for (const [i, r] of REVELATIONS.entries()) {
                const pick = picks[r.key];
                revelations.push({
                    ...r,
                    ordinal: L(`Sky.Ordinal.${i + 1}`),
                    label: L(`Sky.Col.${r.key}`),
                    value: pick?.value,
                    pips: pips(pick?.value),
                    name: pick?.entry?.name,
                    entryHTML: await foundry.applications.ux.TextEditor.implementation.enrichHTML(revelationEntryHTML(pick?.entry)),
                    ruleHTML: revelationRule(r.key),
                    isSecret: r.key === 'secret',
                    isAlly: r.key === 'ally',
                    isShowdown: r.key === 'showdown'
                });
            }
        }
        const prepared = ['secret', 'ally', 'key1', 'key2'].map(key => ({ key, label: L(`Sky.Prepared.${key}`), checked: !!state.prepared[key] }));

        const secrets = isGM ? listSecrets().map(s => ({ ...s, who: person(s.by) })) : [];
        const allAssigned = REVELATIONS.every(r => state.assign[r.key]);
        const phase = state.revealed ? 'revealed' : dice.length < DICE ? 'roll' : 'read';

        return Object.assign(ctx, {
            isGM,
            art: ART,
            justRevealed,
            phase,
            steps: ['roll', 'read', 'revealed'].map((key, i) => ({ key, n: i + 1, label: L(`Sky.Step.${key}`), active: key === phase, done: ['roll', 'read', 'revealed'].indexOf(phase) > i })),
            tab,
            dice,
            empty,
            left: DICE - dice.length,
            canRoll: !state.revealed && dice.length < DICE && !this.#rolling,
            columns,
            rows,
            crowded: isGM ? crowded.map(c => ({ place: c.place, labels: c.keys.map(k => L(`Sky.Col.${k}`)).join(' & ') })) : [],
            allAssigned,
            unplaced: dice.filter(d => !d.placed).length,
            editing: isGM && this.editing && !state.revealed,
            hasOverrides: Object.keys(state.overrides).length > 0,
            revealed: state.revealed,
            revelations,
            allyHope: Array.from({ length: ALLY_HOPE }, (_, i) => ({ filled: i < state.allyHope })),
            allyHopeLeft: state.allyHope,
            prepared,
            allPrepared: prepared.every(p => p.checked),
            secrets,
            rulesLink: await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@UUID[${HF_PAGES.nightSky}]{${L('Sky.RulesLink')}}`)
        });
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.restoreDrafts();
        this.#drawConstellation();
        this.#bindDragDrop();
        for (const input of this.element.querySelectorAll('.ns-cell-edit')) {
            input.addEventListener('change', ev => {
                const el = ev.currentTarget;
                dispatch('nightSky', 'override', { value: Number(el.dataset.value), col: el.dataset.col, text: el.value });
            });
        }
    }

    /** Draw lines between the chosen cells, column by column, like a constellation. */
    #drawConstellation() {
        const wrap = this.element.querySelector('.ns-table-wrap');
        const svg = wrap?.querySelector('svg.ns-constellation');
        if (!wrap || !svg) return;
        const box = wrap.getBoundingClientRect();
        const points = [...wrap.querySelectorAll('.ns-cell.chosen .ns-die')]
            .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
            .map(el => {
                const r = el.getBoundingClientRect();
                return [r.left + r.width / 2 - box.left + wrap.scrollLeft, r.top + r.height / 2 - box.top + wrap.scrollTop];
            });
        svg.setAttribute('viewBox', `0 0 ${wrap.scrollWidth} ${wrap.scrollHeight}`);
        svg.style.width = `${wrap.scrollWidth}px`;
        svg.style.height = `${wrap.scrollHeight}px`;
        const line = points.map(p => p.join(',')).join(' ');
        svg.innerHTML = points.length > 1 ? `<polyline class="ns-line" points="${line}"/><polyline class="ns-line-glow" points="${line}"/>` : '';
    }

    #bindDragDrop() {
        if (!game.user.isGM) return;
        for (const die of this.element.querySelectorAll('.ns-tray .ns-die[data-die]')) {
            die.setAttribute('draggable', 'true');
            die.addEventListener('dragstart', ev => {
                ev.dataTransfer.setData('text/plain', JSON.stringify({ wdDie: die.dataset.die }));
                ev.dataTransfer.effectAllowed = 'move';
            });
        }
        for (const target of this.element.querySelectorAll('[data-drop-col]')) {
            target.addEventListener('dragover', ev => {
                ev.preventDefault();
                target.classList.add('drop-hover');
            });
            target.addEventListener('dragleave', () => target.classList.remove('drop-hover'));
            target.addEventListener('drop', ev => {
                ev.preventDefault();
                target.classList.remove('drop-hover');
                let data;
                try {
                    data = JSON.parse(ev.dataTransfer.getData('text/plain'));
                } catch {
                    return;
                }
                if (data?.wdDie) this.#assign(data.wdDie, target.dataset.dropCol);
            });
        }
    }

    async #assign(die, col) {
        this.selected = null;
        await dispatch('nightSky', 'assign', { die, col });
    }

    /* ---------------------------------------- */
    /*  Actions                                 */
    /* ---------------------------------------- */

    async #roll(count) {
        if (this.#rolling) return;
        this.#rolling = true;
        this.render();
        try {
            const values = await rollD6(count);
            for (const value of values) {
                if ((await dispatch('nightSky', 'roll', { value })) == null) break;
            }
        } finally {
            this.#rolling = false;
            this.render();
        }
    }

    static #onRollOne() {
        this.#roll(1);
    }

    static #onRollAll() {
        this.#roll(Math.max(1, DICE - this.state.dice.length));
    }

    static #onSelectDie(event, target) {
        if (!game.user.isGM || this.state.revealed) return;
        const id = target.dataset.die;
        this.selected = this.selected === id ? null : id;
        this.render();
    }

    /** Click a cell: place the selected die (or a free die with that number) in this column. Click again to take it out. */
    static #onCell(event, target) {
        if (!game.user.isGM || this.editing) return;
        const state = this.state;
        if (state.revealed) return;
        const col = target.dataset.col;
        const value = Number(target.dataset.value);
        const current = state.dice.find(d => d.id === state.assign[col]);
        if (current && current.value === value && !this.selected) return dispatch('nightSky', 'unassign', { col });
        const placed = new Set(Object.values(state.assign));
        const selected = state.dice.find(d => d.id === this.selected);
        const die =
            (selected?.value === value ? selected : null) ??
            state.dice.find(d => d.value === value && !placed.has(d.id)) ??
            state.dice.find(d => d.value === value);
        if (!die) return ui.notifications.info(L('Sky.NoDieForRow', { value }));
        this.#assign(die.id, col);
    }

    static #onColumn(event, target) {
        if (!game.user.isGM || !this.selected) return;
        this.#assign(this.selected, target.dataset.col);
    }

    static #onAutoAssign() {
        dispatch('nightSky', 'autoAssign');
    }

    static async #onClearDice() {
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Sky.ClearDice') },
            content: `<p>${L('Sky.ClearDiceConfirm')}</p>`
        });
        if (ok) dispatch('nightSky', 'clearDice');
    }

    static async #onRerollDie(event, target) {
        event.stopPropagation();
        const [value] = await rollD6(1);
        dispatch('nightSky', 'reroll', { die: target.dataset.die, value });
    }

    static #onToggleEdit() {
        this.editing = !this.editing;
        this.render();
    }

    static #onResetTable() {
        dispatch('nightSky', 'resetOverrides');
    }

    static async #onReveal() {
        const rev = await dispatch('nightSky', 'reveal');
        if (rev == null) return;
        const state = this.state;
        try {
            const entry = await writeReading(state);
            await ChatMessage.create({
                speaker: { alias: L('Sky.Astromancer') },
                content: await renderTemplate(MODULE_TEMPLATES('chat-reading'), {
                    art: ART.starReading,
                    items: REVELATIONS.map((r, i) => {
                        const pick = chosen(state)[r.key];
                        return { icon: r.icon, label: L(`Sky.Col.${r.key}`), ordinal: L(`Sky.Ordinal.${i + 1}`), name: pick?.entry?.name };
                    }),
                    link: await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@UUID[${entry.uuid}]{${L('Sky.Journal.Open')}}`)
                })
            });
        } catch (err) {
            console.error(`${MODULE_ID} | reading journal`, err);
        }
        broadcast('open', { app: 'nightSky' });
    }

    static async #onConceal() {
        await dispatch('nightSky', 'conceal');
        writeReading(this.state).catch(() => {});
    }

    static #onTab(event, target) {
        this.tab = target.dataset.tab;
        this.render();
    }

    static #onSpendHope() {
        dispatch('nightSky', 'spendAllyHope');
    }

    static #onRefillHope() {
        dispatch('nightSky', 'refillAllyHope');
    }

    static #onPrepare(event, target) {
        if (!game.user.isGM) return;
        dispatch('nightSky', 'prepare', { key: target.dataset.key, value: !this.state.prepared[target.dataset.key] });
    }

    static async #onWhisper() {
        const field = this.element.querySelector('[data-keep="secret"]');
        const text = field?.value?.trim();
        if (!text) return;
        this.forgetDraft('secret');
        field.value = '';
        try {
            await request('whisperSecret', { text });
            ui.notifications.info(L('Sky.Whispered'));
            if (game.user.isGM) this.render();
        } catch (err) {
            this.drafts ??= {};
            this.drafts.secret = text;
            const el = this.element?.querySelector('[data-keep="secret"]');
            if (el) el.value = text;
            ui.notifications.warn(err.message);
        }
    }

    static async #onForgetSecret(event, target) {
        await request('forgetSecret', { at: Number(target.dataset.at) });
        this.render();
    }

    static #onSummon() {
        broadcast('open', { app: 'nightSky' });
        ui.notifications.info(L('Summoned'));
    }

    static async #onJournal() {
        if (game.user.isGM) await writeReading(this.state);
        if (!openReadingJournal()) ui.notifications.info(L('Sky.NoJournal'));
    }

    static async #onReset() {
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Sky.Reset') },
            content: `<p>${L('Sky.ResetConfirm')}</p>`
        });
        if (!ok) return;
        this.selected = null;
        this.tab = 'sky';
        dispatch('nightSky', 'reset');
    }
}

const renderTemplate = (path, data) => foundry.applications.handlebars.renderTemplate(path, data);
