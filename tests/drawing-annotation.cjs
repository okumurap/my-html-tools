'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
new vm.Script(fs.readFileSync('tools/drawing-annotation/script.js','utf8'));
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000',shots=process.env.TEST_SCREENSHOT_DIR;
const DB='drawing-annotation:v1';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_PATH||'/usr/bin/chromium'});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const ready=async(p=page)=>{await p.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false')};
    const go=async(p=page)=>{await p.goto(base+'/tools/drawing-annotation/');await ready(p)};
    const saved=async(p=page)=>{await p.waitForFunction(()=>document.getElementById('st-save').textContent==='端末に保存済み');await p.waitForTimeout(350)};
    const doc=async(p=page)=>p.evaluate(db=>new Promise((resolve,reject)=>{const r=indexedDB.open(db,1);r.onsuccess=()=>{const d=r.result,t=d.transaction('drafts'),q=t.objectStore('drafts').get('current');t.oncomplete=()=>{if(q.result?.image)q.result.image.bytes=q.result.image.blob.size;resolve(q.result);d.close()};t.onabort=()=>reject(t.error)};r.onerror=()=>reject(r.error)}),DB);
    const png=async()=>{const download=page.waitForEvent('download');await page.locator('#btn-save').click();return fs.readFileSync(await(await download).path())};
    async function shot(name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')})}}
    async function point(x,y){const r=await page.locator('#fgCanvas').boundingBox();const dims=await page.locator('#st-frame').textContent(),m=dims.match(/(\d+)×(\d+)/);return {x:r.x+x*r.width/Number(m[1]),y:r.y+y*r.height/Number(m[2])}}
    async function drag(x,y,x2,y2){const a=await point(x,y),b=await point(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up()}
    await go();assert.equal(await page.locator('#draftWarning').isHidden(),true);
    const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=400;const x=c.getContext('2d');x.fillStyle='#dce6f0';x.fillRect(0,0,640,400);x.strokeStyle='#334455';x.lineWidth=2;x.strokeRect(25,25,590,350);x.fillStyle='#334455';x.font='22px sans-serif';x.fillText('SAMPLE 01',30,55);return c.toDataURL().split(',')[1]});
    const upload=async(p=page)=>{await p.locator('#fileInput').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await p.waitForFunction(()=>document.querySelector('#st-frame').textContent.includes('640×400'));await saved(p)};
    await upload();
    await drag(40,250,180,290);await saved();
    for(const [tool,args]of [['rect',[70,80,210,150]],['ellipse',[260,90,340,180]],['arrow',[390,90,480,160]],['line',[390,210,510,260]]]){await page.locator(`[data-tool="${tool}"]`).click();await drag(...args);await saved()}
    await page.locator('[data-tool=text]').click();const label=await point(250,240);await page.touchscreen.tap(label.x,label.y);await page.locator('#textInput').fill('12');await page.locator('#textInput').press('Enter');await saved();
    let current=await doc();assert.equal(current.items.length,6);assert.equal(current.settings.nextNumber,2);assert.equal(current.image.bytes,Buffer.from(image,'base64').length);
    // Selection and resizing must persist the final geometry, not history reference objects.
    await page.locator('[data-tool=select]').click();await drag(100,110,130,140);await saved();current=await doc();assert.ok(Math.abs(current.items.find(i=>i.tool==='rect').rect.x-100)<2);
    await drag(240,180,260,200);await saved();const rect=(await doc()).items.find(i=>i.tool==='rect').rect;assert.ok(rect.w>150&&rect.h>80);
    await page.locator('#hudLabel').click();await page.locator('#hudPen').click();await page.locator('[data-color=blue]').click();await page.locator('[data-size="1"]').click();await saved();
    const snapshot=await doc(),before=await png();assert.ok(before.length>1000);
    await page.reload();await ready();assert.match(await page.locator('#st-frame').textContent(),/640×400/);
    assert.equal(await page.locator('[data-color=blue]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#hudLabel').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#hudPen').getAttribute('aria-pressed'),'false');
    assert.deepEqual((await doc()).items,snapshot.items);assert.deepEqual(await png(),before,'image and every annotation must survive reload exactly');
    // Restored annotations remain editable; deleting, undoing and redoing all save correctly.
    await drag(130,145,150,165);await saved();await page.keyboard.press('Delete');await saved();assert.equal((await doc()).items.length,5);
    await page.locator('#btn-undo').click();await saved();assert.equal((await doc()).items.length,6);await page.locator('#btn-redo').click();await saved();assert.equal((await doc()).items.length,5);await page.reload();await ready();assert.equal((await doc()).items.length,5);
    // Eraser removes a crossing line, Undo restores it; no deleted items reappear after reload.
    await page.locator('[data-tool=eraser]').click();await drag(440,190,440,270);await saved();assert.equal((await doc()).items.length,4);await page.locator('#btn-undo').click();await saved();assert.equal((await doc()).items.length,5);
    // OS theme changes all chrome but must not change source or exported pixels.
    const lightPNG=await png();await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).colorScheme),'dark');assert.deepEqual(await png(),lightPNG);
    for(const scheme of ['light','dark'])for(const [width,height]of [[320,568],[375,812],[768,1024],[1280,900]]){
      await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width,height});await page.locator('#btn-reset').click();await page.waitForTimeout(100);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
      const r=await page.locator('#scroll').boundingBox();assert.ok(r.height>150&&r.y>0&&r.y+r.height<=height);
      for(const selector of ['#btn-open','#btn-zoom-in','#hudAuto','[data-tool=pen]']){await page.locator(selector).scrollIntoViewIfNeeded();const b=await page.locator(selector).boundingBox();assert.ok(b.height>=44&&b.width>=44,selector)}
      await page.locator('.toolbar-controls').evaluate(e=>e.scrollLeft=0);await page.locator('#hud').evaluate(e=>e.scrollLeft=0);await shot(scheme+'-'+width);
    }
    await page.setViewportSize({width:1280,height:900});await page.emulateMedia({colorScheme:'light'});await saved();
    // Failed image import leaves the current document and persisted image intact.
    const preserved=await doc();await page.locator('#fileInput').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.waitForFunction(()=>document.getElementById('message').dataset.level==='error');assert.deepEqual((await doc()).items,preserved.items);assert.match(await page.locator('#st-frame').textContent(),/640×400/);
    // Last image operation wins even if an older decode finishes later.
    await page.evaluate(()=>{const original=window.createImageBitmap;let count=0;window.createImageBitmap=async(...args)=>{if(++count===1)await new Promise(r=>setTimeout(r,400));return original(...args)}});
    await page.locator('#fileInput').setInputFiles({name:'slow.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
    const small=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=200;return c.toDataURL().split(',')[1]});await page.locator('#fileInput').setInputFiles({name:'latest.png',mimeType:'image/png',buffer:Buffer.from(small,'base64')});await page.waitForTimeout(600);await saved();assert.match(await page.locator('#st-frame').textContent(),/320×200/);assert.equal((await doc()).items.length,0);
    // Quota/transaction failure: keep the old saved draft and current ink; retry saves it.
    await page.evaluate(()=>{window.realPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Quota','QuotaExceededError')}});await page.locator('[data-tool=pen]').click();await drag(40,60,160,100);await page.waitForFunction(()=>!document.getElementById('draftWarning').hidden);assert.equal((await doc()).items.length,0);const failedPNG=await png();assert.ok(failedPNG.length>500);await shot('save-failure');await page.evaluate(()=>IDBObjectStore.prototype.put=window.realPut);await page.locator('#retryDraft').click();await saved();assert.equal((await doc()).items.length,1);assert.deepEqual(await png(),failedPNG);
    // Another tab must not silently overwrite a newer saved document.
    const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));await go(other);await drag(80,120,220,150);await saved();const authoritative=await doc();await other.locator('[data-color=green]').click();await other.waitForFunction(()=>!document.getElementById('draftWarning').hidden);assert.match(await other.locator('#draftWarning').textContent(),/別のタブ/);assert.equal((await doc()).revision,authoritative.revision);await other.close();
    // Corrupt saved data is preserved, even if the user draws on the fallback blank canvas.
    const corrupt=await browser.newContext(),cp=await corrupt.newPage();cp.on('pageerror',e=>errors.push(e.message));await go(cp);await cp.evaluate(db=>new Promise(resolve=>{const r=indexedDB.open(db,1);r.onsuccess=()=>{const d=r.result,t=d.transaction('drafts','readwrite');t.objectStore('drafts').put({version:1,revision:8,frame:{width:-1,height:3}},'current');t.oncomplete=()=>{d.close();resolve()}}}),DB);await cp.reload();await ready(cp);assert.match(await cp.locator('#draftWarning').textContent(),/上書きしません/);await cp.locator('#fgCanvas').click({position:{x:50,y:50}});await cp.waitForTimeout(400);assert.equal((await doc(cp)).revision,8);await corrupt.close();
    // Storage denial still permits drawing and PNG export instead of leaving a loading screen.
    const denied=await browser.newContext();await denied.addInitScript(()=>{IDBFactory.prototype.open=function(){throw new DOMException('Denied','SecurityError')}});const dp=await denied.newPage();dp.on('pageerror',e=>errors.push(e.message));await go(dp);assert.ok(await dp.locator('#draftWarning').isVisible());await dp.locator('#fgCanvas').click({position:{x:80,y:80}});assert.ok(await dp.locator('#btn-undo').isEnabled());await denied.close();
    // Pages subdirectory resolves the same app and stylesheet.
    const prefix=await context.newPage();await prefix.route('**/my-html-tools/**',async route=>{const response=await route.fetch({url:route.request().url().replace('/my-html-tools/','/')});await route.fulfill({response})});await prefix.goto(base+'/my-html-tools/tools/drawing-annotation/');await ready(prefix);assert.ok(await prefix.locator('#fgCanvas').isVisible());await prefix.close();
    assert.deepEqual(errors,[]);console.log('OK: source image + editable pen/shapes/labels restore; move/resize/delete/eraser/Undo/Redo; settings; unchanged PNG in dark mode; 8 layouts; import failure/race; quota/retry; conflicting tabs; corrupt draft; denied storage; Pages prefix.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
