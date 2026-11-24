import { HF_ID, L, MODULE_ID } from './constants.mjs';
import { listen, registerRelay } from './relay.mjs';
import { onStoreChange, registerStores } from './store.mjs';
import { NightSkyReading } from './night-sky.mjs';
import { VillainBuilder } from './villain-builder.mjs';
import { clearCurses, clearCursesFrom, registerCurseBreakers, registerCurseStatuses, registerCurseVisuals } from './curses.mjs';
import { registerTransform, transform } from './transform.mjs';
import './journal.mjs';

const apps = { nightSky: null, villain: null };
const APP_CLASSES = { nightSky: NightSkyReading, villain: VillainBuilder };

/** Open (or focus) one of the table apps on this client. */
export function openApp(key) {
    const Cls = APP_CLASSES[key];
    if (!Cls) return null;
    apps[key] ??= new Cls();
    apps[key].render({ force: true });
    return apps[key];
}
export const openNightSky = () => openApp('nightSky');
export const openVillainBuilder = () => openApp('villain');

/**
 * Load the stylesheet with a version query. Foundry links module CSS by bare path, and a caching
 * proxy would otherwise keep serving last release's styles. Same cascade layer Foundry uses for module styles.
 */
function loadStyles() {
    const version = game.modules.get(MODULE_ID)?.version ?? Date.now();
    const style = document.createElement('style');
    style.id = `${MODULE_ID}-styles`;
    style.textContent = `@import url("modules/${MODULE_ID}/styles/weredragon.css?v=${encodeURIComponent(version)}") layer(modules);`;
    document.head.append(style);
}

function registerSettings() {
    game.settings.register(MODULE_ID, 'curseConditions', {
        name: 'DHWD.Settings.CurseConditions.Name',
        hint: 'DHWD.Settings.CurseConditions.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: true
    });
    game.settings.register(MODULE_ID, 'curseVisuals', {
        name: 'DHWD.Settings.CurseVisuals.Name',
        hint: 'DHWD.Settings.CurseVisuals.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register(MODULE_ID, 'transform', {
        name: 'DHWD.Settings.Transform.Name',
        hint: 'DHWD.Settings.Transform.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register(MODULE_ID, 'rollsToChat', {
        name: 'DHWD.Settings.RollsToChat.Name',
        hint: 'DHWD.Settings.RollsToChat.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
}

Hooks.once('init', () => {
    loadStyles();
    registerSettings();
    registerStores();
    game.modules.get(MODULE_ID).api = {
        openNightSky,
        openVillainBuilder,
        transform,
        clearCurses,
        clearCursesFrom
    };
});

// The system sets its conditions in "setup"; ours go after them.
Hooks.once('setup', () => registerCurseStatuses());

Hooks.once('ready', () => {
    registerRelay();
    registerCurseVisuals();
    registerCurseBreakers();
    if (game.settings.get(MODULE_ID, 'transform')) registerTransform();
    listen('open', ({ app }) => openApp(app));
    onStoreChange(key => {
        if (apps[key]?.rendered) apps[key].render();
    });
    if (game.user.isGM && !game.modules.get(HF_ID)?.active) {
        ui.notifications.warn(L('Notify.NoHopeAndFear'), { permanent: true });
    }
});

// Whispered secrets live on a GM-only journal page: refresh the GM's reading when one arrives.
for (const hook of ['createJournalEntryPage', 'updateJournalEntryPage']) {
    Hooks.on(hook, page => {
        if (page.getFlag(MODULE_ID, 'page') === 'secrets' && apps.nightSky?.rendered) apps.nightSky.render();
    });
}

// Players' characters can change name or portrait while the apps are open.
Hooks.on('updateUser', () => Object.values(apps).forEach(a => a?.rendered && a.render()));

/** "Reign of the Weredragon" section in the Daggerheart sidebar menu. */
Hooks.on('renderDaggerheartMenu', (app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root || root.querySelector('.dh-weredragon-menu')) return;
    const fieldsets = root.querySelectorAll('fieldset');
    const last = fieldsets[fieldsets.length - 1];
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'dh-weredragon-menu';
    fieldset.innerHTML = `
        <legend>${L('Menu.Legend')}</legend>
        <div class="menu-options-container">
            <div class="menu-options-inner-container">
                <button type="button" data-wd="villain"><i class="fa-solid fa-crown"></i> ${L('Menu.Villain')}</button>
                <button type="button" data-wd="nightSky"><i class="fa-solid fa-star-and-crescent"></i> ${L('Menu.NightSky')}</button>
            </div>
        </div>`;
    for (const btn of fieldset.querySelectorAll('[data-wd]')) btn.addEventListener('click', () => openApp(btn.dataset.wd));
    if (last) last.after(fieldset);
    else root.append(fieldset);
});
