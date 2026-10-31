import {STRINGS,Tracker,Sampler} from './pitch-detector.js';
const $=id=>document.getElementById(id), tracker=new Tracker();
const buttons=STRINGS.map((s,i)=>{const b=document.createElement('button');b.innerHTML=`${s.name}<small>${s.number}弦</small>`;b.setAttribute('aria-label',`${s.number}弦 ${s.name}${s.octave}`);b.onclick=()=>select(i);return b;});
const group=document.querySelector('.strings');buttons.forEach(b=>group.append(b));
function select(i){tracker.select(i);buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));$('auto').setAttribute('aria-pressed',String(i===null));}
$('auto').onclick=()=>select(null);select(null);
let context,stream,source,capture,worker,sampler,sink,running=false,generation=0,starting=false;
function status(text){$('status').textContent=text;}
async function stop(){generation++;running=false;starting=false;tracker.reset();worker?.terminate();worker=null;capture?.disconnect();source?.disconnect();sink?.disconnect();if(capture?.port)capture.port.onmessage=null;if(capture)capture.onaudioprocess=null;stream?.getTracks().forEach(t=>t.stop());stream=null;const old=context;context=null;capture=source=sink=sampler=null;if(old&&old.state!=='closed')await old.close().catch(()=>{});$('power').textContent='START';$('power').disabled=false;}
async function start(){
 if(starting||running)return;starting=true;const token=++generation;$('power').disabled=true;status('');
 let ctx,media;
 try{
  if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('secure');
  ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});context=ctx;
  // Resume within the user gesture, before awaiting microphone permission (Safari).
  const resumed=ctx.resume();
  media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  await resumed;if(token!==generation){media.getTracks().forEach(t=>t.stop());return;}
  stream=media;source=ctx.createMediaStreamSource(media);sink=ctx.createGain();sink.gain.value=0;sink.connect(ctx.destination);
  const receive=result=>{if(running&&token===generation)tracker.update(result,performance.now());};
  try{worker=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});worker.postMessage({rate:ctx.sampleRate});worker.onmessage=e=>receive(e.data);worker.onerror=()=>{if(token===generation){stop();status('音声解析を開始できません。再度STARTを押してください。');}};}catch{sampler=new Sampler(ctx.sampleRate,receive);}
  const feed=data=>{if(worker)worker.postMessage(data,[data.buffer]);else sampler.push(data);};
  let workletReady=false;
  if(ctx.audioWorklet){try{await ctx.audioWorklet.addModule(new URL('./audio-worklet.js',import.meta.url));workletReady=true;}catch{/* Older Safari / worklet loading failure: ScriptProcessor fallback. */}}
  if(token!==generation)return;
  if(workletReady){capture=new AudioWorkletNode(ctx,'tuner-capture');capture.port.onmessage=e=>feed(e.data);}
  else{capture=ctx.createScriptProcessor(1024,1,1);capture.onaudioprocess=e=>feed(new Float32Array(e.inputBuffer.getChannelData(0)));}
  source.connect(capture);capture.connect(sink);running=true;starting=false;$('power').disabled=false;$('power').textContent='STOP';
  media.getTracks().forEach(t=>t.onended=()=>{if(running){stop();status('マイクが切断されました。');}});
  ctx.onstatechange=()=>{if(running&&ctx.state!=='running'){stop();status('一時停止中 · STARTで再開');}};
 }catch(error){media?.getTracks().forEach(t=>t.stop());if(token!==generation)return;await stop();status(error.name==='NotAllowedError'?'マイクが許可されていません。ブラウザーの設定を確認してください。':error.message==='secure'?'HTTPS環境でマイク対応ブラウザーを使用してください。':'マイクを開始できません。接続を確認してください。');}
}
$('power').onclick=()=>running?stop().then(()=>status('')):start();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting)){stop();status('一時停止中 · STARTで再開');}});
window.addEventListener('pagehide',()=>stop());
let previous='',needlePrevious='';
let meterWidth=$('meter').clientWidth;
new ResizeObserver(()=>{meterWidth=$('meter').clientWidth;}).observe($('meter'));
function draw(time){const {index,value}=tracker.snapshot(time),s=index===null?null:STRINGS[index];const tuned=value!==null&&Math.abs(value)<=5;const key=`${index}/${value===null?'':Math.round(value)}/${tuned}`;
 if(key!==previous){previous=key;$('note').firstChild.textContent=s?s.name:'—';$('octave').textContent=s?s.octave:'';$('string-label').textContent=s?`${s.number}弦${tracker.manual===null?' · 自動':''}`:'自動';$('deviation').innerHTML=`${value===null?'—':`${value>0?'+':''}${Math.round(value)}`} <small>cents</small>`;$('range').textContent=value!==null&&Math.abs(value)>50?(value<0?'‹ −50 cents':'＋50 cents ›'):'\u00a0';$('meter').classList.toggle('in-tune',tuned);}
 const position=value===null?'neutral':String((Math.max(-50,Math.min(50,value))*meterWidth/100).toFixed(2));
 if(position!==needlePrevious){needlePrevious=position;$('needle').style.transform=`translateX(${value===null?0:position}px)`;$('needle').style.opacity=value===null?'.25':'1';}requestAnimationFrame(draw);}
requestAnimationFrame(draw);
