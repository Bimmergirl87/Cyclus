/* ─── cycle setup ──────────────────────────────────────── */
let cycleDates = ['', ''];

function toggleCycleSetup() {
    const setup = document.getElementById('cycleSetup');
    const open  = setup.classList.toggle('open');
    setup.querySelector('.cycle-setup-arrow').textContent = open ? '▼' : '▶';
}

function renderCycleDates() {
    const list = document.getElementById('cycleDateList');
    list.innerHTML = '';
    cycleDates.forEach((val, i) => {
        const row = document.createElement('div');
        row.className = 'cycle-date-row';
        const lbl = document.createElement('label');
        lbl.textContent = `Menstruatie ${i + 1}`;
        const inp = document.createElement('input');
        inp.type = 'date'; inp.value = val;
        inp.max = new Date().toISOString().slice(0, 10);
        inp.addEventListener('change', e => {
            cycleDates[i] = e.target.value;
            sortCycleDates();
            renderCycleDates();
            calcCycleLen();
        });
        row.appendChild(lbl);
        row.appendChild(inp);
        const cell = document.createElement('div');
        cell.className = 'cyc-inline';
        cell.id = `cycLen${i}`;
        row.appendChild(cell);
        if (cycleDates.length > 2) {
            const del = document.createElement('button');
            del.className = 'btn-remove-date'; del.textContent = '×';
            del.onclick = () => { cycleDates.splice(i, 1); renderCycleDates(); calcCycleLen(); };
            row.appendChild(del);
        }
        const warn = document.createElement('div');
        warn.className = 'cycle-date-warn';
        warn.id = `cycleDateWarn${i}`;
        row.appendChild(warn);
        list.appendChild(row);
    });
}

/* Sorteer de ingevulde datums chronologisch (oudste eerst); lege
   velden blijven onderaan staan. */
function sortCycleDates() {
    cycleDates.sort((a, b) => {
        if (!a) return 1;
        if (!b) return -1;
        return a < b ? -1 : a > b ? 1 : 0;
    });
}

/* Markeer dubbele of opvallend dicht op elkaar liggende datums.
   Geeft true terug als er een blokkerend probleem is (duplicaat). */
function flagCloseCycleDates() {
    cycleDates.forEach((_, i) => {
        const w = document.getElementById(`cycleDateWarn${i}`);
        if (w) { w.textContent = ''; w.style.display = 'none'; }
    });
    let hasDuplicate = false;
    cycleDates.forEach((val, i) => {
        if (!val) return;
        // afstand tot de dichtstbijzijnde andere menstruatie
        let nearest = null;
        for (let j = 0; j < cycleDates.length; j++) {
            if (j === i || !cycleDates[j]) continue;
            const gap = Math.abs(Math.round((new Date(val) - new Date(cycleDates[j])) / MS_PER_DAY));
            if (nearest === null || gap < nearest) nearest = gap;
        }
        if (nearest === null) return;
        let msg = '';
        if (nearest === 0)     { msg = 'Deze datum heb je al ingevuld.'; hasDuplicate = true; }
        else if (nearest < 15)  msg = `Ligt maar ${nearest} ${nearest === 1 ? 'dag' : 'dagen'} van een andere datum.`;
        else if (nearest > 45)  msg = `Ligt ${nearest} dagen van de dichtstbijzijnde menstruatie; dat is uitzonderlijk ver.`;
        const w = document.getElementById(`cycleDateWarn${i}`);
        if (w && msg) { w.textContent = msg; w.style.display = ''; }
    });
    return hasDuplicate;
}

/* Vul per datumregel de cycluslengte in als balkje dat van links vol loopt.
   De schaal begint niet bij 0 maar rond het gemiddelde (een venster van
   ± CYC_SPAN dagen), zodat kleine verschillen tussen cycli uitvergroot
   worden — de verhoudingen zijn dus bewust niet exact. Het gemiddelde valt
   altijd in het midden. De vroegste datum heeft geen voorganger en blijft leeg. */
