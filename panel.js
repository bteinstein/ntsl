// ── panel.js — truck slide-out panel ─────────────────────────────────

let _panelHistory = [];    // sorted asc by insp_date
let _selectedPeriod = 0;  // index into _panelHistory (latest = last)

// ── open / close ──────────────────────────────────────────────────────
function openPanel(regNo) {
  const truck = state.data.trucks.find(t => t.reg_no === regNo);
  if (!truck) return;

  _panelHistory = (state.data.history?.[regNo] ?? [])
    .slice()
    .sort((a, b) => a.insp_date.localeCompare(b.insp_date));
  _selectedPeriod = _panelHistory.length - 1;  // default: latest

  document.getElementById('truckPanel').innerHTML = buildPanel(truck);
  document.getElementById('truckPanel').hidden    = false;
  document.getElementById('panelOverlay').hidden  = false;
  document.body.classList.add('panel-open');
}

function closePanel() {
  document.getElementById('truckPanel').hidden   = true;
  document.getElementById('panelOverlay').hidden = true;
  document.body.classList.remove('panel-open');
}

function selectPeriod(idx) {
  _selectedPeriod = idx;
  document.getElementById('panelIssues').innerHTML    = buildIssues();
  document.getElementById('panelPeriodTabs').innerHTML = buildPeriodTabs();
}

document.getElementById('panelOverlay').addEventListener('click', closePanel);

// ── shell ─────────────────────────────────────────────────────────────
function buildPanel(truck) {
  const brandModel = [truck.brand, truck.model].filter(Boolean).join(' ');
  return `
    <div class="panel__header">
      <div class="panel__header-main">
        <span class="panel__reg">${truck.reg_no}</span>
        ${brandModel ? `<span class="panel__brand">${brandModel}</span>` : ''}
        <span class="badge badge--${statusClass(truck.truck_status)}">${truck.truck_status}</span>
      </div>
      <div class="panel__header-sub">
        <span>Inspector: ${truck.advisor || '—'}</span>
        <span class="${isExpiringSoon(truck.expiry_date) ? 'truck-expiring' : ''}">
          Expires: ${fmtDate(truck.expiry_date)}
        </span>
      </div>
      <button class="panel__close" onclick="closePanel()">✕</button>
    </div>
    <div class="panel__body">
      ${buildTrend()}
      <section class="panel__section">
        <div class="panel__section-title">Issues by Period</div>
        <div id="panelPeriodTabs" class="panel__period-tabs">${buildPeriodTabs()}</div>
        <div id="panelIssues">${buildIssues()}</div>
      </section>
      ${buildHistoryTable()}
    </div>`;
}

// ── period tabs ───────────────────────────────────────────────────────
function buildPeriodTabs() {
  return _panelHistory.map((h, i) => {
    const short  = stripPeriodPrefix(h.period).split('–')[0].trim();
    const active = i === _selectedPeriod ? ' panel__period-tab--active' : '';
    const hasIA  = h.ia > 0 ? ' panel__period-tab--has-ia' : '';
    return `<button class="panel__period-tab${active}${hasIA}"
                    onclick="selectPeriod(${i})"
                    title="${stripPeriodPrefix(h.period)}">${short}</button>`;
  }).join('');
}

// ── issues for selected period ────────────────────────────────────────
function buildIssues() {
  const h = _panelHistory[_selectedPeriod];
  if (!h) return '<p class="panel__none">No data.</p>';

  const label  = stripPeriodPrefix(h.period);
  const noIA   = !h.ia_items?.length;

  const sysTags = Object.keys(h.ia_by_system ?? {}).sort()
    .map(s => `<span class="truck-tag">${s}</span>`).join('');

  const items = noIA
    ? '<p class="panel__none">No immediate attention items this period.</p>'
    : `${sysTags ? `<div class="panel__ia-systems">${sysTags}</div>` : ''}
       <ul class="panel__ia-list panel__ia-list--spaced">
         ${h.ia_items.map(x => `<li>${x}</li>`).join('')}
       </ul>`;

  return `
    <div class="panel__issues-meta">
      <span class="panel__issues-date">${label} · ${fmtDate(h.insp_date)}</span>
      <span class="panel__issues-counts">
        <span class="panel__issues-ia">${h.ia} IA</span>
        <span class="panel__issues-fa">${h.fa} FA</span>
        <span class="panel__issues-ok">${h.ok} OK</span>
      </span>
    </div>
    ${items}
    <p class="panel__issues-note">Issues only · full checklist in v2</p>`;
}

