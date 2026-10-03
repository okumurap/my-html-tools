(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'flag-learner:v1';
  const TARGET_CODES = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW PS VA`.split(' ');
  const TARGET_SET = new Set(TARGET_CODES);
  const REGION_ORDER = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];
  const REGION_LABELS = {Asia:'アジア',Europe:'ヨーロッパ',Africa:'アフリカ','North America':'北中米','South America':'南米',Oceania:'オセアニア'};
  const A3_PATCH = {FRA:'FR', NOR:'NO'};
  const EXTRA_POINTS = {
    MV:[73.22,3.2,'Asia'], MC:[7.4246,43.738,'Europe'], NR:[166.93,-0.522,'Oceania'],
    TV:[179.2,-8.52,'Oceania'], VA:[12.4534,41.9029,'Europe']
  };
  const FALLBACK_REGIONS = {
    AD:'Europe',AG:'North America',BS:'North America',BB:'North America',BH:'Asia',BZ:'North America',BN:'Asia',CV:'Africa',KM:'Africa',DM:'North America',GD:'North America',KI:'Oceania',KN:'North America',LC:'North America',LI:'Europe',LU:'Europe',MH:'Oceania',MT:'Europe',FM:'Oceania',PW:'Oceania',SM:'Europe',ST:'Africa',SC:'Africa',SG:'Asia',VC:'North America',WS:'Oceania',TO:'Oceania',TT:'North America',PS:'Asia',MV:'Asia',MC:'Europe',NR:'Oceania',TV:'Oceania',VA:'Europe'
  };
  // Region fallback derived from the bundled Natural Earth dataset.
  const MAP_REGIONS = Object.fromEntries([
    ['Asia', 'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MY MN MM NP OM PK PH QA SA SG LK SY TJ TH TL TR TM AE UZ VN YE PS'],
    ['Europe', 'AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB'],
    ['Africa', 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'],
    ['North America', 'AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US'],
    ['South America', 'AR BO BR CL CO EC GY PY PE SR UY VE'],
    ['Oceania', 'AU FJ KI MH FM NZ PW PG WS SB TO VU']
  ].flatMap(([region, codes]) => codes.split(' ').map(code => [code, region])));
  const englishNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], {type:'region'}) : null;
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['ja'], {type:'region'}) : null;
  const countryByCode = new Map();
  const featureByCode = new Map();
  const markerByCode = new Map();
  const pathByCode = new Map();

  function loadState(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const statuses = saved && typeof saved.statuses === 'object' && saved.statuses ? saved.statuses : {};
      const clean = {};
      TARGET_CODES.forEach(code => { if (statuses[code] === 'learning' || statuses[code] === 'known') clean[code] = statuses[code]; });
      return {statuses:clean, showFlags:saved?.showFlags !== false};
    }catch(_){ return {statuses:{}, showFlags:true}; }
  }
  let state = loadState();
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(_){ $('storageNotice').hidden=false; $('storageNotice').textContent = '学習記録を保存できません。この画面では続けられますが、閉じると今回の記録は失われます。'; }
  }

  function flagEmoji(code){ return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))) : '🏳️'; }
  function jaName(code, fallback=''){ try{ return regionNames?.of(code) || fallback || code; }catch(_){ return fallback || code; } }
  function project([lon,lat]){ return [(lon + 180) / 360 * 1000, (90 - lat) / 180 * 500]; }
  function unproject([x,y]){ return [x / 1000 * 360 - 180, 90 - y / 500 * 180]; }
  function countryStatus(code){ return state.statuses[code] || 'none'; }

  function normalizeFeatureCode(feature){
    const props = feature.properties || {};
    const iso2 = props.iso_a2;
    if (TARGET_SET.has(iso2)) return iso2;
    return A3_PATCH[props.adm0_a3] || '';
  }

  function buildCountries(features){
    TARGET_CODES.forEach(code => countryByCode.set(code, {code, nameJa:jaName(code), nameEn:englishNames?.of(code)||code, region:FALLBACK_REGIONS[code] || MAP_REGIONS[code] || ''}));
    features.forEach(feature => {
      const code = normalizeFeatureCode(feature);
      if (!code) return;
      featureByCode.set(code, feature);
      const props = feature.properties || {};
      const current = countryByCode.get(code);
      countryByCode.set(code, {...current, nameEn:englishNames?.of(code) || props.name || current.nameEn, region:current.region || props.continent});
    });
    Object.entries(EXTRA_POINTS).forEach(([code,point]) => {
      const current = countryByCode.get(code);
      countryByCode.set(code, {...current, region:point[2] || current.region});
    });
    TARGET_CODES.forEach(code => {
      const current = countryByCode.get(code);
      if (!current.region) countryByCode.set(code, {...current, region:'Other'});
    });
  }

  function pathFromRing(ring){
    if (!Array.isArray(ring) || ring.length < 2) return '';
    let d = '';
    let prevLon = null;
    ring.forEach((point,index) => {
      if (!Array.isArray(point) || point.length < 2) return;
      const [lon,lat] = point;
      const [x,y] = project([lon,lat]);
      const jump = prevLon !== null && Math.abs(lon - prevLon) > 180;
      d += `${index === 0 || jump ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      prevLon = lon;
    });
    return `${d}Z`;
  }
  function pathFromGeometry(geometry){
    if (!geometry) return '';
    if (geometry.type === 'Polygon') return geometry.coordinates.map(pathFromRing).join('');
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap(poly => poly.map(pathFromRing)).join('');
    return '';
  }

  function ringAreaAndCentroid(ring){
    let area = 0, cx = 0, cy = 0;
    const points = (ring || []).map(project);
    for (let i=0;i<points.length-1;i++){
      const [x1,y1] = points[i], [x2,y2] = points[i+1];
      const cross = x1*y2 - x2*y1;
      area += cross; cx += (x1+x2)*cross; cy += (y1+y2)*cross;
    }
    area /= 2;
    if (Math.abs(area) < .01) return {area:0, x:points[0]?.[0] || 500, y:points[0]?.[1] || 250};
    return {area:Math.abs(area), x:cx/(6*(area)), y:cy/(6*(area))};
  }
  function representative(feature){
    const geometry = feature?.geometry;
    const rings = geometry?.type === 'Polygon' ? [geometry.coordinates[0]] : geometry?.type === 'MultiPolygon' ? geometry.coordinates.map(poly => poly[0]) : [];
    const ranked = rings.map(ringAreaAndCentroid).sort((a,b)=>b.area-a.area);
    return ranked[0] || {area:0,x:500,y:250};
  }

  function populateRegionSelect(select, includeAllLabel){
    select.replaceChildren();
    const all = document.createElement('option'); all.value = 'all'; all.textContent = includeAllLabel; select.append(all);
    REGION_ORDER.forEach(region => { const option=document.createElement('option'); option.value=region; option.textContent=REGION_LABELS[region]; select.append(option); });
  }

  function initSuggestions(){
    const list = $('countrySuggestions');
    list.replaceChildren(...TARGET_CODES.map(code => {
      const c=countryByCode.get(code); const option=document.createElement('option'); option.value=c.nameJa; option.label=c.nameEn; return option;
    }));
  }

  function renderMap(features){
    const ns='http://www.w3.org/2000/svg';
    const countryLayer=$('countryLayer'), flagLayer=$('flagLayer');
    const countryFrag=document.createDocumentFragment(), flagFrag=document.createDocumentFragment();
    features.forEach(feature => {
      const code=normalizeFeatureCode(feature); if(!code) return;
      const c=countryByCode.get(code); const path=document.createElementNS(ns,'path');
      path.setAttribute('d',pathFromGeometry(feature.geometry)); path.setAttribute('class','country'); path.dataset.code=code;
      path.setAttribute('aria-label',c.nameJa); path.setAttribute('tabindex','0'); path.setAttribute('role','button');
      countryFrag.append(path); pathByCode.set(code,path);
      const rep=representative(feature); createFlagMarker(code,rep.x,rep.y,rep.area < 48,flagFrag,ns);
    });
    Object.entries(EXTRA_POINTS).forEach(([code,[lon,lat]]) => {
      if(markerByCode.has(code)) return; const [x,y]=project([lon,lat]); createFlagMarker(code,x,y,true,flagFrag,ns);
    });
    countryLayer.replaceChildren(countryFrag); flagLayer.replaceChildren(flagFrag);
    refreshMapClasses();
  }

  function createFlagMarker(code,x,y,isSmall,fragment,ns){
    const marker=document.createElementNS(ns,'text'); marker.setAttribute('x',x.toFixed(2)); marker.setAttribute('y',y.toFixed(2));
    marker.setAttribute('class',`flag-marker${isSmall?' is-small':''}`); marker.dataset.code=code; marker.textContent=flagEmoji(code);
    marker.setAttribute('aria-label',`${countryByCode.get(code).nameJa}の国旗`); marker.setAttribute('role','button'); marker.setAttribute('tabindex','0');
    markerByCode.set(code,marker); fragment.append(marker);
  }

  let activeMapRegion='all'; let selectedCode=''; let view={x:0,y:0,w:1000,h:500}; let drag=null; let suppressMapClick=false;
  function setView(next){
    const minW=250,maxW=1000; const w=Math.min(maxW,Math.max(minW,next.w)); const h=w/2;
    let x=Math.min(1000-w,Math.max(0,next.x)); let y=Math.min(500-h,Math.max(0,next.y));
    view={x,y,w,h}; $('worldMap').setAttribute('viewBox',`${x} ${y} ${w} ${h}`); $('worldMap').parentElement.classList.toggle('is-zoomed',w<720);
  }
  function zoom(factor, centerX=view.x+view.w/2, centerY=view.y+view.h/2){
    const newW=view.w*factor; const ratio=newW/view.w; setView({w:newW,h:newW/2,x:centerX-(centerX-view.x)*ratio,y:centerY-(centerY-view.y)*ratio});
  }
  function focusCountry(code){
    const feature=featureByCode.get(code); let point;
    if(feature){ const r=representative(feature); point=[r.x,r.y]; }
    else if(EXTRA_POINTS[code]) point=project(EXTRA_POINTS[code]);
    if(point) setView({x:point[0]-250,y:point[1]-125,w:500,h:250});
  }

  function refreshMapClasses(){
    pathByCode.forEach((path,code) => {
      const c=countryByCode.get(code); path.classList.toggle('is-dim',activeMapRegion!=='all'&&c.region!==activeMapRegion);
      path.classList.toggle('is-selected',code===selectedCode); path.classList.toggle('is-known',countryStatus(code)==='known');
    });
    markerByCode.forEach((marker,code) => marker.classList.toggle('is-filtered',activeMapRegion!=='all'&&countryByCode.get(code).region!==activeMapRegion));
    $('worldMap').classList.toggle('flags-hidden',!state.showFlags);
  }

  function selectCountry(code,{focus=false}={}){
    if(!TARGET_SET.has(code)) return; selectedCode=code; const c=countryByCode.get(code);
    $('countryCard').hidden=false; $('countryFlag').textContent=flagEmoji(code); $('countryName').textContent=c.nameJa;
    $('countryEnglish').textContent=c.nameEn; $('countryRegion').textContent=REGION_LABELS[c.region] || c.region;
    document.querySelectorAll('[data-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.status===countryStatus(code))));
    if(focus) focusCountry(code); refreshMapClasses();
  }

  function findCountry(query){
    const q=String(query||'').trim().normalize('NFKC').toLocaleLowerCase('ja'); if(!q) return '';
    const exact=TARGET_CODES.find(code=>{ const c=countryByCode.get(code); return [code,c.nameJa,c.nameEn].some(v=>String(v).normalize('NFKC').toLocaleLowerCase('ja')===q); });
    if(exact) return exact;
    return TARGET_CODES.find(code=>{ const c=countryByCode.get(code); return `${c.nameJa} ${c.nameEn} ${code}`.normalize('NFKC').toLocaleLowerCase('ja').includes(q); }) || '';
  }

  const STATUS_LABELS = {none:'未学習', learning:'練習中', known:'覚えた'};
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if(className) element.className = className;
    if(text !== undefined) element.textContent = text;
    return element;
  };
  const normalized = text => String(text).normalize('NFKC').trim().toLocaleLowerCase('ja');
  function renderAtlas(){
    const query=normalized($('countrySearch').value);
    const status=$('atlasStatus').value;
    const codes=TARGET_CODES.filter(code=>{
      const c=countryByCode.get(code);
      return (activeMapRegion==='all'||c.region===activeMapRegion) && (status==='all'||countryStatus(code)===status) && normalized(`${c.nameJa} ${c.nameEn} ${code}`).includes(query);
    }).sort((a,b)=>countryByCode.get(a).nameJa.localeCompare(countryByCode.get(b).nameJa,'ja'));
    $('atlasCount').textContent=`${codes.length}か国`;
    $('atlasEmpty').hidden=codes.length>0;
    $('countryGrid').replaceChildren(...codes.map(code=>{
      const button=node('button','country-tile'); button.type='button'; button.dataset.code=code;
      button.setAttribute('aria-pressed',String(code===selectedCode));
      button.append(node('span','tile-flag',flagEmoji(code)),node('span','tile-name',countryByCode.get(code).nameJa),node('span','tile-status',STATUS_LABELS[countryStatus(code)]));
      return button;
    }));
  }
  function updateKnownCount(){
    const known=TARGET_CODES.filter(code=>countryStatus(code)==='known').length;
    $('knownCount').textContent=known; $('knownProgress').value=known;
    $('learningCount').textContent=TARGET_CODES.filter(code=>countryStatus(code)==='learning').length;
    updateSetup();
  }
  function setMode(mode){
    const isQuiz=mode==='quiz';
    $('quizTab').setAttribute('aria-pressed',String(isQuiz)); $('mapTab').setAttribute('aria-pressed',String(!isQuiz));
    $('quizPanel').hidden=!isQuiz; $('mapPanel').hidden=isQuiz;
    $('resumeQuiz').hidden=!quiz.active;
    if(!isQuiz){ renderAtlas(); requestAnimationFrame(()=>setView(view)); }
  }
  let quiz={active:false,index:0,correct:0,streak:0,answered:false,questions:[],mistakes:[],results:[]};
  function shuffled(list){ const a=[...list]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function quizPool(){ return TARGET_CODES.filter(code=>$('quizRegion').value==='all'||countryByCode.get(code)?.region===$('quizRegion').value); }
  function updateSetup(){
    const pool=quizPool(); const review=pool.filter(code=>countryStatus(code)==='learning');
    $('setupHint').textContent=`${pool.length}か国から ${Math.min(Number($('quizLength').value),pool.length)}問を出題`;
    $('startQuiz').disabled=pool.length===0;
    $('startReview').disabled=review.length===0;
    $('startReview').textContent=review.length?`練習中の国を復習（${review.length}か国）`:'練習中の国はまだありません';
  }
  function showSetup(){
    quiz.active=false; $('quizSetup').hidden=false; $('quizSession').hidden=true; updateSetup(); setMode('quiz'); $('startQuiz').focus();
  }
  function startQuiz(codes, review=false){
    const pool=quizPool(); const questions=shuffled(codes||pool).slice(0,Number($('quizLength').value));
    if(!questions.length) return;
    quiz={active:true,index:0,correct:0,streak:0,answered:false,questions,mistakes:[],results:[],direction:$('quizDirection').value,pool,review};
    $('quizSetup').hidden=true; $('quizSession').hidden=false; $('quizResult').hidden=true; $('quizCard').hidden=false;
    setMode('quiz'); updateQuizScore(); renderQuestion();
  }
  function updateQuizScore(){ $('quizCorrect').textContent=quiz.correct; $('quizStreak').textContent=quiz.streak; }
  function makeChoices(answer,pool){ const others=shuffled(pool.filter(code=>code!==answer)).slice(0,3); return shuffled([answer,...others]); }
  function renderQuestion(){
    const answer=quiz.questions[quiz.index]; if(!answer){ finishQuiz(); return; }
    quiz.answered=false; $('answerPanel').hidden=true; $('quizFeedback').textContent='';
    $('quizNumber').textContent=`${quiz.index+1} / ${quiz.questions.length} 問`;
    $('quizProgress').max=quiz.questions.length; $('quizProgress').value=quiz.index;
    const country=countryByCode.get(answer);
    $('quizRegionLabel').textContent=REGION_LABELS[country.region]||'';
    $('questionInstruction').textContent=quiz.direction==='flag-to-name'?'この国旗は、どこの国？':'この国の国旗は、どれ？';
    const prompt=$('quizPrompt'); prompt.replaceChildren();
    if(quiz.direction==='flag-to-name'){
      const flag=node('span','big-flag',flagEmoji(answer)); flag.setAttribute('role','img'); flag.setAttribute('aria-label','出題の国旗'); prompt.append(flag);
    } else { prompt.textContent=country.nameJa; }
    const choices=makeChoices(answer,quiz.pool.length>=4?quiz.pool:TARGET_CODES);
    $('quizChoices').replaceChildren(...choices.map((code,index)=>{
      const button=node('button','choice'); button.type='button'; button.dataset.code=code;
      if(quiz.direction==='flag-to-name') button.textContent=countryByCode.get(code).nameJa;
      else {
        const flag=node('span','choice-flag',flagEmoji(code)); flag.setAttribute('aria-hidden','true');
        button.append(flag); button.setAttribute('aria-label',`国旗の選択肢 ${index+1}`);
      }
      return button;
    }));
    $('questionInstruction').focus({preventScroll:true});
    $('quizSession').scrollIntoView({block:'start'});
  }
  function refreshKnownButton(){
    const known=countryStatus(quiz.questions[quiz.index])==='known';
    $('markKnown').textContent=known?'✓ 覚えた（解除する）':'覚えたにする';
    $('markKnown').setAttribute('aria-pressed',String(known));
  }
  function answerQuiz(code){
    if(!quiz.active||quiz.answered||!quiz.questions[quiz.index]) return;
    quiz.answered=true; const answer=quiz.questions[quiz.index]; const ok=code===answer;
    quiz.results.push({code:answer,ok});
    if(ok){ quiz.correct++; quiz.streak++; } else { quiz.streak=0; quiz.mistakes.push(answer); }
    // A missed answer needs practice again, including countries previously marked known.
    if(!ok||countryStatus(answer)==='none') state.statuses[answer]='learning';
    saveState(); updateKnownCount(); updateQuizScore();
    const c=countryByCode.get(answer);
    $('quizFeedback').textContent=`${ok?'✓ 正解！':'もう一度覚えよう。正解は'} ${flagEmoji(answer)} ${c.nameJa}（${REGION_LABELS[c.region]||''}）`;
    $('quizFeedback').className=`feedback ${ok?'good':'bad'}`;
    $('quizChoices').querySelectorAll('.choice').forEach(button=>{
      button.disabled=true;
      if(quiz.direction==='name-to-flag'){
        button.removeAttribute('aria-label'); button.append(node('span','choice-label',countryByCode.get(button.dataset.code).nameJa));
      }
      if(button.dataset.code===answer){ button.classList.add('correct'); button.append(node('span','choice-result','✓ 正解')); }
      else if(button.dataset.code===code){button.classList.add('wrong');button.append(node('span','choice-result','×'));}
    });
    $('quizProgress').value=quiz.index+1;
    refreshKnownButton(); $('answerPanel').hidden=false;
    $('nextQuestion').textContent=quiz.index===quiz.questions.length-1?'結果を見る →':'次の問題 →';
    $('nextQuestion').focus({preventScroll:true});
  }
  function finishQuiz(){
    quiz.active=false; $('quizCard').hidden=true; $('quizResult').hidden=false;
    $('quizResultScore').textContent=`${quiz.correct} / ${quiz.questions.length}`;
    $('quizResultText').textContent=quiz.mistakes.length?`${quiz.mistakes.length}か国をもう一度。下の国を押すと、図鑑で確認できます。`:'全問正解！ 次は別の地域にも挑戦してみよう。';
    $('retryMistakes').hidden=quiz.mistakes.length===0;
    $('resultCountries').replaceChildren(...quiz.results.map(({code,ok})=>{
      const button=node('button','result-country'); button.type='button'; button.dataset.code=code;
      button.append(node('span','',flagEmoji(code)),node('span','',countryByCode.get(code).nameJa),node('small','',ok?'✓ 正解　↗':'要復習　↗')); return button;
    }));
    $('resultHeading').focus({preventScroll:true}); $('quizSession').scrollIntoView({block:'start'});
  }
  function openAtlasCountry(code){
    activeMapRegion='all'; $('mapRegion').value='all'; $('countrySearch').value=''; $('atlasStatus').value='all';
    setMode('map'); selectCountry(code,{focus:true}); renderAtlas(); $('countryCard').scrollIntoView({block:'start'});
  }

  function bindEvents(){
    $('quizTab').addEventListener('click',()=>setMode('quiz')); $('mapTab').addEventListener('click',()=>setMode('map'));
    $('quizChoices').addEventListener('click',e=>{const b=e.target.closest('.choice');if(b)answerQuiz(b.dataset.code);});
    $('nextQuestion').addEventListener('click',()=>{quiz.index++;renderQuestion();}); $('restartQuiz').addEventListener('click',()=>startQuiz(quiz.review?quiz.questions:undefined,quiz.review));
    $('startQuiz').addEventListener('click',()=>startQuiz());
    $('startReview').addEventListener('click',()=>startQuiz(quizPool().filter(code=>countryStatus(code)==='learning'),true));
    $('retryMistakes').addEventListener('click',()=>startQuiz(quiz.mistakes,true));
    $('quizRegion').addEventListener('change',updateSetup); $('quizLength').addEventListener('change',updateSetup);
    $('exitQuiz').addEventListener('click',()=>{if(!quiz.active||window.confirm('今回のクイズを終了して設定に戻りますか？ 習得記録は残ります。'))showSetup();});
    $('resultHome').addEventListener('click',showSetup);
    $('resumeQuiz').addEventListener('click',()=>setMode('quiz'));
    $('answerMap').addEventListener('click',()=>{openAtlasCountry(quiz.questions[quiz.index]);document.querySelector('.map-disclosure').open=true;});
    $('markKnown').addEventListener('click',()=>{const code=quiz.questions[quiz.index];state.statuses[code]=countryStatus(code)==='known'?'learning':'known';saveState();updateKnownCount();refreshKnownButton();refreshMapClasses();});
    $('countryGrid').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(b){selectCountry(b.dataset.code,{focus:true});renderAtlas();$('countryCard').scrollIntoView({block:'start'});}});
    $('resultCountries').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(b)openAtlasCountry(b.dataset.code);});
    $('countrySearch').addEventListener('input',renderAtlas); $('atlasStatus').addEventListener('change',renderAtlas);
    $('showFlags').checked=state.showFlags; $('showFlags').addEventListener('change',()=>{state.showFlags=$('showFlags').checked;saveState();refreshMapClasses();});
    $('mapRegion').addEventListener('change',()=>{activeMapRegion=$('mapRegion').value;refreshMapClasses();renderAtlas();});
    const runSearch=()=>{const code=findCountry($('countrySearch').value);if(code){openAtlasCountry(code);document.querySelector('.map-disclosure').open=true;$('mapStatus').textContent=`${countryByCode.get(code).nameJa} を表示しました。`;}else{document.querySelector('.map-disclosure').open=true;$('mapStatus').textContent='該当する国が見つかりません。';}};
    $('searchButton').addEventListener('click',runSearch); $('countrySearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch();}});
    $('countryLayer').addEventListener('click',e=>{if(suppressMapClick)return;const node=e.target.closest('[data-code]');if(node)selectCountry(node.dataset.code);});
    $('flagLayer').addEventListener('click',e=>{if(suppressMapClick)return;const node=e.target.closest('[data-code]');if(node)selectCountry(node.dataset.code);});
    $('worldMap').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset.code){e.preventDefault();selectCountry(e.target.dataset.code,{focus:true});}});
    $('countryCard').addEventListener('click',e=>{const b=e.target.closest('[data-status]');if(!b||!selectedCode)return;const next=b.dataset.status;if(next==='none')delete state.statuses[selectedCode];else state.statuses[selectedCode]=next;saveState();updateKnownCount();selectCountry(selectedCode);renderAtlas();if(quiz.active&&quiz.answered)refreshKnownButton();});
    $('zoomIn').addEventListener('click',()=>zoom(.7)); $('zoomOut').addEventListener('click',()=>zoom(1.4)); $('zoomReset').addEventListener('click',()=>setView({x:0,y:0,w:1000,h:500}));
    const map=$('worldMap');
    map.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,view:{...view},moved:false};});
    map.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const rect=map.getBoundingClientRect();const dx=(e.clientX-drag.x)/rect.width*drag.view.w,dy=(e.clientY-drag.y)/rect.height*drag.view.h;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>6){drag.moved=true;map.setPointerCapture?.(e.pointerId);}setView({...drag.view,x:drag.view.x-dx,y:drag.view.y-dy});});
    map.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId){suppressMapClick=drag.moved;if(suppressMapClick)setTimeout(()=>{suppressMapClick=false;},0);drag=null;}}); map.addEventListener('pointercancel',()=>{drag=null;suppressMapClick=false;});
    map.addEventListener('wheel',e=>{e.preventDefault();const rect=map.getBoundingClientRect();const x=view.x+(e.clientX-rect.left)/rect.width*view.w;const y=view.y+(e.clientY-rect.top)/rect.height*view.h;zoom(e.deltaY>0?1.15:.85,x,y);},{passive:false});
  }

  async function init(){
    populateRegionSelect($('quizRegion'),'全世界'); populateRegionSelect($('mapRegion'),'全世界'); buildCountries([]); initSuggestions(); bindEvents(); updateKnownCount(); renderAtlas();
    try{
      const response=await fetch('./world.geojson',{cache:'force-cache'}); if(!response.ok)throw new Error(`HTTP ${response.status}`); const geo=await response.json();
      if(!geo||!Array.isArray(geo.features))throw new Error('invalid geojson');
      buildCountries(geo.features); initSuggestions(); renderMap(geo.features); $('mapStatus').textContent='国や国旗をタップして確認できます。'; updateSetup();
    }catch(_){
      buildCountries([]); initSuggestions(); updateSetup(); $('mapStatus').textContent='世界地図を読み込めませんでした。通信またはファイル配置を確認してください。クイズは利用できます。';
    }
  }
  init();
})();
