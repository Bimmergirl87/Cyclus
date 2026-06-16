/* ─── date & time utilities ────────────────────────────────── */
const MS_PER_DAY = 86400000;

function parseISODate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { y, m, d };
}

function normalizeCycleDay(rawDay, cycleLen) {
    return (((rawDay - 1) % cycleLen) + cycleLen) % cycleLen + 1;
}

/* ─── checkbox & grid utilities ────────────────────────────── */
function getCheckedValues(selector) {
    return [...document.querySelectorAll(`${selector} input:checked`)].map(c => c.value);
}

function getCheckedCount(selector) {
    return document.querySelectorAll(`${selector} input:checked`).length;
}

function setCheckedValues(selector, valuesToCheck) {
    const toCheck = new Set(valuesToCheck);
    document.querySelectorAll(`${selector} input[type=checkbox]`).forEach(cb => {
        cb.checked = toCheck.has(cb.value);
    });
}
