(() => {
  'use strict';
  const KEY = 'gear-mesh-lab:params:v1';
  const DEFAULTS = {m:2,z1:12,z2:24,alpha:20,x1:0.4,x2:0,extra:0};
  const PRESETS = {
    standard:{m:2,z1:20,z2:40,alpha:20,x1:0,x2:0,extra:0},
    small:DEFAULTS,
    pair:{m:2,z1:12,z2:24,alpha:20,x1:0.4,x2:-0.4,extra:0},
    pressure:{m:2,z1:20,z2:40,alpha:25,x1:0,x2:0,extra:0}
  };
  const $ = id => document.getElementById(id);
  const svg = $('gear-svg');
  const ids = Object.keys(DEFAULTS);
  let model = null;
  let snapshot = null;
  let phase = 0;
  let playing = false;
  let previousTick = null;
  let zoom = 1;
  const fmt = (value, digits=3) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const deg = value => value * 180 / Math.PI;
  const point = (r, a) => `${fmt(r*Math.cos(a),5)},${fmt(r*Math.sin(a),5)}`;
  const setFields = params => {
    ids.forEach(id => {
      $(id).value = params[id];
      const slider = $(`${id}-range`);
      if (slider) slider.value = Math.min(Number(slider.max), Math.max(Number(slider.min), Number(params[id])));
    });
    updateExtraRange();
  };
  function updateExtraRange() {
    const slider = $('extra-range');
    const val = Number($('m').value);
    slider.max = Number.isFinite(val) && val >= 0.5 ? Math.min(20,2*val) : 4;
    slider.value = Math.min(Number(slider.max), Math.max(0, Number($('extra').value) || 0));
  }
  function readParams() {
    return Object.fromEntries(ids.map(id => [id, $(id).value]));
  }
  function save(params) {
    try {localStorage.setItem(KEY, JSON.stringify(params));$('save-status').textContent='入力条件をこの端末に保存しました。';}
    catch (_) {$('save-status').textContent='このブラウザでは保存できません。アプリの使用は可能です。';}
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && ids.every(id => Object.hasOwn(saved,id))) {
        GearMath.calculate(saved);
        return saved;
      }
    } catch (_) { /* 保存不可・不正データ時は例題から開始 */ }
    return DEFAULTS;
  }
  // 歯元は工具で創成されるトロコイドではなく、基礎円と歯底円の直線接続で模式描画。
  function gearPath(g) {
    const z = g.z, pitch = 2*Math.PI/z;
    const startR = Math.max(g.rb,g.rf);
    const rootHalf = Math.min(g.toothAngle(startR), .48*pitch);
    const tipHalf = g.toothAngle(g.ra);
    let result='';
    const polar = (r, a) => point(r,a);
    for (let n=0;n<z;n++) {
      const center=n*pitch;
      result += `${n?'L':'M'}${polar(g.rf,center-rootHalf)} `;
      result += `L${polar(startR,center-g.toothAngle(startR))} `;
      for (let s=1;s<=9;s++) {
        const r=startR+(g.ra-startR)*s/9;
        result += `L${polar(r,center-g.toothAngle(r))} `;
      }
      for (let s=1;s<=5;s++) result+=`L${polar(g.ra,center-tipHalf+2*tipHalf*s/5)} `;
      for (let s=8;s>=0;s--) {
        const r=startR+(g.ra-startR)*s/9;
        result+=`L${polar(r,center+g.toothAngle(r))} `;
      }
      result+=`L${polar(g.rf,center+rootHalf)} `;
      for(let s=1;s<=3;s++)result+=`L${polar(g.rf,center+rootHalf+(pitch-2*rootHalf)*s/3)} `;
    }
    return result+'Z';
  }
  function circleMarkup(g, x) {
    const circles=[['reference',g.r,'reference'],['base',g.rb,'base'],['working',g.rw,'working'],['tip',g.ra,'tip'],['root',g.rf,'root']];
    return circles.filter(([key])=>document.querySelector(`[data-circle="${key}"]`).checked).map(([key,r,klass])=>`<circle cx="${fmt(x,6)}" cy="0" r="${fmt(r,6)}" class="circle-${klass}" fill="none" vector-effect="non-scaling-stroke"/>`).join('');
  }
  function drawStatic() {
    if(!model)return;
    const {g1,g2,a,workingAlpha}=model;
    const x1=-a/2,x2=a/2;
    const totalWidth=a+g1.ra+g2.ra;
    const centerX=(g2.ra-g1.ra)/2;
    const dimensionY=Math.max(g1.ra,g2.ra)+model.m*3;
    const margin=model.m*5;
    const w=(totalWidth+2*margin)/zoom;
    const h=Math.max(w*.71,(2*(dimensionY+margin))/zoom);
    svg.setAttribute('viewBox',`${fmt(centerX-w/2,5)} ${fmt(-h/2,5)} ${fmt(w,5)} ${fmt(h,5)}`);
    const pitchX=x1+g1.rw;
    const lineHalf=Math.max(g1.ra,g2.ra)*1.3;
    const dx=Math.sin(workingAlpha),dy=-Math.cos(workingAlpha);
    const actionEnabled=$('action-line').checked;
    // SVG に渡す数値はすべて計算済みの有限値のみ。
    svg.innerHTML=`<style>
.gear-one{fill:var(--blue);fill-opacity:.19;stroke:var(--blue);stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.gear-two{fill:var(--orange);fill-opacity:.2;stroke:var(--orange);stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.circle-reference{stroke:var(--blue);stroke-dasharray:6 3;stroke-width:1.35}.circle-base{stroke:var(--green);stroke-dasharray:2 3;stroke-width:1.6}.circle-working{stroke:var(--orange);stroke-dasharray:7 3;stroke-width:1.6}.circle-tip,.circle-root{stroke:var(--muted);stroke-opacity:.7;stroke-dasharray:2 3;stroke-width:1}.dim{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}.action{stroke:var(--red);stroke-width:1.7;vector-effect:non-scaling-stroke}.contact-dot{fill:var(--red);stroke:var(--panel);stroke-width:1.6;vector-effect:non-scaling-stroke}.svg-label{fill:var(--ink);font-family:system-ui,sans-serif;font-size:${fmt(model.m*2.4,3)}px;font-weight:750;paint-order:stroke;stroke:var(--bg);stroke-width:${fmt(model.m*.7,3)}px}
</style><g id="gear-one" transform="translate(${fmt(x1,6)},0)"><path class="gear-one" d="${gearPath(g1)}"/></g><g id="gear-two" transform="translate(${fmt(x2,6)},0)"><path class="gear-two" d="${gearPath(g2)}"/></g>${circleMarkup(g1,x1)}${circleMarkup(g2,x2)}<g class="dim"><path d="M${fmt(x1,6)} 0V${fmt(dimensionY,6)} M${fmt(x2,6)} 0V${fmt(dimensionY,6)} M${fmt(x1,6)} ${fmt(dimensionY,6)}H${fmt(x2,6)}"/><path d="M${fmt(x1-model.m,6)} ${fmt(dimensionY-model.m,6)}L${fmt(x1+model.m,6)} ${fmt(dimensionY+model.m,6)} M${fmt(x2-model.m,6)} ${fmt(dimensionY-model.m,6)}L${fmt(x2+model.m,6)} ${fmt(dimensionY+model.m,6)}"/></g><text class="svg-label" x="${fmt((x1+x2)/2,6)}" y="${fmt(dimensionY+model.m*3,6)}" text-anchor="middle">a = ${fmt(a)} mm</text><g id="action-group" ${actionEnabled?'':'display="none"'}><path class="action" stroke-dasharray="5 4" d="M${fmt(pitchX-dx*lineHalf,6)} ${fmt(-dy*lineHalf,6)}L${fmt(pitchX+dx*lineHalf,6)} ${fmt(dy*lineHalf,6)}"/><path class="action" stroke-width="3" d="M${fmt(pitchX+dx*model.approach,6)} ${fmt(dy*model.approach,6)}L${fmt(pitchX+dx*model.recess,6)} ${fmt(dy*model.recess,6)}"/><circle class="contact-dot" cx="${fmt(pitchX,6)}" cy="0" r="${fmt(model.m*.32,6)}"/><text class="svg-label" x="${fmt(pitchX+model.m,6)}" y="${fmt(-model.m,6)}">P</text><g id="moving-contacts"></g></g><g class="dim"><circle cx="${fmt(x1,6)}" cy="0" r="${fmt(model.m*.25,6)}" fill="var(--ink)"/><circle cx="${fmt(x2,6)}" cy="0" r="${fmt(model.m*.25,6)}" fill="var(--ink)"/></g>`;
    drawFrame();
  }
  function drawFrame() {
    if(!model)return;
    const {z1,z2,g1,g2,a,workingAlpha,approach,recess,basePitch}=model;
    const angle1=phase;
    const angle2=(z2%2?0:Math.PI/z2)-phase*z1/z2;
    $('gear-one').setAttribute('transform',`translate(${fmt(-a/2,6)},0) rotate(${fmt(deg(angle1),5)})`);
    $('gear-two').setAttribute('transform',`translate(${fmt(a/2,6)},0) rotate(${fmt(deg(angle2),5)})`);
    const progress=((phase*z1/(2*Math.PI))%1+1)%1;
    const dots=[];
    for(let i=0;i<Math.min(5,Math.ceil(model.ratio)+1);i++) {
      const t=approach+(progress+i)*basePitch;
      if(t>recess+1e-8)break;
      const x=-a/2+g1.rw+t*Math.sin(workingAlpha);
      const y=-t*Math.cos(workingAlpha);
      dots.push(`<circle class="contact-dot" cx="${fmt(x,6)}" cy="${fmt(y,6)}" r="${fmt(model.m*.36,6)}"/>`);
    }
    const target=$('moving-contacts');
    if(target)target.innerHTML=dots.join('');
    $('contact-count').textContent=`${dots.length}対`;
    $('contact-bar').style.width=`${Math.min(100,dots.length/Math.max(1,Math.ceil(model.ratio))*100)}%`;
  }
  function updateInsight(changed) {
    const notes={m:'モジュール m を変えると歯の寸法・基準円 d=mz・標準中心距離が比例します。',z1:'歯車1の歯数を変えると、基準円直径 d₁=mz₁ と伝達比 z₂/z₁が変化します。',z2:'歯車2の歯数を変えると、基準円直径 d₂=mz₂ と伝達比 z₂/z₁が変化します。',alpha:'基準圧力角を変えると基礎円 db=d cos α、作用線、歯形が変わります。',x1:'転位 x₁ は歯車1の歯厚・歯先径に作用しますが、基準円直径 d₁=mz₁は変わりません。',x2:'転位 x₂ は歯車2の歯厚・歯先径に作用しますが、基準円直径 d₂=mz₂は変わりません。',extra:'中心距離を増やしても製作済みの歯形・基準円・基礎円・歯先円は不変。かみ合いピッチ円と圧力角が変わります。'};
    $('insight').textContent=notes[changed]||'基準円は d=mz。基準円と実際のかみ合いピッチ円は、転位・組立中心距離によって一致しない場合があります。';
  }
  function showResults() {
    const v=model;
    $('result-center').textContent=fmt(v.a)+' mm';
    $('result-pressure').textContent=fmt(deg(v.workingAlpha),2)+'°';
    $('result-ratio').textContent=fmt(v.ratio,3);
    $('result-backlash').textContent=fmt(v.backlashApprox,3)+' mm';
    $('contact-note').textContent=`作用線の有効長 ${fmt(v.length)} mm ÷ 法線ピッチ ${fmt(v.basePitch)} mm = ${fmt(v.ratio,3)}。歯元は近似形状です。`;
    const values=[['基準円 d','d'],['基礎円 db','db'],['かみ合いピッチ円 dw','dw'],['歯先円 da','da'],['歯底円 df','df'],['歯先厚さ sₐ','tipThickness']];
    $('dimension-rows').replaceChildren(...values.map(([label,key])=>{
      const tr=document.createElement('tr');
      [label,fmt(v.g1[key]),fmt(v.g2[key])].forEach(cell=>{const el=document.createElement('td');el.textContent=cell;tr.append(el);});
      return tr;
    }));
    const warnings=$('warnings');
    warnings.hidden=v.warnings.length===0;
    warnings.replaceChildren(...v.warnings.map(w=>{const p=document.createElement('p');p.textContent='注意：'+w;return p;}));
    renderCompare();
  }
  function renderCompare() {
    const box=$('compare');box.hidden=!snapshot||!model;
    if(box.hidden)return;
    const items=[['中心距離 a',m=>m.a,'mm'],['基準円 d₁',m=>m.g1.d,'mm'],['かみ合いピッチ円 dw₁',m=>m.g1.dw,'mm'],['歯先円 da₁',m=>m.g1.da,'mm'],['圧力角 αw',m=>deg(m.workingAlpha),'°'],['かみ合い率 εα',m=>m.ratio,'']];
    const heading=document.createElement('h3');heading.textContent='Before / After：固定した条件と現在値';
    const table=document.createElement('table');
    const thead=document.createElement('thead');thead.innerHTML='<tr><th>項目</th><th>固定</th><th>現在</th></tr>';table.append(thead);
    const body=document.createElement('tbody');
    items.forEach(([label,get,unit])=>{
      const tr=document.createElement('tr');
      [label,fmt(get(snapshot))+unit,fmt(get(model))+unit].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);
    });table.append(body);box.replaceChildren(heading,table);
  }
  function render(changed='') {
    try {
      const input=readParams();
      const next=GearMath.calculate(input);
      model=next;
      $('error').hidden=true;
      $('error').textContent='';
      save(Object.fromEntries(ids.map(id=>[id,Number(input[id])])));
      showResults();
      drawStatic();
      updateInsight(changed);
    } catch(err) {
      model=null;
      playing=false;
      $('play').textContent='▶ 回転する';
      $('error').textContent=err.message||'計算条件を確認してください。';
      $('error').hidden=false;
      svg.replaceChildren();
      ['result-center','result-pressure','result-ratio','result-backlash','contact-count'].forEach(id=>$(id).textContent='—');
      $('contact-bar').style.width='0%';
      $('dimension-rows').replaceChildren();
      $('warnings').hidden=true;
      $('compare').hidden=true;
      $('save-status').textContent='入力エラーのため、この条件は保存していません。';
    }
  }
  function tick(time) {
    requestAnimationFrame(tick);
    if(!playing||!model){previousTick=time;return;}
    const delta=previousTick===null?0:Math.min(0.05,(time-previousTick)/1000);
    previousTick=time;
    phase+=delta*Number($('speed').value)*(2*Math.PI/model.z1)*.7;
    drawFrame();
  }
  ids.forEach(id=>{
    const number=$(id),range=$(`${id}-range`);
    number.addEventListener('input',()=>{
      if(id==='m') updateExtraRange();
      if(range && number.value!=='')range.value=number.value;
      render(id);
    });
    if(range)range.addEventListener('input',()=>{number.value=range.value;if(id==='m')updateExtraRange();render(id);});
  });
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{setFields(PRESETS[button.dataset.preset]);phase=0;render();}));
  document.querySelectorAll('[data-circle]').forEach(input=>input.addEventListener('change',drawStatic));
  $('action-line').addEventListener('change',drawStatic);
  $('play').addEventListener('click',()=>{if(!model)return;playing=!playing;previousTick=null;$('play').textContent=playing?'Ⅱ 一時停止':'▶ 回転する';});
  $('step').addEventListener('click',()=>{if(!model)return;playing=false;$('play').textContent='▶ 回転する';phase+=2*Math.PI/(model.z1*24);drawFrame();});
  $('reset-rotation').addEventListener('click',()=>{phase=0;playing=false;$('play').textContent='▶ 回転する';drawFrame();});
  $('speed').addEventListener('input',()=>$('speed-output').textContent=Number($('speed').value).toFixed(1)+'×');
  $('zoom-in').addEventListener('click',()=>{zoom=Math.min(2.8,zoom*1.25);drawStatic();});
  $('zoom-out').addEventListener('click',()=>{zoom=Math.max(.65,zoom/1.25);drawStatic();});
  $('zoom-reset').addEventListener('click',()=>{zoom=1;drawStatic();});
  $('snapshot').addEventListener('click',()=>{if(model){snapshot=model;renderCompare();}});
  $('clear-snapshot').addEventListener('click',()=>{snapshot=null;renderCompare();});
  $('reset').addEventListener('click',()=>{setFields(DEFAULTS);snapshot=null;phase=0;zoom=1;playing=false;$('play').textContent='▶ 回転する';render();});
  setFields(load());
  render();
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;previousTick=null;$('play').textContent='▶ 回転する';}});
})();
