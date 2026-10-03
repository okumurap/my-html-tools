// Requires a local HTTP server and Playwright, without adding a project dependency.
// TEST_PLAYWRIGHT_MODULE=/path/to/playwright node tests/flag-learner.cjs
const assert = require('node:assert/strict');
const {chromium} = require(process.env.TEST_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({headless:true, channel:process.env.TEST_BROWSER_CHANNEL || 'chrome'});
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const open = () => page.goto(`${base}/tools/flag-learner/`);
  const click = id => page.locator(`#${id}`).click();
  const overflow = async () => assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const answerCode = async () => [...await page.locator('#quizPrompt').innerText()].map(char=>String.fromCharCode(char.codePointAt(0)-127397)).join('');
  try {
    await open();
    await page.waitForFunction(()=>document.querySelectorAll('#countryLayer path').length>0);
    assert.equal(await page.locator('#quizSetup').isVisible(),true);
    assert.equal(await page.locator('.country-tile').count(),195);
    let regionTotal=0;
    for(const region of ['Asia','Europe','Africa','North America','South America','Oceania']){
      await page.locator('#quizRegion').selectOption(region);
      regionTotal+=parseInt(await page.locator('#setupHint').innerText(),10);
    }
    assert.equal(regionTotal,195);await page.locator('#quizRegion').selectOption('all');
    for(const width of [320,375,768,1280]){
      await page.setViewportSize({width,height:900}); await overflow();
      await click('mapTab');await overflow();await click('quizTab');
    }
    await page.setViewportSize({width:375,height:812});
    await page.screenshot({path:'/tmp/flag-mobile-home.png',fullPage:true});
    await page.locator('#quizLength').selectOption('5');await click('startQuiz');
    const wrong=[];
    for(let i=0;i<5;i++){
      const code=await answerCode();
      assert.equal(await page.locator('.choice').count(),4);
      if(i<2){wrong.push(code);await page.locator(`.choice:not([data-code="${code}"])`).first().click();}
      else await page.locator(`.choice[data-code="${code}"]`).click();
      assert.equal(await page.locator('.choice:disabled').count(),4);
      if(i===0){await click('answerMap');assert.equal(await page.locator('#countryCard').isVisible(),true);await click('resumeQuiz');assert.match(await page.locator('#quizNumber').innerText(),/1 \/ 5/);}
      if(i===2) await click('markKnown');
      for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:812});await overflow();}
      await page.setViewportSize({width:375,height:812});
      if(i===2) await page.screenshot({path:'/tmp/flag-mobile-question.png',fullPage:true});
      await click('nextQuestion');
    }
    assert.equal(await page.locator('#quizResultScore').innerText(),'3 / 5');
    for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:812});await overflow();}
    await click('retryMistakes');
    for(let i=0;i<2;i++){const code=await answerCode();assert.ok(wrong.includes(code));await page.locator(`.choice[data-code="${code}"]`).click();await click('nextQuestion');}
    assert.equal(await page.locator('#quizResultScore').innerText(),'2 / 2');
    assert.equal(await page.locator('#retryMistakes').isVisible(),false);
    await click('resultHome');await page.locator('#quizDirection').selectOption('name-to-flag');await click('startQuiz');
    assert.equal(await page.locator('.choice-label').count(),0);
    assert.equal(await page.locator('.choice').first().getAttribute('aria-label'),'国旗の選択肢 1');
    await page.locator('.choice').first().click();assert.equal(await page.locator('.choice-label').count(),4);
    await click('mapTab');await page.locator('#countrySearch').fill('Japan');
    assert.equal(await page.locator('.country-tile').count(),1);await page.locator('.country-tile').click();
    await page.locator('[data-status="known"]').click();
    assert.equal(await page.locator('#countryName').innerText(),'日本');
    await click('searchButton');
    const before=await page.locator('#worldMap').getAttribute('viewBox');await click('zoomIn');
    assert.notEqual(await page.locator('#worldMap').getAttribute('viewBox'),before);await click('zoomReset');
    assert.equal(await page.locator('#worldMap').getAttribute('viewBox'),'0 0 1000 500');
    await page.locator('#showFlags').uncheck();
    await page.locator('#countrySearch').fill('Germany');await click('searchButton');
    await page.locator('#countryLayer [data-code="DE"]').click();
    assert.equal(await page.locator('#countryName').innerText(),'ドイツ');
    await page.screenshot({path:'/tmp/flag-atlas.png',fullPage:true});
    await page.locator('#atlasStatus').selectOption('known');
    assert.equal(await page.locator('.country-tile[data-code="JP"]').count(),1);
    await page.locator('#atlasStatus').selectOption('none');
    assert.equal(await page.locator('.country-tile[data-code="JP"]').count(),0);
    await page.locator('#atlasStatus').selectOption('all');
    await page.reload();await click('mapTab');
    await page.locator('#countrySearch').fill('日本');await page.locator('.country-tile').click();
    assert.equal(await page.locator('[data-status="known"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#showFlags').isChecked(),false);
    await page.locator('#countrySearch').fill('x'.repeat(300));assert.equal(await page.locator('.country-tile').count(),0);await overflow();
    await page.locator('#countrySearch').fill('');await page.locator('#mapRegion').selectOption('Oceania');
    assert.equal(await page.locator('.country-tile').count(),14);
    // Existing storage format must remain readable. Unsupported values are discarded.
    await page.evaluate(()=>localStorage.setItem('flag-learner:v1',JSON.stringify({statuses:{JP:'known',BR:'learning',XX:'known',FR:'bad'},showFlags:false})));
    await page.reload();assert.equal(await page.locator('#knownCount').innerText(),'1');assert.equal(await page.locator('#learningCount').innerText(),'1');
    await page.locator('#quizRegion').selectOption('South America');await click('startReview');
    assert.match(await page.locator('#quizNumber').innerText(),/1 \/ 1/);
    // Map request failure must not prevent regional quizzes.
    await page.route('**/world.geojson',route=>route.abort());await page.reload();
    await page.locator('#quizRegion').selectOption('Oceania');assert.match(await page.locator('#setupHint').innerText(),/^14か国/);
    await page.locator('#quizLength').selectOption('20');await click('startQuiz');assert.match(await page.locator('#quizNumber').innerText(),/1 \/ 14/);
    await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
    await page.locator('.choice').first().click();assert.equal(await page.locator('#storageNotice').isVisible(),true);
    await page.evaluate(()=>localStorage.clear());await page.reload();
    await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/flag-dark.png',fullPage:true});
    await page.evaluate(()=>localStorage.setItem('flag-learner:v1','{broken'));await page.reload();
    assert.equal(await page.locator('#knownCount').innerText(),'0');
    assert.deepEqual(errors,[]);
    const touch=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
    const tp=await touch.newPage();await tp.goto(`${base}/tools/flag-learner/`);
    await tp.locator('#startQuiz').tap();await tp.locator('.choice').first().tap();await tp.locator('#nextQuestion').tap();
    assert.match(await tp.locator('#quizNumber').innerText(),/2 \/ 10/);await touch.close();
    console.log('OK: 4 widths; both directions; quiz/result/retry; atlas/search/regions; map zoom; persistence/legacy data; map/storage failure; touch; no runtime errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
