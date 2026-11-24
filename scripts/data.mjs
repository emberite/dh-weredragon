/**
 * Tables of the Reign of the Weredragon campaign frame (Daggerheart: Hope & Fear, chapter 4).
 */
import { MODULE_ID } from './constants.mjs';

const SYS = (pack, id) => `Compendium.daggerheart.${pack}.Item.${id}`;
const OWN = id => `Compendium.${MODULE_ID}.weredragon-items.Item.${id}`;

/** Item ids in this module's items compendium (kept stable by tools/build-packs.mjs). */
export const ITEM_IDS = {
    longsword: 'dhwdLavenderSwrd',
    zoetrope: 'dhwdZoetrope0000',
    bramble: 'dhwdBrambleSword'
};

/** The five revelations of the Astromancer's reading, in order. */
export const REVELATIONS = [
    { key: 'secret', icon: 'fa-solid fa-eye', star: 'Secret' },
    { key: 'ally', icon: 'fa-solid fa-handshake-angle', star: 'Ally' },
    { key: 'key1', icon: 'fa-solid fa-shield-halved', star: 'Shield' },
    { key: 'key2', icon: 'fa-solid fa-khanda', star: 'Blade' },
    { key: 'showdown', icon: 'fa-solid fa-dragon', star: 'Dragon' }
];
export const REVELATION_KEYS = REVELATIONS.map(r => r.key);

/**
 * Night Sky Reading table, one row per d6 result.
 * `place` names the location a revelation sends the party to (for the "spread them out" check),
 * `uuid` links the item a Key to Victory refers to.
 */
export const NIGHT_SKY = [
    {
        secret: { name: 'Nightshade', place: 'Nightshade' },
        ally: {
            name: 'Tiltuk (they/them)',
            text: 'A young dryad from the Dryad’s Graveyard. They are oath-sworn to hold back the weredrakes that have overrun their homeland.',
            place: 'Dryad’s Graveyard'
        },
        key1: { name: 'Glider', text: 'Trapped within the Wyrmbolt Tower in Elevarne.', place: 'Elevarne', uuid: SYS('loot', 'CiXwelozmBDcPY48') },
        key2: { name: 'Legendary Hallowed Axe', text: 'Stuck in a log in Froghaven Bog.', place: 'Froghaven Bog', uuid: SYS('weapons', '0HmhnZnv1I6uX69c') },
        showdown: { name: 'Nightshade', place: 'Nightshade' }
    },
    {
        secret: { name: 'Elevarne', place: 'Elevarne' },
        ally: {
            name: 'Ehud (he/him)',
            text: 'The chieftain of a clan of sapient bears living along the shore of the river that runs through Starlance Grove. He purchases Forlorne’s clemency with regular tribute, but the cost has become intolerable.',
            place: 'Starlance Grove'
        },
        key1: { name: 'Emberwoven Armor', text: 'Formed from an elder dryad’s ashes in the Dryad’s Graveyard.', place: 'Dryad’s Graveyard', uuid: SYS('armors', 'bcQUh4QG3qFX0Vx6') },
        key2: { name: 'Legendary Scepter', text: 'Left in Nightshade.', place: 'Nightshade', uuid: SYS('weapons', 'IZ4CWNxfuM46JeCN') },
        showdown: { name: 'Elevarne', place: 'Elevarne' }
    },
    {
        secret: { name: 'Nwarlyth', place: 'Nwarlyth' },
        ally: {
            name: 'B’rahl Zed (he/him)',
            text: 'A cave ogre cursed with immortality who roams the Whelvewood. He protects the wilds from Forlorne’s encroachment.',
            place: 'The Whelvewood'
        },
        key1: { name: 'Enlighten Relic', text: 'From a landmark in the Whelvewood.', place: 'The Whelvewood', uuid: SYS('loot', 'vSGx1f9SYUiA29L3') },
        key2: { name: 'Lady Lavender’s Longsword', text: 'From Knightstead.', place: 'Knightstead', uuid: OWN(ITEM_IDS.longsword), unique: true },
        showdown: { name: 'Nwarlyth', place: 'Nwarlyth' }
    },
    {
        secret: { name: 'Stillwater Lake', place: 'Stillwater Lake' },
        ally: {
            name: 'Vexxen (they/them)',
            text: 'A demon imprisoned long ago within an obelisk at Knightstead, with power not of this world. Lady Lavender can be convinced to release them.',
            place: 'Knightstead'
        },
        key1: { name: 'Ring of Unbreakable Resolve', text: 'Buried in the ruins of Vexstone Abbey.', place: 'Vexstone Abbey', uuid: SYS('loot', 'kn71qCQY0DnjmQBJ') },
        key2: { name: 'Stag Knight’s Bramble Sword', text: 'From the Starlance Grove (uses Advanced Cutlass statistics).', place: 'Starlance Grove', uuid: OWN(ITEM_IDS.bramble) },
        showdown: { name: 'Stillwater Lake', place: 'Stillwater Lake' }
    },
    {
        secret: { name: 'Vexstone Abbey', place: 'Vexstone Abbey' },
        ally: {
            name: 'Cymor Bucklethorn (he/him)',
            text: 'A halfling spymaster of the Whelvian Thieves Guild. He built a network of clandestine operatives to fund a rebellion against Forlorne but was betrayed. As punishment, Forlorne turned him to stone and placed him on display in Vexstone Abbey.',
            place: 'Vexstone Abbey'
        },
        key1: { name: 'Clay Companion', text: 'Has made a home in the caves below Vexstone Abbey.', place: 'Vexstone Abbey', uuid: SYS('loot', 'lGIk9vBNz0jvskXD') },
        key2: { name: 'Firestaff', text: 'Hidden in one of the standing stones of Stillwater Lake.', place: 'Stillwater Lake', uuid: SYS('weapons', 'BtCm2RhWEfs00g38') },
        showdown: { name: 'Vexstone Abbey', place: 'Vexstone Abbey' }
    },
    {
        secret: { name: 'Witch’s End', place: 'Witch’s End' },
        ally: {
            name: 'Harrowyrr Lykona (she/her)',
            text: 'Forlorne’s twin sister, lost in a fire when she was eleven. She haunts Witch’s End as a charred skeleton wrapped in an ashen shroud.',
            place: 'Witch’s End'
        },
        key1: { name: 'The Zoetrope of the Bright Bacchanal', text: 'Hidden at Witch’s End.', place: 'Witch’s End', uuid: OWN(ITEM_IDS.zoetrope), unique: true },
        key2: { name: 'Magus Revolver', text: 'Smuggled into Nightshade by a clandestine organization.', place: 'Nightshade', uuid: SYS('weapons', 'jGykNGQiKm63tCiE') },
        showdown: { name: 'Witch’s End', place: 'Witch’s End' }
    }
];

