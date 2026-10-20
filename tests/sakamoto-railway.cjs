// TEST_BASE_URL=http://localhost:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/sakamoto-railway.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/tools/sakamoto-railway/`);await page.locator('#dutyStartBtn').tap();
    const screenshot=async name=>{if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/rail-${name}.png`,fullPage:true});};
    for(const [width,height] of [[320,740],[375,812],[768,1024],[1280,900],[812,375]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} overflow`);
      for(const selector of ['.scene-wrap','.drive-readout','.controls','.speed-history','.speed-chart-viewport']){
        const rect=await page.locator(selector).boundingBox();assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,selector+' outside screen');
      }
      const scenery=await page.locator('.scene-wrap').boundingBox();
      assert.ok(scenery.height>=(width<=760?260:height<520?180:250));
      assert.equal(await page.locator('.scene-wrap #speed').count(),0);
      assert.equal(await page.locator('.drive-readout #speed').count(),1);
      assert.equal(await page.locator('.drive-readout #speedLimit').count(),1);
      assert.equal(await page.locator('.drive-readout #statusBadge').count(),1);
      await screenshot(`layout-${width}x${height}`);
    }
    await page.setViewportSize({width:375,height:812});
    // Preserve the actual driving controls after moving their readouts.
    await page.locator('#doorBtn').tap();await page.locator('[data-kind="brake"] .drag-notch[data-index="0"]').tap();await page.locator('[data-kind="power"] .drag-notch[data-index="0"]').tap();
    await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)>1);
    await page.locator('[data-kind="brake"] .drag-notch[data-index="5"]').tap();await page.waitForFunction(()=>document.querySelector('#brakeValue').textContent==='非常');
    await page.locator('#announceBtn').tap();await page.locator('#resetBtn').tap();await page.waitForFunction(()=>document.querySelector('#speed').textContent==='0'&&document.querySelector('#doorValue').textContent==='開');
    await page.locator('.speed-chart-zoom').selectOption('4');
    const ratio=await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollWidth/el.clientWidth);assert.ok(ratio>3.9&&ratio<4.1);
    // Feed fixed route positions into the DOM contract used by the telemetry layer.
    await page.evaluate(()=>{window.testRoutePercent=50;Object.defineProperty(document.querySelector('#routeProgress').style,'width',{configurable:true,get:()=>`${window.testRoutePercent}%`,set:()=>{}});});
    await page.waitForFunction(()=>document.querySelector('.speed-chart-viewport').scrollLeft>100);
    const cursor=await page.locator('.speed-chart-viewport').evaluate(el=>{const w=el.querySelector('canvas').getBoundingClientRect().width;return{expected:8+.5*(w-16)-el.clientWidth*.4,actual:el.scrollLeft};});
    assert.ok(Math.abs(cursor.expected-cursor.actual)<2,'50% position should be inside the zoomed viewport');
    await page.locator('.speed-chart-viewport').scrollIntoViewIfNeeded();
    const rect=await page.locator('.speed-chart-viewport').boundingBox();
    const before=await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft);
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width*.75,y:rect.y+80}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*.75-i*20,y:rect.y+80}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
    assert.equal(await page.locator('.speed-chart-follow').getAttribute('aria-pressed'),'false');
    assert.ok(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft)>before+20,'touch swipe should scroll the graph');
    await screenshot('zoomed-touch');
    await page.locator('.speed-chart-follow').tap();assert.equal(await page.locator('.speed-chart-follow').getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(150);assert.ok(Math.abs((await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft))-cursor.expected)<2);
    // Fixed y-axis remains in place while the plot scrolls.
    assert.equal(await page.locator('.speed-chart-axis span').count(),5);
    for(const [pos,minimum] of [[0,0],[100,800]]){
      await page.evaluate(pos=>{window.testRoutePercent=pos;},pos);await page.waitForTimeout(180);
      const left=await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft);
      if(pos===0)assert.equal(left,0);else assert.ok(left>minimum);
    }
    await page.evaluate(()=>{delete document.querySelector('#routeProgress').style.width;});
    await page.locator('#resetBtn').tap();await page.waitForTimeout(150);assert.equal(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft),0);
    await page.locator('.speed-chart-zoom').selectOption('2');assert.ok(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollWidth/el.clientWidth)>1.9);
    await page.locator('.speed-chart-zoom').selectOption('1');assert.equal(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollWidth-el.clientWidth),0);
    await page.locator('.speed-history>summary').tap();assert.equal(await page.locator('.speed-chart-viewport').isVisible(),false);await page.locator('.speed-history>summary').tap();assert.equal(await page.locator('.speed-chart-viewport').isVisible(),true);
    await page.locator('.duty-change-btn').tap();assert.equal(await page.locator('#dutySelection').isVisible(),true);await page.locator('[data-duty-group="weather"][data-duty-value="rain"]').tap();await page.locator('#dutyStartBtn').tap();assert.equal(await page.locator('body').getAttribute('data-weather'),'rain');
    assert.deepEqual(errors,[]);await context.close();
    console.log('OK: 4 widths + landscape; wider scenery; readouts; driving/door/emergency/reset; 1x/2x/4x; touch scroll; follow/manual control; 0/50/100% cursor; collapse; duty change.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
