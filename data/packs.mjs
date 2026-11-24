/**
 * Compendium content of the Reign of the Weredragon campaign frame (Hope & Fear, chapter 4).
 * Source for tools/build-packs.mjs, which turns it into Daggerheart system documents.
 *
 * Feature shorthand (as in Hotpot):
 *   { std: 'relentless', n } | { std: 'terrifying', range } | { std: 'flying' }
 *   { name, form: 'passive'|'action'|'reaction', img, text, flags?, act?: {
 *       type: 'attack'|'damage'|'save'|'effect', cost: {stress|fear|hope: n}, damage: '2d8+7',
 *       dtype: 'physical'|'magical', range, save: trait, effect: { statuses, changes } } }
 */

const HF = 'modules/daggerheart-hope-and-fear/assets/art/book';
export const ART = {
    faun: `${HF}/weredragon-forlornefaun.webp`,
    dragon: `${HF}/weredragon-forlornedragon.webp`,
    weredrake: `${HF}/weredragon-weredrake-12-10-25.webp`,
    sword: `${HF}/weredragon-item-lavendersword.webp`,
    zoetrope: `${HF}/weredragon-item-zoetrope.webp`
};

const MOD = 'dh-weredragon';
const SOURCE = 'Daggerheart: Hope & Fear';
const PETRIFIED_CHANGES = ['major', 'severe'].map(k => ({ key: `system.damageThresholds.${k}`, value: 10, priority: null, type: 'add', phase: 'initial' }));
const WEREDRAKE_LINK = `@UUID[Compendium.${MOD}.weredragon-adversaries.Actor.dhwdWeredrake000]{Weredrake}`;

const PETRIFIED_TEXT =
    'Until this condition is cleared, the target and the equipment they’re wearing or carrying turn to stone. While under the <em>Petrified Curse</em>, the target is <em>Restrained</em> and <em>Vulnerable</em>, can’t act, and gains a <strong>+10</strong> bonus to their damage thresholds.';
const WEREDRAKE_TEXT = `While under the <em>Weredrake Curse</em>, the target drops their equipment and loot and transforms into a ${WEREDRAKE_LINK} adversary under the GM’s control. After this condition is cleared, the target retains no memory of their time as a weredrake.`;
const CLEARING =
    '<p>A Cursed condition can be cleared only by magic from a spell, ritual, magic item, location, supernatural occurrence, higher power, or some combination of these options. Lady Lavender’s Longsword and the Zoetrope of the Bright Bacchanal both end curses.</p>';

/* ------------------------------------------------------------------ */
/*  Adversaries                                                       */
/* ------------------------------------------------------------------ */

const FRAMEWORK = [
    { std: 'relentless', n: 4 },
    {
        name: 'Transform',
        form: 'action',
        img: 'icons/magic/control/silhouette-grow-shrink-tan.webp',
        text: '<p><strong>Mark a Stress</strong> to have Forlorne shift between her Dragon Form and Faun Form. While she embodies a form, she uses its statistics and features.</p>',
        flags: { transform: true },
        act: { type: 'effect', cost: { stress: 1 } }
    },
    {
        name: 'Feed on Fear',
        form: 'reaction',
        img: 'icons/magic/control/fear-fright-mask-orange.webp',
        text: '<p>When a PC within Close range fails with Fear, Forlorne can clear a HP or a Stress.</p>'
    }
];

const FORLORNE_BASE = {
    tier: 4,
    type: 'solo',
    hp: 11,
    stress: 8,
    motives: 'Ascend to the stars, learn new magic, rule through terror, transform',
    experiences: [
        ['Arcane Knowledge', 5],
        ['Death from Above', 5]
    ]
};

