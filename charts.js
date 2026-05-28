// ── charts.js — fleet health trend chart ────────────────────────────

function renderTrendChart() {
  const section = document.getElementById('trend-section');
  const trend   = state.data.trend;
  const target  = state.data.kpis.fleet_health_target;

  if (!trend || trend.length < 2) {
    section.innerHTML = '<p class="trend-empty">No trend data available.</p>';
    return;
  }

  const W = 760, H = 180;
  const padL = 36, padR = 52, padT = 24, padB = 44;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const N  = trend.length;

  const vals = trend.map(t => t.avg_health_pct);
  const minVal = Math.floor(Math.min(...vals) / 10) * 10 - 5;
  const maxVal = 100;
  const range  = maxVal - minVal;

  function px(i) { return padL + (i / (N - 1)) * cW; }
  function py(v) { return padT + cH - ((v - minVal) / range) * cH; }

  // y grid + labels — only round multiples of 25 that fall in range
  const yTicks = [0, 25, 50, 75, 100]
    .filter(v => v >= minVal && v <= maxVal)
    .map(v => {
      const y = py(v).toFixed(1);
      return `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
              stroke="var(--border)" stroke-width="${v === 0 ? 1 : 0.5}"/>
        <text x="${padL - 6}" y="${y}" text-anchor="end" dominant-baseline="middle"
              class="trend-tick">${v}</text>`;
    }).join('');

  // target dashed line
  const ty = py(target).toFixed(1);
  const targetLine = `
    <line x1="${padL}" y1="${ty}" x2="${W - padR}" y2="${ty}"
          stroke="var(--available)" stroke-width="1.2" stroke-dasharray="6 3" opacity="0.7"/>
    <text x="${W - padR + 5}" y="${ty}" dominant-baseline="middle"
          class="trend-target-lbl">▸ ${target}%</text>`;

  // area fill
  const ptArr   = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const polyPts = ptArr.join(' ');
  const areaPath = `M${px(0).toFixed(1)},${(padT + cH).toFixed(1)} ` +
                   ptArr.map(p => `L${p}`).join(' ') +
                   ` L${px(N - 1).toFixed(1)},${(padT + cH).toFixed(1)} Z`;

  const area = `<path d="${areaPath}" fill="var(--green)" opacity="0.06"/>`;

  // line
  const line = `<polyline points="${polyPts}" fill="none" stroke="var(--green)"
                           stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // dots
  const dots = vals.map((v, i) => {
    const cx  = px(i).toFixed(1);
    const cy  = py(v).toFixed(1);
    const clr = v >= target ? 'var(--available)' : 'var(--expiring)';
    const lbl = stripPeriodPrefix(trend[i].period);
    return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${clr}" stroke="#fff"
                    stroke-width="1.5" class="trend-dot">
              <title>${lbl}\n${v}% health · ${trend[i].trucks_inspected} trucks</title>
            </circle>`;
  }).join('');

  // value labels — above dot, nudge down if too close to top
  const valLabels = vals.map((v, i) => {
    const cx  = px(i).toFixed(1);
    const raw = py(v) - 11;
    const cy  = (raw < padT ? py(v) + 15 : raw).toFixed(1);
    return `<text x="${cx}" y="${cy}" text-anchor="middle" class="trend-val-lbl">${v}%</text>`;
  }).join('');

  // x-axis: start date of period
  const xLabels = trend.map((t, i) => {
    const short = stripPeriodPrefix(t.period).split('–')[0].trim();
    return `<text x="${px(i).toFixed(1)}" y="${H - padB + 14}" text-anchor="middle"
                  class="trend-tick">${short}</text>`;
  }).join('');

  const pNums = trend.map((t, i) => {
    const num = t.period.match(/Period (\d+)/i)?.[1] ?? (i + 1);
    return `<text x="${px(i).toFixed(1)}" y="${H - padB + 28}" text-anchor="middle"
                  class="trend-tick trend-pnum">P${num}</text>`;
  }).join('');

  section.innerHTML = `
    <div class="trend-header">
      <span class="trend-title">Fleet Health Trend</span>
      <span class="trend-sub">avg health score per inspection period · target ${target}% · all trucks, fleet-wide</span>
    </div>
    <div class="trend-wrap">
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
           preserveAspectRatio="xMidYMid meet">
        ${yTicks}
        ${targetLine}
        ${area}
        ${line}
        ${dots}
        ${valLabels}
        ${xLabels}
        ${pNums}
      </svg>
    </div>`;
}
