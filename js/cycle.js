/* ─── phase panel ──────────────────────────────────────── */
function computeRanges(cycleLen) {
    const ov       = Math.round(cycleLen * 0.46);
    const progPeak = cycleLen - 7;
    return [
        [1,          5],
        [6,          Math.max(6, ov - 4)],
        [ov - 3,     ov - 2],
        [ov - 1,     ov + 1],
        [ov + 2,         progPeak],
        [progPeak + 1,   cycleLen + 10],
    ];
}

function phaseForDay(day, cycleLen) {
    cycleLen = cycleLen || avgCycleLen;
    const ranges = computeRanges(cycleLen);
    const idx = ranges.findIndex(([s, e]) => day >= s && day <= e);
    if (idx === -1) return null;
    const [s, e] = ranges[idx];
    return {
        ...PHASES[idx],
        range: [s, e],
        days: `Dag ${s}–${Math.min(e, cycleLen)}`,
    };
}

function cycleDayForDate(dateStr) {
    const startVal = document.getElementById('startDate').value;
    if (!startVal) return 0;
    const { y: sy, m: sm, d: sd } = parseISODate(startVal);
    const { y: ty, m: tm, d: td } = parseISODate(dateStr);
    return Math.round((new Date(ty, tm - 1, td) - new Date(sy, sm - 1, sd)) / MS_PER_DAY) + 1;
}

/* ─── dynamic hormone levels ──────────────────────────────── */
function _gauss(x, mu, sigma, amp) { return amp * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)); }
function _sigmoid(x, c, k) { return 1 / (1 + Math.exp(-k * (x - c))); }

function buildHormoneData(cycleLen) {
    const ov = Math.round(cycleLen * 0.46);
    const pk = cycleLen - 7;
    const fsh = [], lh = [], estro = [], prog = [];
    for (let d = 1; d <= cycleLen; d++) {
        fsh.push(Math.max(0.04, 0.15 + _gauss(d, 3.5, 2.2, 0.18) + _gauss(d, ov, 0.65, 0.52) + 0.14 * _sigmoid(d, cycleLen - 3, 0.8)));
        lh.push(Math.max(0, 0.07 + _gauss(d, ov, 0.65, 1.0)));
        const op = ov - 1;
        const ep = d <= op ? 0.95 * Math.pow(Math.max(0, (d - 1) / (op - 1)), 2.2)
                            : 0.95 * Math.exp(-0.28 * Math.pow(d - op, 2));
        estro.push(Math.max(0.04, ep + _gauss(d, pk, cycleLen * 0.12, 0.44) + 0.03));
        const p = _gauss(d, pk, cycleLen * 0.115, 0.95);
        prog.push(d < ov ? Math.min(p, 0.04) : Math.max(0.03, p));
    }
    return { fsh, lh, estro, prog };
}

function computePhaseHormones(range, cycleLen) {
    const data = buildHormoneData(cycleLen);
    const s = range[0];
    const e = Math.min(range[1], cycleLen);
    const maxOf = arr => Math.max(...arr);
    const mFsh = maxOf(data.fsh), mLh = maxOf(data.lh), mEst = maxOf(data.estro), mPrg = maxOf(data.prog);

    function stats(arr, cMax) {
        const sl = arr.slice(s - 1, e);
        const avg  = sl.reduce((a, b) => a + b, 0) / sl.length;
        const fill = Math.round(avg / cMax * 100);
        const rel  = avg / cMax;
        const trend = (sl[sl.length - 1] - sl[0]) / ((sl.length - 1) || 1) / cMax;
        let level = rel > 0.80 ? 'piek' : rel > 0.55 ? 'hoog' : rel > 0.30 ? 'matig' : rel > 0.12 ? 'laag' : 'zeer laag';
        let label = level;
        if (level !== 'piek') {
            if (trend >  0.015) label += ', stijgend';
            else if (trend < -0.015) label += ', dalend';
        }
        return { fill, label };
    }

    const est = stats(data.estro, mEst);
    const prg = stats(data.prog,  mPrg);
    const fsh = stats(data.fsh,   mFsh);
    const lh  = stats(data.lh,    mLh);
    return [
        { name: 'Oestradiol',  fill: est.fill, label: est.label, color: '#f2d232' },
        { name: 'Progesteron', fill: prg.fill, label: prg.label, color: '#4db8c8' },
        { name: 'FSH',         fill: fsh.fill, label: fsh.label, color: '#7ab55c' },
        { name: 'LH',          fill: lh.fill,  label: lh.label,  color: '#e87ab0' },
    ];
}

function renderHormones(hormones) {
    return hormones.map(h => `
        <div class="hormone-row">
            <span class="hormone-name">${h.name}</span>
            <div class="hormone-bar-bg">
                <div class="hormone-bar-fill" style="width:${h.fill}%;background:${h.color}"></div>
            </div>
            <span class="hormone-label">${h.label}</span>
        </div>`).join('');
}

function getLogsForPhase(phaseName) {
    const startVal = document.getElementById('startDate').value;
    if (!startVal) return [];
    const logs = [];
    Object.entries(loadLogs()).forEach(([date, entry]) => {
        const rawDay = cycleDayForDate(date);
        if (rawDay < 1 - avgCycleLen * 10) return;
        const cycDay = normalizeCycleDay(rawDay, avgCycleLen);
        const p = phaseForDay(cycDay);
        if (!p || p.name !== phaseName) return;
        logs.push(entry);
    });
    return logs;
}

function computePhaseSymFreq(phaseName) {
    const freq = {};
    getLogsForPhase(phaseName).forEach(entry => {
        (entry.symptoms || []).forEach(s => {
            const name = typeof s === 'string' ? s : s.name;
            freq[name] = (freq[name] || 0) + 1;
        });
    });
    return Object.keys(freq).length ? freq : null;
}

function computePhaseLoggedDays(phaseName) {
    return getLogsForPhase(phaseName).filter(e => (e.symptoms || []).length).length;
}

function computePhaseWorksHistory(phaseName) {
    const well = {}, not = {};
    getLogsForPhase(phaseName).forEach(entry => {
        tipArray(entry.worksWell).forEach(v => { well[v] = (well[v] || 0) + 1; });
        tipArray(entry.worksNot).forEach(v  => { not[v]  = (not[v]  || 0) + 1; });
    });
    const hasAny = Object.keys(well).length || Object.keys(not).length;
    return hasAny ? { well, not } : null;
}
