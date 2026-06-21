/* ─── agenda-item titel ────────────────────────────────── */
function icsSummary(style, phaseName, cycleDay) {
    if (style === 'day') return 'Dag ' + cycleDay;
    if (style === 'neutral') return 'Dagadvies';
    return phaseName + ' (dag ' + cycleDay + ')';
}

/* ─── ICS calendar export ──────────────────────────────── */
function exportICS() {
    const startVal = document.getElementById('icsStartDate').value;
    if (!startVal) {
        document.getElementById('icsStartDate').focus();
        return;
    }

    const icsCycleLen = Math.max(21, Math.min(45, parseInt(document.getElementById('icsCycleLen').value, 10) || 28));
    const [sy, sm, sd] = startVal.split('-').map(Number);
    const cycleStart = new Date(sy, sm - 1, sd);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const months = parseInt(document.getElementById('icsMonths').value, 10) || 2;
    const rangeEnd = new Date(today);
    rangeEnd.setMonth(rangeEnd.getMonth() + months);

    function icsText(str) {
        return str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    }

    function datePart(d) {
        return d.getFullYear()
            + String(d.getMonth() + 1).padStart(2, '0')
            + String(d.getDate()).padStart(2, '0');
    }

    const inclGeneriek     = document.getElementById('icsIncludeGeneriek').checked;
    const inclEigen        = document.getElementById('icsIncludeEigen').checked;
    const inclActiviteiten = document.getElementById('icsIncludeActiviteiten').checked;
    const inclKenmerken    = document.getElementById('icsIncludeKenmerken').checked;
    const titleStyle       = document.getElementById('icsTitleStyle').value;
    const eigenFreqCache   = {};
    function dots(score) { return '●'.repeat(score) + '○'.repeat(5 - score); }

    const events = [];
    const cursor = new Date(today);
    while (cursor <= rangeEnd) {
        const rawDay = Math.round((cursor - cycleStart) / 86400000) + 1;
        if (rawDay >= 1) {
            const cycleDay = ((rawDay - 1) % icsCycleLen) + 1;
            const phase = phaseForDay(cycleDay, icsCycleLen);
            if (phase) {
                const parts = [];
                if (titleStyle === 'neutral') {
                    parts.push(phase.name + ' (dag ' + cycleDay + ')');
                } else if (titleStyle === 'day') {
                    parts.push(phase.name);
                }
                if (inclKenmerken) {
                    if (parts.length) parts.push('');
                    parts.push('Kenmerken: ' + phase.plannen);
                }
                if (inclGeneriek) {
                    if (parts.length) parts.push('');
                    parts.push('Generieke symptomen: ' + phase.symptoms.slice(0, 5).join(', '));
                }
                if (inclEigen) {
                    if (!(phase.name in eigenFreqCache)) {
                        const freq = computePhaseSymFreq(phase.name) || {};
                        eigenFreqCache[phase.name] = Object.entries(freq)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([n]) => n);
                    }
                    const topEigen = eigenFreqCache[phase.name];
                    if (topEigen.length) {
                        if (!inclGeneriek && parts.length) parts.push('');
                        parts.push('Eigen symptomen: ' + topEigen.join(', '));
                    }
                }
                if (inclActiviteiten) {
                    if (parts.length) parts.push('');
                    parts.push(
                        'Sport ' + dots(phase.sport.score), phase.sport.tip,
                        '', 'Sociaal ' + dots(phase.sociaal.score), phase.sociaal.tip,
                        '', 'Zelfvertrouwen ' + dots(phase.mentaal.score), phase.mentaal.tip,
                        '', 'Denkvermogen ' + dots(phase.denkvermogen.score), phase.denkvermogen.tip
                    );
                }
                const desc = icsText(parts.join('\n'));

                const nextDay = new Date(cursor);
                nextDay.setDate(nextDay.getDate() + 1);

                events.push([
                    'BEGIN:VEVENT',
                    'DTSTART;VALUE=DATE:' + datePart(cursor),
                    'DTEND;VALUE=DATE:' + datePart(nextDay),
                    'SUMMARY:' + icsText(icsSummary(titleStyle, phase.name, cycleDay)),
                    'DESCRIPTION:' + desc,
                    'COLOR:' + phase.color,
                    'UID:cyclus-' + datePart(cursor) + '@cyclustracker',
                    'END:VEVENT',
                ].join('\r\n'));
            }
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Cyclus Tracker//NL',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Cyclus',
        ...events,
        'END:VCALENDAR',
    ].join('\r\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'cyclus.ics';
    a.click();
}

document.getElementById('exportIcsBtn').addEventListener('click', exportICS);

/* ─── ICS preview update ───────────────────────────────── */
function updateIcsPreview() {
    const generiek = document.getElementById('icsIncludeGeneriek').checked;
    const eigen = document.getElementById('icsIncludeEigen').checked;
    const activiteiten = document.getElementById('icsIncludeActiviteiten').checked;
    const kenmerken = document.getElementById('icsIncludeKenmerken').checked;
    
    const show = (id, visible) => { document.getElementById(id).style.display = visible ? '' : 'none'; };
    
    const titleStyle = document.getElementById('icsTitleStyle').value;
    document.getElementById('icsPreviewHeader').textContent =
        icsSummary(titleStyle, 'Late luteale fase', 23);

    const showFase = titleStyle === 'neutral' || titleStyle === 'day';
    if (showFase) {
        document.getElementById('icsPreviewFase').textContent =
            titleStyle === 'neutral' ? 'Late luteale fase (dag 23)' : 'Late luteale fase';
    }
    show('icsPreviewFase',        showFase);
    show('icsPreviewGeneriek',    generiek);
    show('icsPreviewActiviteiten', activiteiten);
    show('icsPreviewKenmerken',   kenmerken);
    show('icsPreviewEmpty',       !showFase && !generiek && !eigen && !activiteiten && !kenmerken);
    
    document.getElementById('icsPreviewBody').style.display = '';

    const eigenEl = document.getElementById('icsPreviewEigen');
    
    eigenEl.style.display = eigen ? '' : 'none';
    
    if (eigen) {
        const previewPhase = PHASES.find(p => p.name === 'Late luteale fase');
        const freq = previewPhase ? (computePhaseSymFreq(previewPhase.name) || {}) : {};
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
        const textEl = document.getElementById('icsPreviewEigenText');
        textEl.textContent = top.length ? top.join(' · ') : 'nog geen logs voor deze fase';
        textEl.style.fontStyle = top.length ? 'normal' : 'italic';
    }
}

updateIcsPreview();

document.getElementById('icsIncludeGeneriek').addEventListener('change', updateIcsPreview);
document.getElementById('icsIncludeEigen').addEventListener('change', updateIcsPreview);
document.getElementById('icsIncludeActiviteiten').addEventListener('change', updateIcsPreview);
document.getElementById('icsIncludeKenmerken').addEventListener('change', updateIcsPreview);
document.getElementById('icsTitleStyle').addEventListener('change', updateIcsPreview);
