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
  document.querySelectorAll('.curve-overlay,.curve-badge,.curve-ground-cover').forEach(el => el.remove());
  const routeProgress = $('#routeProgress');
  const speedEl = $('#speed');
  const limitEl = $('#speedLimit');
  const speedMap = $('.speed-limit-map');
  if (!routeProgress || !speedEl || !limitEl || !speedMap) return;
  const oldChart = $('.speed-chart-wrap', speedMap);
  oldChart?.remove();
  const chart = document.createElement('div');
  chart.className = 'speed-chart-wrap';
  chart.innerHTML = '<div class="speed-chart-head"><div class="speed-chart-legend"><span class="speed-chart-key">実速度</span><span class="speed-chart-key limit">制限速度</span></div><strong class="speed-chart-now">0 / 35 km/h</strong></div><canvas class="speed-chart-canvas" aria-label="路線距離ごとの実速度と制限速度グラフ"></canvas>';
  speedMap.append(chart);
  const graph = $('.speed-chart-canvas', chart);
  const ctx = graph.getContext('2d');
  const nowLabel = $('.speed-chart-now', chart);
  const samples = [{ pos: 0, speed: 0 }];
  let lastSamplePos = 0;
  let lastSampleTime = 0;
  const routePosition = () => clamp(parseFloat(routeProgress.style.width) || 0, 0, 100) / 100 * routeLength;
  function resize() {
    const rect = graph.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(300, Math.round(rect.width * dpr));
    const h = Math.max(100, Math.round(rect.height * dpr));
    if (graph.width !== w || graph.height !== h) { graph.width = w; graph.height = h; }
    return { w, h, dpr };
  }
  function draw() {
    const { w, h, dpr } = resize();
    const pad = { l: 31*dpr, r: 9*dpr, t: 8*dpr, b: 18*dpr };
    const pw = w-pad.l-pad.r, ph = h-pad.t-pad.b;
    const x = p => pad.l + p/routeLength*pw;
    const y = v => pad.t + (1-clamp(v,0,80)/80)*ph;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=dpr;
    ctx.fillStyle='rgba(230,240,245,.75)';ctx.font=`${8*dpr}px sans-serif`;ctx.textAlign='right';ctx.textBaseline='middle';
    [0,20,40,60,80].forEach(v=>{ctx.beginPath();ctx.moveTo(pad.l,y(v));ctx.lineTo(w-pad.r,y(v));ctx.stroke();ctx.fillText(String(v),pad.l-5*dpr,y(v));});
    ctx.strokeStyle='#ffd166';ctx.lineWidth=2.2*dpr;ctx.setLineDash([6*dpr,3*dpr]);ctx.beginPath();
    zones.forEach((z,i)=>{if(i===0)ctx.moveTo(x(z.start),y(z.limit));else ctx.lineTo(x(z.start),y(z.limit));ctx.lineTo(x(z.end),y(z.limit));});ctx.stroke();ctx.setLineDash([]);
    if(samples.length>1){ctx.strokeStyle='#5fc3ff';ctx.lineWidth=2.7*dpr;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();samples.forEach((s,i)=>i?ctx.lineTo(x(s.pos),y(s.speed)):ctx.moveTo(x(s.pos),y(s.speed)));ctx.stroke();}
    const pos=routePosition();ctx.strokeStyle='#ff6b6b';ctx.lineWidth=1.5*dpr;ctx.beginPath();ctx.moveTo(x(pos),pad.t);ctx.lineTo(x(pos),pad.t+ph);ctx.stroke();
    ctx.fillStyle='rgba(230,240,245,.72)';ctx.textAlign='center';ctx.textBaseline='top';[['0',0],['1.4',1400],['2.9',2900],['4.2km',4200]].forEach(([label,p])=>ctx.fillText(label,x(p),h-14*dpr));
  }
  function tick(now) {
    const pos=routePosition(), speed=Number(speedEl.textContent)||0, limit=Number(limitEl.textContent)||35;
    nowLabel.textContent=`${Math.round(speed)} / ${limit} km/h`;
    if(pos<lastSamplePos-50){samples.length=1;samples[0]={pos:0,speed:0};lastSamplePos=0;lastSampleTime=0;}
    if((pos-lastSamplePos>=10 || now-lastSampleTime>=700) && pos>=lastSamplePos){samples.push({pos,speed});if(samples.length>800)samples.splice(1,1);lastSamplePos=pos;lastSampleTime=now;}
    draw();requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
