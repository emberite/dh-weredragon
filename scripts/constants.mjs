export const MODULE_ID = 'dh-weredragon';
export const HF_ID = 'daggerheart-hope-and-fear';

/** Art from the Hope & Fear module. */
export const HF_ART = `modules/${HF_ID}/assets/art`;
export const ART = {
    intro: `${HF_ART}/book/weredragon-intro.webp`,
    starReading: `${HF_ART}/book/weredragon-starreading.webp`,
    faun: `${HF_ART}/book/weredragon-forlornefaun.webp`,
    dragon: `${HF_ART}/book/weredragon-forlornedragon.webp`,
    weredrake: `${HF_ART}/book/weredragon-weredrake-12-10-25.webp`,
    sword: `${HF_ART}/book/weredragon-item-lavendersword.webp`,
    zoetrope: `${HF_ART}/book/weredragon-item-zoetrope.webp`,
    inciting: `${HF_ART}/book/weredragon-incitingincident.webp`,
    map: `${HF_ART}/book/reign-of-the-weredragon-map-rh-12dec2025.webp`
};

/** Pages of the Hope & Fear rulebook compendium. */
const HF_CHAPTER = `Compendium.${HF_ID}.rules.JournalEntry.daghfear06chapte.JournalEntryPage`;
export const HF_PAGES = {
    frame: `${HF_CHAPTER}.06reignofthewe00`,
    queen: `${HF_CHAPTER}.06theweredrago00`,
    revelations: `${HF_CHAPTER}.06theastromanc00`,
    nightSky: `${HF_CHAPTER}.06nightskyread00`,
    keys: `${HF_CHAPTER}.06keystovictor00`,
    curses: `${HF_CHAPTER}.06curses00000000`,
    forlorne: `${HF_CHAPTER}.06forlornelyko00`
};

/** Status ids for the two curses of the campaign frame. */
export const CURSE = {
    weredrake: 'weredrakeCurse',
    petrified: 'petrifiedCurse'
};

export const PACKS = {
    adversaries: `${MODULE_ID}.weredragon-adversaries`,
    items: `${MODULE_ID}.weredragon-items`,
    curses: `${MODULE_ID}.weredragon-curses`
};

/** Localize under this module's namespace, with optional format data. */
export const L = (key, data) => (data ? game.i18n.format(`DHWD.${key}`, data) : game.i18n.localize(`DHWD.${key}`));

export const hasHFArt = () => !!game.modules.get(HF_ID)?.active;
