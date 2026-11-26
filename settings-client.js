(function (root) {
    'use strict';

    function clone(value) {
        return structuredClone(value);
    }

    function sameValue(left, right) {
        if (Object.is(left, right)) return true;
        if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function settingsPatch(previous = {}, next = {}) {
        const patch = {};
        for (const [key, value] of Object.entries(next)) {
            if (!sameValue(previous[key], value)) patch[key] = value;
        }
        return patch;
    }

    function createSettingsClient(api) {
        let savedSettings = null;

        return {
            // `defaults` fills in keys the stored settings do not have yet, so the
            // page and the diff snapshot start from the same baseline.
            async load(defaults = {}) {
                const response = await api.runtime.sendMessage({ type: 'GET_SETTINGS' });
                if (!response || response.error) {
                    throw new Error(response && response.error || 'Failed to load settings');
                }
                savedSettings = clone({ ...defaults, ...(response.settings || {}) });
                return clone(savedSettings);
            },

            async save(nextSettings) {
                const patch = settingsPatch(savedSettings || {}, nextSettings);
                if (savedSettings && Object.keys(patch).length === 0) return clone(savedSettings);

                const response = await api.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: patch });
                if (!response || response.error) {
                    throw new Error(response && response.error || 'Failed to save settings');
                }
                savedSettings = clone(response.settings);
                return clone(savedSettings);
            }
        };
    }

    root.SettingsClient = { settingsPatch, createSettingsClient };
})(typeof window !== 'undefined' ? window : globalThis);
