import assert from 'node:assert/strict';
import {PitchDetector,Tracker,Sampler,STRINGS,cents,CONFIG} from './pitch-detector.js';
let seed=42;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296-.5;};
function signal(hz,rate=12000,harmonics=[1],noise=0,amplitude=.2){return Float32Array.from({length:CONFIG.window},(_,i)=>amplitude*(harmonics.reduce((v,a,k)=>v+a*Math.sin(2*Math.PI*hz*(k+1)*i/rate+.3*k),0)+noise*random()));}
let count=0,maxError=0;
for(const s of STRINGS)for(const detune of [-50,-30,-15,-5,0,5,15,30,50])for(const harmonics of [[1],[.1,1,.7,.4],[0,1,.8,.4]])for(const noise of [0,.05]){
 const hz=s.hz*2**(detune/1200),result=new PitchDetector().detect(signal(hz,12000,harmonics,noise));assert.ok(result,`${s.name}${s.octave} ${detune}`);const error=Math.abs(cents(result.hz,hz));maxError=Math.max(maxError,error);assert.ok(error<2,`error ${error} at ${hz}`);count++;
}
const d=new PitchDetector();assert.equal(d.detect(new Float32Array(1024)),null);assert.equal(d.detect(Float32Array.from({length:1024},random)),null);assert.ok(d.detect(signal(82.41,12000,[1],0,.003)));
for(const rate of [44100,48000]){let result;const sampler=new Sampler(rate,r=>result=r);sampler.push(Float32Array.from({length:rate/5},(_,i)=>.2*Math.sin(2*Math.PI*STRINGS[0].hz*i/rate)));assert.ok(Math.abs(cents(result.hz,STRINGS[0].hz))<2);}
const t=new Tracker();const r=(i,c=0)=>({hz:STRINGS[i].hz*2**(c/1200),confidence:.99});t.update(r(0),0);assert.equal(t.index,0);t.update(r(5),16);assert.equal(t.index,5);t.select(0);t.update(r(5),32);assert.equal(t.index,0);assert.ok(t.value>2000);assert.equal(t.snapshot(300).value,null);t.select(null);t.update(r(2),320);assert.equal(t.index,2);
t.update(r(2,30),336);t.update(r(2,30),352);assert.ok(t.value>20);for(let i=0;i<100;i++)t.update(r(2,30+(i%2?.5:-.5)),368+i*16);assert.ok(Math.abs(t.value-30)<.2);
t.update(r(2,-40),2000);assert.ok(t.value>20,'isolated outlier rejected');t.update(null,2200);assert.equal(t.snapshot(2300).value,null);
console.log(`${count} synthetic pitch cases passed; maximum error ${maxError.toFixed(3)} cents. Silence/noise/low level, sample rates, tracking, selection, stale and outlier tests passed.`);
