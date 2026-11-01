import assert from 'node:assert/strict';
import {meterState} from './meter.js';
for(const value of [-150,-50,-30,-15,-5,0,5,15,30,50,150]) {
 const state=meterState(value);
 assert.equal(state.tuned,Math.abs(value)<=5);
 assert.equal(state.overflow,Math.abs(value)>50);
 if(Math.abs(value)<=5) assert.equal(state.active,10);
 else assert.equal(state.active<10,value<0);
 assert.ok(state.active>=0&&state.active<=20);
}
assert.equal(meterState(-50).active,0);
assert.equal(meterState(50).active,20);
for(const value of [null,NaN,Infinity])assert.equal(meterState(value).active,-1);
assert.match(meterState(-15).label,/低い/);
assert.match(meterState(15).label,/高い/);
console.log('Block meter: direction, center ±5, range ±50, invalid/silent states passed');
