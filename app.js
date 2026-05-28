// ── app.js — orchestrator ────────────────────────────────────────────
// Modules: filters.js · kpis.js · trucks.js · charts.js
// Data:    window.PORTAL_DATA (set by data/portal_data.js)

// ── state ────────────────────────────────────────────────────────────
const state = {
  data: null,
  filters: {
    regNo:      '',
    dateType:   'inspection',  // 'inspection' | 'expiry'
    dateFrom:   '',            // ISO date string YYYY-MM-DD, '' = no lower bound
    dateTo:     '',            // ISO date string YYYY-MM-DD, '' = no upper bound
    statuses:   [],            // [] = all
    systems:    [],            // [] = all
    model:      '',            // '' = all
  },
};

// ── boot ─────────────────────────────────────────────────────────────
function init() {
  if (!window.PORTAL_DATA) {
    document.getElementById('main').innerHTML =
      `<div class="loading" style="color:#dc2626">
         Fleet data not found. Run <code>python app/build_data.py</code> and refresh.
       </div>`;
    return;
  }

  state.data = window.PORTAL_DATA;
  document.getElementById('clientName').textContent = state.data.meta.client;
  renderAll();
}

// ── full render ───────────────────────────────────────────────────────
function renderAll() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div id="filter-bar-container"></div>
    <div id="kpi-strip" class="kpi-strip"></div>
    <div id="trend-section" class="trend-section"></div>
    <div id="trucks-section" class="truck-section"></div>
  `;

  renderFilterBar();
  renderKPIs();
  renderTrendChart();
  renderTruckTable();
}

// ── partial refresh (filters changed) ────────────────────────────────
function onFilterChange() {
  updateFilterChips();
  updateFilterMeta();
  renderKPIs();         // keep CTA toggle state in sync
  renderTruckTable();
}

// ── helpers exposed to all modules ───────────────────────────────────
function filteredTrucks() {
  const { regNo, statuses, systems, model, dateType, dateFrom, dateTo } = state.filters;
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  return state.data.trucks.filter(t => {
    if (regNo           && !t.reg_no.toUpperCase().includes(regNo))              return false;
    if (statuses.length && !statuses.includes(t.truck_status))                   return false;
    if (systems.length  && !systems.some(s => t.failing_systems.includes(s)))    return false;
    if (model           && t.model !== model)                                     return false;

    if (from || to) {
      if (dateType === 'expiry') {
        if (!t.expiry_date) return false;
        const d = new Date(t.expiry_date);
        if (from && d < from) return false;
        if (to   && d > to)   return false;
      } else {
        // inspection date — match if ANY historical inspection falls in range
        const history = (state.data.history?.[t.reg_no] ?? []);
        const dates   = history.length
          ? history.map(h => new Date(h.insp_date))
          : (t.last_insp_date ? [new Date(t.last_insp_date)] : []);
        if (!dates.length) return false;
        const inRange = dates.some(d => (!from || d >= from) && (!to || d <= to));
        if (!inRange) return false;
      }
    }
    return true;
  });
}

function availableSystems() {
  const all = new Set();
  state.data.trucks.forEach(t => t.failing_systems.forEach(s => all.add(s)));
  return [...all].sort();
}

function availableModels() {
  const all = new Set(state.data.trucks.map(t => t.model).filter(Boolean));
  return [...all].sort();
}

function countActiveFilters() {
  const f = state.filters;
  return (f.regNo ? 1 : 0) +
         (f.dateFrom || f.dateTo ? 1 : 0) +
         f.statuses.length +
         f.systems.length +
         (f.model ? 1 : 0);
}

function handleLogout() {
  if (confirm('Sign out?')) logout();
}

// ── exposed for KPI alert tile CTAs ──────────────────────────────────
function setStatusFilter(statusKey) {
  const cur = state.filters.statuses;
  const isOnlyThis = cur.length === 1 && cur[0] === statusKey;
  state.filters.statuses = isOnlyThis ? [] : [statusKey];
  renderFilterBar();
  renderKPIs();   // refresh CTA labels (View Trucks ↔ Clear)
  onFilterChange();
  if (!isOnlyThis) {
    document.getElementById('trucks-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── start ─────────────────────────────────────────────────────────────
init();
