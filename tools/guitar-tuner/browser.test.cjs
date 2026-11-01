const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.TEST_BROWSER_PATH||undefined,headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:width<400?667:900});await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8000')+'/tools/guitar-tuner/');await page.waitForSelector('.strings button');assert.equal(await page.locator('.strings button').count(),6);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));await page.locator('.strings button').first().click();assert.equal(await page.locator('.strings button').first().getAttribute('aria-pressed'),'true');await page.locator('#auto').click();if(width===375&&process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT});}
await page.setViewportSize({width:375,height:667});
// Inject known analysis results at the Worker boundary and verify visible blocks.
let detune = null;
await page.route('**/analysis-worker.js', route => route.fulfill({contentType:'text/javascript',body:`onmessage=()=>{};setInterval(()=>postMessage(${detune===null?'null':JSON.stringify({hz:82.4068892282175*2**(detune/1200),confidence:.99})}),16);`}));
for (const value of [-30,0,30,80,null]) {
 detune=value;
 await page.reload();
 await page.locator('#power').click();
 await page.waitForFunction(()=>document.querySelector('#power').textContent==='STOP');
 await page.waitForTimeout(180);
 const active=await page.locator('.block.active').evaluateAll(nodes=>nodes.map(n=>Array.from(n.parentNode.children).indexOf(n)));
 assert.deepEqual(active,value===null?[]:[value===-30?4:value===0?10:value===30?16:20]);
 assert.equal(await page.locator('#meter').evaluate(el=>el.classList.contains('in-tune')),value===0);
 assert.equal(await page.locator('#meter').evaluate(el=>el.classList.contains('overflow')),value===80);
 assert.equal(await page.locator('#deviation').evaluate(el=>getComputedStyle(el).position),'absolute');
 if(value===30&&process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT});
 await page.locator('#power').click();
 await page.waitForTimeout(40);
 assert.equal(await page.locator('.block.active').count(),0);
}
await page.unroute('**/analysis-worker.js');await page.reload();
await page.locator('#power').click();await page.waitForFunction(()=>document.querySelector('#power').textContent==='STOP');await page.waitForTimeout(600);await page.locator('#power').click();assert.equal(await page.locator('#power').textContent(),'START');await page.locator('#power').click();await page.waitForFunction(()=>document.querySelector('#power').textContent==='STOP');await page.locator('#power').click();
// Exercise the ScriptProcessor capture fallback while retaining Worker analysis.
await page.addInitScript(()=>Object.defineProperty(AudioContext.prototype,'audioWorklet',{get:()=>undefined}));await page.reload();await page.locator('#power').click();await page.waitForFunction(()=>document.querySelector('#power').textContent==='STOP');await page.waitForTimeout(300);await page.locator('#power').click();
// Rewrite only the hosting prefix to simulate GitHub Pages subpath serving.
await page.route('**/my-html-tools/**',route=>route.continue({url:route.request().url().replace('/my-html-tools/','/')}));
await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8000')+'/my-html-tools/tools/guitar-tuner/');await page.waitForSelector('.strings button');assert.equal(await page.locator('.strings button').count(),6);
await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});await page.reload();await page.locator('#power').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('許可'));assert.equal(await page.locator('#power').isEnabled(),true);assert.deepEqual(errors,[]);console.log('Browser: 4 widths, manual/auto, fake microphone start/stop/restart, denied permission passed');await browser.close();})();
