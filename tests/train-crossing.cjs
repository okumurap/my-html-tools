// TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/train-crossing.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=`${base}/tools/train-crossing/`;
    const shot=async name=>{if(name.startsWith('arrival-'))await page.waitForTimeout(220);if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/crossing-${name}.png`});};
    const reachable=async selector=>{
      const result=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
      assert.ok(result,selector+' should be visible and tappable');
    };
    const layout=async mode=>{
      for(const [width,height] of [[320,568],[375,667],[375,812],[768,1024],[1280,900],[812,375],[568,320]]){
        await page.setViewportSize({width,height});await page.waitForTimeout(100);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false,'no page overflow');
        for(const selector of ['.back-link','#soundButton','#fullscreenButton',...(mode==='running'?['#hornButton','#brakeButton','#boostButton']:['#startButton','[data-train="local"]','[data-train="bullet"]','[data-train="steam"]'])])await reachable(selector);
        if(mode==='running')assert.ok(await page.locator('.speed-meter').isVisible());
        await shot(`${mode}-${width}x${height}`);
      }
    };
    await page.goto(url);await layout('idle');
    await page.setViewportSize({width:375,height:812});await page.locator('[data-train="bullet"]').tap();await page.reload();
    assert.equal(await page.locator('[data-train="bullet"]').getAttribute('aria-pressed'),'true','train choice persists');
    await page.locator('#soundButton').tap();assert.equal(await page.locator('#soundButton').getAttribute('aria-label'),'音を出す');
    await page.reload();assert.equal(await page.locator('#soundButton').getAttribute('aria-label'),'音を出す','mute persists');
    for(const [index,type] of ['local','bullet','steam'].entries()){
      await page.locator(`[data-train="${type}"]`).tap();await page.locator('#startButton').tap();assert.equal(await page.locator('body').getAttribute('data-state'),'running');
      if(index===0){
        await layout('running');await page.setViewportSize({width:375,height:812});
        await page.locator('#hornButton').tap();assert.match(await page.locator('#status').textContent(),/警笛/);
        await page.locator('#boostButton').tap();assert.equal(await page.locator('#routePhase').textContent(),'スピード アップ！');
        // Actual held touch: stop, remain stopped, release and continue.
        const r=await page.locator('#brakeButton').boundingBox(),touch=await context.newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
        await page.waitForFunction(()=>document.querySelector('#speedText').textContent==='ブレーキ！');await page.waitForTimeout(1400);
        const position=await page.locator('#journeyTrain').evaluate(el=>parseFloat(el.style.left));await page.waitForTimeout(180);
        assert.equal(await page.locator('#journeyTrain').evaluate(el=>parseFloat(el.style.left)),position,'held brake must stop movement');
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>!document.querySelector('#brakeButton').classList.contains('is-held'));
        await page.keyboard.down('ArrowDown');assert.equal(await page.locator('#brakeButton').evaluate(el=>el.classList.contains('is-held')),true);await page.keyboard.up('ArrowDown');
        await page.locator('#brakeButton').focus();await page.keyboard.down('Space');assert.equal(await page.locator('#brakeButton').evaluate(el=>el.classList.contains('is-held')),true);await page.keyboard.up('Space');
        await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#routePhase').textContent(),'スピード アップ！');
        await page.waitForFunction(()=>parseFloat(document.querySelector('#journeyTrain').style.left)>35);await shot('crossing');
        await page.waitForFunction(()=>parseFloat(document.querySelector('#journeyTrain').style.left)>68);await shot('tunnel');
      }
      await page.waitForFunction(()=>document.body.dataset.state==='done',null,{timeout:25000});
      assert.equal(await page.locator('#starCount').textContent(),'3 / 3');assert.equal(await page.locator('#tripCount').textContent(),`のった ${index+1}かい`);
      assert.equal(await page.locator('#startButton').textContent(),'▶ つぎの えきへ！');await reachable('#startButton');await shot(`arrival-${type}`);
    }
    await page.reload();assert.equal(await page.locator('#tripCount').textContent(),'のった 3かい');assert.equal(await page.locator('[data-train="steam"]').getAttribute('aria-pressed'),'true');
    // No fullscreen or storage/audio support must still leave a playable game.
    await page.evaluate(()=>{Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined,configurable:true});});
    await page.locator('#fullscreenButton').tap();assert.match(await page.locator('#toast').textContent(),/ぜんがめんに できない/);
    const quiet=await browser.newContext({viewport:{width:375,height:667},reducedMotion:'reduce'}),quietPage=await quiet.newPage();quietPage.on('pageerror',e=>errors.push(e.message));
    await quietPage.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable');};Storage.prototype.setItem=()=>{throw Error('Storage unavailable');};window.AudioContext=class{constructor(){throw Error('Audio unavailable');}};});
    await quietPage.goto(url);await quietPage.waitForTimeout(150);const still=await quietPage.locator('#game').evaluate(el=>el.toDataURL());await quietPage.waitForTimeout(180);assert.equal(await quietPage.locator('#game').evaluate(el=>el.toDataURL()),still,'reduced motion should stop decorative movement');
    await quietPage.locator('#startButton').click();await quietPage.waitForFunction(()=>document.body.dataset.state==='done',null,{timeout:25000});assert.equal(await quietPage.locator('#starCount').textContent(),'3 / 3');await quiet.close();
    // Same assets must load under the GitHub Pages repository prefix.
    const prefix=await browser.newPage();await prefix.route('**/my-html-tools/**',async route=>{const u=route.request().url().replace('/my-html-tools/','/');const response=await route.fetch({url:u});await route.fulfill({response});});
    await prefix.goto(`${base}/my-html-tools/tools/train-crossing/`);await prefix.locator('#startButton').click();await prefix.waitForFunction(()=>document.body.dataset.state==='running');await prefix.close();
    assert.deepEqual(errors,[]);await context.close();console.log('OK: 7 viewport sizes; touch controls; brake hold/release; keyboard; 3 train types; crossing/tunnel; all stars; arrival/replay; persistence; no audio/storage/fullscreen support; reduced motion; repository subpath.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
