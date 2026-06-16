/* ─── storage abstraction layer ─────────────────────────── */

const STORAGE_KEYS = {
    CYCLE_SETUP: 'cyclus_setup_v1',
    CYCLE_LOG: 'cycle_log_v1',
    THEME: 'cyclus_theme',
    SYM_SETTINGS: 'cyclus_sym_settings_v1',
    TIPS: 'cyclus_tips_v1',
    LAST_BACKUP: 'cyclus_last_backup',
    BACKUP_SNOOZE: 'cyclus_backup_snooze',
};

const StorageAPI = {
    setItem(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    getItem(key, defaultValue = null) {
        const val = localStorage.getItem(key);
        if (val === null) return defaultValue;
        try {
            return JSON.parse(val);
        } catch {
            return defaultValue;
        }
    },

    removeItem(key) {
        localStorage.removeItem(key);
    },

    getString(key, defaultValue = '') {
        return localStorage.getItem(key) ?? defaultValue;
    },

    setString(key, value) {
        localStorage.setItem(key, value);
    },
};
