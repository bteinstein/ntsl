// ── kpis.js — KPI strip render ───────────────────────────────────────

function pct(n, total) {
  if (!total) return '—';
  return Math.round(n / total * 100) + '% of fleet';
}

function stripPeriodPrefix(label) {
  return label.replace(/^Period \d+\s*[—–]\s*/i, '');
}

function buildSparkline(trend, target) {
  if (!trend || trend.length < 2) return '';

  const W = 100, H = 28, pad = 3;
  const vals = trend.map(t => t.avg_health_pct);
  const minV = 0, maxV = 100;

  function x(i)   { return pad + (i / (vals.length - 1)) * (W - pad * 2); }
  function y(v)   { return H - pad - ((v - minV) / (maxV - minV)) * (H - pad * 2); }
  function ty()   { return y(target); }

  const points = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const latestAbove = vals.at(-1) >= target;
  const lineColor   = latestAbove ? 'var(--available)' : 'var(--expiring)';

  return `
    <svg class="kpi-sparkline" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${pad}" y1="${ty().toFixed(1)}" x2="${W - pad}" y2="${ty().toFixed(1)}"
            stroke="var(--border)" stroke-width="1" stroke-dasharray="3 2"/>
      <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="1.6"
                stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals.at(-1)).toFixed(1)}"
              r="2.2" fill="${lineColor}"/>
    </svg>`;
}