/** Villain Builder roll table: roll a d4 (tens) and a d10 (ones), 10 to 49. */
export const PROMPTS = {
    10: 'The queen once ordered the creation of something beautiful in her honor. What was it, and where does it now reside?',
    11: 'What is a unique or unexpected part of Forlorne’s appearance that affects how people view her?',
    12: 'Forlorne and one of the Knights of Whelvia are rumored to be having an affair. Who is the knight, and what are they known for?',
    13: 'Forlorne recently quashed a small rebellion. Who led that effort, and what mistake did they make that led to their downfall?',
    14: 'What symbol do followers of the queen use to identify themselves to one another?',
    15: 'Forlorne frequently visits a remote Whelvian village. Why do the locals believe she keeps coming back?',
    16: 'Forlorne’s castle contains a secret room that only she can access. What does she hide there?',
    17: 'What heinous acts has Forlorne imposed upon her citizens since becoming queen?',
    18: 'What distinct markings, patterns, or features do Forlorne’s weredrakes bear once she transforms them?',
    19: 'What unique magical item is Forlorne rumored to seek? What are people afraid she’ll do if she gets it?',
    20: 'The queen recently lost a close member of her royal court. Who were they, and how has she responded to their death?',
    21: 'What defensive systems are rumored to protect the fortress of Nwarlyth where Forlorne resides?',
    22: 'Who is the queen’s most recently appointed royal advisor, and what aspect of the kingdom are they responsible for?',
    23: 'The queen has a childhood friend who’s now a member of her court. Who are they, and what’s strange about them?',
    24: 'The queen’s favorite weapon once belonged to someone else. What is it, and who owned it previously?',
    25: 'Which Whelvian hero vocally supports Forlorne? How does she reward them?',
    26: 'What inoffensive item, symbol, or practice did Forlorne ban when she came to power? What is the punishment for those who are caught violating the ban?',
    27: 'What is the Whelvians’ nickname for Forlorne, and where did it come from?',
    28: 'What creature does the queen keep chained in her dungeon, and why does she keep it alive?',
    29: 'One member of Forlorne’s royal court is treated differently from the others. Why is that, and how do the other nobles feel about it?',
    30: 'Forlorne sometimes disappears from Whelvia for short stretches of time. Where do people say she goes?',
    31: 'Forlorne recently destroyed something vital to many Whelvians. What happened, and who has been most affected?',
    32: 'What act of kindness did Forlorne recently commit? What controversy has come about because of it?',
    33: 'A foreign leader recently asked Forlorne for her hand in marriage, hoping to forge a powerful alliance. Who were they, and how did Forlorne respond?',
    34: 'Forlorne holds an annual celebration in her own honor. What does she require from citizens during the event, and how are they punished if they refuse to comply?',
    35: 'What symbol do Whelvian rebels use to identify themselves to one another?',
    36: 'Forlorne is demonizing a specific community, blaming them for Whelvia’s problems. Which community is it, and what has she tasked her knights to do in response?',
    37: 'Forlorne elevated someone to power who was an unexpected choice. Who are they, and why do people believe she chose them?',
    38: 'Forlorne recently killed a sky seer. What did this person see in the night sky that caused her to kill them?',
    39: 'What scandalous story is everyone telling from Forlorne’s last grand ball?',
    40: 'What trait or behavior of others brings out Forlorne’s cruelty?',
    41: 'Someone saved the queen’s life. Who were they, and what happened?',
    42: 'What promises has Forlorne made to the people of Whelvia, and what, if any, action has she taken to fulfill them?',
    43: 'Which criminal organization handles clandestine tasks for the queen?',
    44: 'What specific claims does the queen’s most recent propaganda campaign make to her people?',
    45: 'Forlorne meets her sky seers in a very specific place. Where do they go, and why does she bring them there?',
    46: 'The queen’s regime has taken many people from their homes. Why were these people chosen, and where does Forlorne send them?',
    47: 'What new process has Forlorne implemented to dispatch those she deems criminal in Whelvia?',
    48: 'What did Forlorne say at her last widely attended speech? How did the audience react?',
    49: 'What is the queen’s rumored vice, and where in Whelvia does she go to satisfy it?'
};
export const PROMPT_NUMBERS = Object.keys(PROMPTS).map(Number);
