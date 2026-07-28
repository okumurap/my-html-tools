(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const routeLength = 4200;
  const zones = [
    { start: 0, end: 300, limit: 35 },
    { start: 300, end: 1220, limit: 60 },
    { start: 1220, end: 1550, limit: 40 },
    { start: 1550, end: 2550, limit: 60 },
    { start: 2550, end: 3120, limit: 45 },
    { start: 3120, end: 3900, limit: 60 },
    { start: 3900, end: 4200, limit: 30 }
  ];
  const routeProgress = $('#routeProgress');
  const speedEl = $('#speed');
  const limitEl = $('#speedLimit');
  const speedMap = $('.speed-limit-map');
  const scene = $('.scene-wrap');
  if (!routeProgress || !speedEl || !limitEl || !speedMap || !scene) return;

  function routePosition() {
    return clamp(parseFloat(routeProgress.style.width) || 0, 0, 100) / 100 * routeLength;
  }
  function limitAt(pos) {
    return zones.find(z => pos >= z.start && pos < z.end)?.limit || zones.at(-1).limit;
  }

  const chart = document.createElement('div');
  chart.className = 'speed-chart-wrap';
  chart.innerHTML = '<div class="speed-chart-head"><div class="speed-chart-legend"><span class="speed-chart-key">実速度</span><span class="speed-chart-key limit">制限速度</span></div><strong class="speed-chart-now">0 / 35 km/h</strong></div><canvas class="speed-chart-canvas" aria-label="路線距離ごとの実速度と制限速度グラフ"></canvas>';
  speedMap.append(chart);
  const graph = $('.speed-chart-canvas', chart);
  const graphCtx = graph.getContext('2d');
  const nowLabel = $('.speed-chart-now', chart);
  const samples = [{ pos: 0, speed: 0 }];
  let lastSamplePos = 0;
  let lastSampleTime = 0;

  function resizeCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(300, Math.round(rect.width * dpr));
    const h = Math.max(80, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    return { w, h, dpr };
  }

  function drawChart() {
    const { w, h, dpr } = resizeCanvas(graph, graphCtx);
    const pad = { l: 30 * dpr, r: 8 * dpr, t: 8 * dpr, b: 18 * dpr };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const maxSpeed = 80;
    const x = pos => pad.l + pos / routeLength * pw;
    const y = speed => pad.t + (1 - clamp(speed, 0, maxSpeed) / maxSpeed) * ph;

    graphCtx.clearRect(0, 0, w, h);
    graphCtx.strokeStyle = 'rgba(255,255,255,.15)';
    graphCtx.lineWidth = dpr;
    graphCtx.fillStyle = 'rgba(230,240,245,.72)';
    graphCtx.font = `${8 * dpr}px sans-serif`;
    graphCtx.textAlign = 'right';
    graphCtx.textBaseline = 'middle';
    [0, 20, 40, 60, 80].forEach(v => {
      graphCtx.beginPath();
      graphCtx.moveTo(pad.l, y(v));
      graphCtx.lineTo(w - pad.r, y(v));
      graphCtx.stroke();
      graphCtx.fillText(String(v), pad.l - 5 * dpr, y(v));
    });

    graphCtx.strokeStyle = '#ffd166';
    graphCtx.lineWidth = 2.2 * dpr;
    graphCtx.setLineDash([6 * dpr, 3 * dpr]);
    graphCtx.beginPath();
    zones.forEach((z, i) => {
      if (i === 0) graphCtx.moveTo(x(z.start), y(z.limit));
      else graphCtx.lineTo(x(z.start), y(z.limit));
      graphCtx.lineTo(x(z.end), y(z.limit));
    });
    graphCtx.stroke();
    graphCtx.setLineDash([]);

    if (samples.length > 1) {
      graphCtx.strokeStyle = '#5fc3ff';
      graphCtx.lineWidth = 2.5 * dpr;
      graphCtx.lineJoin = 'round';
      graphCtx.lineCap = 'round';
      graphCtx.beginPath();
      samples.forEach((s, i) => i ? graphCtx.lineTo(x(s.pos), y(s.speed)) : graphCtx.moveTo(x(s.pos), y(s.speed)));
      graphCtx.stroke();
    }

    const pos = routePosition();
    graphCtx.strokeStyle = '#ff6b6b';
    graphCtx.lineWidth = 1.5 * dpr;
    graphCtx.beginPath();
    graphCtx.moveTo(x(pos), pad.t);
    graphCtx.lineTo(x(pos), pad.t + ph);
    graphCtx.stroke();

    graphCtx.fillStyle = 'rgba(230,240,245,.7)';
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    [['0',0],['1.4',1400],['2.9',2900],['4.2km',4200]].forEach(([label,p]) => graphCtx.fillText(label, x(p), h - 14 * dpr));
  }

  const overlay = document.createElement('canvas');
  overlay.className = 'curve-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  scene.append(overlay);
  const curveCtx = overlay.getContext('2d');
  const curveBadge = document.createElement('div');
  curveBadge.className = 'curve-badge';
  curveBadge.innerHTML = '<strong>カーブ</strong><span></span>';
  scene.append(curveBadge);
  const curveText = $('span', curveBadge);

  function curvatureAt(pos) {
    const smooth = (start, peak, end, amount) => {
      if (pos < start || pos > end) return 0;
      if (pos <= peak) return Math.sin((pos - start) / (peak - start) * Math.PI / 2) * amount;
      return Math.cos((pos - peak) / (end - peak) * Math.PI / 2) * amount;
    };
    return smooth(520, 820, 1180, .44) + smooth(1660, 1930, 2250, -.52) + smooth(3180, 3440, 3730, .48);
  }

  function curveInfo(pos) {
    const c = curvatureAt(pos);
    if (Math.abs(c) < .07) return null;
    const radius = Math.round(520 / Math.max(.18, Math.abs(c)) / 10) * 10;
    return { direction: c > 0 ? '右' : '左', radius };
  }

  function drawCurveScene() {
    const { w, h, dpr } = resizeCanvas(overlay, curveCtx);
    curveCtx.clearRect(0, 0, w, h);
    const pos = routePosition();
    const curve = curvatureAt(pos);
    const horizonY = h * .52;
    const bottomY = h * .91;
    const centerBottom = w * .5;
    const centerHorizon = w * (.5 + curve * .2);

    const centerX = t => {
      const q = t * t;
      return centerBottom + (centerHorizon - centerBottom) * q + curve * w * .19 * Math.sin(Math.PI * t) * (1 - t * .28);
    };
    const yy = t => bottomY + (horizonY - bottomY) * t;
    const halfGauge = t => (w * .31) * Math.pow(1 - t, 1.35) + w * .012;

    curveCtx.fillStyle = 'rgba(91,112,71,.34)';
    curveCtx.beginPath();
    curveCtx.moveTo(0, bottomY);
    curveCtx.lineTo(w, bottomY);
    curveCtx.lineTo(w, horizonY + h * .02);
    curveCtx.lineTo(0, horizonY + h * .02);
    curveCtx.closePath();
    curveCtx.fill();

    curveCtx.strokeStyle = '#dedbd2';
    curveCtx.lineWidth = Math.max(3 * dpr, w * .0055);
    [-1, 1].forEach(side => {
      curveCtx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const t = i / 36;
        const px = centerX(t) + side * halfGauge(t);
        const py = yy(t);
        i ? curveCtx.lineTo(px, py) : curveCtx.moveTo(px, py);
      }
      curveCtx.stroke();
    });

    for (let i = 0; i < 24; i++) {
      const t = Math.pow(i / 23, .64);
      const px = centerX(t);
      const py = yy(t);
      const hw = halfGauge(t) * 1.18;
      curveCtx.strokeStyle = 'rgba(68,57,48,.9)';
      curveCtx.lineWidth = Math.max(1 * dpr, (1 - t) * 7 * dpr);
      curveCtx.beginPath();
      curveCtx.moveTo(px - hw, py);
      curveCtx.lineTo(px + hw, py);
      curveCtx.stroke();
    }

    const info = curveInfo(pos);
    curveBadge.classList.toggle('visible', Boolean(info));
    if (info) curveText.textContent = `${info.direction} R${info.radius}m`;

    const station = $('.station-scenery');
    if (station) station.style.right = `${clamp(-1 - curve * 16, -10, 8)}%`;
  }

  function tick(now) {
    const pos = routePosition();
    const speed = Number(speedEl.textContent) || 0;
    const limit = Number(limitEl.textContent) || limitAt(pos);
    nowLabel.textContent = `${Math.round(speed)} / ${limit} km/h`;
    if (pos < lastSamplePos - 50) {
      samples.length = 1;
      samples[0] = { pos: 0, speed: 0 };
      lastSamplePos = 0;
      lastSampleTime = 0;
    }
    if ((pos - lastSamplePos >= 12 || now - lastSampleTime >= 900) && pos >= lastSamplePos) {
      samples.push({ pos, speed });
      if (samples.length > 650) samples.splice(1, 1);
      lastSamplePos = pos;
      lastSampleTime = now;
    }
    drawChart();
    drawCurveScene();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();