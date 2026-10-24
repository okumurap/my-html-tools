'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
new vm.Script(fs.readFileSync('tools/screw-diameter-comparator/script.js','utf8'));
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000',shots=process.env.TEST_SCREENSHOT_DIR;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_PATH||'/usr/bin/chromium'});try{
  const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tools/screw-diameter-comparator/');
  const text=id=>page.locator('#'+id).textContent();
  const diameter=async(side,index)=>page.locator('#d'+side).evaluate((e,i)=>{e.value=i;e.dispatchEvent(new Event('input',{bubbles:true}))},index);
  const volume=async(value)=>page.locator('#volumeNumber').fill(String(value));
  async function check(side,vp,metering,travel){assert.equal(await text('vpPosition'+side),vp+' mm');assert.equal(await text('meteringPosition'+side),metering+' mm');assert.equal(await text('vpTravel'+side),travel+' mm')}
  await check('A','12.50','60.00','47.50');await check('B','11.91','48.28','36.37');
  // Independent references: S=V/(144π), V/(256π), V/(506.25π).
  // S = 22.1048532072, 39.7887357730, 56.5884242105 mm respectively.
  // VP=10+0.05S, metering=10+S, travel=0.95S. Round only displayed results.
  for(const c of [{index:0,v:10000,vp:'11.11',meter:'32.10',travel:'21.00'}, {index:2,v:32000,vp:'11.99',meter:'49.79',travel:'37.80'}, {index:4,v:90000,vp:'12.83',meter:'66.59',travel:'53.76'}]){
    await diameter('A',c.index);await diameter('B',c.index);await volume(c.v);await check('A',c.vp,c.meter,c.travel);await check('B',c.vp,c.meter,c.travel);
    const lane=page.locator('.position-a');assert.match(await lane.locator('svg').getAttribute('aria-label'),new RegExp(c.meter+' mm'));const meterX=await lane.locator('.position-meter').getAttribute('x'),vpPath=await lane.locator('.position-vp').getAttribute('d');assert.ok(Number(meterX)+6>Number(vpPath.match(/^M([\d.]+)/)[1]));
    assert.equal(await lane.locator('dd').nth(1).textContent(),c.vp+' mm');
  }
  // The smaller area leaves a larger residual position for the same remaining volume.
  await diameter('A',0);await diameter('B',4);await volume(10000);assert.equal(await text('vpPositionA'),'11.11 mm');assert.equal(await text('vpPositionB'),'10.31 mm');
  const xs=await page.locator('.position-meter').evaluateAll(els=>els.map(e=>Number(e.getAttribute('x'))));assert.ok(xs[0]>xs[1]);assert.equal(await page.locator('#strokeNumberA').inputValue(),'22');
  // Bidirectional stroke/volume links and both diameter sliders update the new outputs.
  await diameter('B',2);await page.locator('#strokeNumberB').fill('50');assert.equal(await page.locator('#volumeNumber').inputValue(),'40212');assert.equal(await text('vpPositionB'),'12.50 mm');assert.equal(await text('strokeDriver'),'B側');
  await page.locator('#strokeRangeA').evaluate(e=>{e.value=50;e.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.locator('#volumeNumber').inputValue(),'22619');assert.equal(await text('vpPositionA'),'12.50 mm');assert.equal(await text('strokeDriver'),'A側');
  await page.locator('#volumeRange').evaluate(e=>{e.value=10000;e.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await text('vpPositionA'),'11.11 mm');assert.equal(await text('strokeDriver'),'体積スライダー');
  // Existing speed/rpm conversion stays active, including zero-speed undefined time.
  await page.locator('#speedNumberB').fill('100');assert.equal(await page.locator('#speedNumberA').inputValue(),'178');await page.locator('#rpmNumberB').fill('100');assert.equal(await page.locator('#rpmNumberA').inputValue(),'133');const vpBefore=await text('vpPositionA');await page.locator('#speedNumberA').fill('0');assert.equal(await text('timeA'),'―');assert.equal(await text('vpPositionA'),vpBefore);
  for(const input of ['', '-1', '0', 'not-a-number']){
    if(input==='not-a-number')await page.locator('#volumeNumber').evaluate(e=>{e.value='bad';e.dispatchEvent(new Event('input',{bubbles:true}))});else await volume(input);
    await check('A','10.00','10.00','0.00');await check('B','10.00','10.00','0.00');assert.match(await text('positionSummary'),/クッション位置で重なります/);
  }
  // Upper bounds and diameter changes clamp the common volume and recalculate positions.
  await diameter('B',0);await volume(999999);assert.equal(await page.locator('#volumeNumber').inputValue(),'90477');await check('A','20.00','210.00','190.00');await diameter('A',4);await diameter('B',4);await volume(200000);await diameter('A',0);assert.equal(await page.locator('#volumeNumber').inputValue(),'90477');assert.equal(await text('vpPositionA'),'20.00 mm');
  await diameter('A',1);await diameter('B',2);await volume(30788);await page.locator('#speedNumberA').fill('50');
  assert.match(await page.locator('.vp-basis').textContent(),/クッション10 mm・95％充填/);assert.match(await page.locator('.vp-basis').textContent(),/0 mm/);
  for(const [width,height] of [[320,568],[375,812],[768,1024],[1280,900]]){
    await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const side of ['A','B']){await page.locator('#vpPosition'+side).scrollIntoViewIfNeeded();assert.ok(await page.locator('#vpPosition'+side).isVisible());assert.ok(await page.locator('#vpPosition'+side).evaluate(e=>e.scrollWidth<=e.clientWidth));}
    await page.locator('#positionDiagram').scrollIntoViewIfNeeded();if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'vp-'+width+'.png')})}
  }
  await page.setViewportSize({width:375,height:812});await page.locator('#dA').tap();assert.match(await text('vpPositionA'),/^\d+\.\d{2} mm$/);
  const prefix=await context.newPage();await prefix.route('**/my-html-tools/**',async route=>{const response=await route.fetch({url:route.request().url().replace('/my-html-tools/','/')});await route.fulfill({response})});await prefix.goto(base+'/my-html-tools/tools/screw-diameter-comparator/');assert.equal(await prefix.locator('#vpPositionA').textContent(),'12.50 mm');await prefix.close();assert.deepEqual(errors,[]);
  console.log('OK: 3 independent VP references; unrounded strokes; A/B common volume; both stroke and volume links; speed/rpm regression; zero/empty/negative/non-numeric/max; 4 widths; touch; Pages prefix.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
