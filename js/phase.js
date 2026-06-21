/* ─── phase panel UI state ─────────────────────────────── */
let phaseSymTab       = 'typical';
let phaseSymExpanded  = false;   // "Typisch" (overige symptomen)
let phaseUserExpanded = false;   // "Jij" (overige symptomen)

const PHASE_SYM_LIMIT = 8;

/* append a collapsible "toon meer" block (hidden by default) to `el` */
function appendPhaseSymExtra(el, rowsHtml, moreLabel, getState, setState) {
    if (!rowsHtml.length) return;
    const extra = document.createElement('div');
    extra.className = 'phase-sym-extra';
    extra.innerHTML = rowsHtml.join('');
    const btn = document.createElement('button');
    btn.className = 'phase-sym-more-btn';
    const expanded = getState();
    if (expanded) { btn.classList.add('expanded'); extra.classList.add('visible'); }
    btn.textContent = expanded ? 'Toon minder' : moreLabel;
    btn.addEventListener('click', () => {
        const now = btn.classList.toggle('expanded');
        extra.classList.toggle('visible', now);
        btn.textContent = now ? 'Toon minder' : moreLabel;
        setState(now);
    });
    el.appendChild(extra);
    el.appendChild(btn);
}

function renderPhaseSymContainer(phase) {
    const el = document.getElementById('phase-sym-container');
    if (!el || !phase) return;

    if (phaseSymTab === 'typical') {
        const pct = phase.prevalence || {};
        const makeRow = s => `<div class="phase-sym-row"><span class="phase-sym-bullet" style="background:${phase.color}"></span><span class="phase-sym-name">${escHtml(s)}</span>${pct[s] != null ? `<div class="phase-sym-bar-wrap"><div class="phase-sym-bar" style="width:${pct[s]}%;background:${phase.color}"></div></div><span class="phase-sym-count">${pct[s]}%</span>` : ''}</div>`;
        el.innerHTML = phase.symptoms.slice(0, PHASE_SYM_LIMIT).map(makeRow).join('');
        const rest = phase.symptoms.slice(PHASE_SYM_LIMIT);
        appendPhaseSymExtra(el, rest.map(makeRow), `Toon ${rest.length} meer…`,
            () => phaseSymExpanded, v => phaseSymExpanded = v);
        return;
    }

    const freq = computePhaseSymFreq(phase.name);
    if (!freq) {
        el.innerHTML = '<p class="phase-sym-hint">Kies een startdatum om je eigen patroon te zien.</p>';
        return;
    }

    const maxCount = Math.max(1, ...Object.values(freq));

    function makeBarRow(name) {
        const count = freq[name] || 0;
        const pct   = (count / maxCount * 100).toFixed(0);
        return `<div class="phase-sym-row">
            <span class="phase-sym-bullet" style="background:${phase.color}"></span>
            <span class="phase-sym-name">${escHtml(name)}</span>
            <div class="phase-sym-bar-wrap"><div class="phase-sym-bar" style="width:${pct}%;background:${phase.color}"></div></div>
            <span class="phase-sym-count">${count > 0 ? count + '×' : ''}</span>
        </div>`;
    }

    // alle gelogde symptomen (typisch + eigen), alleen daadwerkelijk gelogd,
    // gesorteerd op hoeveelheid keren gelogd
    const logged = [...new Set([...phase.symptoms, ...Object.keys(freq)])]
        .filter(n => (freq[n] || 0) > 0)
        .sort((a, b) => freq[b] - freq[a]);

    if (!logged.length) {
        el.innerHTML = '<p class="phase-sym-hint">Nog niets gelogd in deze fase.</p>';
        return;
    }

    // hoofdlijst (ingeklapt na de eerste PHASE_SYM_LIMIT)
    el.innerHTML = logged.slice(0, PHASE_SYM_LIMIT).map(makeBarRow).join('');
    const rest = logged.slice(PHASE_SYM_LIMIT);
    appendPhaseSymExtra(el, rest.map(makeBarRow), `Toon ${rest.length} meer…`,
        () => phaseUserExpanded, v => phaseUserExpanded = v);
}

