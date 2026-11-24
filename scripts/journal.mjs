/**
 * Journals written by the apps: the Astromancer's reading (with the players' whispered secrets on a
 * GM-only page) and the table's portrait of Forlorne from the Villain Builder.
 */
import { ART, HF_PAGES, L, MODULE_ID } from './constants.mjs';
import { ITEM_IDS, PROMPTS, REVELATIONS } from './data.mjs';
import { handle } from './relay.mjs';
import { chosen } from './state.mjs';

const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
const NONE = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;

const esc = s => foundry.utils.escapeHTML(String(s ?? ''));
const para = s =>
    esc(s)
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');

function findJournal(flag) {
    return game.journal.find(j => j.getFlag(MODULE_ID, 'kind') === flag) ?? null;
}

async function ensureJournal(flag, name, ownership) {
    let entry = findJournal(flag);
    if (!entry) {
        entry = await JournalEntry.create({ name, ownership, flags: { [MODULE_ID]: { kind: flag } } });
    } else if (ownership && entry.ownership.default !== ownership.default) {
        await entry.update({ 'ownership.default': ownership.default });
    }
    return entry;
}

async function upsertPage(entry, key, data) {
    data = foundry.utils.expandObject(data);
    const page = entry.pages.find(p => p.getFlag(MODULE_ID, 'page') === key);
    if (page) return page.update(data);
    return entry.createEmbeddedDocuments('JournalEntryPage', [{ ...data, flags: { [MODULE_ID]: { page: key } } }]);
}

/* ------------------------------------------------------------------ */
/*  The Astromancer's reading                                         */
/* ------------------------------------------------------------------ */

/** Rules text for one revelation, as HTML. */
export function revelationRule(key) {
    return L(`Sky.Rule.${key}`);
}

export function revelationEntryHTML(entry) {
    if (!entry) return '';
    const name = entry.uuid ? `@UUID[${entry.uuid}]{${esc(entry.name)}}` : esc(entry.name);
    return `<strong class="ns-entry-name">${name}</strong>${entry.text ? ` <span class="ns-entry-text">${esc(entry.text)}</span>` : ''}`;
}

/** Art of this module's own Keys to Victory, shown on their revelation page. */
const KEY_ART = { [ITEM_IDS.longsword]: ART.sword, [ITEM_IDS.zoetrope]: ART.zoetrope };

/** One journal page of the reading: the revelation's entry, its item and its rule. */
export function revelationPageHTML(key, index, entry) {
    const art = Object.entries(KEY_ART).find(([id]) => entry?.uuid?.endsWith(id))?.[1];
    return [
        `<p><em>${L(`Sky.Ordinal.${index + 1}`)}</em></p>`,
        art ? `<img src="${art}" alt="" style="float: right; max-width: 35%; max-height: 320px; margin: 0 0 8px 12px; border: none" />` : '',
        `<h2>${entry.uuid ? `@UUID[${entry.uuid}]{${esc(entry.name)}}` : esc(entry.name)}</h2>`,
        entry.text ? `<p>${esc(entry.text)}</p>` : '',
        `<blockquote><p>${revelationRule(key)}</p></blockquote>`,
        `<p>@UUID[${HF_PAGES.revelations}]{${L('Sky.Journal.Rules')}}</p>`
    ].join('');
}

/**
 * Write (or rewrite) the reading journal: the Astromancer's art with the intro, one page per revelation,
 * then the GM-only whispered secrets. Before the reveal only the GM can open it.
 */
