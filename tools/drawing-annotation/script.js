(() => {
"use strict";

// エラー検出＋最小限のログ
window.addEventListener('error', (event) => {
  console.error('[ScriptError]', event.error || event.message);
  showMessage('スクリプトエラーが発生しました。ページを再読み込みしてください。', true);
});

// 主要状態
const COLOR_MAP = { red:'#ff2d2d', blue:'#2d66ff', green:'#1fbf48', yellow:'rgba(255,212,0,0.5)', black:'#000000' };
const SIZE_MAP = { 0:3, 1:7 };
const TOOLS = ['select','pen','eraser','line','arrow','rect','ellipse','text'];
const TOOL_LABELS = { select:'選択', pen:'ペン', eraser:'消しゴム', line:'直線', arrow:'矢印', rect:'四角', ellipse:'楕円', text:'番号' };
const COLOR_LABELS = { red:'赤', blue:'青', green:'緑', yellow:'黄', black:'黒' };
const MAX_IMAGE_PIXELS = 24000000;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_DISPLAY_PIXELS = 12000000;
const HANDLE_SIZE = 10;
const scrollEl = document.getElementById('scroll');
const stageEl  = document.getElementById('stage');
const bgCanvas = document.getElementById('bgCanvas');
const fgCanvas = document.getElementById('fgCanvas');
const textInput = document.getElementById('textInput');
const hudAuto = document.getElementById('hudAuto');
const hudLabel = document.getElementById('hudLabel');
const hudPen = document.getElementById('hudPen');
const stTool = document.getElementById('st-tool');
const stColor = document.getElementById('st-color');
const stSize = document.getElementById('st-size');
const stFrame = document.getElementById('st-frame');
const stCanvas = document.getElementById('st-canvas');
const stDpr = document.getElementById('st-dpr');
const stScroll = document.getElementById('st-scroll');
const toolbarEl = document.getElementById('toolbar');
const hudEl = document.getElementById('hud');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const fileInput = document.getElementById('fileInput');
const undoButton = document.getElementById('btn-undo');
const redoButton = document.getElementById('btn-redo');

const state = {
  frame: { width: 1280, height: 720 },
  displayScale: 1.0,
  viewScale: 1.0,
  currentColor: 'red',
  currentSizeId: 0,
  get currentSizePx(){ return SIZE_MAP[this.currentSizeId]; },
  currentTool: 'pen',
  history: [],
  redoStack: [],
  dpr: window.devicePixelRatio || 1,
  arrowHeadOpt: { type:'vee', length:null, angleDeg:30, double:false, scaleWithWidth:true },
  selected: { item:null },
  autoNumbering: true,
  nextNumber: 1,
  textLabelOpt: { enabled:true, padding:6, radius:8, fill:'rgba(255,255,255,0.85)', stroke:'rgba(17,24,39,0.90)', strokeWidth:1.5 },
  penExt: { enabled:true, zoomK:0.002, minScale:0.1, maxScale:4.0 }
};
let prevTool = null;
let drawing = false; let tempStart = null; let previewShape = null; let eraserPath = null; let isSpacePan = false;
let dragTarget = null; let dragStartP = null; let dragAccum = { dx:0, dy:0 };
let handleDrag = null;
let penMode = null; let penStart = {x:0,y:0};
let panState={ active:false, sx:0, sy:0, sl:0, st:0 };
let textInputSession = null;
let messageTimer = 0;
let scrollFrame = 0;
let chromeObserver = null;

// 安全ガード用ユーティリティ
function isTyping(){ const ae=document.activeElement; if (!ae) return false; const tag=ae.tagName; return tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||(ae.getAttribute('contenteditable')==='true'); }
function showMessage(message, isError=false){
  window.clearTimeout(messageTimer);
  messageEl.textContent=message;
  messageEl.dataset.level=isError?'error':'info';
  messageEl.setAttribute('role',isError?'alert':'status');
  messageEl.hidden=false;
  messageTimer=window.setTimeout(()=>{ messageEl.hidden=true; }, 4500);
}
function syncChromeSize(){
  document.documentElement.style.setProperty('--toolbarH', toolbarEl.offsetHeight+'px');
  document.documentElement.style.setProperty('--hudH', hudEl.offsetHeight+'px');
  document.documentElement.style.setProperty('--statusH', statusEl.offsetHeight+'px');
}
function effectiveDpr(){
  const pixelRatioLimit=Math.sqrt(MAX_DISPLAY_PIXELS/Math.max(1,state.frame.width*state.frame.height));
  return Math.max(0.5,Math.min(state.dpr,2,pixelRatioLimit));
}
function updateActionButtons(){
  undoButton.disabled=state.history.length===0;
  redoButton.disabled=state.redoStack.length===0;
}

// レイアウト
function applyLayout(){ try{
  const dpr = effectiveDpr();
  const cssW = Math.max(1, Math.round(state.frame.width  * state.displayScale));
  const cssH = Math.max(1, Math.round(state.frame.height * state.displayScale));
  stageEl.style.width  = cssW + 'px';
  stageEl.style.height = cssH + 'px';
  for (const c of [bgCanvas, fgCanvas]){
    c.style.width  = cssW + 'px';
    c.style.height = cssH + 'px';
    c.width  = Math.max(1, Math.round(state.frame.width  * dpr));
    c.height = Math.max(1, Math.round(state.frame.height * dpr));
  }
  drawAll(); updateStatus();
  }catch(err){ console.error('[applyLayout]', err); showMessage('表示の初期化に失敗しました。', true); }
}
function updateStatus(){ try{
  stTool.textContent='ツール: '+(TOOL_LABELS[state.currentTool]||state.currentTool);
  stColor.textContent='色: '+(COLOR_LABELS[state.currentColor]||state.currentColor);
  stSize.textContent='太さ: '+state.currentSizePx+'px';
  const rectCanvas=fgCanvas.getBoundingClientRect();
  stFrame.textContent='画像: '+state.frame.width+'×'+state.frame.height;
  stCanvas.textContent='表示: '+Math.round(state.displayScale*100)+'%（'+Math.round(rectCanvas.width)+'×'+Math.round(rectCanvas.height)+'）';
  stDpr.textContent='描画倍率: '+effectiveDpr().toFixed(2);
  stScroll.textContent='位置: '+scrollEl.scrollLeft+', '+scrollEl.scrollTop;
  hudAuto.textContent='自動番号: '+(state.autoNumbering?'ON':'OFF')+'（N）';
  hudAuto.setAttribute('aria-pressed',String(state.autoNumbering));
  hudLabel.textContent='ラベル枠: '+(state.textLabelOpt.enabled?'ON':'OFF')+'（K）';
  hudLabel.setAttribute('aria-pressed',String(state.textLabelOpt.enabled));
  hudPen.textContent='ペン拡張: '+(state.penExt.enabled?(penMode?penModeLabel(penMode):'ON'):'OFF')+'（H）';
  hudPen.setAttribute('aria-pressed',String(state.penExt.enabled));
  updateActionButtons();
  }catch(err){ console.error('[updateStatus]', err); }
}
function penModeLabel(m){ return m==='zoom'?'Zoom(Ctrl)': m==='pan'?'Pan(Alt)': m==='eraser'?'Eraser(Button)':'ON'; }
function toWorldPoint(e){ const rect = fgCanvas.getBoundingClientRect(); const xCanvas = e.clientX - rect.left; const yCanvas = e.clientY - rect.top; const scale = Math.max(1e-6, state.viewScale * state.displayScale); return { x: xCanvas / scale, y: yCanvas / scale }; }

// 描画
function drawAll(){ try{
  const dpr = effectiveDpr(); const bg = bgCanvas.getContext('2d'); const fg = fgCanvas.getContext('2d');
  bg.setTransform(dpr,0,0,dpr,0,0); bg.clearRect(0,0,state.frame.width, state.frame.height);
  bg.save(); bg.scale(state.viewScale, state.viewScale);
  const imgRec = state.history.find(h => h && h.type==='image');
  if (imgRec && imgRec.bitmap){ bg.drawImage(imgRec.bitmap, 0,0, imgRec.imgW, imgRec.imgH); } else { bg.fillStyle = '#ffffff'; bg.fillRect(0,0,state.frame.width, state.frame.height); }
  bg.restore();
  fg.setTransform(dpr,0,0,dpr,0,0); fg.clearRect(0,0,state.frame.width, state.frame.height);
  fg.save(); fg.scale(state.viewScale, state.viewScale);
  for (const item of state.history){ if (!item) continue; if (item.type==='stroke') renderStroke(fg, item); else if (item.type==='shape') renderShape(fg, item); else if (item.type==='text') renderText(fg, item); }
  if (previewShape){ fg.globalAlpha = 0.9; renderShape(fg, previewShape, true); fg.globalAlpha = 1.0; }
  if (state.selected.item){ drawSelectionHighlight(fg, state.selected.item); drawHandles(fg, state.selected.item); }
  fg.restore();
  }catch(err){ console.error('[drawAll]', err); }
}
function renderStroke(ctx, item){ try{
  ctx.strokeStyle=COLOR_MAP[item.color]||'#000';
  ctx.fillStyle=ctx.strokeStyle;
  ctx.lineWidth=item.sizePx||3;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  const pts=item.points||[];
  if (!pts.length) return;
  if (pts.length===1){
    ctx.beginPath();
    ctx.arc(pts[0].x,pts[0].y,Math.max(1,ctx.lineWidth/2),0,Math.PI*2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();
  }catch(err){ console.error('[renderStroke]', err); }
}
function renderShape(ctx, item){ try{ ctx.strokeStyle=COLOR_MAP[item.color]||'#000'; ctx.lineWidth=item.sizePx||3; ctx.lineCap='round'; ctx.lineJoin='round'; if (item.tool==='line'){ ctx.beginPath(); ctx.moveTo(item.p1.x,item.p1.y); ctx.lineTo(item.p2.x,item.p2.y); ctx.stroke(); } else if (item.tool==='arrow'){ ctx.beginPath(); ctx.moveTo(item.p1.x,item.p1.y); ctx.lineTo(item.p2.x,item.p2.y); ctx.stroke(); drawArrowHead(ctx, item); } else if (item.tool==='rect'){ const r=item.rect; if (!r) return; ctx.strokeRect(r.x,r.y,r.w,r.h); } else if (item.tool==='ellipse'){ const e=item.ellipse; if (!e) return; ctx.beginPath(); ctx.ellipse(e.cx,e.cy,e.rx,e.ry,0,0,Math.PI*2); ctx.stroke(); } }catch(err){ console.error('[renderShape]', err); }}
function renderText(ctx, item){ try{ ctx.save(); const fontPx = item.fontPx || 18; ctx.font = `${fontPx}px Meiryo, \"MS Gothic\"`; ctx.textBaseline = 'top'; const pad = state.textLabelOpt.padding; const radius = state.textLabelOpt.radius; const text = String(item.text||''); const m = ctx.measureText(text); const tw = Math.max(12, m.width); const th = Math.max(fontPx, fontPx); const bw = Math.round(tw + pad*2); const bh = Math.round(th + pad*2); if (state.textLabelOpt.enabled){ const bx = item.x, by = item.y; ctx.beginPath(); roundedRectPath(ctx, bx, by, bw, bh, radius); ctx.fillStyle = state.textLabelOpt.fill; ctx.fill(); ctx.lineWidth = state.textLabelOpt.strokeWidth; ctx.strokeStyle = state.textLabelOpt.stroke; ctx.stroke(); } ctx.fillStyle = COLOR_MAP[item.color]||'#000'; ctx.fillText(text, item.x + pad, item.y + pad); item.box = { x:item.x, y:item.y, w:bw, h:bh }; ctx.restore(); }catch(err){ console.error('[renderText]', err); }}
function roundedRectPath(ctx, x,y,w,h,r){ const rr=Math.min(r, Math.min(w,h)/2); ctx.moveTo(x+rr,y); ctx.lineTo(x+w-rr,y); ctx.arcTo(x+w,y,x+w,y+rr,rr); ctx.lineTo(x+w,y+h-rr); ctx.arcTo(x+w,y+h,x+w-rr,y+h,rr); ctx.lineTo(x+rr,y+h); ctx.arcTo(x,y+h,x,y+h-rr,rr); ctx.lineTo(x,y+rr); ctx.arcTo(x,y,x+rr,y,rr); }
function drawSelectionHighlight(ctx, item){ const pad=6; const bb=getItemAABB(item); if (!bb) return; const x=bb.minx-pad, y=bb.miny-pad, w=(bb.maxx-bb.minx)+pad*2, h=(bb.maxy-bb.miny)+pad*2; ctx.save(); ctx.strokeStyle='rgba(96,165,250,0.85)'; ctx.lineWidth=1.5; ctx.setLineDash([6,4]); ctx.strokeRect(x,y,w,h); ctx.restore(); }
function drawHandles(ctx, item){ const handles=getHandles(item)||[]; ctx.save(); ctx.fillStyle='#60a5fa'; ctx.strokeStyle='#0ea5e9'; ctx.lineWidth=1; for (const h of handles){ ctx.beginPath(); ctx.rect(h.x-HANDLE_SIZE/2, h.y-HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE); ctx.fill(); ctx.stroke(); } ctx.restore(); }
function getHandles(item){ if (!item) return []; const hs=[]; if (item.type==='shape'){ if (item.tool==='line'||item.tool==='arrow'){ hs.push({id:'p1',x:item.p1.x,y:item.p1.y}); hs.push({id:'p2',x:item.p2.x,y:item.p2.y}); } else if (item.tool==='rect'){ const r=item.rect; hs.push({id:'lt',x:r.x,y:r.y}); hs.push({id:'rt',x:r.x+r.w,y:r.y}); hs.push({id:'rb',x:r.x+r.w,y:r.y+r.h}); hs.push({id:'lb',x:r.x,y:r.y+r.h}); } else if (item.tool==='ellipse'){ const e=item.ellipse; hs.push({id:'l',x:e.cx-e.rx,y:e.cy}); hs.push({id:'r',x:e.cx+e.rx,y:e.cy}); hs.push({id:'t',x:e.cx,y:e.cy-e.ry}); hs.push({id:'b',x:e.cx,y:e.cy+e.ry}); } } else if (item.type==='text'){ const b=item.box||{x:item.x,y:item.y,w:18,h:18}; hs.push({id:'move', x:b.x+b.w/2, y:b.y+b.h/2}); } return hs; }
function getItemAABB(item){ if (!item) return null; if (item.type==='stroke'){ let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity; for (const p of item.points||[]){ minx=Math.min(minx,p.x); miny=Math.min(miny,p.y); maxx=Math.max(maxx,p.x); maxy=Math.max(maxy,p.y);} return {minx,miny,maxx,maxy}; } else if (item.type==='shape'){ if (item.tool==='line'||item.tool==='arrow'){ const minx=Math.min(item.p1.x,item.p2.x), miny=Math.min(item.p1.y,item.p2.y); const maxx=Math.max(item.p1.x,item.p2.x), maxy=Math.max(item.p1.y,item.p2.y); return {minx,miny,maxx,maxy}; } else if (item.tool==='rect'){ const r=item.rect; return {minx:r.x, miny:r.y, maxx:r.x+r.w, maxy:r.y+r.h}; } else if (item.tool==='ellipse'){ const e=item.ellipse; return {minx:e.cx-e.rx, miny:e.cy-e.ry, maxx:e.cx+e.rx, maxy:e.cy+e.ry}; } } else if (item.type==='text'){ const b=item.box||{x:item.x,y:item.y,w:18,h:18}; return {minx:b.x, miny:b.y, maxx:b.x+b.w, maxy:b.y+b.h}; } return null; }
function drawArrowHead(ctx, item){ const p1=item.p1, p2=item.p2, sizePx=item.sizePx||3; const opt=item.arrowHead||{type:'vee',length:4*sizePx,angleDeg:30,double:false}; const drawOne=(baseP,tipP)=>{ const vx=tipP.x-baseP.x, vy=tipP.y-baseP.y; const len=Math.hypot(vx,vy)||1; const ux=vx/len, uy=vy/len; const L=opt.length||4*sizePx; const th=(opt.angleDeg||30)*Math.PI/180; const rx=-ux, ry=-uy; const r1x=rx*Math.cos(th)-ry*Math.sin(th), r1y=rx*Math.sin(th)+ry*Math.cos(th); const r2x=rx*Math.cos(-th)-ry*Math.sin(-th), r2y=rx*Math.sin(-th)+ry*Math.cos(-th); const ax1=tipP.x+r1x*L, ay1=tipP.y+r1y*L; const ax2=tipP.x+r2x*L, ay2=tipP.y+r2y*L; ctx.beginPath(); ctx.moveTo(tipP.x,tipP.y); ctx.lineTo(ax1,ay1); ctx.moveTo(tipP.x,tipP.y); ctx.lineTo(ax2,ay2); ctx.stroke(); }; drawOne(p1,p2); if (opt.double) drawOne(p2,p1); }

// 入力（ツール・色・サイズ）
for (const btn of document.querySelectorAll('#tool-select .btn')) btn.addEventListener('click',()=> setTool(btn.dataset.tool));
for (const sw of document.querySelectorAll('#color-select .swatch')) sw.addEventListener('click',()=> setColor(sw.dataset.color));
for (const bs of document.querySelectorAll('#size-select .btn')){ if (bs.dataset.size!==undefined) bs.addEventListener('click',()=> setSizeId(parseInt(bs.dataset.size))); }
document.getElementById('btn-open').addEventListener('click',()=>fileInput.click());
document.getElementById('btn-save').addEventListener('click',savePNG);
document.getElementById('btn-copy').addEventListener('click',copyPNG);
document.getElementById('btn-reset').addEventListener('click',()=>resetView());
undoButton.addEventListener('click',()=>{ undo(); showMessage('1つ前の操作に戻しました。'); });
redoButton.addEventListener('click',()=>{ redo(); showMessage('操作をやり直しました。'); });
hudAuto.addEventListener('click',()=>{ state.autoNumbering=!state.autoNumbering; updateStatus(); });
hudLabel.addEventListener('click',()=>{ state.textLabelOpt.enabled=!state.textLabelOpt.enabled; updateStatus(); drawAll(); });
hudPen.addEventListener('click',()=>{ state.penExt.enabled=!state.penExt.enabled; penMode=null; updateStatus(); });
document.getElementById('btn-zoom-in').addEventListener('click',()=>keyboardZoom(1.15));
document.getElementById('btn-zoom-out').addEventListener('click',()=>keyboardZoom(0.85));
fileInput.addEventListener('change',async()=>{
  const file=fileInput.files&&fileInput.files[0];
  if (file) await loadImageFile(file);
  fileInput.value='';
});
function setTool(t){
  if (!TOOLS.includes(t)) return;
  state.currentTool=t;
  if (t!=='select') state.selected.item=null;
  for (const btn of document.querySelectorAll('#tool-select .btn')){
    const active=btn.dataset.tool===t;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  }
  drawAll();
  updateStatus();
}
function setColor(c){
  if (!COLOR_MAP[c]) return;
  state.currentColor=c;
  for (const sw of document.querySelectorAll('#color-select .swatch')){
    const active=sw.dataset.color===c;
    sw.classList.toggle('active',active);
    sw.setAttribute('aria-pressed',String(active));
  }
  updateStatus();
}
function setSizeId(id){
  if (!(id in SIZE_MAP)) return;
  state.currentSizeId=id;
  for (const bs of document.querySelectorAll('#size-select .btn')){
    const active=bs.dataset.size!==undefined&&parseInt(bs.dataset.size,10)===id;
    bs.classList.toggle('active',active);
    bs.setAttribute('aria-pressed',String(active));
  }
  updateStatus();
}

// キーボード（ESCキャンセル含む）
window.addEventListener('keydown',(e)=>{
  if (isTyping()) return; const k=e.key.toLowerCase();
  if (k==='0') setTool('select'); else if (k==='1') setTool('pen'); else if (k==='2') setTool('eraser'); else if (k==='3') setTool('line'); else if (k==='4') setTool('arrow'); else if (k==='5') setTool('rect'); else if (k==='6') setTool('ellipse'); else if (k==='7') setTool('text');
  else if (k==='q') setColor('red'); else if (k==='w') setColor('blue'); else if (k==='e') setColor('green'); else if (k==='r') setColor('yellow'); else if (k==='t') setColor('black');
  else if (k==='8') setSizeId(0); else if (k==='9') setSizeId(1);
  else if (k==='s') { e.preventDefault(); savePNG(); }
  else if ((e.ctrlKey||e.metaKey) && k==='c') { e.preventDefault(); copyPNG(); }
  else if ((e.ctrlKey||e.metaKey) && k==='z') { e.preventDefault(); e.shiftKey?redo():undo(); }
  else if ((e.ctrlKey||e.metaKey) && k==='y') { e.preventDefault(); redo(); }
  else if (e.key===' ') { isSpacePan = true; }
  else if (e.key==='arrowup') { e.preventDefault(); keyboardZoom(1.1); }
  else if (e.key==='arrowdown') { e.preventDefault(); keyboardZoom(0.9); }
  else if (k==='n') { state.autoNumbering=!state.autoNumbering; updateStatus(); }
  else if (k==='k') { state.textLabelOpt.enabled=!state.textLabelOpt.enabled; updateStatus(); drawAll(); }
  else if (k==='h') { state.penExt.enabled=!state.penExt.enabled; penMode=null; updateStatus(); }
  else if (k==='escape') { e.preventDefault(); cancelCurrentAction(); }
  else if (k==='delete'||k==='backspace') { if (state.selected.item){ e.preventDefault(); deleteSelected(); } }
});
window.addEventListener('keyup',(e)=>{ if (e.key===' ') isSpacePan=false; });

// キャンセル処理（ESC）
function cancelCurrentAction(){ try{
  if (textInput && textInput.style.display==='block'){ closeTextInput(false); }
  if (penMode){ if (penMode==='eraser' && prevTool){ setTool(prevTool); prevTool=null; } penMode=null; }
  if (panState.active){ panState.active=false; }
  if (handleDrag){ if (handleDrag.beforeSnapshot){ Object.assign(handleDrag.item, handleDrag.beforeSnapshot); } handleDrag=null; }
  if (dragTarget){ applyTranslateTemp(dragTarget, -(dragAccum?.dx||0), -(dragAccum?.dy||0)); dragTarget=null; dragStartP=null; dragAccum={dx:0,dy:0}; }
  if (drawing && state.currentTool==='pen'){
    const last=state.history[state.history.length-1];
    if (last&&last.type==='stroke') state.history.pop();
  }
  drawing=false; previewShape=null; eraserPath=null; tempStart=null; state.selected.item=null; drawAll(); updateStatus();
  }catch(err){ console.error('[cancelCurrentAction]', err); }
}

// ズーム
fgCanvas.addEventListener('wheel',(e)=>{ e.preventDefault(); const factor=e.deltaY>0?0.9:1.1; wheelZoomAt(e.clientX,e.clientY,factor); }, {passive:false});
function keyboardZoom(factor){ try{
  const rectCanvas=fgCanvas.getBoundingClientRect(); const rectScroll=scrollEl.getBoundingClientRect();
  const xCanvas=Math.max(1, rectCanvas.width/2), yCanvas=Math.max(1, rectCanvas.height/2); const scale0=Math.max(1e-6, state.viewScale*state.displayScale);
  const worldX=xCanvas/scale0, worldY=yCanvas/scale0;
  const xScrollView=Math.max(1, rectScroll.width/2), yScrollView=Math.max(1, rectScroll.height/2);
  const newScale=Math.min(Math.max(state.displayScale*factor,state.penExt.minScale),state.penExt.maxScale); if (newScale===state.displayScale) return;
  state.displayScale=newScale; applyLayout();
  const off={ x: stageEl.offsetLeft||0, y: stageEl.offsetTop||0 };
  const scale=Math.max(1e-6, state.viewScale*state.displayScale); const newContentX=worldX*scale+off.x; const newContentY=worldY*scale+off.y;
  scrollEl.scrollLeft=Math.round(newContentX - xScrollView); scrollEl.scrollTop=Math.round(newContentY - yScrollView);
  drawAll(); updateStatus();
  }catch(err){ console.error('[keyboardZoom]', err); }
}
function wheelZoomAt(clientX,clientY,factor){ try{
  const rectCanvas=fgCanvas.getBoundingClientRect(); const rectScroll=scrollEl.getBoundingClientRect();
  const xCanvas=(clientX - rectCanvas.left), yCanvas=(clientY - rectCanvas.top); const scale0=Math.max(1e-6, state.viewScale*state.displayScale);
  const worldX=xCanvas/scale0, worldY=yCanvas/scale0; const xScrollView=(clientX - rectScroll.left), yScrollView=(clientY - rectScroll.top);
  const newScale=Math.min(Math.max(state.displayScale*factor,state.penExt.minScale),state.penExt.maxScale); if (newScale===state.displayScale) return;
  state.displayScale=newScale; applyLayout();
  const off={ x: stageEl.offsetLeft||0, y: stageEl.offsetTop||0 };
  const scale=Math.max(1e-6, state.viewScale*state.displayScale); const newContentX=worldX*scale+off.x; const newContentY=worldY*scale+off.y;
  scrollEl.scrollLeft=Math.round(newContentX - xScrollView); scrollEl.scrollTop=Math.round(newContentY - yScrollView);
  drawAll(); updateStatus();
  }catch(err){ console.error('[wheelZoomAt]', err); }
}

// ポインタイベント
fgCanvas.addEventListener('pointerdown',(e)=>{ try{
  if (handlePenPointerDown(e)) return;
  if (e.button===1 || e.button===2 || (isSpacePan && e.button===0)){
    panState={ active:true, sx:e.clientX, sy:e.clientY, sl:scrollEl.scrollLeft, st:scrollEl.scrollTop };
    fgCanvas.setPointerCapture(e.pointerId); return;
  }
  if (e.button!==0) return;
  fgCanvas.setPointerCapture(e.pointerId);
  const p=toWorldPoint(e);
  if (state.currentTool==='select'){
    if (state.selected.item){
      const handle=handleHitTest(p,state.selected.item);
      if (handle){ startHandleDrag(handle,p); return; }
    }
    const hit=hitTestAt(p);
    state.selected.item=hit;
    if (hit){
      dragTarget=hit;
      dragStartP=p;
      dragAccum={dx:0,dy:0};
      fgCanvas.style.cursor='move';
    }
    drawAll();
    return;
  }
  state.selected.item=null;
  if (state.currentTool==='pen'){
    const rec={ type:'stroke', tool:'pen', color:state.currentColor, sizeId:state.currentSizeId, sizePx:state.currentSizePx, points:[p] };
    state.history.push(rec); state.redoStack.length=0; drawing=true; state.selected.item=null;
  } else if (state.currentTool==='eraser'){
    eraserPath=[p]; drawing=true; previewShape=null; state.selected.item=null;
  } else if (state.currentTool==='line' || state.currentTool==='arrow' || state.currentTool==='rect' || state.currentTool==='ellipse'){
    tempStart=p; drawing=true; previewShape=null; state.selected.item=null;
  } else if (state.currentTool==='text'){
    showTextInputAt(p);
  }
  drawAll();
  }catch(err){ console.error('[pointerdown]', err); }
});
fgCanvas.addEventListener('pointermove',(e)=>{ try{
  if (handlePenPointerMove(e)) return;
  if (panState.active){ const dx=e.clientX-panState.sx, dy=e.clientY-panState.sy; scrollEl.scrollLeft=panState.sl - dx; scrollEl.scrollTop=panState.st - dy; updateStatus(); return; }
  if (handleDrag){ const p=toWorldPoint(e); updateHandleDrag(p); drawAll(); return; }
  if (dragTarget){ const p=toWorldPoint(e); const dx=p.x - dragStartP.x; const dy=p.y - dragStartP.y; applyTranslateTemp(dragTarget, dx - dragAccum.dx, dy - dragAccum.dy); dragAccum={dx,dy}; drawAll(); return; }
  if (!drawing) return;
  const p=toWorldPoint(e);
  if (state.currentTool==='pen'){ const rec=state.history[state.history.length-1]; if (!rec||rec.type!=='stroke') return; rec.points.push(p); drawAll(); }
  else if (state.currentTool==='eraser'){ eraserPath.push(p); drawPreviewEraser(eraserPath); }
  else if (state.currentTool==='line' || state.currentTool==='arrow' || state.currentTool==='rect' || state.currentTool==='ellipse'){ previewShape=finalizeShape(state.currentTool, tempStart, p, e, true); drawAll(); }
  }catch(err){ console.error('[pointermove]', err); }
});
fgCanvas.addEventListener('pointerup',(e)=>{ try{
  if (handlePenPointerUp(e)) return;
  if (panState.active){ panState.active=false; return; }
  if (handleDrag){ finishHandleDrag(); drawAll(); return; }
  if (dragTarget){
    if (Math.abs(dragAccum.dx)>0.01||Math.abs(dragAccum.dy)>0.01){
      state.history.push({ type:'move', itemRef:dragTarget, from:{dx:0,dy:0}, to:{dx:dragAccum.dx,dy:dragAccum.dy} });
      state.redoStack.length=0;
    }
    state.selected.item=dragTarget;
    dragTarget=null;
    dragStartP=null;
    dragAccum={dx:0,dy:0};
    fgCanvas.style.cursor='default';
    drawAll();
    updateStatus();
    return;
  }
  if (!drawing) return; drawing=false;
  const p=toWorldPoint(e);
  if (state.currentTool==='pen'){ drawAll(); updateStatus(); }
  else if (state.currentTool==='eraser'){ applyEraser(eraserPath, state.history); eraserPath=null; previewShape=null; }
  else if (state.currentTool==='line' || state.currentTool==='arrow' || state.currentTool==='rect' || state.currentTool==='ellipse'){
    const item=finalizeShape(state.currentTool, tempStart, p, e, false); if (item){ state.history.push(item); state.redoStack.length=0; state.selected.item=item; }
    previewShape=null; tempStart=null; drawAll();
  }
  }catch(err){ console.error('[pointerup]', err); }
});
fgCanvas.addEventListener('pointercancel',cancelCurrentAction);
fgCanvas.addEventListener('contextmenu',(e)=>{ e.preventDefault(); });

// ペン拡張
function barrelPressed(e){ return ((e.buttons & 0x02)!==0) || (e.button===5); }
function handlePenPointerDown(e){ if (e.pointerType!=='pen' || !state.penExt.enabled) return false; const pressed = !!e.pressure && e.pressure>0; const barrel = barrelPressed(e); if (barrel){ prevTool=state.currentTool; setTool('eraser'); penMode='eraser'; updateStatus(); fgCanvas.setPointerCapture(e.pointerId); return true; } if (e.ctrlKey && pressed){ penMode='zoom'; penStart={x:e.clientX,y:e.clientY}; updateStatus(); fgCanvas.setPointerCapture(e.pointerId); return true; } if (e.altKey && pressed){ penMode='pan'; penStart={x:e.clientX,y:e.clientY}; updateStatus(); fgCanvas.setPointerCapture(e.pointerId); return true; } return false; }
function handlePenPointerMove(e){ if (e.pointerType!=='pen' || !state.penExt.enabled) return false; if (!penMode) return false; if (penMode==='eraser'){ if (!barrelPressed(e)) { if (prevTool){ setTool(prevTool); prevTool=null; } penMode=null; updateStatus(); return true; } const p=toWorldPoint(e); if (!eraserPath) eraserPath=[p]; else eraserPath.push(p); drawPreviewEraser(eraserPath); return true; } if (penMode==='zoom'){ if (!(!!e.pressure && e.pressure>0) || !e.ctrlKey){ penMode=null; updateStatus(); return true; } const dy = e.clientY - penStart.y; const factor = Math.exp(state.penExt.zoomK * (-dy)); wheelZoomAt(e.clientX,e.clientY,factor); penStart={x:e.clientX,y:e.clientY}; return true; } if (penMode==='pan'){ if (!(!!e.pressure && e.pressure>0) || !e.altKey){ penMode=null; updateStatus(); return true; } const dx = e.clientX - penStart.x, dy = e.clientY - penStart.y; scrollEl.scrollLeft -= dx; scrollEl.scrollTop -= dy; penStart={x:e.clientX,y:e.clientY}; updateStatus(); return true; } return false; }
function handlePenPointerUp(e){ if (e.pointerType!=='pen' || !state.penExt.enabled) return false; if (!penMode) return false; if (penMode==='eraser'){ applyEraser(eraserPath, state.history); eraserPath=null; if (prevTool){ setTool(prevTool); prevTool=null; } penMode=null; updateStatus(); return true; } if (penMode==='zoom' || penMode==='pan'){ penMode=null; updateStatus(); return true; } return false; }

// テキスト入力
function closeTextInput(shouldCommit){
  if (!textInputSession) return;
  const worldP=textInputSession.worldP;
  const text=(textInput.value||'').trim();
  textInputSession=null;
  textInput.onkeydown=null;
  textInput.onblur=null;
  textInput.style.display='none';
  if (!shouldCommit||!text) return;
  if (!/^[0-9]+$/.test(text)){
    showMessage('番号は半角数字で入力してください。',true);
    return;
  }
  const item={ type:'text', text, x:worldP.x, y:worldP.y, color:state.currentColor, fontPx:18, box:null };
  state.history.push(item);
  state.redoStack.length=0;
  state.selected.item=item;
  if (state.autoNumbering) state.nextNumber+=1;
  drawAll();
  updateStatus();
}
function showTextInputAt(worldP){
  closeTextInput(false);
  textInput.value=state.autoNumbering?String(state.nextNumber):'';
  textInput.style.display='block';
  const scale=Math.max(1e-6,state.viewScale*state.displayScale);
  textInput.style.left=(worldP.x*scale)+'px';
  textInput.style.top=(worldP.y*scale)+'px';
  textInputSession={worldP};
  textInput.onkeydown=(event)=>{
    if (event.key==='Enter'){ event.preventDefault(); closeTextInput(true); }
    else if (event.key==='Escape'){ event.preventDefault(); closeTextInput(false); fgCanvas.focus(); }
  };
  textInput.onblur=()=>closeTextInput(true);
  textInput.focus();
  textInput.select();
}

// ハンドル編集／削除／汎用
function handleHitTest(p,item){ const hs=getHandles(item)||[]; for (const h of hs){ if (Math.abs(p.x-h.x)<=HANDLE_SIZE && Math.abs(p.y-h.y)<=HANDLE_SIZE) return h; } return null; }
function deepCopyItem(it){ return JSON.parse(JSON.stringify(it)); }
function startHandleDrag(h,worldP){ handleDrag={ item:state.selected.item, id:h.id, startP:worldP, beforeSnapshot:deepCopyItem(state.selected.item) }; }
function updateHandleDrag(worldP){ const it=handleDrag.item; const id=handleDrag.id; if (!it) return; if (it.type==='shape'){ if (it.tool==='line'||it.tool==='arrow'){ if (id==='p1'){ it.p1={x:worldP.x,y:worldP.y}; } else { it.p2={x:worldP.x,y:worldP.y}; } } else if (it.tool==='rect'){ const r=it.rect; const anchor={ x:r.x + (id.includes('r')?0:r.w), y:r.y + (id.includes('b')?0:r.h) }; const nx=Math.min(anchor.x,worldP.x), ny=Math.min(anchor.y,worldP.y); const nw=Math.abs(worldP.x-anchor.x), nh=Math.abs(worldP.y-anchor.y); it.rect={ x:nx, y:ny, w:nw, h:nh }; } else if (it.tool==='ellipse'){ const e=it.ellipse; if (id==='l'){ e.rx=Math.max(1, e.cx - worldP.x); } else if (id==='r'){ e.rx=Math.max(1, worldP.x - e.cx); } else if (id==='t'){ e.ry=Math.max(1, e.cy - worldP.y); } else if (id==='b'){ e.ry=Math.max(1, worldP.y - e.cy); } } } else if (it.type==='text'){ const dx=worldP.x - handleDrag.startP.x; const dy=worldP.y - handleDrag.startP.y; it.x += dx; it.y += dy; if (it.box){ it.box.x += dx; it.box.y += dy; } handleDrag.startP=worldP; } }
function finishHandleDrag(){ const after=deepCopyItem(handleDrag.item); const rec={ type:'edit', itemRef:handleDrag.item, before:handleDrag.beforeSnapshot, after }; state.history.push(rec); state.redoStack.length=0; handleDrag=null; }
function drawPreviewEraser(path){ const dpr=effectiveDpr(); const ctx=fgCanvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.save(); ctx.scale(state.viewScale,state.viewScale); ctx.globalAlpha=0.7; ctx.strokeStyle='#9ca3af'; ctx.lineWidth=Math.max(2,state.currentSizePx); ctx.setLineDash([12,8]); ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y); ctx.stroke(); ctx.restore(); }
function finalizeShape(tool,p1,p2,e,preview){ const shift=e.shiftKey, alt=e.altKey; if (tool==='rect'){ let dx=p2.x-p1.x, dy=p2.y-p1.y; if (shift){ const s=Math.max(Math.abs(dx),Math.abs(dy)); dx=Math.sign(dx)*s; dy=Math.sign(dy)*s; } let x=p1.x,y=p1.y,w=dx,h=dy; if (alt){ x=p1.x-dx; y=p1.y-dy; w=2*dx; h=2*dy; } const r=normalizeRect({x,y,w,h}); return { type:'shape', tool:'rect', color:state.currentColor, sizeId:state.currentSizeId, sizePx:state.currentSizePx, rect:r }; } else if (tool==='line'||tool==='arrow'){ let dx=p2.x-p1.x, dy=p2.y-p1.y; if (shift){ const rr=Math.hypot(dx,dy); const ang=Math.atan2(dy,dx); const snap=Math.round( ang / (Math.PI/4) ) * (Math.PI/4); dx=rr*Math.cos(snap); dy=rr*Math.sin(snap); } const p2f={ x:p1.x+dx, y:p1.y+dy }; const lw=state.currentSizePx; const opt=state.arrowHeadOpt||{type:'vee',length:4*lw,angleDeg:30,double:false,scaleWithWidth:true}; const length=(opt.scaleWithWidth ? (opt.length && typeof opt.length==='number' ? opt.length : 4*lw) : opt.length); const arrowHead={...opt, length}; return { type:'shape', tool:tool, color:state.currentColor, sizeId:state.currentSizeId, sizePx:lw, p1:p1, p2:p2f, arrowHead }; } else if (tool==='ellipse'){ let dx=p2.x-p1.x, dy=p2.y-p1.y; if (shift){ const s=Math.max(Math.abs(dx),Math.abs(dy)); dx=Math.sign(dx)*s; dy=Math.sign(dy)*s; } let x=p1.x,y=p1.y,w=dx,h=dy; if (alt){ x=p1.x-dx; y=p1.y-dy; w=2*dx; h=2*dy; } const r=normalizeRect({x,y,w,h}); const cx=r.x+r.w/2, cy=r.y+r.h/2; const rx=Math.max(1,r.w/2), ry=Math.max(1,r.h/2); return { type:'shape', tool:'ellipse', color:state.currentColor, sizeId:state.currentSizeId, sizePx:state.currentSizePx, ellipse:{ cx, cy, rx, ry } }; } return null; }
function normalizeRect(r){ let {x,y,w,h}=r; let x0=x,y0=y,w0=w,h0=h; if (w0<0){ x0=x+w; w0=-w; } if (h0<0){ y0=y+h; h0=-h; } return { x:x0, y:y0, w:w0, h:h0 }; }
function applyEraser(pathPts,history){ if (!pathPts||pathPts.length<2) return; const eraseSegs=toSegments(pathPts); const removed=[]; for (let i=history.length-1;i>=0;i--){ const item=history[i]; if (!item || item.type==='image' || item.type==='delete') continue; const segs=getItemSegments(item); const hit=hitAny(eraseSegs,segs,Math.max(item.sizePx? item.sizePx/2 : 2, 2)); if (hit){ removed.push(item); history.splice(i,1); } } if (removed.length){ history.push({ type:'delete', removed }); state.redoStack.length=0; } drawAll(); updateStatus(); }
function toSegments(pts){ const segs=[]; for (let i=0;i<pts.length-1;i++) segs.push([pts[i],pts[i+1]]); return segs; }
function getItemSegments(item){ const segs=[]; if (!item) return segs; if (item.type==='stroke'){ const pts=item.points||[]; for (let j=0;j<pts.length-1;j++) segs.push([pts[j],pts[j+1]]); } else if (item.type==='shape'){ if (item.tool==='line'||item.tool==='arrow') segs.push([item.p1,item.p2]); else if (item.tool==='rect'){ const r=item.rect; const p={x:r.x,y:r.y}, q={x:r.x+r.w,y:r.y}, s={x:r.x+r.w,y:r.y+r.h}, t={x:r.x,y:r.y+r.h}; segs.push([p,q],[q,s],[s,t],[t,p]); } else if (item.tool==='ellipse'){ const {cx,cy,rx,ry}=item.ellipse; const N=64; let prev=null; for (let k=0;k<=N;k++){ const th=(k/N)*Math.PI*2; const pt={ x:cx+rx*Math.cos(th), y:cy+ry*Math.sin(th) }; if (prev){ segs.push([prev,pt]); } prev=pt; } } } else if (item.type==='text'){ const b=item.box||{x:item.x,y:item.y,w:18,h:18}; const p={x:b.x,y:b.y}, q={x:b.x+b.w,y:b.y}, s={x:b.x+b.w,y:b.y+b.h}, t={x:b.x,y:b.y+b.h}; segs.push([p,q],[q,s],[s,t],[t,p]); } return segs; }
function hitAny(eraseSegs,segs,thr){ for (const [e1,e2] of eraseSegs){ const eaabb=aabbFromSeg(e1,e2); for (const [s1,s2] of segs){ const saabb=aabbFromSeg(s1,s2); if (!aabbOverlap(eaabb,saabb,thr)) continue; if (segIntersect(e1,e2,s1,s2)) return true; if (segDistance(s1,s2,e1)<=thr || segDistance(s1,s2,e2)<=thr) return true; if (segDistance(e1,e2,s1)<=thr || segDistance(e1,e2,s2)<=thr) return true; } } return false; }
function aabbFromSeg(a,b){ const minx=Math.min(a.x,b.x), maxx=Math.max(a.x,b.x); const miny=Math.min(a.y,b.y), maxy=Math.max(a.y,b.y); return {minx,maxx,miny,maxy}; }
function aabbOverlap(A,B,thr){ return !(A.maxx+thr < B.minx || B.maxx+thr < A.minx || A.maxy+thr < B.miny || B.maxy+thr < A.miny); }
function segIntersect(a,b,c,d){ const ccw=(p,q,r)=> (r.y-p.y)*(q.x-p.x) > (q.y-p.y)*(r.x-p.x); return (ccw(a,c,d) !== ccw(b,c,d)) && (ccw(a,b,c) !== ccw(a,b,d)); }
function segDistance(a,b,p){ const vx=b.x-a.x, vy=b.y-a.y; const wx=p.x-a.x, wy=p.y-a.y; const L2=vx*vx+vy*vy || 1; const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/L2)); const proj={x:a.x+t*vx, y:a.y+t*vy}; return Math.hypot(p.x-proj.x, p.y-proj.y); }

function hitTestAt(worldP){ for (let i=state.history.length-1;i>=0;i--){ const item=state.history[i]; if (!item || item.type==='image' || item.type==='delete' || item.type==='move' || item.type==='edit') continue; const thr=Math.max(item.sizePx? item.sizePx/2 : 4, 4); if (item.type==='stroke'){ const pts=item.points||[]; for (let j=0;j<pts.length-1;j++){ if (segDistance(pts[j],pts[j+1],worldP) <= thr) return item; } } else if (item.type==='shape'){ if (item.tool==='line' || item.tool==='arrow'){ if (segDistance(item.p1,item.p2,worldP) <= thr) return item; } else if (item.tool==='rect' || item.tool==='ellipse'){ const bb=getItemAABB(item); if (!bb) continue; if (worldP.x>=bb.minx-6 && worldP.x<=bb.maxx+6 && worldP.y>=bb.miny-6 && worldP.y<=bb.maxy+6) return item; } } else if (item.type==='text'){ const b=item.box||{x:item.x,y:item.y,w:18,h:18}; if (worldP.x>=b.x && worldP.x<=b.x+b.w && worldP.y>=b.y && worldP.y<=b.y+b.h) return item; } } return null; }

function undo(){ if (!state.history.length) return; const last=state.history.pop(); state.redoStack.push(last); if (last && last.type==='delete'){ for (const it of last.removed||[]) state.history.push(it); } else if (last && last.type==='move'){ applyTranslateTemp(last.itemRef, -(last.to?.dx||0), -(last.to?.dy||0)); } else if (last && last.type==='edit'){ Object.assign(last.itemRef, last.before); } drawAll(); updateStatus(); }
function redo(){ if (!state.redoStack.length) return; const item=state.redoStack.pop(); if (item && item.type==='delete'){ const removed=[]; for (const it of item.removed||[]){ const idx=state.history.indexOf(it); if (idx>=0){ removed.push(it); state.history.splice(idx,1); } } state.history.push({ type:'delete', removed }); } else if (item && item.type==='move'){ applyTranslateTemp(item.itemRef, item.to.dx, item.to.dy); state.history.push(item); } else if (item && item.type==='edit'){ Object.assign(item.itemRef, item.after); state.history.push(item); } else { state.history.push(item); } drawAll(); updateStatus(); }

async function decodeImageFile(file){
  if (!file||!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('PNGまたはJPEG画像を選択してください。');
  if (file.size>MAX_FILE_BYTES) throw new Error('画像ファイルは30MB以下にしてください。');
  if ('createImageBitmap' in window){
    try { return await createImageBitmap(file,{imageOrientation:'from-image'}); }
    catch(error){ console.warn('[createImageBitmap]',error); }
  }
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.decoding='async';
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('画像を読み込めませんでした。'));
      image.src=url;
    });
    return image;
  }finally{
    URL.revokeObjectURL(url);
  }
}
async function loadImageFile(file){
  try{
    const bitmap=await decodeImageFile(file);
    const width=bitmap.width||bitmap.naturalWidth;
    const height=bitmap.height||bitmap.naturalHeight;
    if (!width||!height||width*height>MAX_IMAGE_PIXELS){
      if (typeof bitmap.close==='function') bitmap.close();
      throw new Error('画像は合計2,400万画素以下にしてください。');
    }
    const previous=state.history.find(item=>item&&item.type==='image');
    if (previous&&previous.bitmap&&typeof previous.bitmap.close==='function') previous.bitmap.close();
    state.history.length=0;
    state.redoStack.length=0;
    state.history.push({type:'image',bitmap,imgW:width,imgH:height});
    state.frame={width,height};
    applyLayout();
    requestAnimationFrame(()=>{ resetView(true); showMessage('画像を読み込みました。描画を始められます。'); });
  }catch(error){
    console.error('[loadImageFile]',error);
    showMessage(error.message||'画像の読み込みに失敗しました。',true);
  }
}
stageEl.addEventListener('dragover',(event)=>{ event.preventDefault(); });
stageEl.addEventListener('drop',async(event)=>{
  event.preventDefault();
  const file=[...(event.dataTransfer?.files||[])].find(candidate=>/^image\/(png|jpeg)$/.test(candidate.type));
  if (!file){ showMessage('PNGまたはJPEG画像をドロップしてください。',true); return; }
  await loadImageFile(file);
});
window.addEventListener('paste',async(event)=>{
  const items=event.clipboardData?.items;
  if (!items) return;
  for (const item of items){
    if (/^image\/(png|jpeg)$/.test(item.type)){
      const file=item.getAsFile();
      if (file) await loadImageFile(file);
      return;
    }
  }
});
async function copyPNG(){
  try{
    if (!navigator.clipboard||!window.ClipboardItem) throw new Error('このブラウザでは画像コピーを利用できません。PNG保存をご利用ください。');
    const blob=await renderPNGBlob();
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    showMessage('PNGをクリップボードにコピーしました。');
  }catch(error){
    console.error('[copyPNG]',error);
    showMessage(error.message||'PNGのコピーに失敗しました。',true);
  }
}
async function savePNG(){
  try{
    const blob=await renderPNGBlob();
    const anchor=document.createElement('a');
    const date=new Date();
    const pad=value=>String(value).padStart(2,'0');
    const name=date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'_'+pad(date.getHours())+'-'+pad(date.getMinutes())+'-'+pad(date.getSeconds())+'_annotation.png';
    const url=URL.createObjectURL(blob);
    anchor.href=url;
    anchor.download=name;
    anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    showMessage('PNGを保存しました。');
  }catch(error){
    console.error('[savePNG]',error);
    showMessage(error.message||'PNGの保存に失敗しました。',true);
  }
}
async function renderPNGBlob(){
  const w=state.frame.width,h=state.frame.height;
  if (w*h>MAX_IMAGE_PIXELS) throw new Error('画像が大きすぎるため書き出せません。');
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext('2d');
  if (!ctx) throw new Error('画像の書き出しを開始できませんでした。');
  const imgRec=state.history.find(item=>item&&item.type==='image');
  if (imgRec&&imgRec.bitmap) ctx.drawImage(imgRec.bitmap,0,0,imgRec.imgW,imgRec.imgH);
  else { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h); }
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.lineCap='round';
  ctx.lineJoin='round';
  for (const item of state.history){
    if (!item) continue;
    if (item.type==='stroke') renderStroke(ctx,item);
    else if (item.type==='shape') renderShape(ctx,item);
    else if (item.type==='text') renderText(ctx,item);
  }
  ctx.restore();
  return await new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNGを生成できませんでした。')),'image/png');
  });
}

