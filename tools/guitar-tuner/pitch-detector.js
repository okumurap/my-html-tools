export const CONFIG = Object.freeze({rate:12000, window:1024, hop:192, minHz:65, maxHz:380, rms:0.0015, confidence:0.88, yin:0.12, stale:240, switchMargin:35});
export const STRINGS = [40,45,50,55,59,64].map((m,i)=>({name:['E','A','D','G','B','E'][i], octave:i===0||i===1?2:i===5?4:3, hz:440*2**((m-69)/12), number:6-i}));
export const cents = (hz,target)=>1200*Math.log2(hz/target);
// Fixed integration length avoids lag-dependent bias; CMNDF + parabolic interpolation.
export class PitchDetector {
 constructor(rate=CONFIG.rate){this.rate=rate;this.diff=new Float64Array(256);}
 detect(x){
  let energy=0,mean=0;for(const v of x)mean+=v;mean/=x.length;
  for(const v of x)energy+=(v-mean)**2;
  if(Math.sqrt(energy/x.length)<CONFIG.rms)return null;
  const max=Math.ceil(this.rate/CONFIG.minHz), min=Math.floor(this.rate/CONFIG.maxHz), n=x.length-max;const d=this.diff;d[0]=1;let sum=0;
  for(let t=1;t<=max;t++){let v=0;for(let j=0;j<n;j++){const a=x[j]-x[j+t];v+=a*a;}sum+=v;d[t]=sum?v*t/sum:1;}
  let best=-1;
  for(let t=min;t<max;t++)if(d[t]<CONFIG.yin){while(t+1<max&&d[t+1]<d[t])t++;best=t;break;}
  if(best<0)return null;
  // A strong second harmonic can form an early minimum. Prefer a substantially
  // deeper double/triple-period minimum only when the signal provides evidence.
  for(let k=2;k<=3;k++){const center=Math.round(best*k);if(center+2>=max)break;let b=center;for(let t=center-2;t<=center+2;t++)if(d[t]<d[b])b=t;if(d[b]<d[best]*0.35&&d[best]>0.04){best=b;break;}}
  const confidence=1-d[best];if(confidence<CONFIG.confidence)return null;
  const a=d[best-1],b=d[best],c=d[best+1];const offset=(a-c)/(2*(a-2*b+c))||0;
  const hz=this.rate/(best+Math.max(-1,Math.min(1,offset)));
  return hz>=CONFIG.minHz&&hz<=CONFIG.maxHz?{hz,confidence}:null;
 }
}
export class Tracker {
 constructor(){this.manual=null;this.reset();}
 reset(){this.index=null;this.value=null;this.last=-Infinity;this.pending=null;}
 select(index){this.manual=index;this.reset();}
 update(result,time){
  if(!result||result.confidence<CONFIG.confidence)return;
  const distances=STRINGS.map(s=>Math.abs(cents(result.hz,s.hz)));let next=this.manual??distances.indexOf(Math.min(...distances));
  if(this.manual===null&&this.index!==null&&next!==this.index&&distances[next]+CONFIG.switchMargin>=distances[this.index])next=this.index;
  const raw=cents(result.hz,STRINGS[next].hz), changed=next!==this.index;
  // Confirm isolated large jumps once, but let a new string attack through immediately.
  if(!changed&&this.value!==null&&Math.abs(raw-this.value)>35){if(this.pending===null||Math.abs(raw-this.pending)>12){this.pending=raw;return;}}
  this.pending=null;const dt=Math.min(100,time-this.last);this.last=time;
  const alpha=1-Math.exp(-dt/(Math.abs(raw-(this.value??raw))>8?20:65));
  this.value=changed||this.value===null?raw:this.value+alpha*(raw-this.value);this.index=next;
 }
 snapshot(time){if(time-this.last>CONFIG.stale){this.value=null;this.pending=null;return {index:this.manual,value:null};}return {index:this.index,value:this.value};}
}
// Streaming box integration before decimation suppresses high-frequency aliases.
export class Sampler {
 constructor(rate,callback){this.rate=rate;this.callback=callback;this.phase=0;this.sum=0;this.count=0;this.pos=0;this.filled=0;this.hop=0;this.ring=new Float32Array(CONFIG.window);this.frame=new Float32Array(CONFIG.window);this.detector=new PitchDetector();}
 push(input){for(const v of input){this.sum+=v;this.count++;this.phase+=CONFIG.rate;if(this.phase<this.rate)continue;this.phase-=this.rate;this.ring[this.pos]=this.sum/this.count;this.sum=0;this.count=0;this.pos=(this.pos+1)%CONFIG.window;this.filled++;if(++this.hop>=CONFIG.hop&&this.filled>=CONFIG.window){this.hop=0;for(let i=0;i<CONFIG.window;i++)this.frame[i]=this.ring[(this.pos+i)%CONFIG.window];this.callback(this.detector.detect(this.frame));}}}
}
