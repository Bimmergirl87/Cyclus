/* ─── tips (werkt wel / niet) ──────────────────────────── */
const tipsEditMode = { well: false, not: false };

function toggleTipsEdit(type) {
    tipsEditMode[type] = !tipsEditMode[type];
    buildTipsGrids();
}

function deleteTipItem(type, name) {
    const tips = loadTips();
    tips[type] = tips[type].filter(t => t !== name);
    saveTips(tips);
    buildTipsGrids();
    syncSaveFeedback();
}

function renameTipItem(type, oldName, newName) {
    const tips = loadTips();
    if (tips[type].map(s => s.toLowerCase()).includes(newName.toLowerCase())) {
        buildTipsGrids(); return;
    }
    const idx = tips[type].indexOf(oldName);
    if (idx !== -1) tips[type][idx] = newName;
    saveTips(tips);
    const logField = type === 'well' ? 'worksWell' : 'worksNot';
    const logs = loadLogs();
    Object.values(logs).forEach(entry => {
        const arr = tipArray(entry[logField]);
        const i = arr.indexOf(oldName);
        if (i !== -1) { arr[i] = newName; entry[logField] = arr; }
    });
    saveLogs(logs);
    buildTipsGrids();
    syncSaveFeedback();
}

function startRenameTipItem(type, name, lbl) {
    const container = lbl.parentNode;
    const row = document.createElement('div');
    row.className = 'works-rename-row sym-label works-chk-' + type;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = name; inp.className = 'works-rename-input';
    const ok = document.createElement('button');
    ok.textContent = '✓'; ok.className = 'works-rename-confirm';
    let done = false;
    function commit() {
        if (done) return; done = true;
        const v = inp.value.trim();
        if (v && v !== name) renameTipItem(type, name, v);
        else buildTipsGrids();
    }
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { done = true; buildTipsGrids(); } });
    inp.addEventListener('blur', commit);
    ok.addEventListener('mousedown', e => e.preventDefault());
    ok.addEventListener('click', commit);
    row.appendChild(inp); row.appendChild(ok);
    container.replaceChild(row, lbl);
    inp.select();
}

function buildTipsGrids() {
    ['well', 'not'].forEach(type => {
        const gridId   = type === 'well' ? 'worksWellGrid'   : 'worksNotGrid';
        const btnId    = type === 'well' ? 'worksWellEditBtn' : 'worksNotEditBtn';
        const grid     = document.getElementById(gridId);
        const editBtn  = document.getElementById(btnId);
        if (!grid) return;
        const tips    = loadTips();
        const editMode = tipsEditMode[type];
        const checked = new Set(getCheckedValues('#' + gridId));
        grid.innerHTML = '';
        if (editBtn) {
            editBtn.textContent = editMode ? 'Klaar' : 'Bewerk';
            editBtn.classList.toggle('active', editMode);
        }
        tips[type].forEach(name => {
            const lbl = document.createElement('label');
            lbl.className = 'sym-label works-chk-' + type;
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.value = name;
            if (checked.has(name)) cb.checked = true;
            cb.addEventListener('change', syncSaveFeedback);
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(' ' + name));
            if (editMode) {
                const ren = document.createElement('button');
                ren.className = 'works-ren-btn';
                ren.textContent = '✎';
                ren.addEventListener('click', e => { e.stopPropagation(); startRenameTipItem(type, name, lbl); });
                const del = document.createElement('button');
                del.className = 'works-del-btn';
                del.textContent = '×';
                del.addEventListener('click', e => { e.stopPropagation(); deleteTipItem(type, name); });
                lbl.appendChild(ren);
                lbl.appendChild(del);
            }
            grid.appendChild(lbl);
        });
    });
}

function addTipItem(type) {
    const inputId = type === 'well' ? 'worksWellInput' : 'worksNotInput';
    const inp = document.getElementById(inputId);
    const val = inp.value.trim();
    if (!val) return;
    const tips = loadTips();
    if (!tips[type].map(s => s.toLowerCase()).includes(val.toLowerCase())) {
        tips[type].push(val);
        saveTips(tips);
    }
    buildTipsGrids();
    /* auto-check the newly added item */
    const gridId = type === 'well' ? 'worksWellGrid' : 'worksNotGrid';
    const grid = document.getElementById(gridId);
    const cb = [...grid.querySelectorAll('input')].find(c => c.value.toLowerCase() === val.toLowerCase());
    if (cb) {
        cb.checked = true;
        syncSaveFeedback();
    }
    inp.value = '';
}

