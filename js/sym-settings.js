/* ─── shared UI state ──────────────────────────────────── */
let currentPhase = null;
let _draggingName = null, _draggingFrom = null;

/* ─── build checkbox grid ──────────────────────────────── */
function buildSymGrid() {
    const checked = new Set(getCheckedValues('#symptomGrid'));
    const settings = loadSymSettings();
    const grid     = document.getElementById('symptomGrid');
    grid.innerHTML = '';

    const freq      = currentPhase ? (computePhaseSymFreq(currentPhase.name) || {}) : {};
    const phaseSyms = currentPhase ? currentPhase.symptoms : [];
    const shownSet  = new Set(settings.shown);
    const allCatSyms = new Set(Object.values(SYM_CATS).flat());

    function sortSyms(names) {
        return [...names].sort((a, b) => {
            const fa = freq[a] || 0, fb = freq[b] || 0;
            if (fa !== fb) return fb - fa;
            const ai = phaseSyms.indexOf(a), bi = phaseSyms.indexOf(b);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return 0;
        });
    }

    function makeLbl(name) {
        const inPhase = currentPhase && currentPhase.symptoms.includes(name);
        const lbl = document.createElement('label');
        lbl.className = 'sym-label' + (inPhase ? ' sym-label-phase' : '');
        if (inPhase) lbl.style.setProperty('--phase-dot-color', currentPhase.color);
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'sym_' + name.replace(/\W+/g, '_');
        cb.value = name;
        if (checked.has(name)) cb.checked = true;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + name));
        return lbl;
    }

    const customCats = settings.customCats || {};

    function addSection(title, names, cat) {
        const color = SYM_CAT_COLORS[title];
        const hd = document.createElement('div');
        hd.className = 'sym-cat-hd';
        hd.textContent = title;
        if (color) { hd.style.color = color; hd.style.borderBottomColor = color; }
        grid.appendChild(hd);

        const SYM_SHOW_LIMIT = 14;
        const visible = [], hidden = [];
        names.forEach(n => {
            if (visible.length < SYM_SHOW_LIMIT || checked.has(n)) visible.push(n);
            else hidden.push(n);
        });
        visible.forEach(n => grid.appendChild(makeLbl(n)));

        // hidden labels in DOM before + so + stays at position N+1
        let extraLabels = [], moreBtn = null;
        if (hidden.length > 0) {
            extraLabels = hidden.map(n => { const l = makeLbl(n); l.classList.add('sym-cat-extra'); return l; });
            extraLabels.forEach(l => grid.appendChild(l));
            moreBtn = document.createElement('button');
            moreBtn.className = 'sym-cat-more-btn';
            moreBtn.textContent = `Toon ${hidden.length} meer…`;
            moreBtn.addEventListener('click', () => {
                const expanded = moreBtn.classList.toggle('expanded');
                extraLabels.forEach(l => l.classList.toggle('visible', expanded));
                moreBtn.textContent = expanded ? 'Toon minder' : `Toon ${hidden.length} meer…`;
            });
        }

        if (!cat) {
            if (moreBtn) grid.appendChild(moreBtn);
            return;
        }
        const row = document.createElement('div');
        row.className = 'sym-cat-add-row';
        const toggle = document.createElement('button');
        toggle.className = 'sym-cat-toggle';
        toggle.textContent = '+';
        if (color) toggle.style.setProperty('--cat-color', color);
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'sym-cat-input'; inp.placeholder = 'Naam…';
        const ok = document.createElement('button');
        ok.className = 'btn-anders sym-cat-ok'; ok.textContent = '+';
        function commit() {
            const val = inp.value.trim();
            if (val) addCustomSymToCategory(val, cat);
            else { row.classList.remove('open'); inp.value = ''; }
        }
        toggle.addEventListener('click', () => { row.classList.add('open'); inp.focus(); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { row.classList.remove('open'); inp.value = ''; } });
        inp.addEventListener('blur', () => setTimeout(() => { if (!inp.value.trim()) row.classList.remove('open'); }, 150));
        ok.addEventListener('mousedown', e => e.preventDefault());
        ok.addEventListener('click', commit);
        row.appendChild(toggle); row.appendChild(inp); row.appendChild(ok);
        grid.appendChild(row);
        if (moreBtn) grid.appendChild(moreBtn);
    }

    function effectiveCatFor(name) {
        if (customCats[name]) return customCats[name];
        for (const [c, syms] of Object.entries(SYM_CATS)) {
            if (syms.includes(name)) return c;
        }
        return 'Fysiek';
    }

    Object.entries(SYM_CATS).forEach(([cat]) => {
        const inThisCat = settings.shown.filter(s => effectiveCatFor(s) === cat);
        addSection(cat, sortSyms(inThisCat), cat);
    });
}

