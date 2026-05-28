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

// certified-count per period — computed from history (sum across all trucks)
function _certifiedByPeriod() {
  const out = {};
  const hist = state.data.history || {};
  Object.values(hist).forEach(rows => {
    rows.forEach(r => {
      out[r.period] = (out[r.period] || 0) + (r.certified ? 1 : 0);
    });
  });
  return out;
}

function renderTrendChart() {
  const section = document.getElementById('trend-section');
  const trendRaw = state.data.trend;
  const target   = state.data.kpis.fleet_health_target;

  if (!trendRaw || trendRaw.length < 2) {
    section.innerHTML = '<p class="trend-empty">No trend data available.</p>';
    return;
  }

  // chronological sort
  const trend = [...trendRaw].sort((a, b) => {
    const ax = stripPeriodPrefix(a.period).split('–')[0].trim();
    const bx = stripPeriodPrefix(b.period).split('–')[0].trim();
    return new Date(`${ax}, 2026`).getTime() - new Date(`${bx}, 2026`).getTime();
  });

  const certByPeriod = _certifiedByPeriod();

  // ── layout ──
  // Two stacked plot areas inside one SVG:
  //   1. Line chart (health %)
  //   2. Bar strip (trucks inspected) — own baseline, no shared y-axis
  const W           = 880;
  const padL        = 60;
  const padR        = 56;
  const padT        = 28;
  const innerMargin = 24;

  const lineH    = 170;                         // height of line chart
  const stripGap = 14;                          // gap between line and bars
  const stripH   = 40;                          // bar strip height
  const xLblPad  = 22;                          // space for x-axis date labels
  const padB     = 14;                          // bottom padding
  const H        = padT + lineH + stripGap + stripH + xLblPad + padB;

  const cW         = W - padL - padR;
  const N          = trend.length;
  const lineTop    = padT;
  const lineBottom = padT + lineH;
  const stripTop   = lineBottom + stripGap;
  const stripBot   = stripTop + stripH;

  const vals    = trend.map(t => t.avg_health_pct);
  const volumes = trend.map(t => t.trucks_inspected);
  const minVal  = 40;
  const maxVal  = 100;
  const range   = maxVal - minVal;

  // Bar strip scaling — min 0 so all bars share a true baseline
  const maxVol  = Math.max(...volumes, 1);

  function px(i)   { return padL + innerMargin + (i / (N - 1)) * (cW - innerMargin * 2); }
  function py(v)   { return lineBottom - ((v - minVal) / range) * lineH; }
  function barTop(v) { return stripBot - (v / maxVol) * stripH; }

  const xs = vals.map((_, i) => px(i));
  const ys = vals.map(v => py(v));

  // ── line chart y-grid + labels ──
  const yTicks = [50, 60, 70, 80, 90, 100].map(v => {
    const y = py(v).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="var(--border)" stroke-width="0.5"/>
      <text x="${padL - 12}" y="${y}" text-anchor="end" dominant-baseline="middle"
            class="trend-tick">${v}%</text>`;
  }).join('');

  // ── target line ──
  const ty = py(target).toFixed(1);
  const targetLine = `
    <line x1="${padL}" y1="${ty}" x2="${W - padR}" y2="${ty}"
          stroke="var(--available)" stroke-width="1.2" stroke-dasharray="6 3" opacity="0.7"/>
    <text x="${W - padR + 6}" y="${ty}" dominant-baseline="middle"
          class="trend-target-lbl">▸ ${target}%</text>`;

  // ── line + area ──
  const linePath = _splinePath(xs, ys);
  const areaPath = `${linePath} L${xs[N-1].toFixed(1)},${lineBottom} L${xs[0].toFixed(1)},${lineBottom} Z`;
  const area = `<path d="${areaPath}" fill="var(--green)" opacity="0.06"/>`;
  const line = `<path d="${linePath}" fill="none" stroke="var(--green)"
                      stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // ── line dots (interactive) ──
  const dots = vals.map((v, i) => {
    const clr  = v >= target ? 'var(--available)' : 'var(--expiring)';
    const lbl  = stripPeriodPrefix(trend[i].period);
    const cert = certByPeriod[trend[i].period] ?? 0;
    return `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4.5" fill="${clr}"
                    stroke="#fff" stroke-width="1.8" class="trend-dot"
                    data-label="${lbl}"
                    data-health="${v}"
                    data-inspected="${trend[i].trucks_inspected}"
                    data-certified="${cert}"></circle>`;
  }).join('');

  // ── value labels above line ──
  const valLabels = vals.map((v, i) => {
    const cy = (ys[i] - 10).toFixed(1);
    return `<text x="${xs[i].toFixed(1)}" y="${cy}" text-anchor="middle"
                  class="trend-val-lbl">${v}%</text>`;
  }).join('');

  // ── volume bar strip (below) ──
  const barW = Math.max(10, (cW - innerMargin * 2) / N * 0.4);
  const stripBaseline = `<line x1="${padL}" y1="${stripBot}" x2="${W - padR}" y2="${stripBot}"
                              stroke="var(--border)" stroke-width="0.6"/>`;
  const bars = volumes.map((v, i) => {
    const top = barTop(v);
    const h   = stripBot - top;
    const x   = xs[i] - barW / 2;
    return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}"
                  height="${h.toFixed(1)}" fill="var(--green)" opacity="0.55" rx="2"
                  class="trend-bar"
                  data-label="${stripPeriodPrefix(trend[i].period)}"
                  data-inspected="${v}"/>`;
  }).join('');
  const barCounts = volumes.map((v, i) => {
    return `<text x="${xs[i].toFixed(1)}" y="${(barTop(v) - 3).toFixed(1)}"
                  text-anchor="middle" class="trend-bar-lbl">${v}</text>`;
  }).join('');
  const stripLbl = `<text x="${padL - 12}" y="${((stripTop + stripBot) / 2).toFixed(1)}"
                          text-anchor="end" dominant-baseline="middle"
                          class="trend-strip-lbl">Inspected</text>`;

  // ── x-axis date labels ──
  const xLblY = stripBot + xLblPad - 6;
  const xLabels = trend.map((t, i) => {
    const short = stripPeriodPrefix(t.period).split('–')[0].trim();
    return `<text x="${xs[i].toFixed(1)}" y="${xLblY}" text-anchor="middle"
                  class="trend-tick">${short}</text>`;
  }).join('');

  // ── axis title ──
  const yAxLbl = `<text x="${padL - 12}" y="${padT - 10}" text-anchor="end"
                        class="trend-axis-lbl">Health %</text>`;

  section.innerHTML = `
    <div class="trend-header">
      <span class="trend-title">Fleet Health Trend</span>
      <span class="trend-sub">avg health % per inspection period · target ${target}% · bars show trucks inspected</span>
    </div>
    <div class="trend-wrap" id="trendWrap">
      <svg class="trend-svg" id="trendSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
           preserveAspectRatio="xMidYMid meet">
        ${yTicks}
        ${yAxLbl}
        ${targetLine}
        ${area}
        ${line}
        ${valLabels}
        ${dots}
        ${stripBaseline}
        ${bars}
        ${barCounts}
        ${stripLbl}
        ${xLabels}
      </svg>
      <div class="trend-tooltip" id="trendTooltip" hidden></div>
    </div>`;

  bindTrendHover();
}

function bindTrendHover() {
  const wrap    = document.getElementById('trendWrap');
  const tooltip = document.getElementById('trendTooltip');
  const svg     = document.getElementById('trendSvg');
  if (!wrap || !tooltip || !svg) return;

  const items = svg.querySelectorAll('.trend-dot, .trend-bar');
  items.forEach(d => {
    d.addEventListener('mouseenter', () => {
      const label     = d.dataset.label;
      const health    = d.dataset.health;
      const inspected = d.dataset.inspected;
      const certified = d.dataset.certified;
      tooltip.innerHTML = `
        <div class="trend-tt-title">${label}</div>
        ${health      ? `<div class="trend-tt-row"><span>Avg health</span><strong>${health}%</strong></div>` : ''}
        <div class="trend-tt-row"><span>Trucks inspected</span><strong>${inspected}</strong></div>
        ${certified   ? `<div class="trend-tt-row"><span>Certified</span><strong>${certified}</strong></div>` : ''}`;
      tooltip.hidden = false;
    });
    d.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const tw = tooltip.offsetWidth || 180;
      const flipLeft = (x + tw + 28) > r.width;
      tooltip.style.left = `${flipLeft ? x - tw - 14 : x + 14}px`;
      tooltip.style.top  = `${y - 8}px`;
    });
    d.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  });
}