buildTipsGrids();

/* ─── export / import event listeners ─────────────────── */
document.getElementById('exportBtn').addEventListener('click', exportLogs);
document.getElementById('importFile').addEventListener('change', e => {
    if (e.target.files[0]) importLogs(e.target.files[0]);
});
document.getElementById('backupSnoozeBtn').addEventListener('click', snoozeBackupReminder);
updateBackupReminder();

/* ─── log save / history ───────────────────────────────── */
const logDateInput = document.getElementById('logDate');
logDateInput.value = new Date().toISOString().slice(0, 10);
logDateInput.max   = logDateInput.value;

function toggleSection(id, hdr) {
    const body = document.getElementById(id);
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    hdr.querySelector('.log-sec-arrow').textContent = isOpen ? '▶' : '▼';
}

function toggleCalExportMore() {
    const body = document.getElementById('calExportMore');
    const link = document.getElementById('calExportMoreLink');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    link.style.display = isOpen ? '' : 'none';
}

function toggleAcc(id, btn) {
    const body = document.getElementById(id);
    const isOpen = body.classList.toggle('open');
    btn.querySelector('.log-acc-arrow').textContent = isOpen ? '▼' : '▶';
}

function toggleHistory(btn) {
    const body = document.getElementById('accHistory');
    const isOpen = body.classList.toggle('open');
    btn.querySelector('.history-toggle-text').textContent =
        isOpen ? 'Geschiedenis verbergen' : 'Geschiedenis tonen';
}

function setAcc(id, open) {
    const body = document.getElementById(id);
    if (!body) return;
    body.classList.toggle('open', open);
    const btn = body.previousElementSibling;
    if (btn) btn.querySelector('.log-acc-arrow').textContent = open ? '▼' : '▶';
}

function updateAccSummaries() {
    const symCount = getCheckedCount('#symptomGrid');
    document.getElementById('accSumKlachten').textContent = symCount ? symCount + ' geselecteerd' : '';

    const notes = document.getElementById('logNotes').value.trim();
    document.getElementById('accSumNotities').textContent = notes ? '✓' : '';

    const wellCount = getCheckedCount('#worksWellGrid');
    const notCount = getCheckedCount('#worksNotGrid');
    const parts = [];
    if (wellCount) parts.push(wellCount + ' wel');
    if (notCount) parts.push(notCount + ' niet');
    document.getElementById('accSumWerkt').textContent = parts.join(' · ');
}

function loadLogIntoForm(date) {
    const entry = loadLogs()[date];
    const syms = entry ? (entry.symptoms || []) : [];
    setCheckedValues('#symptomGrid', syms);
    document.getElementById('logNotes').value = entry ? (entry.notes || '') : '';
    const savedWell = entry ? tipArray(entry.worksWell) : [];
    const savedNot = entry ? tipArray(entry.worksNot) : [];
    setCheckedValues('#worksWellGrid', savedWell);
    setCheckedValues('#worksNotGrid', savedNot);
    document.getElementById('saveFeedback').classList.toggle('visible', !!entry);
    setAcc('accKlachten', !entry);
    setAcc('accWerkt', false);
    setAcc('accNotities', !!(entry && entry.notes));
    updateAccSummaries();
}

function syncSaveFeedback() {
    const entry = loadLogs()[logDateInput.value];
    if (!entry) { document.getElementById('saveFeedback').classList.remove('visible'); return; }
    const current = new Set(getCheckedValues('#symptomGrid'));
    const saved = new Set((entry.symptoms || []).map(s => typeof s === 'string' ? s : s.name));
    const symsMatch = current.size === saved.size && [...current].every(s => saved.has(s));
    const notesMatch = document.getElementById('logNotes').value.trim() === (entry.notes || '');
    function checkMatch(gridId, saved) {
        const cur = new Set(getCheckedValues('#' + gridId));
        const prev = new Set(tipArray(saved));
        return cur.size === prev.size && [...cur].every(v => prev.has(v));
    }
    const worksWellMatch = checkMatch('worksWellGrid', entry.worksWell);
    const worksNotMatch = checkMatch('worksNotGrid', entry.worksNot);
    document.getElementById('saveFeedback').classList.toggle('visible', symsMatch && notesMatch && worksWellMatch && worksNotMatch);
    updateAccSummaries();
}