const FORLORNE_NOTES = `<p>Forlorne has multiple stat blocks: the framework (HP, Stress, Experiences, Relentless, Transform and Feed on Fear) is used regardless of her form, plus one for her Dragon Form and one for her Faun Form. Using <strong>Transform</strong> swaps her token to the other form.</p>
<p>Before the players reach the final battle with Forlorne at the end of the campaign, any violent confrontations the PCs have with her don’t use her stat block. Instead, she laughs in the face of attacks and disappears from the scene at the first opportunity, leaving behind utter destruction.</p>
<p>At the Showdown Location of the Astromancer’s reading, if the PCs arrive with the secret, the ally and both Keys to Victory, Forlorne appears alone, and <strong>Feed on Fear</strong> and <strong>Terrifying</strong> aren’t available while she’s there.</p>`;

export const ADVERSARIES = [
    {
        _id: 'dhwdForlorneFaun',
        name: 'Forlorne Lykona (Faun Form)',
        img: ART.faun,
        form: 'faun',
        ...FORLORNE_BASE,
        size: 'medium',
        tokenSize: 1,
        description:
            '<p>Statuesque in her faun form, grotesquely beautiful in her purple-scaled dragon form, the weredragon queen uses magic to defeat all who threaten her rule.</p><p><em>Faun Form:</em> This form reflects Forlorne’s devilish charm, civility, and cunning. This is her original body and the shape she is most familiar with. She takes this form while overseeing the affairs of her realm, and it is the form the PCs are most likely to interact with outside combat.</p>',
        difficulty: 18,
        thresholds: [35, 70],
        attack: { name: 'Eldritch Incantation', range: 'far', bonus: 6, damage: '4d8+14', dtype: 'magical', img: 'icons/magic/unholy/hand-claw-fire-green.webp' },
        features: [
            ...FRAMEWORK,
            {
                name: 'Battle Teleport',
                form: 'passive',
                img: 'icons/skills/movement/portal-silhouette-pink.webp',
                text: '<p>Before or after making a standard attack, you can <strong>mark a Stress</strong> to have Forlorne teleport to a location within Far range.</p>',
                act: { type: 'effect', cost: { stress: 1 }, range: 'far' }
            },
            {
                name: 'Grasping Vines',
                form: 'action',
                img: 'icons/magic/nature/plant-vines-skull-green.webp',
                text: '<p><strong>Spend a Fear</strong> to target a group within Far range. Each target must succeed on an Agility Reaction Roll or take <strong>2d8+7</strong> magic damage and become <em>Restrained</em> until they break free with a successful Strength Roll. The vines last until Forlorne takes Severe damage, uses this feature again, or ends the effect.</p>',
                act: { type: 'save', save: 'agility', range: 'far', cost: { fear: 1 }, damage: '2d8+7', dtype: 'magical', effect: { statuses: ['restrained'] } }
            },
            {
                name: 'Stone-Cold Gaze',
                form: 'reaction',
                img: 'icons/magic/perception/eye-ringed-glow-angry-large-teal.webp',
                text: `<p>When Forlorne takes damage from an attack within Close range, you can <strong>spend 2 Fear</strong> to force the attacker to make an Instinct Reaction Roll. On a failure, the target must spend 3 Hope or gain the <em>Petrified Curse</em>. ${PETRIFIED_TEXT}</p>`,
                act: {
                    type: 'save',
                    save: 'instinct',
                    range: 'close',
                    cost: { fear: 2 },
                    effect: { name: 'Petrified Curse', statuses: ['petrifiedCurse', 'restrained', 'vulnerable'], changes: PETRIFIED_CHANGES, img: 'icons/magic/earth/strike-body-stone-crumble.webp' }
                }
            }
        ]
    },
    {
        _id: 'dhwdForlorneDrgn',
        name: 'Forlorne Lykona (Dragon Form)',
        img: ART.dragon,
        form: 'dragon',
        ...FORLORNE_BASE,
        size: 'huge',
        tokenSize: 3,
        description:
            '<p>Statuesque in her faun form, grotesquely beautiful in her purple-scaled dragon form, the weredragon queen uses magic to defeat all who threaten her rule.</p><p><em>Dragon Form:</em> This form reflects Forlorne’s mercilessness and intolerance as she uses the shape of the once-peaceful dragon Sazanthe to drive fear into her people. While in dragon form, Forlorne is rapacious and terrifying, having cast off the trappings of civility and regality to indulge her primal cravings.</p>',
        difficulty: 20,
        thresholds: [40, 80],
        attack: { name: 'Claws and Teeth', range: 'close', bonus: 8, damage: '4d10+10', img: 'icons/creatures/abilities/mouth-teeth-rows-needles-purple.webp' },
        features: [
            ...FRAMEWORK,
            { std: 'flying' },
            { std: 'terrifying', range: 'far', rangeLabel: 'Far' },
            {
                name: 'Breath Weapon',
                form: 'action',
                img: 'icons/creatures/abilities/dragon-breath-purple.webp',
                text: `<p><strong>Spend 2 Fear</strong> to have Forlorne exhale a cloud of magical energy, filling an area within Close range. Each target in that area must make a Presence Reaction Roll. On a failure, they must mark 3 Stress or gain the <em>Weredrake Curse</em>. ${WEREDRAKE_TEXT}</p>`,
                act: {
                    type: 'save',
                    save: 'presence',
                    range: 'close',
                    cost: { fear: 2 },
                    effect: { name: 'Weredrake Curse', statuses: ['weredrakeCurse'], img: 'icons/creatures/abilities/dragon-breath-purple.webp' }
                }
            },
            {
                name: 'Tail Swipe',
                form: 'reaction',
                img: 'icons/creatures/abilities/tail-swipe-green.webp',
                text: '<p>When Forlorne marks 1 or more HP from an attack within Very Close range, you can <strong>mark a Stress</strong> to deal <strong>2d10+10</strong> physical damage to all creatures within that range.</p>',
                act: { type: 'damage', cost: { stress: 1 }, damage: '2d10+10', range: 'veryClose', area: 'veryClose' }
            }
        ]
    },
    {
        _id: 'dhwdWeredrake000',
        name: 'Weredrake',
        img: ART.weredrake,
        tier: 1,
        type: 'standard',
        size: 'medium',
        tokenSize: 1,
        description:
            '<p>A person transformed into a wingless draconic predator by a weredragon’s breath weapon.</p><p>A weredrake looks like a wingless, quadrupedal dragon of a similar size to the person they once were, but they can’t speak and don’t retain that person’s knowledge or memories. Elements of the weredrake’s former ancestry might be discernible in the creature’s form; for example, a clank transformed into a weredrake might retain a mechanical appearance, while a faerie weredrake might have a carapace instead of scales.</p>',
        notes: '<p>A weredrake can assume their original ancestry’s form. When they do, they retain the terrifying claws and teeth of their new draconic form. They typically use this form as a ruse to lure prey close before attacking.</p><p>As the players move up in tier, adjust the weredrake’s statistics accordingly (see “Improvising Adversaries” in the core rulebook).</p>',
        motives: 'Hunger for flesh, hunt in small packs',
        difficulty: 12,
        thresholds: [8, 14],
        hp: 5,
        stress: 2,
        attack: { name: 'Claws & Teeth', range: 'melee', bonus: 2, damage: '1d8+3', img: 'icons/creatures/claws/claw-hooked-purple.webp' },
        experiences: [['Pack Hunter', 3]],
        features: [
            {
                name: 'Climber',
                form: 'passive',
                img: 'icons/creatures/abilities/paw-print-pair-purple.webp',
                text: '<p>The Weredrake climbs as easily as it runs.</p>'
            },
            {
                name: 'Pack Tactics',
                form: 'passive',
                img: 'icons/creatures/abilities/wolf-heads-swirl-purple.webp',
                text: '<p>If the Weredrake makes a successful standard attack and another Weredrake is within Melee range of the target, deal <strong>1d8+6</strong> physical damage instead of its standard damage and gain a Fear.</p>'
            },
            {
                name: 'Innocent Guise',
                form: 'action',
                img: 'icons/magic/control/silhouette-hold-change-green.webp',
                text: '<p>The Weredrake magically assumes the form of the person it was before its transformation but retains its claws and teeth. This form lasts until it dies or uses this feature again to revert to its draconic form.</p>'
            }
        ]
    }
];

