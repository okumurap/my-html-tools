const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const rules=require('../tools/sakamoto-kiss-fishing/rules.js');
for(const [distance,expected] of [[30,'weed'],[65,'break'],[90,'sand']])assert.equal(rules.bottomAt(distance,{weed:30,break:65}),expected);
for(const [base,perfect,control,timing,care] of [[100,true,.5,25,30],[240,false,1,0,60],[399,true,0,100,0]])assert.deepEqual(rules.catchBonus(base,perfect,control),{timing,control:care});
for(const [p,grade] of [[0,'good'],[.4,'perfect'],[.9,'good']])assert.equal(rules.hookGrade(p),grade);
assert.equal(rules.catchBonus(100,true,4).control,60);assert.equal(rules.catchBonus(100,false,-1).control,0);
assert.ok(rules.lureQuality({moving:false,pace:'slow',pause:1.2,pull:1,bottom:'sand'})>rules.lureQuality({moving:false,pace:'slow',pause:6,pull:1,bottom:'sand'}));
assert.ok(rules.lureQuality({moving:false,pace:'slow',pause:1.2,pull:1,bottom:'sand'})>rules.lureQuality({moving:true,pace:'fast',pause:0,pull:0,bottom:'sand'}));
assert.equal(rules.snagRate('fast','weed',true),1.5);assert.ok(rules.snagRate('fast','weed',false)<0);
console.log('OK: independent scoring cases, timing zones, seabed, lure rhythm, snag risk.');
if(!process.argv.includes('--browser'))process.exit(0);
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Read-only observations drive real input. Explicit fixtures cover timer and failure boundaries.
  await page.route('**/game-v3.js',async route=>{const response=await route.fetch(),source=await response.text(),at=source.lastIndexOf('})();');const bridge=`\nwindow.__fishTest={read:()=>({phase,held,score,skillBonus,combo,mode,timeMode,wind,pace,rig:{...rig},zones:{...zones},tension:fightT,biteProgress:1-biteTime/biteTotal,trip:trip.map(f=>({...f})),fishes:fishes.filter(f=>f.alive).map(f=>({id:f.id,d:f.d,origin:f.origin,kind:f.kind,size:f.size})),round,elapsed,data:JSON.parse(JSON.stringify(data))}),tick:dt=>{update(dt);paint();},fixture:name=>{if(name==='snag'){setPhase('search');rig.d=zones.weed+4;rig.x=toX(rig.d);rig.y=ground(rig.d);snagRisk=.95;held=true;pace='fast';}if(name==='bite'){fishTarget=fishes.find(f=>f.alive);biteTime=1;biteTotal=1;setPhase('bite');}if(name==='fight'){fishOn=fishes.find(f=>f.alive);fishTarget=null;rig.d=30;rig.fightStart=30;fightT=1.019;held=true;setPhase('fight');held=true;}if(name==='timeout'){round=.02;}}};\n`;await route.fulfill({response,body:source.slice(0,at)+bridge+source.slice(at)});});
  const url=`${base}/tools/sakamoto-kiss-fishing/`;
  const shot=async name=>{if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/fishing-${name}.png`});};
  const state=()=>page.evaluate(()=>window.__fishTest.read());
  const reachable=async selector=>assert.ok(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=43&&r.height>=43&&r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector+' visible and tappable');
  await page.goto(url);await page.locator('[data-mode="free"]').tap();await page.locator('#startBtn').tap();
  for(const [width,height] of [[320,568],[375,812],[768,1024],[1280,900],[812,375],[568,320]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(120);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth),false);
    for(const selector of ['#actionBtn','#sonarBtn','#menuBtn','#catalogBtn','#soundBtn','[data-pace="slow"]','[data-pace="fast"]','#finishBtn'])await reachable(selector);
    assert.ok(await page.locator('.app').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'cockpit fits viewport');await shot(`layout-${width}x${height}`);
  }
  await page.setViewportSize({width:375,height:812});await page.locator('#sonarBtn').tap();assert.equal(await page.locator('#sonarBtn').isDisabled(),true);
  const snap=await state(),target=snap.fishes.find(f=>f.kind===0&&f.d>15&&f.d<35)||snap.fishes.find(f=>f.d>15&&f.d<35),aim=Math.round(target.d);
  await page.locator('#aimRange').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},aim);
  const touch=await context.newCDPSession(page);
  const down=async()=>{const r=await page.locator('#actionBtn').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});};
  const up=async()=>touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await down();await page.waitForFunction(aim=>Math.abs(parseInt(document.querySelector('#castEstimate').textContent.replace(/[^0-9]/g,''))-aim)<=2,aim);await up();
  await page.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='search',null,{timeout:10000});await shot('search');
  await page.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='bite',null,{timeout:15000});await page.waitForFunction(()=>window.__fishTest.read().biteProgress>=.25);await shot('bite');await down();await up();
  assert.equal((await state()).phase,'fight');await shot('fight');
  let holding=false;
  const end=Date.now()+20000;
  while(Date.now()<end){const s=await state();if(s.phase!=='fight')break;if(!holding&&s.tension<.48){await down();holding=true;}else if(holding&&s.tension>.73){await up();holding=false;}await page.waitForTimeout(75);}
  if(holding)await up();
  const caught=await state();assert.ok(caught.trip.length>=1,'real cast/bite/fight should land a fish');assert.ok(caught.skillBonus>0,'precise hook and controlled fight earn a bonus');await shot('catch');
  assert.ok(caught.data.total>=1);assert.ok(await page.locator('#catchPopup').isVisible());await page.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='idle');
  // Boundary fixtures use the production update function, not physical fishing observations.
  await page.evaluate(()=>{window.__fishTest.fixture('snag');window.__fishTest.tick(.05);});assert.equal((await state()).phase,'snag');await shot('snag');
  await page.evaluate(()=>{for(let i=0;i<25;i++)window.__fishTest.tick(.05);});assert.ok(['search','nibble','bite'].includes((await state()).phase),'releasing line frees a snag');
  await page.evaluate(()=>window.__fishTest.fixture('bite'));await page.evaluate(()=>window.__fishTest.tick(1.01));assert.equal((await state()).phase,'search','late strike loses the bite');
  await page.evaluate(()=>{window.__fishTest.fixture('fight');window.__fishTest.tick(.05);});assert.equal((await state()).phase,'search','excess tension loses the fish');
  await page.locator('#catalogBtn').tap();const before=(await state()).elapsed;await page.waitForTimeout(180);assert.equal((await state()).elapsed,before,'catalog pauses gameplay');await shot('catalog');await page.locator('#closeCatalog').tap();
  await page.locator('#finishBtn').tap();await shot('result');assert.equal((await state()).phase,'over');assert.ok(await page.locator('#resultCard').textContent().then(t=>t.includes('ジャストアワセ')));
  await page.locator('#againBtn').tap();assert.equal((await state()).phase,'idle');await page.locator('#menuBtn').tap();
  await page.locator('[data-mode="daily"]').tap();assert.equal(await page.locator('[data-time="day"]').isDisabled(),true);await page.locator('#startBtn').tap();
  const first=(await state()).fishes.map(f=>[f.origin,f.kind,f.size]);await page.locator('#menuBtn').tap();await page.locator('#startBtn').tap();assert.deepEqual((await state()).fishes.map(f=>[f.origin,f.kind,f.size]),first,'same day uses the same fish layout');
  await page.evaluate(()=>{window.__fishTest.fixture('timeout');window.__fishTest.tick(.05);});assert.equal((await state()).phase,'over');assert.equal(await page.locator('#clock').textContent(),'0:00');
  await page.locator('#homeBtn').tap();await page.locator('[data-mode="quick"]').tap();await page.locator('#startBtn').tap();assert.ok((await state()).round<=120);assert.equal(await page.locator('#sonarBtn').isDisabled(),true,'quick mode starts sonar');
  // Space and Enter work on the focused primary control; a blur cancels a charge.
  await page.locator('#actionBtn').focus();await page.keyboard.down('Space');await page.waitForTimeout(160);assert.equal((await state()).held,true);await page.keyboard.up('Space');assert.equal((await state()).phase,'casting');
  await page.reload();assert.ok((await state()).data.total>=1,'old save key retains catches');assert.ok(await page.locator('#unlockText').textContent());
  await page.locator('[data-mode="challenge"]').tap();await page.locator('#startBtn').tap();assert.ok((await state()).round>179,'three-minute challenge remains available');await page.locator('#menuBtn').tap();
  await page.reload();
  await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('sakamoto-kiss-v2'));value.total=8;value.catalog.kiss={count:8,max:27.5};value.best.challenge=1234;localStorage.setItem('sakamoto-kiss-v2',JSON.stringify(value));});
  await page.reload();assert.equal(await page.locator('[data-gear="double"]').isDisabled(),false,'legacy cumulative catches unlock double hooks');assert.equal((await state()).data.catalog.kiss.max,27.5);assert.equal((await state()).data.best.challenge,1234);
  await page.locator('[data-gear="double"]').tap();await page.locator('#startBtn').tap();await page.locator('#catalogBtn').tap();assert.match(await page.locator('#catalogGrid').textContent(),/27.5cm/);await shot('legacy-catalog');
  // A clean session remains usable with unavailable storage/audio and reduced decorative motion.
  const fallback=await browser.newContext({viewport:{width:375,height:667},reducedMotion:'reduce'}),p=await fallback.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('no storage');};Storage.prototype.setItem=()=>{throw Error('no storage');};window.AudioContext=class{constructor(){throw Error('no audio');}};});
  await p.goto(url);await p.locator('[data-mode="free"]').click();await p.locator('#startBtn').click();await p.locator('#sonarBtn').click();await p.locator('#finishBtn').click();assert.ok(await p.locator('#resultOverlay').isVisible());await fallback.close();
  const prefix=await browser.newPage();await prefix.route('**/my-html-tools/**',async route=>{const response=await route.fetch({url:route.request().url().replace('/my-html-tools/','/')});await route.fulfill({response});});await prefix.goto(`${base}/my-html-tools/tools/sakamoto-kiss-fishing/`);await prefix.locator('#startBtn').click();await prefix.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='idle');await prefix.close();
  assert.deepEqual(errors,[]);
  await context.close();console.log('OK: touch cast/strike/landing; skill bonus; 6 viewport sizes; snag and escape fixtures; catalog pause; free finish; replay; save; daily repeatability; timed finish; quick sonar; keyboard.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
