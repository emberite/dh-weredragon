#!/usr/bin/env node
/**
 * Dev tool (not loaded by the module): builds data/packs.mjs into Daggerheart system documents,
 * writes them as JSON to src/<pack>/ and compiles them into the LevelDB compendiums in packs/.
 *
 *   npm run build
 *
 * Document ids are derived from names, so rebuilding keeps every UUID stable.
 * Standard adversary features (Relentless, Terrifying, Flying) follow the system's own SRD adversaries.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePack } from '@foundryvtt/foundryvtt-cli';
import { ADVERSARIES, CURSES, ITEMS, META } from '../data/packs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATS = { coreVersion: '14.370', systemId: 'daggerheart', systemVersion: '2.12.7', createdTime: null, modifiedTime: null, lastModifiedBy: null, compendiumSource: null, duplicateSource: null };
const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/** Stable 16-character id from a seed. */
function sid(...seed) {
    const hash = createHash('sha256').update(seed.join('/')).digest();
    return Array.from(hash.subarray(0, 16), b => ALNUM[b % ALNUM.length]).join('');
}

const attribution = () => ({ source: META.SOURCE, page: null, artist: '' });
const costs = cost => Object.entries(cost ?? {}).map(([key, value]) => ({ scalable: false, key, value, step: null, itemId: null, consumeOnSuccess: false }));

/** "2d10+3" → system damage value. */
function damageValue(formula, multiplier = 'flat') {
    const m = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(String(formula).trim());
    if (!m) return { custom: { enabled: true, formula: String(formula) }, multiplier: 'flat', flatMultiplier: 1, dice: 'd6', bonus: null };
    return {
        custom: { enabled: false, formula: '' },
        multiplier,
        flatMultiplier: Number(m[1]),
        dice: `d${m[2]}`,
        bonus: m[4] ? Number(m[3] === '-' ? -m[4] : m[4]) : null
    };
}

function damagePart(formula, dtype = 'physical') {
    return {
        value: damageValue(formula),
        applyTo: 'hitPoints',
        type: [dtype],
        base: false,
        resultBased: false,
        valueAlt: null,
        includeBase: false,
        direct: false,
        fullRestore: false,
        itemId: null
    };
}

function baseAction(id, name, img, extra = {}) {
    return {
        _id: id,
        type: 'effect',
        systemPath: 'actions',
        name,
        img,
        description: '',
        chatDisplay: true,
        actionType: 'action',
        cost: [],
        uses: { value: null, max: '', recovery: null, consumeOnSuccess: false },
        target: { type: 'any', amount: null },
        effects: [],
        range: '',
        areas: [],
        baseAction: false,
        originItem: { type: 'itemCollection' },
        triggers: [],
        ...extra
    };
}

function effectDoc(id, { name, img, statuses = [], changes = [], transfer = false, description = '' }, key) {
    return {
        _id: id,
        name,
        img,
        type: 'base',
        transfer,
        disabled: false,
        statuses,
        description,
        tint: '#ffffff',
        showIcon: 1,
        sort: 0,
        flags: {},
        system: { changes, duration: { description: '' }, rangeDependence: null, stacking: null, targetDispositions: [], conditionals: [] },
        duration: { value: null, units: 'seconds', expiry: null, expired: false },
        start: null,
        folder: null,
        _stats: STATS,
        _key: key
    };
}

/* ------------------------------------------------------------------ */
/*  Adversary features                                                */
/* ------------------------------------------------------------------ */

function featureDoc(actorId, f, effects = [], actions = {}, name = f.name) {
    const id = sid(actorId, 'feature', name);
    const key = `!actors.items!${actorId}.${id}`;
    return {
        _id: id,
        name,
        type: 'feature',
        img: f.img,
        system: { description: f.text, featureForm: f.form, actions, resource: null, attribution: {}, gmNotes: '', granter: null, actorResources: [] },
        effects: effects.map(e => ({ ...e, _key: `!actors.items.effects!${actorId}.${id}.${e._id}` })),
        folder: null,
        sort: 0,
        flags: f.flags ? { [META.MOD]: f.flags } : {},
        _stats: STATS,
        _key: key
    };
}