// ── inline SVG icon set ──────────────────────────────────────────────
const KPI_ICONS = {
  truck:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 17H2V5h12v12Z"/><path d="M14 8h4l4 4v5h-4"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>',
  rate:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  shield:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z"/></svg>',
  clock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  cal:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  alert:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  ghost:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/></svg>',
  gauge:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0"/><line x1="12" y1="12" x2="16" y2="8"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

// ── KPI definitions (for tooltips) ───────────────────────────────────
const KPI_DEFS = {
  total:     { title: 'Total Trucks',      body: 'All trucks enrolled in the fleet inspection programme.' },
  inspected: { title: 'Inspected',         body: 'Trucks with at least one inspection in the current window (14 days).' },
  rate:      { title: 'Inspection Rate',   body: 'Inspected ÷ Total Trucks. Target: 100% per period.' },
  available: { title: 'Available',         body: 'Certified and expiry > 7 days away. Fully road-worthy with no renewal urgency.' },
  expiring:  { title: 'Expiring Soon',     body: '<strong>Still road-worthy today</strong> — certified, but expiry within 7 days. Schedule re-inspection.' },
  overdue:   { title: 'Overdue',           body: 'Was certified, validity has lapsed. Not road-worthy until re-inspected.' },
  failed:    { title: 'Failed',            body: 'Has Immediate Attention (IA) items from last inspection. Never certified.' },
  missed:    { title: 'Missed Inspection', body: 'Enrolled but no inspection in the current window.' },
  health:    { title: 'Fleet Health Score', body: 'Average health % across all trucks. Formula: OK ÷ (50 − Not Inspected) × 100. Target 90%.' },
};

// CTA: toggles filter on/off for that status
function viewTrucksCTA(statusKey, count) {
  if (!count) return `<div class="kpi-cta kpi-cta--muted">Up to date</div>`;
  const active = state.filters.statuses.length === 1 && state.filters.statuses[0] === statusKey;
  if (active) {
    return `<button type="button" class="kpi-cta kpi-cta--active"
                    onclick="setStatusFilter('${statusKey}')">✕ Clear filter</button>`;
  }
  return `<button type="button" class="kpi-cta"
                  onclick="setStatusFilter('${statusKey}')">View Trucks →</button>`;
}

function renderKPIs() {
  const k     = state.data.kpis;
  const trend = state.data.trend;
  const total = k.total_trucks;

  const sparkline = buildSparkline(trend, k.fleet_health_target);
  const vsTarget  = k.fleet_health_score - k.fleet_health_target;
  const vsTargetCls = vsTarget >= 0 ? 'positive' : 'negative';

  // road-worthy today = Available + Expiring Soon (both certified)
  const roadWorthy = (k.available || 0) + (k.expiring_soon || 0);

  // All 9 KPIs
  const cards = [
    { id: 'total',     label: 'Total Trucks',    value: total,                       icon: KPI_ICONS.truck,
      sub: '<span class="kpi-sub">enrolled</span>' },
    { id: 'inspected', label: 'Inspected',       value: k.inspected,                 icon: KPI_ICONS.check,
      sub: `<span class="kpi-sub">${pct(k.inspected, total)}</span>` },
    { id: 'rate',      label: 'Insp. Rate',      value: k.inspection_rate_pct + '%', icon: KPI_ICONS.rate,
      sub: `<span class="kpi-sub">${k.inspected} of ${total}</span>` },
    { id: 'available', label: 'Available',       value: k.available,                 icon: KPI_ICONS.shield, cls: 'available',
      sub: `<span class="kpi-sub">${pct(k.available, total)}</span>` },
    { id: 'expiring',  label: 'Expiring Soon',   value: k.expiring_soon,             icon: KPI_ICONS.cal,    cls: 'expiring',
      sub: `<span class="kpi-sub kpi-sub--positive">still road-worthy · ≤ ${state.data.meta.expiry_soon_days ?? 7} days</span>`,
      cta: viewTrucksCTA('Expiring Soon', k.expiring_soon) },
    { id: 'overdue',   label: 'Overdue',         value: k.overdue,                   icon: KPI_ICONS.clock,  cls: 'overdue',
      sub: `<span class="kpi-sub">${pct(k.overdue, total)}</span>`,
      cta: viewTrucksCTA('Overdue', k.overdue) },
    { id: 'failed',    label: 'Failed',          value: k.failed,                    icon: KPI_ICONS.alert,  cls: 'failed',
      sub: `<span class="kpi-sub">${pct(k.failed, total)}</span>`,
      cta: viewTrucksCTA('Failed', k.failed) },
    { id: 'missed',    label: 'Missed',          value: k.missed_inspection,         icon: KPI_ICONS.ghost,  cls: 'missed',
      sub: `<span class="kpi-sub">${pct(k.missed_inspection, total)}</span>` },
    { id: 'health',    label: 'Fleet Health',    value: `${k.fleet_health_score}%`,  icon: KPI_ICONS.gauge,  cls: 'health',
      sub: `<span class="kpi-sub kpi-sub--${vsTargetCls}">${vsTarget >= 0 ? '+' : ''}${vsTarget}% vs ${k.fleet_health_target}% target</span>`,
      spark: sparkline },
  ];

  const html = cards.map(c => {
    const def = KPI_DEFS[c.id];
    const tipAttrs = def
      ? `data-tip-title="${def.title}" data-tip-body="${def.body.replace(/"/g, '&quot;')}"`
      : '';
    return `
    <div class="kpi-card ${c.cls ? 'kpi-card--' + c.cls : ''}" ${tipAttrs}>
      <div class="kpi-card__top">
        <span class="kpi-icon ${c.cls ? 'kpi-icon--' + c.cls : ''}">${c.icon}</span>
        <span class="kpi-label">${c.label}</span>
        <span class="kpi-info" aria-label="info">${KPI_ICONS.info}</span>
      </div>
      <div class="kpi-card__value-row">
        <div class="kpi-value">${c.value}</div>
        ${c.spark || ''}
      </div>
      <div class="kpi-card__foot-row">${c.sub}</div>
      ${c.cta ? `<div class="kpi-card__foot">${c.cta}</div>` : ''}
    </div>`;
  }).join('');

  // Road-worthy summary strip — anchors the positive total across Available + Expiring Soon
  const rwHTML = `
    <div class="kpi-roadworthy">
      <span class="kpi-rw__icon">${KPI_ICONS.shield}</span>
      <span class="kpi-rw__count">${roadWorthy}</span>
      <span class="kpi-rw__label">trucks road-worthy today</span>
      <span class="kpi-rw__split">
        ${k.available} fully available · ${k.expiring_soon} expiring ≤ ${state.data.meta.expiry_soon_days ?? 7} days
      </span>
    </div>`;

  document.getElementById('kpi-strip').innerHTML = `
    <div class="kpi-header">
      <span class="kpi-header__title">Fleet Status</span>
      <span class="kpi-header__date">as of ${k.ref_date}</span>
    </div>
    ${rwHTML}
    <div class="kpi-cards kpi-cards--single">${html}</div>`;

  bindKpiTooltips();
}

// ── KPI hover tooltips ────────────────────────────────────────────────
function bindKpiTooltips() {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  let tt = document.getElementById('kpiTooltip');
  if (!tt) {
    tt = document.createElement('div');
    tt.id = 'kpiTooltip';
    tt.className = 'kpi-tooltip';
    tt.hidden = true;
    document.body.appendChild(tt);
  }

  strip.querySelectorAll('.kpi-card[data-tip-title]').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const title = card.dataset.tipTitle;
      const body  = card.dataset.tipBody;
      tt.innerHTML = `
        <div class="kpi-tt-title">${title}</div>
        <div class="kpi-tt-body">${body}</div>`;
      tt.hidden = false;
    });
    card.addEventListener('mousemove', (e) => {
      const tw = tt.offsetWidth || 220;
      const th = tt.offsetHeight || 80;
      const x  = e.clientX;
      const y  = e.clientY;
      const flipLeft = (x + tw + 24) > window.innerWidth;
      const flipUp   = (y + th + 24) > window.innerHeight;
      tt.style.left = `${flipLeft ? x - tw - 14 : x + 14}px`;
      tt.style.top  = `${flipUp   ? y - th - 14 : y + 14}px`;
    });
    card.addEventListener('mouseleave', () => { tt.hidden = true; });
  });
}
