/**
 * Shared dropdown widgets for the extension pages (options, popup).
 *
 * Loaded as a classic script before the page script, so the factories below
 * are available as globals. Both pages keep their own element refs; everything
 * about rendering, filtering, keyboard navigation and pinning lives here once.
 * createLanguagePicker() and createModelPicker() additionally hold the item
 * shape/config both pages used to repeat verbatim.
 */

const PIN_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';

/**
 * Build a searchable, pinnable dropdown picker.
 * @param {object} config
 *  - els: { picker, trigger, label, menu, search, list } — DOM refs
 *  - getItems(): item[]                — current full list of selectable items
 *  - getId(item) / getName(item)       — identity + display name for an item
 *  - restGroupLabel: string            — header shown above the non-pinned group
 *  - emptyText(filter): string         — text shown when nothing matches
 *  - labelFor(id): string              — trigger label for the current value
 *  - decorateOption?(li, item): void   — optional hook to append extra markup
 *  - isValidId?(id): boolean           — optional filter applied in setPinned
 *  - initialValue?: string             — starting value (default '')
 */
function createPicker(config) {
    const { els, getItems, getId, getName } = config;

    return {
        value: config.initialValue ?? '',
        pinned: [],
        open: false,
        activeIndex: -1,
        visibleIds: [],
        onChange: null,       // (id) => void
        onPinnedChange: null, // (pinnedArray) => void

        init() {
            els.trigger.addEventListener('click', () => this.toggle());
            els.search.addEventListener('input', () => {
                this.activeIndex = -1;
                this.render();
            });
            els.search.addEventListener('keydown', (e) => this.handleKeydown(e));
            // Close when clicking outside the picker
            document.addEventListener('click', (e) => {
                if (this.open && !els.picker.contains(e.target)) this.close();
            });
        },

        getValue() { return this.value; },

        setValue(id) {
            this.value = id;
            els.label.textContent = config.labelFor(id);
        },

        setPinned(arr) {
            const list = Array.isArray(arr) ? arr : [];
            this.pinned = config.isValidId ? list.filter(config.isValidId) : [...list];
        },

        isPinned(id) { return this.pinned.includes(id); },

        togglePin(id) {
            this.pinned = this.isPinned(id)
                ? this.pinned.filter(p => p !== id)
                : [...this.pinned, id];
            if (this.onPinnedChange) this.onPinnedChange([...this.pinned]);
            this.render();
        },

        select(id) {
            this.setValue(id);
            this.close();
            if (this.onChange) this.onChange(id);
        },

        toggle() { this.open ? this.close() : this.openMenu(); },

        openMenu() {
            this.open = true;
            els.picker.classList.add('open');
            els.menu.hidden = false;
            els.trigger.setAttribute('aria-expanded', 'true');
            els.search.value = '';
            this.activeIndex = -1;
            this.render();
            els.search.focus();
            // Scroll the selected row into view
            const sel = els.list.querySelector('.lang-option.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
        },

        close() {
            this.open = false;
            els.picker.classList.remove('open');
            els.menu.hidden = true;
            els.trigger.setAttribute('aria-expanded', 'false');
        },

        // Build the option list, applying the current search filter and pin grouping
        render() {
            const filter = els.search.value.trim().toLowerCase();
            const match = (item) => !filter
                || getName(item).toLowerCase().includes(filter)
                || String(getId(item)).toLowerCase().includes(filter);

            const pinnedSet = new Set(this.pinned);
            const sorted = [...getItems()].sort((a, b) => getName(a).localeCompare(getName(b)));
            const pinnedItems = sorted.filter(i => pinnedSet.has(getId(i)) && match(i));
            const restItems = sorted.filter(i => !pinnedSet.has(getId(i)) && match(i));

            const list = els.list;
            list.innerHTML = '';
            this.visibleIds = [];

            if (!pinnedItems.length && !restItems.length) {
                const empty = document.createElement('li');
                empty.className = 'lang-empty';
                empty.textContent = config.emptyText(filter);
                list.appendChild(empty);
                return;
            }

            if (pinnedItems.length) {
                list.appendChild(this.makeGroupLabel(
                    config.pinnedGroupLabel ? config.pinnedGroupLabel() : 'Pinned'));
                pinnedItems.forEach(i => list.appendChild(this.makeOption(i, true)));
                if (restItems.length) {
                    const sep = document.createElement('li');
                    sep.className = 'lang-separator';
                    sep.setAttribute('aria-hidden', 'true');
                    list.appendChild(sep);
                    const restLabel = typeof config.restGroupLabel === 'function'
                        ? config.restGroupLabel() : config.restGroupLabel;
                    list.appendChild(this.makeGroupLabel(restLabel));
                }
            }
            restItems.forEach(i => list.appendChild(this.makeOption(i, false)));

            this.updateActive();
        },

        makeGroupLabel(text) {
            const li = document.createElement('li');
            li.className = 'lang-group-label';
            li.textContent = text;
            li.setAttribute('aria-hidden', 'true');
            return li;
        },

        makeOption(item, pinned) {
            const id = getId(item);
            const name = getName(item);
            const li = document.createElement('li');
            li.className = 'lang-option' + (pinned ? ' pinned' : '') + (id === this.value ? ' selected' : '');
            li.setAttribute('role', 'option');
            li.dataset.id = id;
            if (id === this.value) li.setAttribute('aria-selected', 'true');

            const nameEl = document.createElement('span');
            nameEl.className = 'lang-option-name';
            nameEl.textContent = name;
            li.appendChild(nameEl);

            if (config.decorateOption) config.decorateOption(li, item);

            const pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.className = 'lang-pin-btn';
            pinBtn.innerHTML = PIN_ICON_SVG;
            pinBtn.title = pinned ? t('picker.unpin', { name }) : t('picker.pin', { name });
            pinBtn.setAttribute('aria-label', pinBtn.title);
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePin(id);
            });
            li.appendChild(pinBtn);

            li.addEventListener('click', () => this.select(id));

            const idx = this.visibleIds.length;
            li.addEventListener('mousemove', () => {
                if (this.activeIndex !== idx) { this.activeIndex = idx; this.updateActive(); }
            });
            this.visibleIds.push(id);
            return li;
        },

        // Reflect activeIndex onto the rows for keyboard navigation highlight
        updateActive() {
            const rows = els.list.querySelectorAll('.lang-option');
            rows.forEach((row, i) => {
                const active = i === this.activeIndex;
                row.classList.toggle('active', active);
                if (active) row.scrollIntoView({ block: 'nearest' });
            });
        },

        handleKeydown(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.visibleIds.length) {
                    this.activeIndex = Math.min(this.activeIndex + 1, this.visibleIds.length - 1);
                    this.updateActive();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.visibleIds.length) {
                    this.activeIndex = Math.max(this.activeIndex - 1, 0);
                    this.updateActive();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
                const id = this.visibleIds[idx];
                if (id) this.select(id);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
                els.trigger.focus();
            }
        }
    };
}

