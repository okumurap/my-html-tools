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
    for(const [width,height] of [[320,568],[320,740],[375,667],[375,812],[390,844],[768,1024],[1280,900],[812,375],[568,320]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} overflow`);
      for(const selector of ['.scene-wrap','.drive-readout','.controls']){
        const rect=await page.locator(selector).boundingBox();assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,selector+' outside screen');
      }
      const scenery=await page.locator('.scene-wrap').boundingBox();
      const fit=await page.locator('html').evaluate(el=>el.classList.contains('rail-fit'));
      assert.ok(scenery.height>=80);
      if(fit){
        const plot=await page.locator('.live-telemetry .speed-chart-canvas').boundingBox();
        assert.ok(plot.height>=86,'live graph should have a larger readable plot');
        if(width===375&&height===812)assert.ok(plot.height>=120&&scenery.height<340,'give more height to the graph');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false,`${width}x${height} vertical overflow`);
        for(const selector of ['.live-telemetry .speed-chart-canvas','#doorBtn','#announceBtn','#resetBtn','.chart-open-btn','[data-kind="power"] .drag-notch[data-index="0"]','[data-kind="power"] .drag-notch[data-index="5"]','[data-kind="brake"] .drag-notch[data-index="5"]']){
          const rect=await page.locator(selector).boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=height+1,selector+' clipped');
          assert.equal(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,selector+' covered');
        }
        await page.locator('.chart-open-btn').tap();await page.waitForTimeout(80);
        const dialog=await page.locator('#telemetryDialog').evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,scroll:el.scrollHeight,height:el.clientHeight}));
        assert.ok(dialog.top>=0&&dialog.bottom<=height+1&&dialog.scroll<=dialog.height+1,`graph panel needs vertical scrolling: ${width}x${height} ${JSON.stringify(dialog)}`);
        await page.locator('.telemetry-close').tap();
        await page.waitForFunction(()=>document.querySelector('.live-telemetry canvas')?.getBoundingClientRect().height>0);
        assert.equal(await page.locator('.speed-chart-canvas').count(),1);
        // Layout fixtures verify that score screens also keep their exit action in view.
        for(const [overlay,button] of [['#stationEvaluation','#stationEvalContinue'],['#resultModal','#retryBtn']]){
          await page.locator(overlay).evaluate(el=>{el.hidden=false;});
          const action=await page.locator(button).boundingBox();assert.ok(action.y>=0&&action.y+action.height<=height+1,button+' clipped');
          await page.locator(overlay).evaluate(el=>{el.hidden=true;});
        }
      }
      assert.equal(await page.locator('.scene-wrap #speed').count(),0);
      assert.equal(await page.locator('.drive-readout #speed').count(),1);
      assert.equal(await page.locator('.drive-readout #speedLimit').count(),1);
      assert.equal(await page.locator('.drive-readout #statusBadge').count(),1);
      await screenshot(`layout-${width}x${height}`);
    }
    await page.setViewportSize({width:375,height:812});
    await page.waitForTimeout(120);
    const stoppedView=await page.locator('#scene').evaluate(el=>el.toDataURL());
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#scene').evaluate(el=>el.toDataURL()),stoppedView,'scenery should stay still at a stop');
    // Preserve the actual driving controls after moving their readouts.
    await page.locator('#doorBtn').tap();await page.locator('[data-kind="brake"] .drag-notch[data-index="0"]').tap();{
      const guide=await page.locator('[data-kind="power"] .drag-guide').boundingBox(),touch=await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:guide.x+guide.width/2,y:guide.y+guide.height-1}]});
      for(let i=1;i<=5;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:guide.x+guide.width/2,y:guide.y+guide.height*(1-i/5)}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)>1);
    assert.notEqual(await page.locator('#scene').evaluate(el=>el.toDataURL()),stoppedView,'scenery should advance with the train');
    assert.ok(await page.locator('.live-telemetry .speed-chart-now').isVisible());
    await page.waitForFunction(()=>parseInt(document.querySelector('.live-telemetry .speed-chart-now').textContent)>0);
    await screenshot('live-driving');
    await page.waitForTimeout(400); // Let the emulated drag gesture settle before a separate tap.
    await page.locator('[data-kind="brake"] .drag-notch[data-index="5"]').tap();await page.waitForFunction(()=>document.querySelector('#brakeValue').textContent==='非常');
    await page.locator('#announceBtn').tap();await page.locator('#resetBtn').tap();await page.waitForFunction(()=>document.querySelector('#speed').textContent==='0'&&document.querySelector('#doorValue').textContent==='開');
    await page.evaluate(()=>{window.originalSpeedGraph=document.querySelector('.speed-chart-canvas');});
    await page.locator('.chart-open-btn').tap();
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
    await page.locator('.telemetry-close').tap();
    await page.waitForFunction(()=>document.querySelector('.live-telemetry canvas')===window.originalSpeedGraph);
    assert.equal(await page.locator('.speed-chart-zoom').inputValue(),'4');
    assert.ok(await page.locator('.live-telemetry .speed-chart-viewport').evaluate(el=>el.scrollWidth/el.clientWidth)>3.9);
    await page.locator('#resetBtn').tap();await page.locator('.chart-open-btn').tap();await page.waitForTimeout(150);assert.equal(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollLeft),0);
    await page.locator('.speed-chart-zoom').selectOption('2');assert.ok(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollWidth/el.clientWidth)>1.9);
    await page.locator('.speed-chart-zoom').selectOption('1');assert.equal(await page.locator('.speed-chart-viewport').evaluate(el=>el.scrollWidth-el.clientWidth),0);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.live-telemetry canvas'));assert.equal(await page.locator('#telemetryDialog').getAttribute('open'),null);
    assert.equal(await page.locator('.chart-open-btn').getAttribute('aria-expanded'),'false');
    await page.locator('.chart-open-btn').tap();await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(120);
    assert.equal(await page.locator('#telemetryDialog').getAttribute('open'),null);assert.equal(await page.locator('.speed-history').isVisible(),true);
    await page.locator('.speed-history>summary').click();assert.equal(await page.locator('.speed-chart-viewport').isVisible(),false);await page.locator('.speed-history>summary').click();
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(120);
    assert.equal(await page.locator('#telemetryDialog').getAttribute('open'),null);
    // Reduced browser height and simulated safe-area padding must not hide controls.
    await page.setViewportSize({width:375,height:620});
    const inset=await page.addStyleTag({content:'.rail-fit #app{padding:24px 18px 20px!important}'});
    const door=await page.locator('#doorBtn').boundingBox();assert.ok(door.y+door.height<=600);await inset.evaluate(el=>el.remove());
    await page.setViewportSize({width:375,height:812});
    await page.locator('.duty-change-btn').tap();assert.equal(await page.locator('#dutySelection').isVisible(),true);await page.locator('[data-duty-group="weather"][data-duty-value="rain"]').tap();await page.locator('#dutyStartBtn').tap();assert.equal(await page.locator('body').getAttribute('data-weather'),'rain');
    const rainView=await page.locator('#scene').evaluate(el=>el.toDataURL());
    await page.waitForTimeout(220);
    assert.notEqual(await page.locator('#scene').evaluate(el=>el.toDataURL()),rainView,'rain and wipers should move while the train is stopped');
    assert.equal(await page.locator('.scene-weather-layer').evaluate(el=>getComputedStyle(el,'::before').content),'none','remove the repeating stripe overlay');
    for(const [width,height] of [[320,568],[375,812],[768,1024],[1280,900],[812,375]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(160);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(await page.locator('html').evaluate(el=>el.classList.contains('rail-fit'))){
        assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
        for(const selector of ['.live-telemetry canvas','#doorBtn']){
          assert.equal(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'rain must stay out of the controls and chart');
        }
      }
      await screenshot(`rain-${width}x${height}`);
    }
    await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);
    const quietRain=await page.locator('#scene').evaluate(el=>el.toDataURL());await page.waitForTimeout(220);
    assert.equal(await page.locator('#scene').evaluate(el=>el.toDataURL()),quietRain,'reduced motion should freeze the rain and park the wiper');
    await screenshot('rain-reduced-motion');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(120);
    assert.notEqual(await page.locator('#scene').evaluate(el=>el.toDataURL()),quietRain,'rain motion should resume');
    await page.locator('.chart-open-btn').tap();assert.ok(await page.locator('#telemetryDialog .speed-chart-viewport').isVisible());await page.locator('.telemetry-close').tap();
    await page.locator('.duty-change-btn').tap();await page.locator('[data-duty-group="weather"][data-duty-value="clear"]').tap();await page.locator('#dutyStartBtn').tap();await page.waitForTimeout(120);
    assert.equal(await page.locator('#scene').evaluate(el=>el.toDataURL()),stoppedView,'clear weather should remove all rain effects');
    assert.deepEqual(errors,[]);await context.close();
    console.log('OK: portrait/landscape sizes; no page scroll; always-visible live graph; reachable controls; graph modal; rotation; safe-area padding; readouts; driving/door/emergency/reset; 1x/2x/4x; touch scroll; follow/manual control; 0/50/100% cursor; collapse; duty change; rain at multiple sizes; reduced motion; weather restoration.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
