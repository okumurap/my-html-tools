'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{chromium}=require(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000',shots=process.env.TEST_SCREENSHOT_DIR;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_PATH||'/usr/bin/chromium'});try{
 const page=await browser.newPage({hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tools/screw-diameter-comparator/');
 const diameter=async(side,index)=>page.locator('#d'+side).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},index);
 async function checkGeometry(){
  const rows=await page.evaluate(()=>{
   const axis=document.querySelector('.position-axis'),labels=axis.querySelectorAll('text');
   const limit=Number(labels[labels.length-1].textContent.replace(' mm',''));
   const screen=(svg,x,y)=>new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()).x;
   const left=screen(axis,24,8),right=screen(axis,496,8);
   return [...document.querySelectorAll('.position-lane')].map(lane=>{
    const svg=lane.querySelector('svg'),meter=lane.querySelector('.position-meter'),cushion=lane.querySelector('.position-cushion'),vp=lane.querySelector('.position-vp');
    const values=[...lane.querySelectorAll('dd')].map(el=>Number(el.textContent.replace(' mm','').replaceAll(',','')));
    const points=[Number(meter.getAttribute('x'))+Number(meter.getAttribute('width'))/2,Number(vp.getAttribute('d').match(/^M([\d.]+)/)[1]),Number(cushion.getAttribute('cx'))];
    return {limit,axisLeft:left,axisRight:right,laneLeft:screen(svg,24,26),laneRight:screen(svg,496,26),actual:points.map(x=>screen(svg,x,26)),expected:values.map(v=>left+v/limit*(right-left))};
   });
  });
  for(const row of rows){assert(Math.abs(row.laneLeft-row.axisLeft)<.5,`axis origin shifted ${row.laneLeft-row.axisLeft}px`);assert(Math.abs(row.laneRight-row.axisRight)<.5,`axis end shifted ${row.laneRight-row.axisRight}px`);row.actual.forEach((x,i)=>assert(Math.abs(x-row.expected[i])<.5,`marker ${i} shifted ${x-row.expected[i]}px`));}
 }
 // Check the rendered screen coordinates, rather than only the SVG's numeric attributes.
 for(const width of [1280,1920,768,375,320]){
  await page.setViewportSize({width,height:900});await checkGeometry();
  for(const c of [{diameter:0,volume:10000,meter:'32.10 mm',vp:'11.11 mm'},{diameter:2,volume:32000,meter:'49.79 mm',vp:'11.99 mm'},{diameter:4,volume:90000,meter:'66.59 mm',vp:'12.83 mm'}]){
   await diameter('A',c.diameter);await diameter('B',c.diameter);await page.locator('#volumeNumber').fill(String(c.volume));assert.equal(await page.locator('.position-a dd').nth(0).textContent(),c.meter);assert.equal(await page.locator('.position-a dd').nth(1).textContent(),c.vp);await checkGeometry();
  }
  await diameter('A',0);await diameter('B',4);await page.locator('#volumeNumber').fill('10000');await checkGeometry();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.locator('.position-card').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'screw-axis-'+width+'.png')})}
  await page.locator('#volumeNumber').fill('0');await checkGeometry();await page.locator('#volumeNumber').fill('999999');await checkGeometry();
 }
 assert.deepEqual(errors,[]);console.log('PASS: actual axis/marker alignment within 0.5px at 320/375/768/1280/1920px; 3 independent positions; asymmetric A/B; zero/max; no overflow');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