/**
 * Target-language picker: items are [code, name] entries from LANGUAGES.
 * @param {object} config
 *  - els: { picker, trigger, label, menu, search, list } — DOM refs
 *  - initialValue?: string             — starting value (default 'en')
 */
function createLanguagePicker(config) {
    return createPicker({
        els: config.els,
        getItems: () => Object.entries(LANGUAGES),
        getId: (entry) => entry[0],
        getName: (entry) => entry[1],
        pinnedGroupLabel: () => t('picker.pinned'),
        restGroupLabel: () => t('picker.allLanguages'),
        emptyText: () => t('picker.noLangMatch'),
        labelFor: (code) => LANGUAGES[code] || code,
        isValidId: (code) => !!LANGUAGES[code],
        initialValue: config.initialValue ?? 'en',
    });
}

/**
 * Model picker: items are { id, name, provider } objects returned by the
 * background's LIST_MODELS message. The loaded list lives on the instance
 * (allModels), and setModels() prunes pinned ids that no longer exist.
 * @param {object} config
 *  - els: { picker, trigger, label, menu, search, list } — DOM refs
 */
function createModelPicker(config) {
    const picker = createPicker({
        els: config.els,
        getItems: () => picker.allModels,
        getId: (m) => m.id,
        getName: (m) => m.name,
        pinnedGroupLabel: () => t('picker.pinned'),
        restGroupLabel: () => t('picker.allModels'),
        emptyText: () => picker.allModels.length === 0 ? t('picker.noModels') : t('picker.noModelMatch'),
        labelFor: (id) => {
            const m = picker.allModels.find(x => x.id === id);
            return m ? m.name : (id || t('model.select'));
        },
        decorateOption: (li, m) => {
            const badge = document.createElement('span');
            badge.className = `model-provider-badge model-provider-badge--${m.provider}`;
            badge.textContent = m.provider;
            li.appendChild(badge);
        },
    });

    picker.allModels = [];

    picker.setModels = function (models) {
        this.allModels = models;
        // Drop pinned ids that no longer exist in the model list
        const ids = new Set(models.map(m => m.id));
        this.pinned = this.pinned.filter(id => ids.has(id));
    };

    picker.getSelectedProvider = function () {
        const m = this.allModels.find(x => x.id === this.value);
        return m ? m.provider : null;
    };

    return picker;
}

