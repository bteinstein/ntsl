// ── trucks.js — truck table ───────────────────────────────────────────

const STATUS_ORDER = ['Overdue', 'Failed', 'Expiring Soon', 'Available', 'Missed'];
const RISK_ORDER   = { HIGH: 0, MED: 1, LOW: 2 };

// sort state
let sortCol = 'status';  // 'status' | 'health' | 'expiry' | 'last_insp'
let sortDir = 1;         // 1 = asc, -1 = desc

function statusClass(s) {
  if (s === 'Available')     return 'available';
  if (s === 'Failed')        return 'failed';
  if (s === 'Overdue')       return 'overdue';
  if (s === 'Expiring Soon') return 'expiring';
  return 'missed';
}

function riskClass(r) {
  if (r === 'HIGH') return 'risk-high';
  if (r === 'MED')  return 'risk-med';
  return 'risk-low';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${mon[+m - 1]}`;
}

function isExpiringSoon(iso) {
  if (!iso) return false;
  const days = (new Date(iso) - new Date()) / 86400000;
  return days >= 0 && days <= (state.data.meta.expiry_soon_days ?? 7);
}

function healthBar(score) {
  const clr = score >= 90 ? 'var(--available)' : score >= 70 ? 'var(--expiring)' : 'var(--failed)';
  return `<div class="truck-hbar-wrap">
    <div class="truck-hbar-fill" style="width:${score}%;background:${clr}"></div>
  </div>`;
}

function sortTrucks(trucks) {
  return [...trucks].sort((a, b) => {
    let diff = 0;
    if (sortCol === 'status') {
      diff = STATUS_ORDER.indexOf(a.truck_status) - STATUS_ORDER.indexOf(b.truck_status);
      if (diff === 0) diff = (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9);
      if (diff === 0) diff = (a.health_score ?? 0) - (b.health_score ?? 0);
    } else if (sortCol === 'health') {
      diff = (a.health_score ?? -1) - (b.health_score ?? -1);
    } else if (sortCol === 'expiry') {
      diff = (a.expiry_date ?? '').localeCompare(b.expiry_date ?? '');
    } else if (sortCol === 'last_insp') {
      diff = (a.last_insp_date ?? '').localeCompare(b.last_insp_date ?? '');
    } else if (sortCol === 'cert') {
      diff = (a.certified === b.certified) ? 0 : a.certified ? -1 : 1;
    }
    return diff * sortDir;
  });
}

function thArrow(col) {
  if (sortCol !== col) return '<span class="th-arrow th-arrow--off">↕</span>';
  return `<span class="th-arrow">${sortDir === 1 ? '↑' : '↓'}</span>`;
}

function onSort(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  renderTruckTable();
}

function matchedInspDate(truck) {
  const { dateType, dateFrom, dateTo } = state.filters;
  if (dateType !== 'inspection' || (!dateFrom && !dateTo)) return null;
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;
  const history = state.data.history?.[truck.reg_no] ?? [];
  const matched = history
    .filter(h => {
      const d = new Date(h.insp_date);
      return (!from || d >= from) && (!to || d <= to);
    })
    .sort((a, b) => b.insp_date.localeCompare(a.insp_date));
  return matched.length ? matched[0].insp_date : null;
}

function dateFilterBanner() {
  const { dateType, dateFrom, dateTo } = state.filters;
  if (!dateFrom && !dateTo) return '';
  const from = dateFrom ? fmtDate(dateFrom) : '…';
  const to   = dateTo   ? fmtDate(dateTo)   : '…';
  if (dateType === 'expiry') {
    return `<div class="truck-filter-banner">
      Showing trucks whose certification expires between <strong>${from} – ${to}</strong>
    </div>`;
  }
  return `<div class="truck-filter-banner">
    Showing trucks inspected between <strong>${from} – ${to}</strong>
    <span class="truck-filter-banner__note">· health, status &amp; expiry reflect current state</span>
  </div>`;
}

function renderTruckTable() {
  const section   = document.getElementById('trucks-section');
  const trucks    = sortTrucks(filteredTrucks());
  const showModel = trucks.some(t => t.model);

  const rows = trucks.map(t => {
    const displayInspDate = matchedInspDate(t) ?? t.last_insp_date;
    const expCls  = isExpiringSoon(t.expiry_date) ? ' truck-expiring' : '';
    const systems = t.failing_systems.length
      ? t.failing_systems.map(s => `<span class="truck-tag">${s}</span>`).join('')
      : '<span class="truck-none">—</span>';
    const modelCol = showModel
      ? `<td class="truck-model">${[t.brand, t.model].filter(Boolean).join(' ') || '—'}</td>`
      : '';
    const iaList  = t.ia_items.length
      ? `<ul class="truck-ia-list">${t.ia_items.map(x => `<li>${x}</li>`).join('')}</ul>`
      : '';
    const colspan = showModel ? 10 : 9;

    return `
      <tr class="truck-row truck-row--clickable" data-reg="${t.reg_no}">
        <td class="truck-reg">${t.reg_no}</td>
        ${modelCol}
        <td><span class="badge badge--${statusClass(t.truck_status)}">${t.truck_status}</span></td>
        <td class="truck-score-cell">
          <span class="truck-score-val">${t.health_score ?? '—'}${t.health_score != null ? '%' : ''}</span>
          ${t.health_score != null ? healthBar(t.health_score) : ''}
        </td>
        <td><span class="badge badge--risk ${riskClass(t.risk)}">${t.risk ?? '—'}</span></td>
        <td class="truck-cert">${t.certified ? '✓' : '✗'}</td>
        <td>${fmtDate(displayInspDate)}</td>
        <td class="${expCls}">${fmtDate(t.expiry_date)}</td>
        <td class="truck-advisor">${t.advisor || '—'}</td>
        <td class="truck-systems">${systems}</td>
      </tr>
      `;
  }).join('');

  const modelTh = showModel ? '<th>Brand / Model</th>' : '';

  section.innerHTML = `
    <div class="truck-header">
      <span class="truck-title">Truck List</span>
      <span class="truck-count" id="truck-count">${trucks.length} trucks</span>
    </div>
    ${dateFilterBanner()}
    <div class="truck-table-wrap">
      <table class="truck-table">
        <thead>
          <tr>
            <th>Reg No</th>
            ${modelTh}
            <th class="th-sortable" onclick="onSort('status')">Status ${thArrow('status')}</th>
            <th class="th-sortable" onclick="onSort('health')">Health ${thArrow('health')}</th>
            <th>Risk</th>
            <th class="th-sortable" onclick="onSort('cert')">Cert. ${thArrow('cert')}</th>
            <th class="th-sortable" onclick="onSort('last_insp')">Last Insp. ${thArrow('last_insp')}</th>
            <th class="th-sortable" onclick="onSort('expiry')">Expiry ${thArrow('expiry')}</th>
            <th>Advisor</th>
            <th>Failing Systems</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  section.querySelectorAll('.truck-row--clickable').forEach(row => {
    row.addEventListener('click', () => openPanel(row.dataset.reg));
  });
}