function renderSymItem(name, listName, isCustom) {
    const item = document.createElement('div');
    item.className = 'sym-drag-item' + (isCustom ? ' sym-drag-custom' : '');
    item.draggable = true;
    item.appendChild(document.createTextNode(name));
    if (isCustom) {
        const del = document.createElement('button');
        del.className = 'sym-del-btn';
        del.title = 'Verwijderen';
        del.textContent = '✕';
        del.addEventListener('click', e => { e.stopPropagation(); deleteCustomSym(name); });
        item.appendChild(del);
    }
    item.addEventListener('dragstart', e => {
        _draggingName = name; _draggingFrom = listName;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    return item;
}

function renderSymSettings() {
    const s = loadSymSettings();
    const zones = {
        shownFysiek:   document.getElementById('shownFysiekZone'),
        shownMentaal:  document.getElementById('shownMentaalZone'),
        hiddenFysiek:  document.getElementById('hiddenFysiekZone'),
        hiddenMentaal: document.getElementById('hiddenMentaalZone'),
    };
    Object.values(zones).forEach(z => { if (z) z.innerHTML = ''; });

    function effectiveCat(name) {
        if (s.customCats && s.customCats[name]) return s.customCats[name];
        for (const [cat, syms] of Object.entries(SYM_CATS)) {
            if (syms.includes(name)) return cat;
        }
        return 'Fysiek';
    }

    [...s.shown].sort((a, b) => a.localeCompare(b, 'nl')).forEach(name => {
        const cat    = effectiveCat(name);
        const listId = cat === 'Mentaal & emotioneel' ? 'shownMentaal' : 'shownFysiek';
        zones[listId].appendChild(renderSymItem(name, listId, s.custom.includes(name)));
    });
    [...s.hidden].sort((a, b) => a.localeCompare(b, 'nl')).forEach(name => {
        const cat    = effectiveCat(name);
        const listId = cat === 'Mentaal & emotioneel' ? 'hiddenMentaal' : 'hiddenFysiek';
        zones[listId].appendChild(renderSymItem(name, listId, s.custom.includes(name)));
    });
}

function setupDropZones() {
    [
        { id: 'shownFysiekZone',   list: 'shownFysiek',   cat: 'Fysiek' },
        { id: 'shownMentaalZone',  list: 'shownMentaal',  cat: 'Mentaal & emotioneel' },
        { id: 'hiddenFysiekZone',  list: 'hiddenFysiek',  cat: 'Fysiek' },
        { id: 'hiddenMentaalZone', list: 'hiddenMentaal', cat: 'Mentaal & emotioneel' },
    ].forEach(({ id, list: targetList, cat: targetCat }) => {
        const zone = document.getElementById(id);
        zone.addEventListener('dragover', e => {
            e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault(); zone.classList.remove('drag-over');
            if (!_draggingName || _draggingFrom === targetList) return;
            const s = loadSymSettings();
            const wasShown = _draggingFrom === 'shownFysiek' || _draggingFrom === 'shownMentaal';
            const toShown  = targetList   === 'shownFysiek'  || targetList   === 'shownMentaal';
            if (!s.customCats) s.customCats = {};
            if (wasShown && toShown) {
                s.customCats[_draggingName] = targetCat;
            } else if (wasShown) {
                s.shown  = s.shown.filter(n => n !== _draggingName);
                s.hidden.push(_draggingName);
                s.customCats[_draggingName] = targetCat;
            } else {
                s.hidden = s.hidden.filter(n => n !== _draggingName);
                s.shown.push(_draggingName);
                s.customCats[_draggingName] = targetCat;
            }
            saveSymSettings(s); renderSymSettings(); buildSymGrid();
            _draggingName = _draggingFrom = null;
        });
    });
}

function toggleSymSettings() {
    const panel = document.getElementById('symSettingsPanel');
    const btn   = document.getElementById('symSettingsBtn');
    const open  = panel.classList.toggle('open');
    btn.classList.toggle('active', open);
    if (open) renderSymSettings();
}

function toggleAddSym(cat) {
    const isFysiek = cat === 'Fysiek';
    const rowEl  = document.getElementById(isFysiek ? 'addFysiekRow'   : 'addMentaalRow');
    const inputEl = document.getElementById(isFysiek ? 'addFysiekInput' : 'addMentaalInput');
    rowEl.classList.add('open');
    inputEl.focus();
}

function commitAddSym(cat) {
    const isFysiek = cat === 'Fysiek';
    const inputEl = document.getElementById(isFysiek ? 'addFysiekInput' : 'addMentaalInput');
    const rowEl   = document.getElementById(isFysiek ? 'addFysiekRow'   : 'addMentaalRow');
    const val     = inputEl.value.trim();
    inputEl.value = '';
    rowEl.classList.remove('open');
    if (!val) return;
    addCustomSymToCategory(val, cat);
    renderSymSettings();
}

function deleteCustomSym(name) {
    const s = loadSymSettings();
    s.custom = s.custom.filter(n => n !== name);
    s.shown  = s.shown.filter(n  => n !== name);
    s.hidden = s.hidden.filter(n => n !== name);
    saveSymSettings(s); renderSymSettings(); buildSymGrid();
}

function addCustomSymToCategory(name, cat) {
    const s = loadSymSettings();
    if (s.shown.includes(name) || s.hidden.includes(name)) { buildSymGrid(); return; }
    s.custom.push(name);
    s.shown.push(name);
    s.customCats[name] = cat;
    saveSymSettings(s);
    buildSymGrid();
    const cb = [...document.querySelectorAll('#symptomGrid input[type=checkbox]')].find(c => c.value === name);
    if (cb) {
        cb.checked = true;
        syncSaveFeedback();
    }
}

['addFysiekInput', 'addMentaalInput'].forEach(id => {
    const el = document.getElementById(id);
    const cat = id === 'addFysiekInput' ? 'Fysiek' : 'Mentaal & emotioneel';
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') commitAddSym(cat);
        if (e.key === 'Escape') {
            el.value = '';
            el.closest('.sym-col-add-row').classList.remove('open');
        }
    });
    el.addEventListener('blur', () => setTimeout(() => {
        if (!el.value.trim()) el.closest('.sym-col-add-row').classList.remove('open');
    }, 150));
});

setupDropZones();
buildSymGrid();