/**
 * Lightweight dropdown for plain value/label selects (no search box, no
 * pinning) — a styled stand-in for <select> so every dropdown on a page looks
 * and behaves the same way. Options are computed live via getOptions() each
 * time the menu opens, so callers can change what's offered (e.g. a disabled
 * entry) without having to rebuild the picker.
 * @param {object} config
 *  - els: { picker, trigger, label, menu, list } — DOM refs
 *  - getOptions(): { value, label, disabled? }[] — current options
 *  - placeholder?: string              — label when the value has no option
 *  - initialValue?: string             — starting value (default '')
 */
function createSimpleSelect(config) {
    const { els, getOptions } = config;

    return {
        value: config.initialValue ?? '',
        open: false,
        activeIndex: -1,
        visibleValues: [],
        onChange: null, // (value) => void

        init() {
            els.trigger.addEventListener('click', () => this.toggle());
            els.trigger.addEventListener('keydown', (e) => this.handleKeydown(e));
            document.addEventListener('click', (e) => {
                if (this.open && !els.picker.contains(e.target)) this.close();
            });
        },

        getValue() { return this.value; },

        setValue(value) {
            this.value = value;
            const opt = (getOptions() || []).find(o => o.value === value);
            els.label.textContent = opt ? opt.label : (config.placeholder || '');
        },

        select(value) {
            this.setValue(value);
            this.close();
            els.trigger.focus();
            if (this.onChange) this.onChange(value);
        },

        toggle() { this.open ? this.close() : this.openMenu(); },

        openMenu() {
            this.open = true;
            els.picker.classList.add('open');
            els.menu.hidden = false;
            els.trigger.setAttribute('aria-expanded', 'true');
            this.activeIndex = -1;
            this.render();
            const sel = els.list.querySelector('.lang-option.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
        },

        close() {
            this.open = false;
            els.picker.classList.remove('open');
            els.menu.hidden = true;
            els.trigger.setAttribute('aria-expanded', 'false');
        },

        render() {
            const options = (getOptions() || []);
            const list = els.list;
            list.innerHTML = '';
            this.visibleValues = [];
            options.forEach(opt => {
                const disabled = !!opt.disabled;
                const li = document.createElement('li');
                li.className = 'lang-option' + (opt.value === this.value ? ' selected' : '') + (disabled ? ' disabled' : '');
                li.setAttribute('role', 'option');
                li.dataset.id = opt.value;
                if (opt.value === this.value) li.setAttribute('aria-selected', 'true');
                if (disabled) li.setAttribute('aria-disabled', 'true');

                const nameEl = document.createElement('span');
                nameEl.className = 'lang-option-name';
                nameEl.textContent = opt.label;
                li.appendChild(nameEl);

                if (!disabled) {
                    li.addEventListener('click', () => this.select(opt.value));
                    const idx = this.visibleValues.length;
                    li.addEventListener('mousemove', () => {
                        if (this.activeIndex !== idx) { this.activeIndex = idx; this.updateActive(); }
                    });
                    this.visibleValues.push(opt.value);
                }
                list.appendChild(li);
            });
            this.updateActive();
        },

        updateActive() {
            const rows = els.list.querySelectorAll('.lang-option:not(.disabled)');
            rows.forEach((row, i) => {
                const active = i === this.activeIndex;
                row.classList.toggle('active', active);
                if (active) row.scrollIntoView({ block: 'nearest' });
            });
        },

        handleKeydown(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!this.open) { this.openMenu(); return; }
                if (this.visibleValues.length) {
                    this.activeIndex = Math.min(this.activeIndex + 1, this.visibleValues.length - 1);
                    this.updateActive();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.open && this.visibleValues.length) {
                    this.activeIndex = Math.max(this.activeIndex - 1, 0);
                    this.updateActive();
                }
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!this.open) { this.openMenu(); return; }
                const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
                const value = this.visibleValues[idx];
                if (value !== undefined) this.select(value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        }
    };
}

// Export for other classic scripts (the pages load this before their own JS).
if (typeof window !== 'undefined') {
    window.PIN_ICON_SVG = PIN_ICON_SVG;
    window.createPicker = createPicker;
    window.createLanguagePicker = createLanguagePicker;
    window.createModelPicker = createModelPicker;
    window.createSimpleSelect = createSimpleSelect;
}
