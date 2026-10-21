const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../tools/gyro-rush/index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log('OK: game script syntax.');
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Tests add observations and isolated collision/timer/energy fixtures to the response only.
  await page.route('**/tools/gyro-rush/',async route=>{const response=await route.fetch(),text=await response.text(),at=text.lastIndexOf('})();');const bridge=`\nwindow.__gyroTest={read:()=>({phase,mode,pointer,neutral,seen,w,h,best,energy:game?.energy,boost:game?.boost,boostUses:game?.boostUses,hp:game?.hp,elapsed:game?.elapsed,target:game?.ship.target,x:game?.ship.x}),energy:value=>{game.energy=value;hud();},quiet:()=>{game.rocks=[];game.items=[];game.spawn=999;},tick:dt=>{update(dt);draw();},collision:()=>{game.ship.inv=0;game.rocks=[{x:game.ship.x,y:game.ship.y,r:20,vy:0,rotation:0,spin:0,shape:Array(10).fill(1),near:false,awarded:false,removed:false}];update(.001);}};\n`;await route.fulfill({response,body:text.slice(0,at)+bridge+text.slice(at)});});
  const url=`${base}/tools/gyro-rush/`,state=()=>page.evaluate(()=>window.__gyroTest.read());
  const shot=async name=>{if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/gyro-${name}.png`});};
  await page.goto(url);await page.locator('#startTouch').tap();await page.evaluate(()=>window.__gyroTest.quiet());
  for(const [width,height] of [[320,568],[375,667],[375,812],[768,1024],[1280,900]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
   const area=await page.locator('#boost').boundingBox(),app=await page.locator('.app').boundingBox(),stage=await page.locator('#stage').boundingBox();
   assert.ok(Math.abs(area.width-app.width)<2,'boost surface spans the full game width');assert.ok(area.y<=stage.y+stage.height*.73,'surface includes the lower game field');assert.ok(area.y+area.height<=height+1);
   await page.evaluate(()=>window.__gyroTest.energy(50));
   for(const point of [[area.x+8,area.y+8],[area.x+area.width/2,area.y+area.height/2],[area.x+area.width-8,area.y+area.height-8]])assert.equal(await page.evaluate(([x,y])=>document.querySelector('#boost').contains(document.elementFromPoint(x,y)),point),true,'lower area must accept touches');
   await shot(`layout-${width}x${height}`);
  }
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(100);const cdp=await context.newCDPSession(page);
  const tap=async(x,y)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  const area=await page.locator('#boost').boundingBox();
  // All left/centre/right positions work, including the energy panel itself.
  for(const [name,fx,fy] of [['left',.03,.08],['centre',.5,.5],['right',.97,.95]]){
   await page.evaluate(()=>{window.__gyroTest.quiet();window.__gyroTest.energy(100);});const before=await state();await tap(area.x+area.width*fx,area.y+area.height*fy);const after=await state();
   assert.equal(after.boostUses,before.boostUses+1,name);assert.equal(after.energy,50);assert.equal(after.target,before.target,'boost touch must not steer');await shot(`boost-${name}`);
   await tap(area.x+area.width*.8,area.y+15);assert.equal((await state()).boostUses,after.boostUses,'active boost cannot charge twice');await page.evaluate(()=>window.__gyroTest.tick(2.1));
  }
  await page.evaluate(()=>window.__gyroTest.energy(49));const low=await state();await tap(area.x+5,area.y+12);assert.equal((await state()).energy,49);assert.equal((await state()).target,low.target,'low energy touches must not steer');
  // Upper field steering remains a separate pointer; a second finger can boost.
  await page.evaluate(()=>window.__gyroTest.energy(100));const rect=await page.locator('#game').boundingBox(),first={x:rect.x+40,y:rect.y+rect.height*.45,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});const steer=await state();assert.ok(steer.target<80);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,{x:area.x+area.width*.9,y:area.y+30,id:2}]});assert.equal((await state()).target,steer.target);assert.equal((await state()).energy,50);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,x:rect.x+rect.width*.8},{x:area.x+area.width*.9,y:area.y+30,id:2}]});assert.ok((await state()).target>rect.width*.7);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state()).pointer,null,'cancelled touches release steering');await page.evaluate(()=>window.__gyroTest.tick(2.1));
  // Space still works immediately after a start/resume; pause activation must not boost.
  await page.locator('#pause').tap();const elapsed=(await state()).elapsed;await page.waitForTimeout(160);assert.equal((await state()).elapsed,elapsed);await page.locator('#resume').tap();
  await page.evaluate(()=>window.__gyroTest.energy(50));await page.keyboard.press('Space');assert.equal((await state()).energy,0);await page.evaluate(()=>window.__gyroTest.tick(2.1));
  await page.evaluate(()=>window.__gyroTest.energy(100));await page.locator('#pause').focus();const uses=(await state()).boostUses;await page.keyboard.press('Space');assert.equal((await state()).phase,'paused');assert.equal((await state()).boostUses,uses);await page.locator('#resume').tap();
  await page.setViewportSize({width:812,height:375});await page.waitForTimeout(100);assert.equal((await state()).phase,'paused','short landscape orientation pauses gameplay');await page.setViewportSize({width:375,height:812});await page.locator('#resume').tap();
  await page.evaluate(()=>{window.__gyroTest.quiet();window.__gyroTest.tick(120);});assert.equal((await state()).phase,'result');await shot('result-clear');await page.locator('#again').tap();await page.evaluate(()=>window.__gyroTest.quiet());
  for(let i=0;i<3;i++)await page.evaluate(()=>window.__gyroTest.collision());assert.equal((await state()).phase,'result');assert.equal((await state()).hp,0);await shot('result-failed');await page.locator('#menu').tap();
  // Permission denied and a missing sensor event both offer usable touch controls.
  await page.evaluate(()=>{delete window.DeviceOrientationEvent;});await page.locator('#startTilt').tap();assert.match(await page.locator('#notice').textContent(),/センサーがありません/);
  await page.evaluate(()=>{window.DeviceOrientationEvent={requestPermission:()=>Promise.resolve('denied')};});await page.locator('#startTilt').tap();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('許可されません'));assert.equal((await state()).phase,'menu');
  await page.evaluate(()=>{window.DeviceOrientationEvent={requestPermission:()=>Promise.resolve('granted')};});await page.locator('#startTilt').tap();await page.evaluate(()=>window.__gyroTest.quiet());await page.waitForFunction(()=>window.__gyroTest.read().mode==='touch',null,{timeout:5000});
  // A mocked gamma stream verifies the tilt path without claiming device testing.
  await page.evaluate(()=>window.__gyroTest.tick(120));await page.locator('#menu').tap();
  await page.locator('#startTilt').tap();await page.evaluate(()=>{window.__gyroTest.quiet();const e=new Event('deviceorientation');Object.defineProperty(e,'gamma',{value:0});window.dispatchEvent(e);const r=new Event('deviceorientation');Object.defineProperty(r,'gamma',{value:20});window.dispatchEvent(r);});await page.waitForTimeout(200);assert.ok((await state()).target>250,'sensor steers right');await page.locator('#pause').tap();await page.locator('#calibrate').tap();assert.equal((await state()).neutral,20);
  await page.reload();assert.ok((await state()).best>0,'score persists');await page.locator('#sense').evaluate(el=>{el.value='1.2';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#sound').uncheck();await page.reload();assert.equal(await page.locator('#sense').inputValue(),'1.2');assert.equal(await page.locator('#sound').isChecked(),false);
  const quiet=await browser.newContext({viewport:{width:375,height:667},reducedMotion:'reduce'}),p=await quiet.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('no storage');};Storage.prototype.setItem=()=>{throw Error('no storage');};window.AudioContext=class{constructor(){throw Error('no audio');}};});await p.goto(url);await p.locator('#startTouch').click();await p.locator('#pause').click();await p.locator('#resume').click();await quiet.close();
  const prefix=await browser.newPage();await prefix.route('**/my-html-tools/**',async route=>{const response=await route.fetch({url:route.request().url().replace('/my-html-tools/','/')});await route.fulfill({response});});await prefix.goto(`${base}/my-html-tools/tools/gyro-rush/`);await prefix.locator('#startTouch').click();assert.ok(await prefix.locator('#hud').isVisible());await prefix.close();
  assert.deepEqual(errors,[]);await context.close();
  console.log('OK: 5 viewports; lower left/centre/right/footer boost; energy bounds; no steering from boost; two-touch input; keyboard; pause/rotation; clear/failure fixtures; replay; sensor denial/timeout/mock/calibration; save.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
