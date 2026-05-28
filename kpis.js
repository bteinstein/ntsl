// ── kpis.js — KPI strip render ───────────────────────────────────────

function pct(n, total) {
  if (!total) return '—';
  return Math.round(n / total * 100) + '% of fleet';
}

function stripPeriodPrefix(label) {
  // "Period 9 — May 04 – May 17"  →  "May 04 – May 17"
  return label.replace(/^Period \d+\s*[—–]\s*/i, '');
}

function buildSparkline(trend, target) {
  if (!trend || trend.length < 2) return '';

  const W = 120, H = 36, pad = 3;
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
      <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="1.8"
                stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals.at(-1)).toFixed(1)}"
              r="2.5" fill="${lineColor}"/>
    </svg>`;
}

function renderKPIs() {
  const k     = state.data.kpis;
  const trend = state.data.trend;
  const total = k.total_trucks;

  const sparkline   = buildSparkline(trend, k.fleet_health_target);
  const healthDelta = k.fleet_health_score - k.fleet_health_target;
  const healthSub   = `vs ${k.fleet_health_target}% target`;
  const healthCls   = healthDelta >= 0 ? 'positive' : 'negative';

  const latestPeriod = trend?.length
    ? stripPeriodPrefix(trend.at(-1).period)
    : '';

  const cards = [
    { label: 'Total Trucks',     value: total,                  sub: '',                                            cls: '' },
    { label: 'Inspected',        value: k.inspected,            sub: pct(k.inspected, total),                       cls: '' },
    { label: 'Insp. Rate',       value: k.inspection_rate_pct + '%', sub: `${k.inspected} of ${total} trucks`,     cls: '' },
    { label: 'Available',        value: k.available,            sub: pct(k.available, total),                       cls: 'available' },
    { label: 'Expiring Soon',    value: k.expiring_soon,        sub: pct(k.expiring_soon, total),                   cls: 'expiring' },
    { label: 'Overdue',          value: k.overdue,              sub: pct(k.overdue, total),                         cls: 'overdue' },
    { label: 'Failed',           value: k.failed,               sub: pct(k.failed, total),                          cls: 'failed' },
    { label: 'Missed',           value: k.missed_inspection,    sub: pct(k.missed_inspection, total),               cls: 'missed' },
  ];

  const cardHTML = cards.map(c => `
    <div class="kpi-card ${c.cls ? 'kpi-card--' + c.cls : ''}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      ${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ''}
    </div>`).join('');

  document.getElementById('kpi-strip').innerHTML = `
    <div class="kpi-header">
      <span class="kpi-header__title">Fleet Status</span>
      <span class="kpi-header__date">as of ${k.ref_date}</span>
    </div>
    <div class="kpi-cards">
      ${cardHTML}
      <div class="kpi-card kpi-card--health">
        <div class="kpi-label">Fleet Health Score</div>
        <div class="kpi-health-row">
          <div class="kpi-value">${k.fleet_health_score}%</div>
          ${sparkline}
        </div>
        <div class="kpi-sub kpi-sub--${healthCls}">
          ${healthDelta >= 0 ? '+' : ''}${healthDelta}% ${healthSub}
        </div>
      </div>
    </div>`;
}
