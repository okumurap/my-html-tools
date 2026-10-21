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
  const stations = [
    { name: 'S車庫', pos: 0 },
    { name: '滑走台跡', pos: 1400 },
    { name: '河和海岸', pos: 2900 },
    { name: '釣り桟橋', pos: 4200 }
  ];

  document.querySelectorAll('.curve-overlay,.curve-badge,.curve-ground-cover').forEach(el => el.remove());
  const routeProgress = $('#routeProgress');
  const speedEl = $('#speed');
  const limitEl = $('#speedLimit');
  const speedMap = $('.speed-limit-map');
  if (!routeProgress || !speedEl || !limitEl || !speedMap) return;

  $('.speed-chart-wrap', speedMap)?.remove();
  const chart = document.createElement('div');
  chart.className = 'speed-chart-wrap';
  chart.innerHTML = `<div class="speed-chart-head"><div class="speed-chart-legend"><span class="speed-chart-key">実速度</span><span class="speed-chart-key limit">制限速度</span><span class="speed-chart-key position">現在地</span></div><strong class="speed-chart-now">0 / 35 km/h</strong></div>
    <div class="speed-chart-tools"><label>表示区間<select class="speed-chart-zoom" aria-label="速度推移の拡大率"><option value="1">全線</option><option value="2">区間 2倍</option><option value="4">詳細 4倍</option></select></label><button type="button" class="speed-chart-follow" aria-pressed="true">現在地を追う</button></div>
    <div class="speed-chart-plot"><div class="speed-chart-axis" aria-hidden="true"><span data-speed="80">80</span><span data-speed="60">60</span><span data-speed="40">40</span><span data-speed="20">20</span><span data-speed="0">0</span></div><div class="speed-chart-viewport" tabindex="0" role="region" aria-label="速度推移グラフ。拡大後は左右へスクロールできます"><canvas class="speed-chart-canvas" role="img" aria-label="路線距離ごとの実速度、制限速度、駅位置グラフ"></canvas></div></div>
    <div class="speed-chart-footer"><span class="speed-chart-range">表示 0.0–4.2 km</span><span>左右へ動かすと追従を停止</span></div>`;
  speedMap.append(chart);

  const graph = $('.speed-chart-canvas', chart);
  const ctx = graph.getContext('2d');
  const nowLabel = $('.speed-chart-now', chart);
  const viewport=$('.speed-chart-viewport',chart),zoomSelect=$('.speed-chart-zoom',chart),followButton=$('.speed-chart-follow',chart);
  const rangeLabel=$('.speed-chart-range',chart),axisLabels=[...chart.querySelectorAll('.speed-chart-axis span')];
  let zoomLevel=1,following=true,lastDrawTime=-Infinity;
  function setFollowing(value){following=value;followButton.setAttribute('aria-pressed',String(value));}
  function updateRange(){
    const width=graph.getBoundingClientRect().width;
    if(!width||!viewport.clientWidth)return;
    const plot=Math.max(1,width-16);
    const from=clamp((viewport.scrollLeft-8)/plot,0,1)*routeLength;
    const to=clamp((viewport.scrollLeft+viewport.clientWidth-8)/plot,0,1)*routeLength;
    rangeLabel.textContent=`表示 ${(from/1000).toFixed(1)}–${(to/1000).toFixed(1)} km`;
  }
  function followPosition(){
    if(!following||!viewport.clientWidth)return;
    const width=graph.getBoundingClientRect().width;
    viewport.scrollLeft=clamp(8+routePosition()/routeLength*(width-16)-viewport.clientWidth*.4,0,Math.max(0,width-viewport.clientWidth));
    updateRange();
  }
  zoomSelect.addEventListener('change',()=>{
    const oldWidth=graph.getBoundingClientRect().width;
    const center=(viewport.scrollLeft+viewport.clientWidth/2)/Math.max(1,oldWidth);
    zoomLevel=Number(zoomSelect.value);viewport.style.setProperty('--chart-width',`${zoomLevel*100}%`);
    if(following)followPosition();else viewport.scrollLeft=center*graph.getBoundingClientRect().width-viewport.clientWidth/2;
    updateRange();draw();
  });
  followButton.addEventListener('click',()=>{setFollowing(!following);if(following)followPosition();});
  viewport.addEventListener('pointerdown',()=>setFollowing(false));
  viewport.addEventListener('wheel',()=>setFollowing(false),{passive:true});
  viewport.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key))setFollowing(false);});
  viewport.addEventListener('scroll',updateRange,{passive:true});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(viewport.clientWidth){followPosition();updateRange();draw();}}).observe(viewport);
  const samples = [{ pos: 0, speed: 0 }];
  let lastSamplePos = 0;
  let lastSampleTime = 0;
  const routePosition = () => clamp(parseFloat(routeProgress.style.width) || 0, 0, 100) / 100 * routeLength;

  function resize() {
    const rect = graph.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(80, Math.round(rect.width * dpr));
    const h = Math.max(60, Math.round(rect.height * dpr));
    if (graph.width !== w || graph.height !== h) {
      graph.width = w;
      graph.height = h;
    }
    return { w, h, dpr };
  }

  function draw() {
    if(!graph.getClientRects().length)return;
    const { w, h, dpr } = resize();
    const compact=Boolean(graph.closest('.live-telemetry'));
    const pad = { l: 8 * dpr, r: 8 * dpr, t: (compact?6:30) * dpr, b: (compact?18:24) * dpr };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const x = p => pad.l + p / routeLength * pw;
    const y = v => pad.t + (1 - clamp(v, 0, 80) / 80) * ph;

    axisLabels.forEach(label=>{label.hidden=compact&&[20,60].includes(Number(label.dataset.speed));label.style.top=`${y(Number(label.dataset.speed))/dpr}px`;});
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = dpr;
    ctx.fillStyle = 'rgba(230,240,245,.75)';
    ctx.font = `${8 * dpr}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [0, 20, 40, 60, 80].forEach(v => {
      ctx.beginPath();
      ctx.moveTo(pad.l, y(v));
      ctx.lineTo(w - pad.r, y(v));
      ctx.stroke();

    });

    ctx.save();
    ctx.setLineDash([3 * dpr, 4 * dpr]);
    ctx.strokeStyle = 'rgba(255,255,255,.42)';
    ctx.fillStyle = 'rgba(240,247,250,.88)';
    ctx.font = `700 ${11 * dpr}px sans-serif`;
    ctx.textBaseline = 'top';
    stations.forEach((station, index) => {
      const sx = x(station.pos);
      ctx.beginPath();
      ctx.moveTo(sx, pad.t);
      ctx.lineTo(sx, pad.t + ph);
      ctx.stroke();
      ctx.textAlign = index === 0 ? 'left' : index === stations.length - 1 ? 'right' : 'center';
      if(!compact)ctx.fillText(station.name, sx, 4 * dpr + (index % 2) * 9 * dpr);
    });
    ctx.restore();

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.2 * dpr;
    ctx.setLineDash([6 * dpr, 3 * dpr]);
    ctx.beginPath();
    zones.forEach((zone, index) => {
      if (index === 0) ctx.moveTo(x(zone.start), y(zone.limit));
      else ctx.lineTo(x(zone.start), y(zone.limit));
      ctx.lineTo(x(zone.end), y(zone.limit));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    if (samples.length > 1) {
      ctx.strokeStyle = '#5fc3ff';
      ctx.lineWidth = 2.8 * dpr;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      samples.forEach((sample, index) => index ? ctx.lineTo(x(sample.pos), y(sample.speed)) : ctx.moveTo(x(sample.pos), y(sample.speed)));
      ctx.stroke();
    }

    const pos = routePosition();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath();
    ctx.moveTo(x(pos), pad.t);
    ctx.lineTo(x(pos), pad.t + ph);
    ctx.stroke();

    ctx.fillStyle = 'rgba(230,240,245,.72)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font=`${10*dpr}px sans-serif`;
    const ticks=zoomLevel===1?[0,1400,2900,4200]:[0,500,1000,1500,2000,2500,3000,3500,4000,4200];
    ticks.forEach((p,index)=>{ctx.textAlign=index===0?'left':index===ticks.length-1?'right':'center';ctx.fillText(`${(p/1000).toFixed(1)}`,x(p),h-17*dpr);});
    followPosition();updateRange();
  }

  function tick(now) {
    const pos = routePosition();
    const speed = Number(speedEl.textContent) || 0;
    const limit = Number(limitEl.textContent) || 35;
    nowLabel.textContent = `${Math.round(speed)} / ${limit} km/h`;
    if (pos < lastSamplePos - 50) {
      samples.length = 1;
      samples[0] = { pos: 0, speed: 0 };
      lastSamplePos = 0;
      lastSampleTime = 0;
    }
    if ((pos - lastSamplePos >= 10 || now - lastSampleTime >= 700) && pos >= lastSamplePos) {
      samples.push({ pos, speed });
      if (samples.length > 800) samples.splice(1, 1);
      lastSamplePos = pos;
      lastSampleTime = now;
    }
    if(now-lastDrawTime>=60){draw();lastDrawTime=now;}
    requestAnimationFrame(tick);
  }

  function clearHistory(){
    samples.length=1;samples[0]={pos:0,speed:0};lastSamplePos=0;lastSampleTime=0;
    setFollowing(true);viewport.scrollLeft=0;updateRange();
  }
  document.querySelectorAll('#resetBtn,#retryBtn').forEach(button=>button.addEventListener('click',clearHistory));
  requestAnimationFrame(tick);
})();
