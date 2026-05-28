// ── filters.js — filter bar render + binding ─────────────────────────

// ── date preset helpers ───────────────────────────────────────────────
function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function latestInspDate() {
  const dates = state.data.trucks.map(t => t.last_insp_date).filter(Boolean);
  return dates.sort().at(-1); // most recent inspection in dataset
}

function thisPeriodRange() {
  // last 14 days ending on the latest inspection in the dataset
  const to   = new Date(latestInspDate());
  const from = new Date(to.getTime() - 13 * 86400000);
  return { from: toISO(from), to: toISO(to) };
}

function presetRange(preset) {
  const today = new Date(state.data.meta.ref_date);
  switch (preset) {
    case 'last7':   return { from: toISO(new Date(today - 6  * 86400000)), to: toISO(today) };
    case 'last30':  return { from: toISO(new Date(today - 29 * 86400000)), to: toISO(today) };
    case 'period':  return thisPeriodRange();
    case 'ytd':     return { from: `${today.getFullYear()}-01-01`,          to: toISO(today) };
    case 'all':     return { from: '', to: '' };
    default:        return null;
  }
}

function activePreset() {
  const { dateFrom, dateTo } = state.filters;
  if (!dateFrom && !dateTo) return 'all';
  for (const p of ['last7', 'last30', 'period', 'ytd']) {
    const r = presetRange(p);
    if (r && r.from === dateFrom && r.to === dateTo) return p;
  }
  return null; // custom range
}

// ── render ────────────────────────────────────────────────────────────
const STATUS_DEFS = [
  { key: 'Available',         cls: 'available' },
  { key: 'Expiring Soon',     cls: 'expiring'  },
  { key: 'Overdue',           cls: 'overdue'   },
  { key: 'Failed',            cls: 'failed'    },
  { key: 'Missed Inspection', cls: 'missed'    },
];

function statusDropdownLabel(statuses) {
  if (statuses.length === 0) return 'All statuses';
  if (statuses.length === 1) return statuses[0];
  return `${statuses.length} statuses`;
}