const CYC_SPAN = 10;   // halve vensterbreedte in dagen rond het gemiddelde
function updateInlineLengths() {
    const gaps = cycleDates.map((val, i) => {
        if (!val) return null;
        let prev = null;
        cycleDates.forEach((o, j) => {
            if (j === i || !o || o >= val) return;
            if (prev === null || o > prev) prev = o;
        });
        return prev ? Math.round((new Date(val) - new Date(prev)) / MS_PER_DAY) : null;
    });

    const valid = gaps.filter(g => g !== null && g > 0);
    const avg   = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    const lo    = avg - CYC_SPAN;
    const hi    = avg + CYC_SPAN;
    const toPct = v => Math.max(6, Math.min(100, (v - lo) / (hi - lo) * 100));

    cycleDates.forEach((_, i) => {
        const cell = document.getElementById(`cycLen${i}`);
        if (!cell) return;
        const g = gaps[i];
        if (g === null || g <= 0) { cell.innerHTML = ''; cell.classList.add('cyc-inline-empty'); return; }
        cell.classList.remove('cyc-inline-empty');
        const pct     = toPct(g);
        const avgPct  = toPct(avg);
        const unusual = g < 21 || g > 35;
        const diff    = Math.round(g - avg);
        const tip     = diff === 0 ? 'Gelijk aan gemiddeld' : `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dag' : 'dagen'} ${diff > 0 ? 'langer' : 'korter'} dan gemiddeld`;
        cell.innerHTML = `
            <div class="cyc-bar-track" title="${tip}">
                <div class="cyc-bar-fill${unusual ? ' cyc-bar-unusual' : ''}" style="width:${pct}%"></div>
                <div class="cyc-avg-mark" style="left:${avgPct}%"></div>
            </div>
            <span class="cyc-bar-val">${g} d</span>`;
    });
}

function addCycleDate() {
    cycleDates.push('');
    renderCycleDates();
}

function calcCycleLen() {
    const hasDuplicate = flagCloseCycleDates();
    updateInlineLengths();
    const filled = cycleDates.filter(d => d).sort();
    const el      = document.getElementById('cycleCalcResult');
    const summary = document.getElementById('cycleSetupSummary');
    if (filled.length < 2) {
        el.textContent = filled.length === 1 ? 'Voer nog minimaal één datum in.' : '';
        summary.textContent = ''; return;
    }
    if (hasDuplicate) {
        el.textContent = 'Sommige datums zijn dubbel ingevuld. Pas ze aan om de cycluslengte te berekenen.';
        el.style.color = 'var(--accent)';
        summary.textContent = ''; return;
    }
    const intervals = [];
    for (let i = 1; i < filled.length; i++) {
        intervals.push(Math.round((new Date(filled[i]) - new Date(filled[i - 1])) / MS_PER_DAY));
    }
    if (intervals.some(l => l < 15 || l > 60)) {
        el.textContent = 'Controleer de datums, de tussenliggende periode lijkt ongebruikelijk.';
        el.style.color = 'var(--accent)';
        summary.textContent = ''; return;
    }
    avgCycleLen = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    el.textContent = `Gemiddeld ${avgCycleLen} dagen`;
    el.style.color = 'var(--text-muted)';
    summary.textContent = `${avgCycleLen} dagen`;
    StorageAPI.setItem(STORAGE_KEYS.CYCLE_SETUP, { dates: filled });
    const newStart = filled[filled.length - 1];
    document.getElementById('startDate').value = newStart;
    syncIcsParams(newStart, avgCycleLen);
    update();
}

function applyImportedCycle(dates) {
    const valid = (dates || []).filter(d => d);
    if (valid.length < 2) return;       // niets bruikbaars om de cyclus mee te bepalen
    cycleDates = [...valid];
    sortCycleDates();
    renderCycleDates();
    calcCycleLen();                     // herberekent lengte, zet startdatum + ICS-params, slaat op
}

/* ─── iframe communication ─────────────────────────────── */
const input = document.getElementById('startDate');
const info  = document.getElementById('info');

(function restoreCycleSetup() {
    const s = StorageAPI.getItem(STORAGE_KEYS.CYCLE_SETUP);
    if (s) {
        if (Array.isArray(s.dates) && s.dates.length >= 2) {
            cycleDates = [...s.dates];
        } else if (s.d1 && s.d2) {
            cycleDates = [s.d1, s.d2, s.d3].filter(Boolean);
        }
    }
    renderCycleDates();
    if (cycleDates.filter(Boolean).length >= 2) calcCycleLen();
})();

function sendDayToFrame(day) {
    const frame = document.getElementById('cyclusFrame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'cyclusDay', day, cycleLen: avgCycleLen }, '*');
    }
}

/* ─── main update ──────────────────────────────────────── */
function update() {
    const val = input.value;
    if (!val) {
        info.textContent = 'Kies een datum om je positie in de cyclus te zien.';
        document.getElementById('infoNextMens').style.display = 'none';
        sendDayToFrame(1);
        hidePhase(); return;
    }
    const { y: sy, m: sm, d: sd } = parseISODate(val);
    const start    = new Date(sy, sm - 1, sd);
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const cycleDay = Math.round((today - start) / MS_PER_DAY) + 1;
    const phase    = phaseForDay(cycleDay);

    sendDayToFrame(cycleDay);

    if (cycleDay < 1) {
        info.textContent = 'Die datum ligt in de toekomst.';
        document.getElementById('infoNextMens').style.display = 'none';
        hidePhase();
    } else if (cycleDay > 35) {
        info.textContent = `Dag ${cycleDay}. Controleer de datum.`;
        document.getElementById('infoNextMens').style.display = 'none';
        hidePhase();
    } else {
        info.textContent = `Je bent nu op dag ${cycleDay} van je cyclus` +
            (cycleDay > avgCycleLen ? ' (langer dan verwacht)' : '');

        const nextMensEl = document.getElementById('infoNextMens');
        const daysLeft   = avgCycleLen - cycleDay;
        const nextMens   = new Date(start);
        nextMens.setDate(nextMens.getDate() + avgCycleLen);
        const nextStr    = nextMens.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
        if (daysLeft > 0) {
            nextMensEl.textContent = `Volgende menstruatie: ${nextStr} (over ${daysLeft} dagen)`;
        } else if (daysLeft === 0) {
            nextMensEl.textContent = 'Menstruatie verwacht vandaag';
        } else {
            nextMensEl.textContent = `Menstruatie verwacht op ${nextStr}`;
        }
        nextMensEl.style.display = '';

        if (phase) showPhase(phase); else hidePhase();
    }
}