document.getElementById('symptomGrid').addEventListener('change', syncSaveFeedback);
document.getElementById('logNotes').addEventListener('input', syncSaveFeedback);
document.getElementById('worksWellInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTipItem('well'); });
document.getElementById('worksNotInput').addEventListener('keydown',  e => { if (e.key === 'Enter') addTipItem('not');  });

logDateInput.addEventListener('change', () => loadLogIntoForm(logDateInput.value));
loadLogIntoForm(logDateInput.value);

document.getElementById('saveLogBtn').addEventListener('click', () => {
    const date = logDateInput.value;
    if (!date) return;
    const symptoms = getCheckedValues('#symptomGrid');
    const notes = document.getElementById('logNotes').value.trim();
    const worksWell = getCheckedValues('#worksWellGrid');
    const worksNot = getCheckedValues('#worksNotGrid');
    const logs = loadLogs();
    const cycleDay = cycleDayForDate(date);
    logs[date] = { symptoms, notes, worksWell, worksNot, ...(cycleDay > 0 ? { cycleDay } : {}) };
    saveLogs(logs);
    renderHistory();
    if (currentPhase) { renderPhaseSymContainer(currentPhase); renderPhaseSymCompare(currentPhase); renderPhaseTips(currentPhase); }
    loadLogIntoForm(date);
    updateBackupReminder();
});

/* ─── history ──────────────────────────────────────────── */
let historyPage = 0;
const HISTORY_PAGE_SIZE = 5;

function renderHistory() {
    const logs  = loadLogs();
    const el    = document.getElementById('logHistory');
    const dates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
    const count = dates.length;

    const countEl = document.getElementById('historyCount');
    if (countEl) countEl.textContent = count ? `${count} invoer${count !== 1 ? 'en' : ''}` : '';

    if (!count) { el.innerHTML = '<p class="history-empty">Nog niets gelogd.</p>'; return; }

    const totalPages = Math.ceil(count / HISTORY_PAGE_SIZE);
    historyPage = Math.max(0, Math.min(historyPage, totalPages - 1));
    const pageDates = dates.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);

    const entries = pageDates.map(date => {
        const entry    = logs[date];
        const cycleDay = cycleDayForDate(date);
        const phase    = cycleDay > 0 ? phaseForDay(cycleDay) : null;
        const badge    = phase
            ? `<span class="entry-phase">${phase.name} · dag ${cycleDay}</span>`
            : (cycleDay > 0 ? `<span class="entry-phase">Dag ${cycleDay}</span>` : '');
        const rawSyms = entry.symptoms || [];
        const tags = rawSyms.map(s => {
            const name = typeof s === 'string' ? s : s.name;
            return `<span class="entry-tag">${escHtml(name)}</span>`;
        }).join('');
        const notes = entry.notes ? `<div class="entry-notes">${escHtml(entry.notes)}</div>` : '';
        const wellArr = tipArray(entry.worksWell);
        const notArr  = tipArray(entry.worksNot);
        const worksWell = wellArr.length ? `<div class="entry-works entry-works-pos"><span class="entry-works-lbl">Werkt wel:</span> ${wellArr.map(escHtml).join(' · ')}</div>` : '';
        const worksNot  = notArr.length  ? `<div class="entry-works entry-works-neg"><span class="entry-works-lbl">Werkt niet:</span> ${notArr.map(escHtml).join(' · ')}</div>`  : '';
        const hasContent = tags || notes || worksWell || worksNot;
        return `<div class="log-entry">
            <div class="log-entry-header">
                <span class="entry-date">${formatDate(date)}</span>
                ${badge}
                <button class="btn-delete" onclick="deleteLog('${date}')" title="Verwijderen">✕</button>
            </div>
            <div class="log-entry-body">
                ${tags ? `<div class="entry-tags">${tags}</div>` : ''}
                ${notes}
                ${worksWell}
                ${worksNot}
                ${!hasContent ? '<span style="color:var(--text-faint)">Geen gegevens.</span>' : ''}
            </div>
        </div>`;
    }).join('');

    const pagination = totalPages > 1 ? `
        <div class="history-pagination">
            <button class="hist-page-btn" onclick="historyPage--; renderHistory()" ${historyPage === 0 ? 'disabled' : ''}>‹ Vorige</button>
            <span class="hist-page-info">${historyPage + 1} / ${totalPages}</span>
            <button class="hist-page-btn" onclick="historyPage++; renderHistory()" ${historyPage >= totalPages - 1 ? 'disabled' : ''}>Volgende ›</button>
        </div>` : '';

    el.innerHTML = entries + pagination;
}

function deleteLog(date) {
    const logs = loadLogs(); delete logs[date]; saveLogs(logs); renderHistory();
}
