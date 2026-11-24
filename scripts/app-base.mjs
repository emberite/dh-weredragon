/**
 * Shared base for the two table apps: one instance per client, re-rendered whenever the shared
 * state changes, and the GM can call everyone to it.
 */
import { MODULE_ID, hasHFArt } from './constants.mjs';
import { read } from './store.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Name, color and portrait of a user for the templates. */
export function person(userId) {
    const user = game.users.get(userId);
    if (!user) return { id: userId, name: '?', color: '#888', avatar: 'icons/svg/mystery-man.svg' };
    const actor = user.character;
    return {
        id: user.id,
        name: actor?.name ?? user.name,
        user: user.name,
        color: user.color?.css ?? String(user.color ?? '#888'),
        avatar: actor?.img ?? user.avatar ?? 'icons/svg/mystery-man.svg',
        active: user.active,
        isGM: user.isGM,
        me: user.id === game.user.id
    };
}

export class WeredragonApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /** Which store this app shows. */
    static STORE = null;

    get state() {
        return read(this.constructor.STORE);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.element.classList.toggle('wd-art', hasHFArt());
        this.element.classList.toggle('wd-gm', game.user.isGM);
    }

    /** Keep typed text and focus across re-renders caused by other people's changes. */
    async _preRender(context, options) {
        const active = this.element?.querySelector?.(':focus');
        this._focus = active?.dataset?.keep ? { key: active.dataset.keep, start: active.selectionStart, end: active.selectionEnd } : null;
        return super._preRender(context, options);
    }

    restoreDrafts() {
        for (const el of this.element.querySelectorAll('[data-keep]')) {
            const key = el.dataset.keep;
            if (this.drafts?.[key] != null && el.value !== this.drafts[key]) el.value = this.drafts[key];
            el.addEventListener('input', () => {
                this.drafts ??= {};
                this.drafts[key] = el.value;
            });
            if (this._focus?.key === key) {
                el.focus();
                try {
                    el.setSelectionRange(this._focus.start, this._focus.end);
                } catch {
                    /* not a text field */
                }
            }
        }
    }

    forgetDraft(key) {
        if (this.drafts) delete this.drafts[key];
    }
}

export const MODULE_TEMPLATES = name => `modules/${MODULE_ID}/templates/${name}.hbs`;