function resetView(silent=false){
  const horizontal=(scrollEl.clientWidth-24)/Math.max(1,state.frame.width);
  const vertical=(scrollEl.clientHeight-24)/Math.max(1,state.frame.height);
  state.displayScale=Math.min(1,Math.max(state.penExt.minScale,Math.min(horizontal,vertical)));
  applyLayout();
  centerScrollToStage();
  if (!silent) showMessage('画像全体が見える倍率に調整しました。');
}
function centerScrollToStage(){ const rectScroll=scrollEl.getBoundingClientRect(); const offX=Math.max(0,(stageEl.clientWidth - rectScroll.width)/2); const offY=Math.max(0,(stageEl.clientHeight - rectScroll.height)/2); scrollEl.scrollLeft=offX; scrollEl.scrollTop=offY; updateStatus(); }
function syncDpr(){
  const current=window.devicePixelRatio||1;
  if (Math.abs(current-state.dpr)>1e-6){
    state.dpr=current;
    applyLayout();
  }
}

function applyTranslateTemp(item,dx,dy){ if (!item) return; if (item.type==='stroke'){ for (const pt of item.points||[]){ pt.x+=dx; pt.y+=dy; } } else if (item.type==='shape'){ if (item.tool==='line'||item.tool==='arrow'){ item.p1.x+=dx; item.p1.y+=dy; item.p2.x+=dx; item.p2.y+=dy; } else if (item.tool==='rect'){ item.rect.x+=dx; item.rect.y+=dy; } else if (item.tool==='ellipse'){ item.ellipse.cx+=dx; item.ellipse.cy+=dy; } } else if (item.type==='text'){ item.x+=dx; item.y+=dy; if (item.box){ item.box.x+=dx; item.box.y+=dy; } } }
function deleteSelected(){ const it=state.selected.item; if (!it) return; const idx=state.history.indexOf(it); if (idx>=0){ state.history.splice(idx,1); state.history.push({ type:'delete', removed:[it] }); state.selected.item=null; state.redoStack.length=0; drawAll(); updateStatus(); } }

function init(){ try{
  syncChromeSize();
  applyLayout();
  setTool('pen');
  setColor('red');
  setSizeId(0);
  if ('ResizeObserver' in window){
    chromeObserver=new ResizeObserver(syncChromeSize);
    chromeObserver.observe(toolbarEl);
    chromeObserver.observe(hudEl);
    chromeObserver.observe(statusEl);
  }
  window.addEventListener('resize',()=>{ syncChromeSize(); syncDpr(); });
  scrollEl.addEventListener('scroll',()=>{
    if (scrollFrame) return;
    scrollFrame=requestAnimationFrame(()=>{ scrollFrame=0; updateStatus(); });
  },{passive:true});
  requestAnimationFrame(()=>resetView(true));
  showMessage('「画像を開く」からPNG/JPEGを選ぶか、画像を貼り付けてください。');
  }catch(err){
    console.error('[init]',err);
    showMessage('初期化に失敗しました。ページを再読み込みしてください。',true);
  }
}
document.addEventListener('DOMContentLoaded',init);
})();