function standardFeature(actorId, f) {
    if (f.std === 'relentless') {
        const name = `Relentless (${f.n})`;
        const actionId = sid(actorId, name, 'action');
        return featureDoc(
            actorId,
            {
                form: 'passive',
                img: 'icons/magic/unholy/silhouette-evil-horned-giant.webp',
                text: `<p>The @Lookup[@name] can be spotlighted up to ${WORDS[f.n] ?? f.n} times per GM turn. Spend Fear as usual to spotlight them.</p>`
            },
            [],
            {
                [actionId]: baseAction(actionId, 'Spotlight: Relentless', 'icons/magic/unholy/silhouette-evil-horned-giant.webp', {
                    chatDisplay: false,
                    actionType: 'passive',
                    cost: costs({ fear: 1 }),
                    uses: { value: 0, max: String(f.n - 1), recovery: null, consumeOnSuccess: false }
                })
            },
            name
        );
    }
    if (f.std === 'terrifying') {
        const actionId = sid(actorId, 'Terrifying', 'action');
        return featureDoc(
            actorId,
            {
                form: 'passive',
                img: 'icons/magic/death/skull-energy-light-purple.webp',
                text: `<p>When the @Lookup[@name] makes a successful attack, all PCs within ${f.rangeLabel ?? 'Close'} range lose a Hope and you gain a Fear.</p>`
            },
            [],
            {
                [actionId]: baseAction(actionId, '', undefined, {
                    type: 'damage',
                    damage: {
                        main: null,
                        resources: {
                            hope: {
                                base: false,
                                applyTo: 'hope',
                                resultBased: false,
                                fullRestore: false,
                                value: { multiplier: 'flat', flatMultiplier: 0, dice: 'd6', bonus: 1, custom: { enabled: false, formula: '' } },
                                valueAlt: null,
                                itemId: null
                            }
                        }
                    },
                    areas: [{ name: 'Terrifying', type: 'placed', shape: 'emanation', size: f.range ?? 'close', hasHole: false, effects: [] }]
                })
            },
            'Terrifying'
        );
    }
    if (f.std === 'flying') {
        const effectId = sid(actorId, 'Flying', 'effect');
        return featureDoc(
            actorId,
            { form: 'passive', img: 'icons/commodities/biological/wing-lizard-brown.webp', text: '<p>While flying, the @Lookup[@name] gains a +3 bonus to their Difficulty.</p>' },
            [
                effectDoc(effectId, {
                    name: 'Flying',
                    img: 'icons/commodities/biological/wing-lizard-brown.webp',
                    transfer: true,
                    changes: [{ key: 'system.difficulty', value: 3, priority: null, type: 'add', phase: 'initial' }],
                    description: '<p>While flying, the @Lookup[@name] gains a +3 bonus to their Difficulty.</p>'
                })
            ],
            {},
            'Flying'
        );
    }
    throw new Error(`Unknown standard feature ${f.std}`);
}

function customFeature(actorId, f) {
    if (!f.act) return featureDoc(actorId, f);
    const a = f.act;
    const actionId = sid(actorId, f.name, 'action');
    const effects = [];
    const action = baseAction(actionId, f.name, f.img, {
        type: a.type === 'save' ? 'attack' : a.type,
        actionType: f.form === 'reaction' ? 'reaction' : 'action',
        cost: costs(a.cost),
        range: a.range ?? ''
    });
    if (a.damage || a.type === 'damage') action.damage = { main: a.damage ? damagePart(a.damage, a.dtype) : null, resources: {} };
    if (a.type === 'attack' || a.type === 'save') {
        action.roll = {
            type: a.type === 'attack' ? 'attack' : null,
            trait: null,
            difficulty: null,
            bonus: null,
            advState: 'neutral',
            diceRolling: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', compare: null, treshold: null },
            useDefault: false
        };
        action.save = { trait: a.type === 'save' ? a.save : null, difficulty: null, damageMod: 'none' };
    }
    if (a.area) action.areas = [{ name: f.name, type: 'placed', shape: 'emanation', size: a.area, hasHole: false, effects: [] }];
    if (a.effect) {
        const effectId = sid(actorId, f.name, 'effect');
        effects.push(effectDoc(effectId, { name: a.effect.name ?? f.name, img: a.effect.img ?? f.img, statuses: a.effect.statuses, changes: a.effect.changes ?? [] }));
        action.effects = [{ _id: effectId, onSave: false }];
    }
    return featureDoc(actorId, f, effects, { [actionId]: action });
}

