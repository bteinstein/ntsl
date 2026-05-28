// ── charts.js — fleet health trend chart ────────────────────────────

function _splinePath(xs, ys, tension = 0.35) {
  const n = xs.length;
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0       ? [xs[0],   ys[0]]   : [xs[i-1], ys[i-1]];
    const p1 = [xs[i],   ys[i]];
    const p2 = [xs[i+1], ys[i+1]];
    const p3 = i + 2 < n ? [xs[i+2], ys[i+2]] : [xs[i+1], ys[i+1]];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function renderTrendChart() {
  const section = document.getElementById('trend-section');
  const trend   = state.data.trend;
  const target  = state.data.kpis.fleet_health_target;

  if (!trend || trend.length < 2) {
    section.innerHTML = '<p class="trend-empty">No trend data available.</p>';
    return;
  }

  const W = 760, H = 180;
  const padL = 48, padR = 52, padT = 24, padB = 44;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const N  = trend.length;

  const vals = trend.map(t => t.avg_health_pct);
  const minVal = Math.floor(Math.min(...vals) / 10) * 10 - 5;
  const maxVal = 100;
  const range  = maxVal - minVal;

  function px(i) { return padL + (i / (N - 1)) * cW; }
  function py(v) { return padT + cH - ((v - minVal) / range) * cH; }

  const xs = vals.map((_, i) => px(i));
  const ys = vals.map(v => py(v));

  // y grid + labels
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

  // smooth line + area (catmull-rom spline)
  const linePath = _splinePath(xs, ys);
  const bottom   = (padT + cH).toFixed(1);
  const areaPath = `${linePath} L${xs[N-1].toFixed(1)},${bottom} L${xs[0].toFixed(1)},${bottom} Z`;

  const area = `<path d="${areaPath}" fill="var(--green)" opacity="0.07"/>`;
  const line = `<path d="${linePath}" fill="none" stroke="var(--green)"
                      stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // dots
  const dots = vals.map((v, i) => {
    const clr = v >= target ? 'var(--available)' : 'var(--expiring)';
    const lbl = stripPeriodPrefix(trend[i].period);
    return `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4" fill="${clr}"
                    stroke="#fff" stroke-width="1.5" class="trend-dot">
              <title>${lbl}\n${v}% health · ${trend[i].trucks_inspected} trucks</title>
            </circle>`;
  }).join('');

  // value labels — smaller, muted; nudge down if too close to top
  const valLabels = vals.map((v, i) => {
    const raw    = ys[i] - 9;
    const cy     = (raw < padT + 2 ? ys[i] + 13 : raw).toFixed(1);
    const anchor = i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle';
    return `<text x="${xs[i].toFixed(1)}" y="${cy}" text-anchor="${anchor}"
                  class="trend-val-lbl">${v}%</text>`;
  }).join('');

  // x-axis labels
  const xLabels = trend.map((t, i) => {
    const short = stripPeriodPrefix(t.period).split('–')[0].trim();
    return `<text x="${xs[i].toFixed(1)}" y="${H - padB + 14}" text-anchor="middle"
                  class="trend-tick">${short}</text>`;
  }).join('');

  const pNums = trend.map((t, i) => {
    const num = t.period.match(/Period (\d+)/i)?.[1] ?? (i + 1);
    return `<text x="${xs[i].toFixed(1)}" y="${H - padB + 28}" text-anchor="middle"
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