function syncIcsParams(startVal, cycleLen) {
    const sd = document.getElementById('icsStartDate');
    const cl = document.getElementById('icsCycleLen');
    if (startVal) sd.value = startVal;
    if (cycleLen)  cl.value = cycleLen;
}

function updateCycleDayHint() {
    document.getElementById('cycleDayHint').style.display =
        document.getElementById('startDate').value ? 'none' : '';
}

input.addEventListener('change', () => {
    if (input.value) syncIcsParams(input.value, null);
    update();
    updateCycleDayHint();
});
input.max = new Date().toISOString().slice(0, 10);

renderHistory();
updateCycleDayHint();

/* ─── theme toggle ─────────────────────────────────────── */
function applyTheme(dark) {
    document.documentElement.classList.toggle('dark-mode', dark);
    document.documentElement.classList.toggle('light-mode', !dark);
    document.getElementById('themeBtn').textContent = dark ? '☀' : '☾';
    const frame = document.getElementById('cyclusFrame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'theme', dark }, '*');
    }
}

function toggleTheme() {
    const dark = !document.documentElement.classList.contains('dark-mode');
    StorageAPI.setString(STORAGE_KEYS.THEME, dark ? 'dark' : 'light');
    applyTheme(dark);
}

(function () {
    const saved = StorageAPI.getString(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    applyTheme(dark);
})();

// re-send theme after iframe loads (in case it loaded before applyTheme ran)
window.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.type === 'dayChanged') {
        const phase = phaseForDay(e.data.day);
        if (phase) showPhase(phase); else hidePhase();
    }
    if (e.data.type === 'cycleLenChanged') {
        avgCycleLen = e.data.cycleLen;
        const phase = phaseForDay(e.data.day, avgCycleLen);
        if (phase) showPhase(phase); else hidePhase();
        update();
    }
});

document.getElementById('cyclusFrame').addEventListener('load', () => {
    const dark = document.documentElement.classList.contains('dark-mode');
    const frame = document.getElementById('cyclusFrame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'theme', dark }, '*');
    }
    if (input.value) update();
});

/* ─── event listeners ──────────────────────────────────────── */
document.getElementById('themeBtn').addEventListener('click', toggleTheme);
document.getElementById('cycleSetupBtn').addEventListener('click', toggleCycleSetup);
document.getElementById('addCycleDateBtn').addEventListener('click', addCycleDate);

document.querySelectorAll('.pst-btn').forEach(btn => {
    btn.addEventListener('click', (e) => switchPhaseSymTab(e.currentTarget.dataset.tab));
});

document.querySelectorAll('[data-acc]').forEach(btn => {
    btn.addEventListener('click', (e) => toggleAcc(e.currentTarget.dataset.acc, e.currentTarget));
});

document.getElementById('symSettingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSymSettings();
});

document.querySelectorAll('[data-action="toggleAddSym"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.category.replace('&amp;', '&');
        toggleAddSym(cat);
    });
});

document.querySelectorAll('[data-action="commitAddSym"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.category.replace('&amp;', '&');
        commitAddSym(cat);
    });
});

document.querySelectorAll('[data-action="toggleTipsEdit"]').forEach(btn => {
    btn.addEventListener('click', (e) => toggleTipsEdit(e.currentTarget.dataset.type));
});

document.querySelectorAll('[data-action="addTipItem"]').forEach(btn => {
    btn.addEventListener('click', (e) => addTipItem(e.currentTarget.dataset.type));
});

document.getElementById('focusStartDateLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('startDate').focus();
});

document.getElementById('historyToggleBtn').addEventListener('click', (e) => {
    toggleHistory(e.currentTarget);
});

document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', (e) => {
        toggleSection(e.currentTarget.dataset.section, e.currentTarget);
    });
});

document.getElementById('calExportMoreLink').addEventListener('click', toggleCalExportMore);
document.getElementById('calExportLessLink').addEventListener('click', toggleCalExportMore);