/* ------------------------------------------------------------------ */
/*  Items                                                             */
/* ------------------------------------------------------------------ */

export const ITEMS = [
    {
        _id: 'dhwdLavenderSwrd',
        name: 'Lady Lavender’s Longsword',
        type: 'weapon',
        img: ART.sword,
        tier: 3,
        trait: 'agility',
        range: 'melee',
        damage: { dice: 'd8', bonus: 10, type: 'physical' },
        burden: 'twoHanded',
        description:
            '<p><em>This blade’s hilt is shaped like two hounds leaping away from each other. The weapon belongs to Lady Lavender, a retired Knight of Whelvia who lives in Knightstead.</em></p><p><strong>Curse Breaker:</strong> This weapon clears all magical curses on a creature it touches.</p><p>Key to Victory 2 of the Astromancer’s reading (roll 3): a PC wielding this weapon gains a +1 bonus to their Proficiency for attacks against Forlorne.</p>',
        breaker: { name: 'Curse Breaker', img: ART.sword, id: 'dhwdCurseBreaker' }
    },
    {
        _id: 'dhwdZoetrope0000',
        name: 'Zoetrope of the Bright Bacchanal',
        type: 'loot',
        img: ART.zoetrope,
        description:
            '<p><em>Unless you decide it was taken elsewhere, a magical trinket lies buried amid the ashes and timbers of the Lykona cottage at Witch’s End, undamaged by fire and the passage of time. Made of copper, the item is a hollow cylinder with dancing fauns cut out of it.</em></p><p>When you place a candle in this zoetrope’s cylinder and turn the metal key attached to the base counterclockwise, the cylinder rotates, casting a luminous parade of dancing fauns on nearby surfaces. While the lit zoetrope turns, it clears all magical curses on creatures within Close range.</p><p>Key to Victory 1 of the Astromancer’s reading (roll 6): when Forlorne appears, a PC holding it gains 1d4 Hope.</p>',
        breaker: { name: 'Light the Zoetrope', img: 'icons/magic/light/light-candles-lit-white.webp', id: 'dhwdZoetropeTurn', range: 'close' }
    },
    {
        _id: 'dhwdBrambleSword',
        name: 'Stag Knight’s Bramble Sword',
        type: 'weapon',
        img: 'icons/weapons/swords/sword-guard-steel-green.webp',
        tier: 3,
        trait: 'presence',
        range: 'melee',
        damage: { dice: 'd8', bonus: 7, type: 'physical' },
        burden: 'oneHanded',
        description:
            '<p>A sword from the Starlance Grove. It uses the statistics of an Advanced Cutlass.</p><p>Key to Victory 2 of the Astromancer’s reading (roll 4): a PC wielding this weapon gains a +1 bonus to their Proficiency for attacks against Forlorne.</p>'
    }
];

/* ------------------------------------------------------------------ */
/*  Curses                                                            */
/* ------------------------------------------------------------------ */

export const CURSES = [
    {
        _id: 'dhwdCurseWerdrke',
        name: 'Weredrake Curse',
        img: 'icons/creatures/abilities/dragon-breath-purple.webp',
        status: 'weredrakeCurse',
        statuses: ['weredrakeCurse'],
        changes: [],
        description: `<p>Forlorne’s “Breath Weapon” turns people into weredrakes.</p><p>${WEREDRAKE_TEXT}</p>${CLEARING}`
    },
    {
        _id: 'dhwdCursePetrify',
        name: 'Petrified Curse',
        img: 'icons/magic/earth/strike-body-stone-crumble.webp',
        status: 'petrifiedCurse',
        statuses: ['petrifiedCurse', 'restrained', 'vulnerable'],
        changes: PETRIFIED_CHANGES,
        description: `<p>Forlorne’s “Stone-Cold Gaze” turns creatures and their equipment to stone.</p><p>${PETRIFIED_TEXT}</p>${CLEARING}`
    }
];

export const META = { MOD, SOURCE };
