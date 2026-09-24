(() => {
  'use strict';
  const M = window.MotionMeasureMath;
  if (!M) return;
  const $ = id => document.getElementById(id);
  const KEY = 'motion-ruler:v1', ID = [1,0,0,0,1,0,0,0,1];
  const ui = Object.fromEntries([
    ['sensorBadge','sensorBadge'],['sensorStatus','sensorStatus'],['enable','enableSensor'],['retry','retrySensor'],
    ['mode','modeSelect'],['phase','phaseLabel'],['main','mainValue'],['hint','measureHint'],['progress','calibrationProgress'],
    ['start','startMeasure'],['stop','stopMeasure'],['again','measureAgain'],['live','liveMeta'],['elapsed','elapsedValue'],['source','sourceValue'],['orientation','orientationValue'],
    ['result','resultCard'],['quality','qualityBadge'],['qualityText','qualityText'],['straight','straightValue'],['path','pathValue'],['side','sideValue'],['duration','durationValue'],
    ['x','xValue'],['y','yValue'],['z','zValue'],['canvas','traceCanvas'],['traceCaption','traceCaption'],
    ['box','boxCard'],['edgeA','edgeA'],['edgeB','edgeB'],['edgeC','edgeC'],['boxSummary','boxSummary'],['nextEdge','nextEdge'],['resetBox','resetBox'],
    ['factor','factorLabel'],['known','knownLength'],['applyCal','applyCalibration'],['resetCal','resetCalibration'],['calStatus','calStatus'],
    ['history','historyList'],['historyEmpty','historyEmpty'],['clearHistory','clearHistory']
  ].map(([k,id]) => [k,$(id)]));

  let settings = { factor: 1, history: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Number.isFinite(s.factor) && s.factor >= .2 && s.factor <= 5) settings.factor = s.factor;
    if (Array.isArray(s.history)) settings.history = s.history.slice(0,8);
  } catch (_) {}
  const st = { phase:'locked', attached:false, motion:false, orient:false, matrix:ID, lastT:0, kind:null, base:[], baseT:0, bias:{x:0,y:0,z:0}, noise:0, samples:[], t:0, rotate:0, total:0, oriented:0, last:null, edges:[null,null,null], edge:0, timer:0 };

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} };
  const badge = (el,text,kind='wait') => { el.textContent=text; el.className=`badge badge-${kind}`; };
  const fmt = n => Number.isFinite(n) ? n.toFixed(Math.abs(n)>=1000?0:Math.abs(n)>=100?1:2) : '—';
  const showMain = (n,label) => { ui.phase.textContent=label; ui.main.textContent=Number.isFinite(n)?fmt(n):'—'; };
  const finite = v => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  const dtFor = e => {
    const i=Number(e.interval); if (i>0) return M.clamp(i/1000,.005,.1);
    const now=performance.now(), dt=st.lastT?(now-st.lastT)/1000:1/60; st.lastT=now; return M.clamp(dt,.005,.1);
  };
  const rotation = e => { const r=e.rotationRate||{}; return Math.hypot(r.alpha||0,r.beta||0,r.gamma||0); };
  function vector(e, forced=null) {
    const kind=forced || (finite(e.acceleration)?'linear':finite(e.accelerationIncludingGravity)?'gravity':null);
    const raw=kind==='linear'?e.acceleration:kind==='gravity'?e.accelerationIncludingGravity:null;
    if (!finite(raw)) return null;
    return {kind, world:M.rotateVector({x:raw.x,y:raw.y,z:raw.z},st.orient?st.matrix:ID)};
  }
  function onOrientation(e) {
    if (![e.alpha,e.beta,e.gamma].every(Number.isFinite)) return;
    st.orient=true; st.matrix=M.rotationMatrix(e.alpha,e.beta,e.gamma);
    ui.orientation.textContent='3D補正 ON';
  }
  function onMotion(e) {
    const dt=dtFor(e);
    if (!st.motion) {
      st.motion=true; st.phase='ready'; clearTimeout(st.timer); badge(ui.sensorBadge,'接続済み','ok');
      ui.sensorStatus.textContent=st.orient?'モーションと姿勢情報を受信しています。':'モーション受信中。姿勢情報がないため大きな回転は避けてください。';
      ui.start.disabled=false; ui.enable.hidden=true; ui.retry.hidden=true; showMain(null,'準備OK'); ui.hint.textContent='スマホの端を始点に当てて「測定開始」を押します。';
    }
    if (st.phase==='ready' || st.phase==='result') {
      const p=vector(e); if(p) ui.source.textContent=p.kind==='linear'?'線形加速度':'重力込み補正';
      ui.orientation.textContent=st.orient?'3D補正 ON':'端末軸のみ'; return;
    }
    if (st.phase==='calibrating') {
      const p=vector(e,st.kind); if(!p) return; if(!st.kind) st.kind=p.kind;
      st.baseT+=dt; st.base.push(p.world); if(st.base.length>220) st.base.shift();
      ui.progress.firstElementChild.style.width=`${Math.min(100,st.baseT/.7*100)}%`; ui.elapsed.textContent=`${st.baseT.toFixed(2)} s`;
      ui.source.textContent=st.kind==='linear'?'線形加速度':'重力込み補正'; ui.orientation.textContent=st.orient?'3D補正 ON':'端末軸のみ';
      if(st.baseT>=.7 && st.base.length>=12){ const mean=M.meanVector(st.base), sd=M.vectorStd(st.base,mean); if(sd<=.24) beginMeasure(mean,sd); else if(st.baseT>=1.8) calFail(sd); }
      return;
    }
    if(st.phase!=='measuring') return;
    const p=vector(e,st.kind); if(!p) return;
    let a=M.sub(p.world,st.bias), mag=M.magnitude(a), floor=M.clamp(Math.max(.025,st.noise*2.2),.025,.14);
    if(mag<floor) a={x:0,y:0,z:0}; else if(mag>35) a=M.scale(a,35/mag);
    st.t+=dt; st.rotate=Math.max(st.rotate,rotation(e)); st.total++; if(st.orient) st.oriented++;
    st.samples.push({t:st.t,a}); if(st.samples.length>1600) st.samples.shift(); ui.elapsed.textContent=`${st.t.toFixed(2)} s`;
    if(st.samples.length%4===0){ const r=M.integrateSamples(st.samples,settings.factor); showMain(ui.mode.value==='trace'?r.pathMm:r.straightMm, ui.mode.value==='box'?`${['A','B','C'][st.edge]||'3辺'}辺 測定中`:'測定中'); }
    if(st.t>=8) finish('timeout');
  }
  function startCal() {
    if(!st.motion || !['ready','result'].includes(st.phase)) return;
    Object.assign(st,{phase:'calibrating',kind:null,base:[],baseT:0,bias:{x:0,y:0,z:0},noise:0,samples:[],t:0,rotate:0,total:0,oriented:0});
    ui.result.hidden=true; ui.start.hidden=true; ui.stop.hidden=true; ui.again.hidden=true; ui.live.hidden=false; ui.progress.hidden=false; ui.progress.firstElementChild.style.width='0%';
    showMain(null,'静止補正中'); ui.hint.textContent='約0.7秒、そのまま動かさないでください。'; ui.elapsed.textContent='0.00 s'; ui.source.textContent='取得中';
  }
  function calFail(sd){ st.phase='ready'; ui.progress.hidden=true; ui.start.hidden=false; showMain(null,'静止できませんでした'); ui.hint.textContent=`静止時ノイズ ${sd.toFixed(2)} m/s²。もう一度開始してください。`; }
  function beginMeasure(mean,sd){ st.phase='measuring'; st.bias=mean; st.noise=sd; st.samples=[{t:0,a:{x:0,y:0,z:0}}]; st.t=0; st.rotate=0; st.total=0; st.oriented=0; ui.progress.hidden=true; ui.stop.hidden=false; showMain(0,'測定中'); ui.hint.textContent='測りたい方向へ1〜2秒で滑らせ、終点で止めて「測定終了」。'; if(navigator.vibrate) navigator.vibrate(35); }
  function quality(r){
    let score=100, notes=[]; if(st.noise>.12){score-=20;notes.push('開始時の静止が不安定');} if(st.rotate>35){score-=20;notes.push('回転が大きい');} if(r.rawEndVelocity>.18){score-=25;notes.push('終了速度のドリフトが大きい');} if(r.duration>3.5){score-=10;notes.push('測定時間が長い');} if(r.rawStraightMm<20){score-=15;notes.push('短距離');} if(r.straightMm>1&&r.sideRmsMm/r.straightMm>.12){score-=15;notes.push('横ぶれが大きい');} if(st.total&&st.oriented/st.total<.6){score-=15;notes.push('姿勢補正不足');}
    score=M.clamp(score,0,100); return {label:score>=75?'センサー状態 良好':score>=50?'センサー状態 注意':'再測定推奨',kind:score>=75?'ok':score>=50?'warn':'bad',notes};
  }
  function finish(reason='manual'){
    if(st.phase!=='measuring') return; st.phase='result'; const r=M.integrateSamples(st.samples,settings.factor), q=quality(r); st.last={...r,quality:q,reason};
    ui.stop.hidden=true; ui.again.hidden=ui.mode.value==='box'; ui.result.hidden=false; ui.applyCal.disabled=r.rawStraightMm<1; badge(ui.quality,q.label,q.kind);
    ui.qualityText.textContent=(q.notes.length?q.notes.join(' / '):'開始・終了・姿勢のセンサー状態は良好です。')+' ※寸法精度の保証ではありません。';
    ui.straight.textContent=fmt(r.straightMm); ui.path.textContent=fmt(r.pathMm); ui.side.textContent=fmt(r.sideRmsMm); ui.duration.textContent=r.duration.toFixed(2); ui.x.textContent=fmt(r.finalVectorMm.x); ui.y.textContent=fmt(r.finalVectorMm.y); ui.z.textContent=fmt(r.finalVectorMm.z);
    const main=ui.mode.value==='trace'?r.pathMm:r.straightMm; showMain(main,ui.mode.value==='trace'?'なぞった距離':ui.mode.value==='xyz'?'3D直線距離':'直線距離'); draw(r.positions);
    if(ui.mode.value==='box') recordEdge(r.straightMm); addHistory(r,q); if(navigator.vibrate) navigator.vibrate([25,45,25]);
  }
  function addHistory(r,q){ settings.history.unshift({at:Date.now(),mode:ui.mode.value,straight:r.straightMm,path:r.pathMm,quality:q.label}); settings.history=settings.history.slice(0,8); save(); renderHistory(); }
  function renderHistory(){
    ui.history.replaceChildren(); ui.historyEmpty.hidden=settings.history.length>0;
    settings.history.forEach(h=>{ const li=document.createElement('li'), a=document.createElement('div'), b=document.createElement('small'), strong=document.createElement('strong'); strong.textContent=`${fmt(h.mode==='trace'?h.path:h.straight)} mm`; a.append(strong); b.textContent=`${new Date(h.at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${h.quality||'—'}`; li.append(a,b); ui.history.append(li); });
  }
  function recordEdge(v){ if(st.edge>2) st.edge=0; st.edges[st.edge++]=v; renderBox(); }
  function renderBox(){
    const active=ui.mode.value==='box'; ui.box.hidden=!active; [ui.edgeA,ui.edgeB,ui.edgeC].forEach((el,i)=>el.textContent=Number.isFinite(st.edges[i])?`${fmt(st.edges[i])} mm`:'—'); if(!active)return;
    if(st.edges.every(Number.isFinite)){ const [a,b,c]=st.edges,v=a*b*c/1000; ui.boxSummary.textContent=`${fmt(a)} × ${fmt(b)} × ${fmt(c)} mm / 体積 約${v.toFixed(v>=1000?0:1)} cm³`; ui.nextEdge.hidden=true; }
    else { const n=['A','B','C'][st.edge]||'A'; ui.boxSummary.textContent=`${n}辺を測定します。`; ui.nextEdge.textContent=`${n}辺を測る`; ui.nextEdge.hidden=['measuring','calibrating'].includes(st.phase); }
  }
  function resetBox(){ st.edges=[null,null,null]; st.edge=0; renderBox(); }
  function draw(points){
    if(!points?.length) return; const c=ui.canvas, rect=c.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2), w=Math.max(280,rect.width||600), h=Math.max(130,w*5/12); c.width=w*d;c.height=h*d; const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);
    const p=M.chooseProjection(points), pts=points.map(v=>({x:v[p.a],y:v[p.b]})), xs=pts.map(v=>v.x),ys=pts.map(v=>v.y), minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),sx=Math.max(1,maxX-minX),sy=Math.max(1,maxY-minY),pad=24,k=Math.min((w-2*pad)/sx,(h-2*pad)/sy),ox=(w-sx*k)/2-minX*k,oy=(h-sy*k)/2+maxY*k,css=getComputedStyle(document.documentElement);
    x.clearRect(0,0,w,h); x.strokeStyle=css.getPropertyValue('--border'); x.lineWidth=1; for(let i=1;i<4;i++){x.beginPath();x.moveTo(w*i/4,8);x.lineTo(w*i/4,h-8);x.stroke();x.beginPath();x.moveTo(8,h*i/4);x.lineTo(w-8,h*i/4);x.stroke();}
    x.strokeStyle=css.getPropertyValue('--accent');x.lineWidth=3;x.beginPath();pts.forEach((v,i)=>{const X=ox+v.x*k,Y=oy-v.y*k;i?x.lineTo(X,Y):x.moveTo(X,Y)});x.stroke(); ui.traceCaption.textContent=`${p.a.toUpperCase()}-${p.b.toUpperCase()}平面への投影。`;
  }
  async function enable(){
    clearTimeout(st.timer); if(!window.isSecureContext){badge(ui.sensorBadge,'HTTPS必要','bad');ui.sensorStatus.textContent='HTTPSまたはlocalhostで開いてください。';return;} if(!('DeviceMotionEvent'in window)){badge(ui.sensorBadge,'非対応','bad');ui.sensorStatus.textContent='DeviceMotion非対応です。';return;}
    ui.enable.disabled=true; badge(ui.sensorBadge,'許可確認中','wait');
    try{ const mp=typeof DeviceMotionEvent.requestPermission==='function'?await DeviceMotionEvent.requestPermission():'granted'; if(mp!=='granted') throw new Error('モーションセンサーが許可されませんでした。'); let op='granted'; if('DeviceOrientationEvent'in window&&typeof DeviceOrientationEvent.requestPermission==='function') op=await DeviceOrientationEvent.requestPermission().catch(()=> 'denied'); if(!st.attached){addEventListener('devicemotion',onMotion,{passive:true});if('DeviceOrientationEvent'in window)addEventListener('deviceorientation',onOrientation,{passive:true});st.attached=true;} badge(ui.sensorBadge,'接続待ち','wait');ui.sensorStatus.textContent=op==='granted'?'端末を少し動かしてください。':'姿勢情報なしで接続します。';st.timer=setTimeout(()=>{if(!st.motion){badge(ui.sensorBadge,'応答なし','warn');ui.retry.hidden=false;}},2200); }
    catch(e){badge(ui.sensorBadge,'許可されていません','bad');ui.sensorStatus.textContent=e.message||'センサーを有効化できません。';ui.retry.hidden=false;} finally{ui.enable.disabled=false;}
  }
  function applyCal(){ const known=Number(ui.known.value),raw=st.last?.rawStraightMm;if(!(known>=10&&known<=2000)){ui.calStatus.textContent='既知寸法は10〜2000 mmで入力してください。';return;}if(!(raw>=1)){ui.calStatus.textContent='先に既知寸法を測定してください。';return;}const f=known/raw;if(f<.2||f>5){ui.calStatus.textContent='補正倍率が範囲外です。再測定してください。';return;}settings.factor=f;save();updateFactor();ui.calStatus.textContent=`補正 ${f.toFixed(3)}× を保存しました。`; }
  function updateFactor(){ui.factor.textContent=`補正 ${settings.factor.toFixed(3)}×`;}
  function ready(){ if(!st.motion)return;st.phase='ready';ui.start.hidden=false;ui.stop.hidden=true;ui.again.hidden=true;ui.progress.hidden=true;ui.live.hidden=false;showMain(null,ui.mode.value==='box'?`${['A','B','C'][st.edge]||'A'}辺 準備`:'準備OK');ui.hint.textContent='スマホの端を始点に当てて「測定開始」を押します。';renderBox(); }

  ui.enable.addEventListener('click',enable); ui.retry.addEventListener('click',enable); ui.start.addEventListener('click',startCal); ui.stop.addEventListener('click',()=>finish()); ui.again.addEventListener('click',startCal); ui.nextEdge.addEventListener('click',startCal); ui.resetBox.addEventListener('click',resetBox); ui.applyCal.addEventListener('click',applyCal);
  ui.resetCal.addEventListener('click',()=>{settings.factor=1;save();updateFactor();ui.calStatus.textContent='補正を1.000×に戻しました。';}); ui.clearHistory.addEventListener('click',()=>{settings.history=[];save();renderHistory();});
  ui.mode.addEventListener('change',()=>{renderBox();if(st.phase==='result'&&st.last)showMain(ui.mode.value==='trace'?st.last.pathMm:st.last.straightMm,ui.mode.value==='trace'?'なぞった距離':'直線距離');});
  addEventListener('resize',()=>{if(st.last)requestAnimationFrame(()=>draw(st.last.positions));}); document.addEventListener('visibilitychange',()=>{if(document.hidden&&['calibrating','measuring'].includes(st.phase)){ready();ui.hint.textContent='画面が非表示になったため測定を中止しました。';}});
  updateFactor(); renderHistory(); renderBox();
})();
