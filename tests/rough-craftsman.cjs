const assert=require('node:assert/strict');
const {score,rank}=require('../tools/rough-craftsman/math.js');
// Independent examples: 20mm/50mm error -> 40% penalty; .5s/2.5s -> 20%; 15°/45° -> one third.
assert.equal(score(80,100,50),60);
assert.equal(score(5500,5000,2500),80);
assert.equal(score(60,45,45),67);
assert.equal(score(100,100,50),100);
assert.equal(score(500,100,50),0);
assert.equal(score(0,100,50),0);
assert.equal(score(120,100,50),score(80,100,50));
for(const args of [[NaN,100,50],[Infinity,5,2],[1,1,0]])assert.throws(()=>score(...args),RangeError);
for(const [total,name] of [[0,'修行中'],[119,'修行中'],[120,'見習い'],[179,'見習い'],[180,'一人前'],[239,'一人前'],[240,'師匠'],[269,'師匠'],[270,'神職人'],[300,'神職人']])assert.equal(rank(total).name,name);
assert.throws(()=>rank(301),RangeError);
console.log('OK: independent scoring examples, clamping, invalid values, rank boundaries.');
if(process.argv.includes('--browser'))browserChecks().catch(error=>{console.error(error);process.exitCode=1;});
async function browserChecks(){
  const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
  const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
  try{
    const context=await browser.newContext({viewport:{width:375,height:900},hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-20T10:00:00Z')});await page.clock.pauseAt(new Date('2026-10-20T10:00:00Z'));
    const click=async id=>page.locator(`#${id}`).click();
    const widths=async label=>{for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' '+width);if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TEST_SCREENSHOT_DIR}/craft-${label}-${width}.png`,fullPage:true});}await page.setViewportSize({width:375,height:900});};
    const point=async(x,y)=>{const p=await page.locator('#board').evaluate((svg,[x,y])=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const c=p.matrixTransform(svg.getScreenCTM());return{x:c.x,y:c.y};},[x,y]);await page.touchscreen.tap(p.x,p.y);};
    await page.goto(`${base}/tools/rough-craftsman/`);await widths('home');
    await page.locator('#startBtn').tap();await widths('length');
    await point(396,150);await click('judgeBtn');assert.equal(await page.locator('#roundScore').innerText(),'100点');assert.equal(await page.locator('#lengthTarget').getAttribute('hidden'),null);await widths('length-result');
    await click('nextBtn');await click('judgeBtn');assert.equal(await page.locator('#judgeBtn').innerText(),'ここ！ 止める');await widths('time-running');await page.clock.runFor(5000);await click('judgeBtn');assert.equal(await page.locator('#roundScore').innerText(),'100点');assert.match(await page.locator('#roundActual').innerText(),/5\.00秒/);await widths('time-result');
    await click('nextBtn');await widths('angle');await point(250+Math.SQRT1_2*200,265-Math.SQRT1_2*200);await click('judgeBtn');assert.equal(await page.locator('#roundScore').innerText(),'100点');await click('nextBtn');
    assert.equal(await page.locator('#totalScore').innerText(),'300');assert.equal(await page.locator('#rankName').innerText(),'神職人');assert.equal(await page.locator('.score-row').count(),3);await widths('result');
    await context.grantPermissions(['clipboard-read','clipboard-write']);await click('copyBtn');assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/神職人 300\/300点/);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}}));await click('copyBtn');assert.equal(await page.locator('#copyFallback').isVisible(),true);assert.match(await page.locator('#copyFallback').inputValue(),/神職人 300\/300点/);
    await page.reload();assert.match(await page.locator('#bestHome').innerText(),/300点/);assert.equal(await page.locator('#playsHome').innerText(),'1');
    await click('startBtn');await click('minusBtn');await click('judgeBtn');assert.match(await page.locator('#roundActual').innerText(),/2\.9cm/);await click('nextBtn');await click('judgeBtn');await page.clock.runFor(1000);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
    assert.match(await page.locator('#judgeBtn').innerText(),/スタート/);assert.equal(await page.locator('#gameNotice').isVisible(),true);await click('judgeBtn');await page.clock.runFor(15001);assert.equal(await page.locator('#roundScore').innerText(),'0点');
    await click('nextBtn');await point(450,265);await page.keyboard.press('ArrowRight');await click('judgeBtn');assert.match(await page.locator('#roundActual').innerText(),/1\.0°/);await click('nextBtn');await click('replayBtn');assert.match(await page.locator('#roundCount').innerText(),/01/);
    page.once('dialog',d=>d.dismiss());await click('quitBtn');assert.equal(await page.locator('#game').isVisible(),true);page.once('dialog',d=>d.accept());await click('quitBtn');assert.equal(await page.locator('#home').isVisible(),true);
    await page.evaluate(()=>localStorage.setItem('rough-craftsman:v1','{broken'));await page.reload();assert.equal(await page.locator('#storageNotice').isVisible(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('rough-craftsman:v1')),'{broken');
    await click('startBtn');await click('judgeBtn');await click('nextBtn');await click('judgeBtn');await page.clock.runFor(5000);await click('judgeBtn');await click('nextBtn');await click('judgeBtn');await click('nextBtn');assert.equal(await page.evaluate(()=>localStorage.getItem('rough-craftsman:v1')),'{broken');
    page.once('dialog',d=>d.accept());await click('resetRecordBtn');assert.equal(await page.locator('#playsHome').innerText(),'0');assert.equal(await page.evaluate(()=>localStorage.getItem('rough-craftsman:v1')),null);
    await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};});
    await click('replayBtn');await click('judgeBtn');await click('nextBtn');await click('judgeBtn');await page.clock.runFor(5000);await click('judgeBtn');await click('nextBtn');await click('judgeBtn');await click('nextBtn');
    assert.equal(await page.locator('#result').isVisible(),true);assert.match(await page.locator('#storageNotice').innerText(),/保存できませんでした/);
    assert.deepEqual(errors,[]);await context.close();
    console.log('OK: 4 widths, touch input, 3-round perfect run, timeout, keyboard, results, replay, copy fallback, persistence, corrupt data, reset.');
  }finally{await browser.close();}
}
