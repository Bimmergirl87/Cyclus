/* ─── symptom settings ─────────────────────────────────── */
const SETTINGS_KEY = 'cyclus_sym_settings_v1';

function loadSymSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (s && Array.isArray(s.shown) && Array.isArray(s.hidden)) {
            const custom = new Set(s.custom || []);
            const allSet = new Set(ALL_SYMPTOMS);
            // remove stale built-in names that no longer exist in ALL_SYMPTOMS
            s.shown  = s.shown.filter(n => allSet.has(n) || custom.has(n));
            s.hidden = s.hidden.filter(n => allSet.has(n) || custom.has(n));
            ALL_SYMPTOMS.forEach(d => {
                if (!s.shown.includes(d) && !s.hidden.includes(d)) s.shown.push(d);
            });
            return { shown: s.shown, hidden: s.hidden, custom: s.custom || [], customCats: s.customCats || {} };
        }
    } catch {}
    return { shown: [...ALL_SYMPTOMS], hidden: [], custom: [], customCats: {} };
}

function saveSymSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* ─── localStorage ─────────────────────────────────────── */
const STORAGE_KEY = 'cyclus_log_v1';
function loadLogs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
}
function saveLogs(logs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); }

function buildBackup() {
    let dates = [];
    try {
        const s = JSON.parse(localStorage.getItem('cyclus_setup_v1'));
        if (s && Array.isArray(s.dates)) dates = s.dates;
    } catch {}
    return { version: 2, cycle: { dates }, logs: loadLogs() };
}

function exportLogs() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' }));
    a.download = 'cyclus_backup.json';
    a.click();
    localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
    localStorage.removeItem(SNOOZE_KEY);
    updateBackupReminder();
}

/* ─── backup-herinnering ───────────────────────────────── */
const LAST_BACKUP_KEY = 'cyclus_last_backup';
const SNOOZE_KEY = 'cyclus_backup_snooze';
const BACKUP_REMINDER_DAYS = 5;

function updateBackupReminder() {
    const el = document.getElementById('backupReminder');
    if (!el) return;
    const textEl = document.getElementById('backupReminderText');

    // niets te beschermen? dan geen herinnering
    if (Object.keys(loadLogs()).length === 0) { el.style.display = 'none'; return; }

    // gesnoozed? dan stil tot de snooze afloopt
    const snoozeUntil = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10);
    if (snoozeUntil && Date.now() < snoozeUntil) { el.style.display = 'none'; return; }

    const last = parseInt(localStorage.getItem(LAST_BACKUP_KEY) || '0', 10);
    const days = last ? Math.floor((Date.now() - last) / 86400000) : Infinity;

    if (days < BACKUP_REMINDER_DAYS) { el.style.display = 'none'; return; }

    textEl.textContent = last
        ? `Je hebt ${days} dagen geen backup gemaakt — exporteer je gegevens even voor de zekerheid.`
        : 'Je hebt nog geen backup gemaakt — exporteer je gegevens even voor de zekerheid.';
    el.style.display = 'block';
}

function snoozeBackupReminder() {
    const inp = document.getElementById('backupSnoozeDays');
    let n = parseInt(inp && inp.value, 10);
    if (!Number.isFinite(n) || n < 1) n = BACKUP_REMINDER_DAYS;
    localStorage.setItem(SNOOZE_KEY, (Date.now() + n * 86400000).toString());
    updateBackupReminder();
}
function importLogs(file) {
    const r = new FileReader();
    r.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (data && typeof data === 'object' && data.logs && typeof data.logs === 'object') {
                // versie 2: logs + cyclusdatums
                saveLogs(data.logs);
                if (data.cycle && Array.isArray(data.cycle.dates)) applyImportedCycle(data.cycle.dates);
            } else {
                // oud formaat: het hele object is de logs
                saveLogs(data);
            }
            renderHistory();
            updateBackupReminder();
            alert('Import gelukt!');
        } catch { alert('Ongeldig bestand.'); }
    };
    r.readAsText(file);
}

/* ─── tips (werkt wel / niet) ──────────────────────────── */
const TIPS_KEY = 'cyclus_tips_v1';

function loadTips() {
    try {
        const t = JSON.parse(localStorage.getItem(TIPS_KEY));
        if (t && Array.isArray(t.well) && Array.isArray(t.not)) return t;
    } catch {}
    return { well: [], not: [] };
}
function saveTips(t) { localStorage.setItem(TIPS_KEY, JSON.stringify(t)); }

/* migrate old string values to array */
function tipArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    const s = val.trim();
    return s ? [s] : [];
}

/* ─── shared helpers ───────────────────────────────────── */
function formatDate(str) { const [y, m, d] = str.split('-'); return `${d}-${m}-${y}`; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