function renderFilterBar() {
  const systems     = availableSystems();
  const models      = availableModels();
  const f           = state.filters;
  const activeCount = countActiveFilters();
  const preset      = activePreset();

  const systemOptions = systems.map(s =>
    `<option value="${s}" ${f.systems[0] === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  const modelSelect = models.length > 1 ? `
    <select class="filter-select filter-select--sm" id="filterModel">
      <option value="">All Models</option>
      ${models.map(m => `<option value="${m}" ${f.model === m ? 'selected':''}>${m}</option>`).join('')}
    </select>` : '';

  const presets = [
    { id: 'last7',  label: '7d'     },
    { id: 'last30', label: '30d'    },
    { id: 'period', label: 'Period' },
    { id: 'ytd',    label: 'YTD'    },
    { id: 'all',    label: 'All'    },
  ];

  const presetBtns = presets.map(p =>
    `<button class="date-preset ${preset === p.id ? 'active' : ''}"
             data-preset="${p.id}">${p.label}</button>`
  ).join('');

  const statusItems = STATUS_DEFS.map(({ key, cls }) => {
    const count   = state.data.trucks.filter(t => t.truck_status === key).length;
    const checked = f.statuses.includes(key) ? 'checked' : '';
    return `
      <label class="status-option status-option--${cls}">
        <input type="checkbox" value="${key}" ${checked} />
        <span class="chip__dot chip__dot--${cls}"></span>
        ${key}
        <span class="status-option__count">${count}</span>
      </label>`;
  }).join('');

  document.getElementById('filter-bar-container').innerHTML = `
    <div class="filter-bar" id="filterBar">
      <div class="filter-row">

        <div class="filter-search">
          <svg class="filter-search__icon" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="filterRegNo" placeholder="Reg no…"
                 value="${f.regNo}" autocomplete="off" />
          <button class="filter-search__clear ${f.regNo ? 'visible' : ''}"
                  id="clearRegNo" title="Clear">✕</button>
        </div>

        <div class="filter-divider"></div>

        <select class="filter-select date-type-select" id="filterDateType">
          <option value="inspection" ${f.dateType==='inspection'?'selected':''}>Inspection date</option>
          <option value="expiry"     ${f.dateType==='expiry'    ?'selected':''}>Expiry date</option>
        </select>

        <span class="date-filter-label">FROM</span>
        <input type="date" class="filter-date-input" id="filterDateFrom" value="${f.dateFrom}" />

        <span class="date-filter-label">TO</span>
        <input type="date" class="filter-date-input" id="filterDateTo" value="${f.dateTo}" />

        <div class="date-presets">${presetBtns}</div>

        <div class="filter-divider"></div>

        <!-- status multi-select dropdown -->
        <div class="status-dropdown" id="statusDropdown">
          <button class="status-dropdown__btn" id="statusDropdownBtn" type="button">
            <span id="statusDropdownLabel">${statusDropdownLabel(f.statuses)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="status-dropdown__panel" id="statusDropdownPanel" hidden>
            <label class="status-option status-option--all">
              <input type="checkbox" value="__all" ${f.statuses.length === 0 ? 'checked' : ''} />
              All statuses
            </label>
            ${statusItems}
          </div>
        </div>

        ${systems.length > 0 ? `
        <select class="filter-select filter-select--sm" id="filterSystem">
          <option value="">All Systems</option>
          ${systemOptions}
        </select>` : ''}

        ${modelSelect}

<span class="filter-bar__active-count ${activeCount > 0 ? 'visible' : ''}"
              id="activeCount">${activeCount} active</span>
        <button class="filter-clear ${activeCount > 0 ? 'visible' : ''}"
                id="clearAll">Clear all</button>

      </div>
    </div>`;

  bindFilters();
}

// ── binding ───────────────────────────────────────────────────────────
function bindFilters() {
  // reg no — lives in filter bar, re-created each render
  const regInput = document.getElementById('filterRegNo');
  const clearBtn = document.getElementById('clearRegNo');
  regInput.addEventListener('input', () => {
    state.filters.regNo = regInput.value.trim().toUpperCase();
    clearBtn.classList.toggle('visible', !!state.filters.regNo);
    onFilterChange();
  });
  clearBtn.addEventListener('click', () => {
    state.filters.regNo = '';
    regInput.value = '';
    clearBtn.classList.remove('visible');
    onFilterChange();
  });

  // date type
  document.getElementById('filterDateType').addEventListener('change', e => {
    state.filters.dateType = e.target.value;
    onFilterChange();
  });

  // date from / to
  document.getElementById('filterDateFrom').addEventListener('change', e => {
    state.filters.dateFrom = e.target.value;
    updatePresetHighlight();
    onFilterChange();
  });
  document.getElementById('filterDateTo').addEventListener('change', e => {
    state.filters.dateTo = e.target.value;
    updatePresetHighlight();
    onFilterChange();
  });

  // preset buttons
  document.querySelectorAll('.date-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = presetRange(btn.dataset.preset);
      if (!r) return;
      state.filters.dateFrom = r.from;
      state.filters.dateTo   = r.to;
      document.getElementById('filterDateFrom').value = r.from;
      document.getElementById('filterDateTo').value   = r.to;
      updatePresetHighlight();
      onFilterChange();
    });
  });

  // status dropdown toggle
  const statusBtn   = document.getElementById('statusDropdownBtn');
  const statusPanel = document.getElementById('statusDropdownPanel');
  statusBtn.addEventListener('click', e => {
    e.stopPropagation();
    statusPanel.hidden = !statusPanel.hidden;
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('statusDropdown')?.contains(e.target)) {
      statusPanel.hidden = true;
    }
  }, { capture: true });

  // status checkboxes
  statusPanel.addEventListener('change', e => {
    const cb  = e.target;
    const val = cb.value;
    if (val === '__all') {
      state.filters.statuses = [];
      statusPanel.querySelectorAll('input[type=checkbox]').forEach(el => {
        el.checked = el.value === '__all';
      });
    } else {
      const allCb = statusPanel.querySelector('input[value="__all"]');
      const idx = state.filters.statuses.indexOf(val);
      if (cb.checked) {
        if (idx === -1) state.filters.statuses.push(val);
      } else {
        if (idx > -1) state.filters.statuses.splice(idx, 1);
      }
      if (allCb) allCb.checked = state.filters.statuses.length === 0;
    }
    document.getElementById('statusDropdownLabel').textContent =
      statusDropdownLabel(state.filters.statuses);
    onFilterChange();
  });

  // system
  document.getElementById('filterSystem')?.addEventListener('change', e => {
    state.filters.systems = e.target.value ? [e.target.value] : [];
    onFilterChange();
  });

  // model
  const modelSel = document.getElementById('filterModel');
  if (modelSel) {
    modelSel.addEventListener('change', e => {
      state.filters.model = e.target.value;
      onFilterChange();
    });
  }

  // clear all
  document.getElementById('clearAll').addEventListener('click', () => {
    state.filters = { regNo: '', dateType: 'inspection', dateFrom: '', dateTo: '', statuses: [], systems: [], model: '' };
    renderFilterBar();
    onFilterChange();
  });
}

// ── helpers ───────────────────────────────────────────────────────────
function updatePresetHighlight() {
  const current = activePreset();
  document.querySelectorAll('.date-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === current);
  });
}

function updateFilterChips() {
  const labelEl = document.getElementById('statusDropdownLabel');
  if (labelEl) labelEl.textContent = statusDropdownLabel(state.filters.statuses);
  const panel = document.getElementById('statusDropdownPanel');
  if (!panel) return;
  panel.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = cb.value === '__all'
      ? state.filters.statuses.length === 0
      : state.filters.statuses.includes(cb.value);
  });
}

function updateFilterMeta() {
  const n      = countActiveFilters();
  const countEl = document.getElementById('activeCount');
  const clearEl = document.getElementById('clearAll');
  if (!countEl) return;
  countEl.textContent = `${n} active`;
  countEl.classList.toggle('visible', n > 0);
  clearEl.classList.toggle('visible', n > 0);
}