export async function writeReading(state) {
    const entry = await ensureJournal('reading', L('Sky.Journal.Name'), { default: state.revealed ? OBSERVER : NONE });
    await upsertPage(entry, 'art', {
        name: L('Sky.Journal.Art'),
        type: 'image',
        src: ART.starReading,
        sort: 0,
        'image.caption': L('Sky.Journal.Intro'),
        title: { show: false, level: 1 }
    });
    // Versions before 0.2.0 kept all five revelations on one page.
    const old = entry.pages.filter(p => p.getFlag(MODULE_ID, 'page') === 'reading').map(p => p.id);
    if (old.length) await entry.deleteEmbeddedDocuments('JournalEntryPage', old);

    const picks = chosen(state);
    for (const [i, r] of REVELATIONS.entries()) {
        const pick = picks[r.key];
        const key = `revelation-${r.key}`;
        if (!pick?.entry) {
            const stale = entry.pages.find(p => p.getFlag(MODULE_ID, 'page') === key);
            if (stale) await stale.delete();
            continue;
        }
        await upsertPage(entry, key, {
            name: L(`Sky.Col.${r.key}`),
            type: 'text',
            'text.content': revelationPageHTML(r.key, i, pick.entry),
            sort: 100 * (i + 1),
            title: { show: true, level: 1 }
        });
    }
    const secrets = entry.pages.find(p => p.getFlag(MODULE_ID, 'page') === 'secrets');
    if (secrets && secrets.sort !== 900) await secrets.update({ sort: 900 });
    return entry;
}

/** The secrets players whispered to the GM (first revelation). GM only. */
export function listSecrets() {
    const entry = findJournal('reading');
    const page = entry?.pages.find(p => p.getFlag(MODULE_ID, 'page') === 'secrets');
    return page?.getFlag(MODULE_ID, 'secrets') ?? [];
}

handle('whisperSecret', async ({ text }, from) => {
    const secret = String(text ?? '').trim().slice(0, 2000);
    if (!secret) throw new Error(L('Refuse.Villain.EmptyAnswer'));
    const entry = await ensureJournal('reading', L('Sky.Journal.Name'), null);
    const list = [...listSecrets(), { by: from, text: secret, at: Date.now() }];
    const user = id => esc(game.users.get(id)?.character?.name ?? game.users.get(id)?.name ?? '?');
    const html = `<p><em>${L('Sky.Journal.SecretsIntro')}</em></p><ol>${list
        .map(s => `<li>${para(s.text)}<p class="wd-by">— ${user(s.by)}</p></li>`)
        .join('')}</ol>`;
    await upsertPage(entry, 'secrets', {
        name: L('Sky.Journal.Secrets'),
        type: 'text',
        'text.content': html,
        sort: 900,
        ownership: { default: NONE },
        [`flags.${MODULE_ID}.secrets`]: list
    });
    return list.length;
});

handle('forgetSecret', async ({ at }, from) => {
    if (!game.users.get(from)?.isGM) throw new Error(L('Refuse.GMOnly'));
    const entry = findJournal('reading');
    const page = entry?.pages.find(p => p.getFlag(MODULE_ID, 'page') === 'secrets');
    if (!page) return 0;
    const list = listSecrets().filter(s => s.at !== at);
    await page.update({ [`flags.${MODULE_ID}.secrets`]: list });
    return list.length;
});

export function openReadingJournal() {
    const entry = findJournal('reading');
    entry?.sheet.render(true);
    return entry;
}

/* ------------------------------------------------------------------ */
/*  The Villain Builder's portrait of Forlorne                        */
/* ------------------------------------------------------------------ */

export function dossierHTML(state, nameOf) {
    const answered = state.log.filter(e => e.status === 'answered');
    const parts = [`<p><em>${L('Villain.Journal.Intro')}</em></p>`];
    for (const e of answered) {
        parts.push(`<h3>${esc(PROMPTS[e.n])}</h3>`, `<blockquote>${para(e.answer)}<p class="wd-by">— ${esc(nameOf(e.by))}</p></blockquote>`);
        const follow = (e.followUps ?? []).filter(f => f.q);
        if (follow.length) {
            parts.push(
                `<ul>${follow
                    .map(f => `<li><strong>${esc(nameOf(f.by))}:</strong> ${esc(f.q)}${f.a ? `<br>${esc(f.a)}` : ''}</li>`)
                    .join('')}</ul>`
            );
        }
    }
    return parts.join('');
}

export async function writeDossier(state, nameOf) {
    const entry = await ensureJournal('villain', L('Villain.Journal.Name'), { default: OBSERVER });
    await upsertPage(entry, 'art', { name: L('Villain.Journal.Art'), type: 'image', src: ART.faun, sort: 0, title: { show: false, level: 1 } });
    await upsertPage(entry, 'dossier', { name: L('Villain.Journal.Dossier'), type: 'text', 'text.content': dossierHTML(state, nameOf), sort: 100 });
    return entry;
}
