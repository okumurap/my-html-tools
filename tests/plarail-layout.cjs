const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../tools/plarail-layout/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const math={};vm.runInNewContext(script.slice(script.indexOf('function trackPoint('),script.indexOf('function trainPose('))+'globalThis.point=trackPoint;globalThis.length=trackLength;',math);
// Independent quarter-circle midpoints and straight lines, in tile units.
for(const [entry,exit,p,x,y] of [['W','E',.5,.5,.5],['N','E',.5,1-Math.SQRT1_2/2,Math.SQRT1_2/2],['E','S',.5,1-Math.SQRT1_2/2,1-Math.SQRT1_2/2],['S','W',.5,Math.SQRT1_2/2,1-Math.SQRT1_2/2]]){
 const point=math.point(entry,exit,p);assert.ok(Math.abs(point.x-x)<1e-10&&Math.abs(point.y-y)<1e-10,entry+exit);
}
assert.equal(math.length('W','E'),1);assert.ok(Math.abs(math.length('N','E')-Math.PI/4)<1e-12);
console.log('OK: independent rail geometry, arc length and syntax.');
if(!process.argv.includes('--browser'))process.exit(0);
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright'),base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
 try{
 const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tools/plarail-layout/',async route=>{const response=await route.fetch(),text=await response.text(),at=text.lastIndexOf('})();');const bridge=`window.__railTest={read:()=>({grid:JSON.parse(JSON.stringify(grid)),running,mode,zoom,panMode,view,trains:trains.map(t=>({...t,cars:carPoses(t)})),gates:[...crossingGates.entries()]}),advance:seconds=>{const was=running;running=true;for(let left=seconds;left>1e-8;left-=.02){const dt=Math.min(.02,left);trains.forEach(t=>updateTrain(t,dt));updateCrossings(dt,performance.now());}running=was;updateRunDetails();draw();},fixture:name=>{running=false;demo();revision++;const t=trains[0];if(name==='curve')Object.assign(t,{x:10,y:1,entry:'W',exit:'S',p:.1});if(name==='branch'){grid[1][2].a=true;Object.assign(t,{x:2,y:1,entry:'W',exit:'N',p:.8});}if(name==='crossing')Object.assign(t,{x:9,y:6,entry:'W',exit:'E',p:.8});if(name==='end'){grid[1][2].a=true;Object.assign(t,{x:2,y:0,entry:'S',exit:'N',p:1});}ensureTrain(t);updateCrossings(.8,performance.now());draw();}};`;await route.fulfill({response,body:text.slice(0,at)+bridge+text.slice(at)});});
 const url=`${base}/tools/plarail-layout/`,state=()=>page.evaluate(()=>window.__railTest.read());
 const shot=async name=>{if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/railtown-${name}.png`});};
 const cell=async(x,y)=>{const {view:v}=await state();const r=await page.locator('#cv').boundingBox();return {x:r.x+v.ox+(x+.5)*v.c,y:r.y+v.oy+(y+.5)*v.c};};
 const tapCell=async(x,y)=>{const p=await cell(x,y);await page.touchscreen.tap(p.x,p.y);};
 await page.goto(url);
 for(const [width,height] of [[320,568],[375,812],[768,1024],[1280,900],[812,375]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
  for(const selector of ['#save','#load','#sound','#help','#zoomIn','#panView','[data-mode="run"]','[data-tool="curve"]'])assert.ok(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=43&&r.height>=43&&r.top>=0&&r.bottom<=innerHeight+1&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector+' visible and tappable');
  await shot(`layout-${width}x${height}`);
 }
 await page.setViewportSize({width:375,height:812});await page.locator('[data-mode="run"]').tap();await page.locator('#start').tap();await page.waitForTimeout(200);assert.equal((await state()).trains[0].status,'停車・乗降中');assert.equal((await state()).trains[0].cars.length,3);await shot('station');await page.waitForTimeout(1800);assert.ok((await state()).trains[0].velocity>0);await page.locator('#start').tap();
 await page.evaluate(()=>window.__railTest.fixture('curve'));
 for(let i=0;i<10;i++){
  await page.evaluate(()=>window.__railTest.advance(.1));const train=(await state()).trains[0];assert.equal(train.cars.length,3);
  for(const car of train.cars){const expected=math.point(car.entry,car.exit,car.p);assert.ok(Math.hypot(car.x-car.cellX-expected.x,car.y-car.cellY-expected.y)<.025,'car follows actual rail, including a curve');}
 }
 await page.locator('#zoomIn').tap();await page.locator('#zoomIn').tap();await shot('curve-zoom');await page.locator('#zoomFit').tap();
 await page.evaluate(()=>window.__railTest.fixture('branch'));await tapCell(2,1);assert.equal((await state()).grid[1][2].a,true,'occupied switch stays locked');assert.match(await page.locator('#toast').textContent(),/通過中/);
 await page.evaluate(()=>window.__railTest.advance(1));const branch=(await state()).trains[0];assert.ok(branch.cars.some(p=>p.cellX===2&&p.cellY===0),'front follows selected branch');assert.ok(branch.cars.some(p=>p.cellX===2&&p.cellY===1),'tail remains on actual approach');await shot('switch-branch');
 await page.evaluate(()=>window.__railTest.fixture('crossing'));assert.equal((await state()).gates.find(([key])=>key==='8,6')[1].alarm,true,'gate remains closed for the tail');await page.evaluate(()=>window.__railTest.advance(3));assert.equal((await state()).gates.find(([key])=>key==='8,6')[1].alarm,false,'gate opens after entire train clears');
 await page.evaluate(()=>window.__railTest.fixture('end'));const before=(await state()).trains[0].cars;await page.evaluate(()=>window.__railTest.advance(.01));const reversed=(await state()).trains[0];assert.equal(reversed.status,'折り返し');
 for(const car of before)assert.ok(reversed.cars.some(next=>Math.hypot(car.x-next.x,car.y-next.y)<.03),'reversal swaps the cab without moving the train');await page.evaluate(()=>window.__railTest.advance(3));assert.equal((await state()).trains[0].cars.length,3);
 // Run multiple laps through curves, a station and a crossing using bounded time steps.
 await page.evaluate(()=>{window.__railTest.fixture('default');window.__railTest.advance(110);});const laps=(await state()).trains[0];assert.ok(laps.stops>=3);assert.equal(laps.cars.length,3);
 await page.locator('[data-mode="edit"]').tap();await page.locator('[data-tool="straight"]').tap();await tapCell(0,4);assert.equal((await state()).grid[4][0].r,0);await tapCell(0,4);assert.equal((await state()).grid[4][0].r,1);await page.locator('#undo').tap();assert.equal((await state()).grid[4][0].r,0);
 const touch=await context.newCDPSession(page),position=await cell(0,4);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[position]});await page.waitForTimeout(600);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).grid[4][0],null);
 const cancel=await cell(0,5);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[cancel]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state()).grid[5][0],null,'cancelled touch does not place a piece');
 // Zoom/pan never edits the board, and Fit restores the complete board.
 const grid=(await state()).grid,originalCell=(await state()).view.c;for(let i=0;i<4;i++)await page.locator('#zoomIn').tap();assert.ok(Math.abs((await state()).view.c-originalCell*2)<.01);await page.locator('#panView').tap();
 const r=await page.locator('#cv').boundingBox(),origin=(await state()).view.ox;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-70,r.y+r.height/2+20,{steps:5});await page.mouse.up();assert.ok((await state()).view.ox<origin);assert.deepEqual((await state()).grid,grid);await shot('zoom-pan');await page.locator('#panView').tap();await page.locator('#zoomFit').tap();assert.equal((await state()).zoom,1);
 await page.locator('#save').tap();const saved=await page.evaluate(()=>localStorage.getItem('railTownV2'));await page.locator('#demo').tap();await page.locator('#load').tap();assert.deepEqual((await state()).grid,grid);assert.equal((await state()).trains[0].cars.length,3);
 await page.evaluate(()=>localStorage.setItem('railTownV2',JSON.stringify({grid:[]})));await page.locator('#load').tap();assert.deepEqual((await state()).grid,grid,'invalid save leaves the board intact');
 await page.evaluate(saved=>{localStorage.setItem('railTownV2',saved);const data=JSON.parse(saved);data.trains=data.trains.map(({x,y,entry,exit,p,pause,lastStop,color})=>({x,y,entry,exit,p,pause,lastStop,color}));localStorage.setItem('railTownV2',JSON.stringify(data));},saved);await page.locator('#load').tap();assert.equal((await state()).trains[0].cars.length,3,'legacy single-car saves remain usable');
 await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};});await page.locator('#save').tap();assert.match(await page.locator('#toast').textContent(),/保存できませんでした/);await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;delete window.savedSetItem;});
 await page.locator('#help').tap();await shot('help');await page.locator('#close').tap();await page.locator('#sound').tap();assert.equal(await page.locator('#sound').textContent(),'🔇');assert.deepEqual(errors,[]);await context.close();
 const prefix=await browser.newPage();await prefix.route('**/my-html-tools/**',async route=>{const response=await route.fetch({url:route.request().url().replace('/my-html-tools/','/')});await route.fulfill({response});});await prefix.goto(`${base}/my-html-tools/tools/plarail-layout/`);await prefix.locator('[data-mode="run"]').click();await prefix.locator('#start').click();await prefix.close();
 console.log('OK: 5 viewports; 3-car curved paths; station dwell/departure; locked switch; full-train crossing; reversal; laps; touch editing/undo/delete/cancel; zoom/pan; save/legacy/invalid load; help/sound; repository prefix.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
