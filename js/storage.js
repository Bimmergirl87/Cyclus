/* ─── symptom settings ─────────────────────────────────── */
function loadSymSettings() {
    const s = StorageAPI.getItem(STORAGE_KEYS.SYM_SETTINGS);
    if (s && Array.isArray(s.shown) && Array.isArray(s.hidden)) {
        const custom = new Set(s.custom || []);
        const allSet = new Set(ALL_SYMPTOMS);
        s.shown  = s.shown.filter(n => allSet.has(n) || custom.has(n));
        s.hidden = s.hidden.filter(n => allSet.has(n) || custom.has(n));
        ALL_SYMPTOMS.forEach(d => {
            if (!s.shown.includes(d) && !s.hidden.includes(d)) s.shown.push(d);
        });
        return { shown: s.shown, hidden: s.hidden, custom: s.custom || [], customCats: s.customCats || {} };
    }
    return { shown: [...ALL_SYMPTOMS], hidden: [], custom: [], customCats: {} };
}

function saveSymSettings(s) {
    StorageAPI.setItem(STORAGE_KEYS.SYM_SETTINGS, s);
}

/* ─── localStorage ─────────────────────────────────────── */
function loadLogs() {
    return StorageAPI.getItem(STORAGE_KEYS.CYCLE_LOG, {});
}
function saveLogs(logs) {
    StorageAPI.setItem(STORAGE_KEYS.CYCLE_LOG, logs);
}

function buildBackup() {
    const setup = StorageAPI.getItem(STORAGE_KEYS.CYCLE_SETUP);
    const dates = (setup && Array.isArray(setup.dates)) ? setup.dates : [];
    return { version: 2, cycle: { dates }, logs: loadLogs() };
}

function exportLogs() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' }));
    a.download = 'cyclus_backup.json';
    a.click();
    StorageAPI.setString(STORAGE_KEYS.LAST_BACKUP, Date.now().toString());
    StorageAPI.removeItem(STORAGE_KEYS.BACKUP_SNOOZE);
    updateBackupReminder();
}

/* ─── backup-herinnering ───────────────────────────────── */
const BACKUP_REMINDER_DAYS = 5;

function updateBackupReminder() {
    const el = document.getElementById('backupReminder');
    if (!el) return;
    const textEl = document.getElementById('backupReminderText');

    if (Object.keys(loadLogs()).length === 0) { el.style.display = 'none'; return; }

    const snoozeUntil = parseInt(StorageAPI.getString(STORAGE_KEYS.BACKUP_SNOOZE, '0'), 10);
    if (snoozeUntil && Date.now() < snoozeUntil) { el.style.display = 'none'; return; }

    const last = parseInt(StorageAPI.getString(STORAGE_KEYS.LAST_BACKUP, '0'), 10);
    const days = last ? Math.floor((Date.now() - last) / MS_PER_DAY) : Infinity;

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
    StorageAPI.setString(STORAGE_KEYS.BACKUP_SNOOZE, (Date.now() + n * MS_PER_DAY).toString());
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
function loadTips() {
    const t = StorageAPI.getItem(STORAGE_KEYS.TIPS);
    if (t && Array.isArray(t.well) && Array.isArray(t.not)) return t;
    return { well: [], not: [] };
}
function saveTips(t) {
    StorageAPI.setItem(STORAGE_KEYS.TIPS, t);
}

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