// ── mini health trend ─────────────────────────────────────────────────
function buildTrend() {
  if (_panelHistory.length < 2) return '';

  const W = 480, H = 100;
  const padL = 28, padR = 16, padT = 14, padB = 28;
  const cW = W - padL - padR, cH = H - padT - padB;
  const N  = _panelHistory.length;
  const target = state.data.kpis.fleet_health_target;

  function px(i) { return padL + (i / (N - 1)) * cW; }
  function py(v) { return padT + cH - ((v - 30) / 70) * cH; }

  const vals    = _panelHistory.map(h => h.health_score);
  const ptArr   = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const polyPts = ptArr.join(' ');
  const areaPath = `M${px(0).toFixed(1)},${(padT+cH).toFixed(1)} ` +
                   ptArr.map(p => `L${p}`).join(' ') +
                   ` L${px(N-1).toFixed(1)},${(padT+cH).toFixed(1)} Z`;
  const ty = py(target).toFixed(1);

  const dots = vals.map((v, i) => {
    const clr  = v >= target ? 'var(--available)' : 'var(--expiring)';
    const sel  = i === _selectedPeriod
      ? `stroke="var(--green)" stroke-width="2.5"` : `stroke="#fff" stroke-width="1.2"`;
    const lbl  = stripPeriodPrefix(_panelHistory[i].period);
    return `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="4"
                    fill="${clr}" ${sel} style="cursor:pointer"
                    onclick="selectPeriod(${i})">
              <title>${lbl}: ${v}%</title>
            </circle>`;
  }).join('');

  const xLabels = _panelHistory.map((h, i) => {
    const short = stripPeriodPrefix(h.period).split('–')[0].trim();
    return `<text x="${px(i).toFixed(1)}" y="${H-padB+12}" text-anchor="middle"
                  class="trend-tick" style="font-size:9px">${short}</text>`;
  }).join('');

  const yTicks = [50, 75, 100].map(v => {
    const y = py(v).toFixed(1);
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"
                  stroke="var(--border)" stroke-width="0.5"/>
            <text x="${padL-4}" y="${y}" text-anchor="end" dominant-baseline="middle"
                  class="trend-tick" style="font-size:9px">${v}</text>`;
  }).join('');

  return `
    <section class="panel__section">
      <div class="panel__section-title">Health Trend
        <span class="panel__section-note">click a point to inspect that period</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="panel__trend-svg"
           xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        ${yTicks}
        <line x1="${padL}" y1="${ty}" x2="${W-padR}" y2="${ty}"
              stroke="var(--available)" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
        <path d="${areaPath}" fill="var(--green)" opacity="0.07"/>
        <polyline points="${polyPts}" fill="none" stroke="var(--green)"
                  stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${xLabels}
      </svg>
    </section>`;
}

// ── inspection history table ──────────────────────────────────────────
function buildHistoryTable() {
  if (!_panelHistory.length) return `
    <section class="panel__section">
      <div class="panel__section-title">Inspection History</div>
      <p class="panel__none">No records found.</p>
    </section>`;

  const legend = `
    <div class="panel__hist-legend">
      <span><strong>Cert.</strong> — certified road-worthy (zero IA items)</span>
      <span><strong>IA</strong> — immediate attention · must fix</span>
      <span><strong>FA</strong> — future attention · monitor</span>
      <span><strong>OK</strong> — passed</span>
    </div>`;

  const rows = [..._panelHistory]
    .sort((a, b) => b.insp_date.localeCompare(a.insp_date))
    .map((h, i) => {
      const idx     = _panelHistory.indexOf(h);
      const active  = idx === _selectedPeriod ? ' class="panel__hist-row--active"' : '';
      const certIcon = h.certified
        ? '<span class="panel__cert panel__cert--ok">✓</span>'
        : '<span class="panel__cert panel__cert--fail">✗</span>';
      const hlthClr = h.health_score >= 90 ? 'var(--available)'
                    : h.health_score >= 70 ? 'var(--expiring)' : 'var(--failed)';
      return `<tr${active} style="cursor:pointer" onclick="selectPeriod(${idx})">
        <td>${fmtDate(h.insp_date)}</td>
        <td class="panel__hist-period">${stripPeriodPrefix(h.period)}</td>
        <td style="color:${hlthClr};font-weight:600">${h.health_score}%</td>
        <td class="panel__hist-center">${certIcon}</td>
        <td class="panel__hist-center ${h.ia > 0 ? 'panel__hist-ia' : ''}">${h.ia}</td>
        <td class="panel__hist-center">${h.fa}</td>
        <td class="panel__hist-center panel__hist-ok">${h.ok}</td>
      </tr>`;
    }).join('');

  return `
    <section class="panel__section">
      <div class="panel__section-title">Inspection History</div>
      ${legend}
      <div class="panel__hist-wrap">
        <table class="panel__hist-table">
          <thead>
            <tr>
              <th>Date</th><th>Period</th><th>Health</th>
              <th>Cert.</th><th>IA</th><th>FA</th><th>OK</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}