function switchPhaseSymTab(tab) {
    phaseSymTab = tab;
    document.querySelectorAll('.pst-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (currentPhase) renderPhaseSymContainer(currentPhase);
}

function renderPhaseSymCompare(phase) {
    const el = document.getElementById('phase-sym-compare');
    if (!el) return;
    const freq = computePhaseSymFreq(phase.name);
    const prevalence = phase.prevalence || {};
    if (!freq || Object.keys(freq).length === 0) { el.innerHTML = ''; return; }

    const days = computePhaseLoggedDays(phase.name);
    if (days < 2) { el.innerHTML = ''; return; }

    // We look at *presence* (do you get this symptom at all) against the
    // population prevalence, which is itself a presence figure (% of women who
    // experience it during this phase). A per-day logging rate is a different unit,
    // so we only use it to confirm you get something REGULARLY (not a one-off).
    // We then flag three things, each only where it is actually meaningful:
    //   - "vaker":       you regularly get a symptom that is UNCOMMON in the population
    //   - "anders":      you never get a symptom that is VERY COMMON ("minder vaak last")
    //   - "gevrijwaard": you never get a symptom that is in this phase's typical list
    // So every typical symptom you skip gets a positive note, except the very common
    // ones, which instead read as "minder vaak last dan andere vrouwen".
    const COMMON  = 70;   // prevalence at/above which never having it reads as "minder vaak last"
    const RARE    = 40;   // prevalence at/below which regularly having it is striking
    const REGULAR = 40;   // you log it on at least this share of your logged days

    const names = new Set([...Object.keys(freq), ...Object.keys(prevalence)]);
    const vakerD = [], andersD = [], gevrijwaardD = [];
    names.forEach(name => {
        const userDays = freq[name] || 0;
        const userRate = userDays / days * 100;
        const popPct   = prevalence[name] || 0;
        if (userDays === 0 && popPct >= COMMON) {
            andersD.push({ name, popPct });
        } else if (userDays === 0 && popPct > 0) {
            gevrijwaardD.push({ name, popPct });
        } else if (userRate >= REGULAR && popPct <= RARE) {
            vakerD.push({ name, popPct, userRate });
        }
    });

    // you experience this far more often than other women (rarest in the population first)
    const vaker = vakerD
        .sort((a, b) => a.popPct - b.popPct || b.userRate - a.userRate)
        .slice(0, 2)
        .map(d => d.name);

    // very common for other women, but you never get it (most common first)
    const anders = andersD
        .sort((a, b) => b.popPct - a.popPct)
        .slice(0, 2)
        .map(d => d.name);

    // a fair share of women get it, lucky you never do (most common first)
    const gevrijwaard = gevrijwaardD
        .sort((a, b) => b.popPct - a.popPct)
        .slice(0, 2)
        .map(d => d.name);

    if (!vaker.length && !anders.length && !gevrijwaard.length) { el.innerHTML = ''; return; }

    const fmt = arr => arr.map((s, i) =>
        `<strong>${escHtml(s)}</strong>${i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' en ' : ''}`
    ).join('');

    const clauses = [];
    if (vaker.length)  clauses.push(`ervaar jij vaker last van ${fmt(vaker)}`);
    if (anders.length) clauses.push(`heb jij minder vaak last van ${fmt(anders)}`);
    let zin = '';
    if (clauses.length) zin = `In vergelijking met andere vrouwen ${clauses.join(', en ')}.`;
    if (gevrijwaard.length) {
        zin += `${zin ? ' ' : ''}Gelukkig blijf je gevrijwaard van ${fmt(gevrijwaard)}.`;
    }

    el.innerHTML = `<p class="phase-sym-compare-text">${zin}</p>`;
}

function renderInsights(phase) {
    function dots(score, color) {
        return Array.from({ length: 5 }, (_, i) =>
            `<span class="insight-dot" style="background:${i < score ? color : 'var(--border)'}"></span>`
        ).join('');
    }
    function card(title, score, tip) {
        return `<div class="insight-card">
            <div class="insight-card-title">${title}</div>
            <div class="insight-dots">${dots(score, phase.color)}</div>
            <div class="insight-tip">${tip}</div>
        </div>`;
    }
    return `<div class="phase-plannen">${phase.plannen}</div>`
         + card('Sport', phase.sport.score, phase.sport.tip)
         + card('Sociaal', phase.sociaal.score, phase.sociaal.tip)
         + card('Zelfvertrouwen', phase.mentaal.score, phase.mentaal.tip)
         + card('Denkvermogen', phase.denkvermogen.score, phase.denkvermogen.tip);
}

function renderPhaseTips(phase) {
    const el = document.getElementById('phase-tips');
    if (!el) return;
    const works = computePhaseWorksHistory(phase.name);
    if (!works) { el.innerHTML = ''; return; }

    function makeItems(freq, color) {
        const entries = Object.entries(freq).sort(([na, a], [nb, b]) => b - a || na.localeCompare(nb, 'nl'));
        const max = entries.length ? entries[0][1] : 1;
        return entries.map(([name, count]) => {
            const pct = Math.round(count / max * 100);
            return `<div class="phase-tips-item">
                <span class="phase-tips-bullet" style="background:${color}"></span>
                <span class="phase-tips-name">${escHtml(name)}</span>
                <div class="phase-sym-bar-wrap"><div class="phase-sym-bar" style="width:${pct}%;background:${color}"></div></div>
                <span class="phase-tips-count">${count}×</span>
            </div>`;
        }).join('');
    }

    let html = '<div class="phase-tips-box">';
    html += '<p class="section-title phase-tips-title">Jouw tips</p>';
    html += '<div class="phase-tips-cols">';
    html += '<div class="phase-tips-col">';
    if (Object.keys(works.well).length) {
        html += '<div class="phase-tips-hd phase-tips-pos">Werkt wel</div>';
        html += makeItems(works.well, '#3a8a56');
    }
    html += '</div>';
    html += '<div class="phase-tips-col">';
    if (Object.keys(works.not).length) {
        html += '<div class="phase-tips-hd phase-tips-neg">Werkt niet</div>';
        html += makeItems(works.not, '#a03050');
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';
    el.innerHTML = html;
}

function showPhase(phase) {
    document.getElementById('phase-panel').style.display = 'block';
    document.getElementById('activity-panel').style.display = 'block';
    document.getElementById('phase-header').style.background   = phase.color;
    document.getElementById('activity-header').style.background = phase.color;
    document.getElementById('phase-name').textContent  = phase.name;
    document.getElementById('phase-days').textContent  = phase.days;
    document.getElementById('phase-desc').textContent  = phase.description;
    document.getElementById('phase-insights').innerHTML = renderInsights(phase);
    document.getElementById('hormone-rows').innerHTML  = renderHormones(phase.hormones);
    renderPhaseSymContainer(phase);
    renderPhaseSymCompare(phase);
    renderPhaseTips(phase);
    if (currentPhase !== phase) { currentPhase = phase; buildSymGrid(); }
}

function hidePhase() {
    document.getElementById('phase-panel').style.display = 'none';
    document.getElementById('activity-panel').style.display = 'none';
    if (currentPhase !== null) { currentPhase = null; buildSymGrid(); }
}