function adversaryDoc(def) {
    const id = def._id;
    const atk = def.attack;
    const items = def.features.map(f => (f.std ? standardFeature(id, f) : customFeature(id, f)));
    return {
        _id: id,
        name: def.name,
        type: 'adversary',
        img: def.img,
        system: {
            difficulty: def.difficulty,
            damageThresholds: { major: def.thresholds[0], severe: def.thresholds[1] },
            resources: { hitPoints: { value: 0, max: def.hp }, stress: { value: 0, max: def.stress } },
            motivesAndTactics: def.motives,
            resistance: {
                physical: { resistance: false, immunity: false, reduction: 0 },
                magical: { resistance: false, immunity: false, reduction: 0 }
            },
            type: def.type,
            notes: def.notes ?? '',
            experiences: Object.fromEntries((def.experiences ?? []).map(([name, value]) => [sid(id, 'experience', name), { name, value, description: '' }])),
            tier: def.tier,
            description: def.description,
            attack: {
                name: atk.name,
                range: atk.range,
                roll: {
                    bonus: atk.bonus,
                    type: 'attack',
                    trait: null,
                    difficulty: null,
                    advState: 'neutral',
                    diceRolling: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', compare: null, treshold: null },
                    useDefault: false
                },
                damage: { main: { ...damagePart(atk.damage, atk.dtype ?? 'physical'), valueAlt: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', bonus: null, custom: { enabled: false, formula: '' } } }, resources: {} },
                _id: sid(id, 'attack'),
                systemPath: 'attack',
                type: 'attack',
                description: '',
                img: atk.img,
                chatDisplay: false,
                actionType: 'action',
                cost: [],
                uses: { value: null, max: null, recovery: null, consumeOnSuccess: false },
                target: { type: 'any', amount: 1 },
                effects: [],
                save: { trait: null, difficulty: null, damageMod: 'none' },
                baseAction: true,
                originItem: { type: 'itemCollection' },
                triggers: [],
                areas: []
            },
            attribution: attribution(),
            size: def.size,
            advantageSources: [],
            disadvantageSources: [],
            criticalThreshold: 20,
            typeData: null
        },
        prototypeToken: {
            name: def.name.replace(/\s*\(.*\)$/, ''),
            displayName: 20,
            displayBars: 20,
            actorLink: false,
            width: def.tokenSize,
            height: def.tokenSize,
            disposition: -1,
            texture: { src: def.img, fit: 'contain', anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1 },
            ring: { enabled: false }
        },
        items,
        effects: [],
        folder: null,
        sort: 0,
        ownership: { default: 0 },
        flags: def.form ? { [META.MOD]: { form: def.form } } : {},
        _stats: STATS,
        _key: `!actors!${id}`
    };
}

/* ------------------------------------------------------------------ */
/*  Items and curses                                                  */
/* ------------------------------------------------------------------ */

function breakerAction(item) {
    const b = item.breaker;
    return baseAction(b.id, b.name, b.img, { range: b.range ?? 'melee', target: { type: 'any', amount: null } });
}

function itemDoc(def) {
    const id = def._id;
    const actions = def.breaker ? { [def.breaker.id]: breakerAction(def) } : {};
    const flags = def.breaker ? { [META.MOD]: { curseBreaker: { action: def.breaker.id } } } : {};
    const base = {
        _id: id,
        name: def.name,
        type: def.type,
        img: def.img,
        effects: [],
        folder: null,
        sort: 0,
        ownership: { default: 0 },
        flags,
        _stats: STATS,
        _key: `!items!${id}`
    };
    if (def.type === 'loot') {
        base.system = { description: def.description, quantity: 1, actions, attribution: attribution(), gmNotes: '' };
        return base;
    }
    base.system = {
        description: def.description,
        actions,
        tier: def.tier,
        equipped: false,
        secondary: false,
        burden: def.burden,
        attack: {
            name: 'Attack',
            img: 'icons/skills/melee/blood-slash-foam-red.webp',
            _id: sid(id, 'attack'),
            baseAction: true,
            systemPath: 'attack',
            type: 'attack',
            range: def.range,
            target: { type: 'any', amount: 1 },
            roll: {
                trait: def.trait,
                type: 'attack',
                difficulty: null,
                bonus: null,
                advState: 'neutral',
                diceRolling: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', compare: null, treshold: null },
                useDefault: false
            },
            damage: {
                main: {
                    value: { dice: def.damage.dice, bonus: def.damage.bonus, multiplier: 'prof', flatMultiplier: 1, custom: { enabled: false, formula: '' } },
                    type: [def.damage.type],
                    applyTo: 'hitPoints',
                    resultBased: false,
                    valueAlt: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', bonus: null, custom: { enabled: false, formula: '' } },
                    base: false,
                    includeBase: false,
                    direct: false,
                    fullRestore: false,
                    itemId: null
                },
                resources: {}
            },
            description: '',
            chatDisplay: false,
            actionType: 'action',
            cost: [],
            uses: { value: null, max: null, recovery: null, consumeOnSuccess: false },
            effects: [],
            save: { trait: null, difficulty: null, damageMod: 'none' },
            originItem: { type: 'itemCollection' },
            triggers: [],
            areas: []
        },
        rules: { attack: { roll: { trait: null } } },
        attribution: attribution(),
        gmNotes: '',
        resource: null,
        quantity: 1,
        itemFeatures: {}
    };
    return base;
}

function curseDoc(def) {
    const id = def._id;
    const effectId = sid(id, 'effect');
    return {
        _id: id,
        name: def.name,
        type: 'feature',
        img: def.img,
        system: { description: def.description, featureForm: 'passive', actions: {}, resource: null, attribution: attribution(), gmNotes: '', granter: null, actorResources: [] },
        effects: [
            {
                ...effectDoc(effectId, { name: def.name, img: def.img, statuses: def.statuses, changes: def.changes, transfer: true }),
                _key: `!items.effects!${id}.${effectId}`
            }
        ],
        folder: null,
        sort: 0,
        ownership: { default: 0 },
        flags: { [META.MOD]: { curse: def.status } },
        _stats: STATS,
        _key: `!items!${id}`
    };
}

/* ------------------------------------------------------------------ */
/*  Write and compile                                                 */
/* ------------------------------------------------------------------ */

const fileName = doc => `${doc.name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')}_${doc._id}.json`;

async function writePack(name, docs) {
    const src = path.join(ROOT, 'src', name);
    await rm(src, { recursive: true, force: true });
    await mkdir(src, { recursive: true });
    for (const doc of docs) await writeFile(path.join(src, fileName(doc)), `${JSON.stringify(doc, null, 2)}\n`);
    const dest = path.join(ROOT, 'packs', name);
    await rm(dest, { recursive: true, force: true });
    await compilePack(src, dest, { log: false });
    const files = await readdir(dest);
    console.log(`${name}: ${docs.length} documents → packs/${name} (${files.length} files)`);
}

await writePack('weredragon-adversaries', ADVERSARIES.map(adversaryDoc));
await writePack('weredragon-items', ITEMS.map(itemDoc));
await writePack('weredragon-curses', CURSES.map(curseDoc));
