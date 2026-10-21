(()=>{'use strict';const $=id=>document.getElementById(id),c=$('scene'),x=c.getContext('2d'),stations=[['S車庫',0],['滑走台跡前',1400],['河和海岸',2900],['釣り桟橋',4200]];let s={pos:0,speed:0,power:0,brake:8,doors:true,next:1,time:32400,score:0,stop:0,safety:100,comfort:100,finished:false,last:performance.now(),ann:false,emg:false,sound:true,msg:0};const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),limit=p=>p<300?35:p>1220&&p<1550?40:p>2550&&p<3120?45:p>3900?30:60,fmt=t=>{t=Math.floor(t)%86400;return`${String(t/3600|0).padStart(2,'0')}:${String(t%3600/60|0).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`};function say(t){if(s.sound&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='ja-JP';speechSynthesis.speak(u)}}function msg(a,b,d=2600){$('messageTitle').textContent=a;$('messageBody').textContent=b;$('messagePanel').classList.remove('hidden');s.msg=performance.now()+d}function vib(p=20){navigator.vibrate?.(p)}function buttons(){document.querySelectorAll('[data-power]').forEach(b=>b.classList.toggle('active',+b.dataset.power===s.power));document.querySelectorAll('[data-brake]').forEach(b=>b.classList.toggle('active',+b.dataset.brake===s.brake))}function power(v){if(s.finished)return;s.power=v;s.emg=false;buttons();vib(12)}function brake(v){if(s.finished)return;s.brake=v;s.emg=false;buttons();vib(12)}function emergency(){s.power=0;s.brake=8;s.emg=true;s.safety-=8;s.comfort-=12;buttons();msg('非常ブレーキ','危険回避以外では使用しないでください。');vib([80,40,80])}function doors(){if(s.speed>.4)return msg('ドア操作できません','完全に停止してから操作してください。');const target=stations[s.next];if(!s.doors){if(target&&Math.abs(s.pos-target[1])>35)return msg('ここは駅ではありません','停止位置まで運転してください。');s.doors=true;s.power=0;buttons();say(`${target?.[0]||'駅'}、到着です。`);if(target)stop(target)}else{s.doors=false;say('ドアが閉まります。ご注意ください。');msg('戸閉めよし','ブレーキを解除して発車してください。')}vib(25)}function stop(st){const e=Math.abs(s.pos-st[1]),pt=Math.round(clamp(100-e*2.2,0,100));s.stop+=pt;s.score+=pt;msg(e<3?'ピタリ停車！':e<8?'良い停止です':'停止位置に注意',`停止誤差 ${e.toFixed(1)} m／${pt} pt`,4000);if(s.next===stations.length-1)return setTimeout(finish,1200);s.next++;s.ann=false}function finish(){if(s.finished)return;s.finished=true;const a=Math.round(s.stop/(stations.length-1)),safe=Math.round(clamp(s.safety,0,100)),com=Math.round(clamp(s.comfort,0,100)),total=Math.round(a*.5+safe*.3+com*.2),rank=total>=95?'S':total>=85?'A':total>=70?'B':total>=55?'C':'D';$('finalScore').textContent=total+'点';$('stopScore').textContent=a+'点';$('safetyScore').textContent=safe+'点';$('comfortScore').textContent=com+'点';$('resultRank').textContent=rank;$('resultComment').textContent=rank==='S'?'模範運転士です。停止も乗り心地も完璧でした。':rank==='A'?'とても安定した運転でした。':'完走お疲れさまでした。早めのブレーキを意識しましょう。';$('resultModal').hidden=false;say(`終点、釣り桟橋です。評価は${rank}ランク、${total}点でした。`)}function reset(){s={pos:0,speed:0,power:0,brake:8,doors:true,next:1,time:32400,score:0,stop:0,safety:100,comfort:100,finished:false,last:performance.now(),ann:false,emg:false,sound:s.sound,msg:0};$('resultModal').hidden=true;buttons();msg('S電鉄 海岸線','ドアを閉め、ブレーキを解除して、マスコンを入れてください。',4500)}function physics(dt){if(s.finished)return;let a=0;if(!s.doors&&s.power)a=(.22+s.power*.19)*clamp(1-s.speed/92,.12,1);a-=s.brake*.17+(s.emg?1.1:0)+(s.speed>.1?.035+s.speed*.001:0);if(s.doors&&s.power){s.power=0;buttons();msg('力行できません','ドアを閉めてください。')}s.speed=Math.max(0,s.speed/3.6+a*dt)*3.6;if(s.speed<.05)s.speed=0;s.pos+=s.speed/3.6*dt;s.time+=dt*3.2;if(s.brake>=7&&s.speed>20)s.comfort-=dt*.45;const lim=limit(s.pos);if(s.speed>lim+2){s.safety-=dt*.8;msg('速度超過',`制限速度 ${lim} km/hです。`,1200)}const t=stations[s.next];if(!t)return;const d=t[1]-s.pos;if(d<500&&d>0&&!s.ann){s.ann=true;$('stationBoardName').textContent=t[0];$('stationBoard').hidden=false;setTimeout(()=>$('stationBoard').hidden=true,2400);say(`まもなく、${t[0]}です。`)}if(d<-55){s.safety-=20;s.next++;s.ann=false;msg('駅を通過',`${t[0]}を通過しました。停止得点は0点です。`,3000);if(s.next>=stations.length)finish()}}function ui(){const t=stations[s.next]||stations.at(-1),d=Math.max(0,Math.round(t[1]-s.pos)),lim=limit(s.pos);$('speed').textContent=Math.round(s.speed);$('needle').style.transform=`translate(-50%,-100%) rotate(${-135+270*clamp(s.speed/120,0,1)}deg)`;$('speedLimit').textContent=lim;$('nextStation').textContent=t[0];$('distance').textContent=d.toLocaleString('ja-JP');$('clock').textContent=fmt(s.time);$('powerValue').textContent=s.power?'P'+s.power:'切';$('brakeValue').textContent=s.emg?'非常':s.brake?'B'+s.brake:'解除';$('doorValue').textContent=s.doors?'開':'閉';$('comfortValue').textContent=Math.round(clamp(s.comfort,0,100));$('score').textContent=Math.round(s.score)+' pt';$('routeProgress').style.width=clamp(s.pos/4200*100,0,100)+'%';$('doorBtn').classList.toggle('open',s.doors);$('doorBtnText').textContent=s.doors?'ドアを閉める':'ドアを開ける';let st=s.doors?'停車中':s.speed>lim+2?'速度超過':d<300?'駅接近':s.speed?'走行中':'発車待ち';$('statusBadge').textContent=st;$('statusBadge').className='status-badge '+(st==='速度超過'?'danger':st==='駅接近'?'warn':'');document.querySelectorAll('.station-dot').forEach((e,i)=>{e.classList.toggle('passed',i<s.next);e.classList.toggle('current',i===s.next)})}function resize(){
  const rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
  if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
}
// Metre-based perspective keeps sleepers, rails and wayside objects moving together.
function draw(){
  if(!c.dataset.scenery){c.dataset.scenery='perspective';c.parentElement.classList.add('perspective-scenery');}
  const w=c.width,h=c.height,hor=h*.39,f=Math.min(w*.92,h*1.55),eye=2.8;
  const seed=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
  const project=(lateral,height,depth)=>({x:w*.5+lateral*f/depth,y:hor+(eye-height)*f/depth});
  const polygon=(points,color)=>{x.fillStyle=color;x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();x.fill();};
  const strip=(left,right,near,far,color,height=0)=>polygon([project(left,height,near),project(right,height,near),project(right,height,far),project(left,height,far)],color);
  const line=(a,b,color,width=1)=>{x.strokeStyle=color;x.lineWidth=width;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();};
  const sky=x.createLinearGradient(0,0,0,hor);sky.addColorStop(0,'#6f9fb5');sky.addColorStop(.65,'#bed4dc');sky.addColorStop(1,'#e5e9e2');x.fillStyle=sky;x.fillRect(0,0,w,h);
  // Soft, distant cloud banks rather than foreground cartoon circles.
  for(let i=0;i<9;i++){
    const cx=(seed(i+7)*1.3-.15)*w-s.pos*.001,cy=h*(.07+seed(i+12)*.13);
    const cloud=x.createRadialGradient(cx,cy,0,cx,cy,w*.19);cloud.addColorStop(0,'#ffffff65');cloud.addColorStop(1,'#ffffff00');
    x.save();x.translate(0,cy*.7);x.scale(1,.3);x.fillStyle=cloud;x.fillRect(0,-h,w,h*4);x.restore();
  }
  for(let layer=0;layer<3;layer++){
    const points=[{x:0,y:hor+h*.035}];
    for(let i=0;i<=48;i++){const u=i/48;points.push({x:u*w,y:hor-h*(.035+layer*.026)*(1+Math.sin(u*8+layer*2+s.pos*.00004)*.45+Math.sin(u*21+layer)*.15)});}
    points.push({x:w,y:hor+h*.035});polygon(points,['#b5c5c4','#9bafac','#809b94'][layer]);
  }
  const ground=x.createLinearGradient(0,hor,0,h);ground.addColorStop(0,'#939c7f');ground.addColorStop(1,'#6e7952');x.fillStyle=ground;x.fillRect(0,hor,w,h-hor);
  // The sea stays beside the embankment, beyond a narrow coastal road.
  const coast=[project(17,0,2),project(17,0,450),{x:w,y:hor},{x:w,y:h}];
  const sea=x.createLinearGradient(0,hor,0,h);sea.addColorStop(0,'#a6bdc1');sea.addColorStop(.35,'#668f9d');sea.addColorStop(1,'#376c7c');polygon(coast,sea);
  x.save();x.beginPath();coast.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();x.clip();
  for(let i=0;i<34;i++){
    const yy=hor+(h-hor)*(i/34)**2,xx=seed(i+41)*w;
    line({x:xx,y:yy},{x:xx+w*(.02+.07*seed(i)),y:yy},i%3?'#d5e2db45':'#f4eee080',Math.max(.5,h*.001));
  }
  x.restore();
  strip(14,17,1,450,'#b6ac91');strip(8,11.5,1,450,'#727c79');strip(9.6,9.7,1,450,'#d5d1b9');
  // Small patches give grass and the embankment depth without image downloads.
  for(let i=0;i<180;i++){
    const world=Math.floor(s.pos/4)*4+i*4,z=world-s.pos;if(z<2)continue;
    for(const side of[-1,1]){
      const lateral=side*(2.5+seed(world+side)*4.8),p=project(lateral,0,z),radius=Math.min(w*.12,f/z*(.2+seed(world+9)*.8));
      x.fillStyle=['#88916b','#7e8960','#646f4d','#a2a17b'][i%4];x.beginPath();x.ellipse(p.x,p.y,radius,Math.max(.3,radius*.16),0,0,Math.PI*2);x.fill();
    }
  }
  strip(-2.1,2.1,1,450,'#555955');strip(-1.8,1.8,1,450,'#7c7c70');
  // Sparse deterministic ballast flecks, anchored to the route rather than time.
  for(let i=0;i<700;i++){
    const world=Math.floor(s.pos/.35)*.35+i*.35,z=world-s.pos;if(z<1.5)continue;
    const side=seed(world+1)*3.5-1.75,p=project(side,.015,z),size=Math.min(7,f/z*.07);
    x.fillStyle=i%2?'#b5b1a0':'#454b47';x.fillRect(p.x,p.y,Math.max(.5,size),Math.max(.5,size*.45));
  }
  const firstSleeper=Math.floor(s.pos/.65);
  for(let i=190;i>=0;i--){
    const z=(firstSleeper+i)*.65-s.pos;if(z<1.2)continue;
    strip(-1.18,1.18,z,z+.19,'#77776b',.04);
    line(project(-1.18,.075,z+.06),project(1.18,.075,z+.06),'#bebaaa',Math.max(.5,f/z*.035));
    if(z<35)for(const rail of[-.7175,.7175])strip(rail-.13,rail+.13,z,z+.2,'#444b49',.09);
  }
  for(const rail of[-.7175,.7175]){
    strip(rail-.07,rail+.07,1,450,'#353c3d',.12);
    strip(rail-.045,rail+.045,1,450,'#c3c9c5',.17);
    line(project(rail-.025,.18,1),project(rail-.025,.18,450),'#edf1e7',Math.max(1,w*.0012));
  }
  // Station platforms occupy their real route positions and grow as we approach.
  stations.forEach((station,index)=>{
    if(!index)return;const near=Math.max(1,station[1]-75-s.pos),far=station[1]+30-s.pos;
    if(far<=1||near>400)return;
    strip(1.75,4.6,near,Math.min(450,far),'#b3b4a8',.85);
    strip(1.75,1.95,near,Math.min(450,far),'#e2d5a0',.86);
    polygon([project(1.75,0,near),project(1.75,.85,near),project(1.75,.85,far),project(1.75,0,far)],'#737d79');
    const shelterNear=Math.max(1,station[1]-24-s.pos),shelterFar=station[1]+12-s.pos;
    if(shelterFar>1&&shelterNear<240){
      for(const world of[station[1]-24,station[1]-6,station[1]+12]){
        const depth=world-s.pos;if(depth>1)line(project(4.2,.85,depth),project(4.2,3.6,depth),'#7c8982',Math.max(.8,f/depth*.09));
      }
      strip(2.4,4.8,shelterNear,shelterFar,'#677b76',3.6);
      strip(2.4,2.55,shelterNear,shelterFar,'#c3ccc0',3.62);
    }
    for(let person=0;person<3;person++){
      const depth=station[1]-18+person*7-s.pos;if(depth<2||depth>150)continue;
      const lateral=3+person%2*.5,head=project(lateral,2.35,depth),radius=f/depth*.12;
      line(project(lateral,.85,depth),project(lateral,2.1,depth),person%2?'#716352':'#4c6672',Math.max(1,f/depth*.28));
      x.fillStyle='#b9a28b';x.beginPath();x.arc(head.x,head.y,Math.max(.5,radius),0,Math.PI*2);x.fill();
    }
    const z=station[1]-s.pos;if(z>3&&z<300){
      const a=project(2.8,2.6,z),b=project(4.6,1.9,z);x.fillStyle='#e6e9db';x.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
      line(project(2.85,0,z),project(2.85,2.6,z),'#596c66',Math.max(1,f/z*.06));
      if(f/z>9){x.fillStyle='#254e47';x.font=`600 ${Math.max(8,f/z*.2)}px sans-serif`;x.fillText(station[0],a.x+2,a.y+(b.y-a.y)*.7,b.x-a.x-4);}
    }
  });
  // Distant objects first: roofs, shaded walls, foliage, poles and safety fence.
  const first=Math.floor(s.pos/24);
  for(let i=19;i>=0;i--){
    const id=first+i,z=id*24+12-s.pos;if(z<=2||z>450)continue;
    const r=seed(id),treeZ=z+7;
    if(id%3!==1){
      const lateral=-11-r*9,height=3+r*2.6,width=3+r*2;
      const front=[project(lateral-width,0,z),project(lateral,0,z),project(lateral,height,z),project(lateral-width,height,z)];
      polygon(front,id%2?'#d2cbb9':'#bdc6bd');
      polygon([project(lateral,0,z),project(lateral+1.8,0,z+5),project(lateral+1.8,height,z+5),project(lateral,height,z)],'#87918b');
      polygon([project(lateral-width-.25,height,z),project(lateral-width/2,height+1.4,z-1),project(lateral+.25,height,z)],'#596260');
      if(z<160)for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const a=project(lateral-width+.4+col*(width-.8)/3,1+row*1.4,z-.02),b=project(lateral-width+.85+col*(width-.8)/3,1.8+row*1.4,z-.02);
        x.fillStyle='#526d72';x.fillRect(a.x,b.y,b.x-a.x,a.y-b.y);line({x:a.x,y:b.y},{x:b.x,y:b.y},'#e3e2d5',Math.max(.5,f/z*.04));
      }
    }
    const tx=-5.5-r*3,treeHeight=4+r*2.2;
    line(project(tx,0,treeZ),project(tx,treeHeight*.7,treeZ),'#645e48',Math.max(.7,f/treeZ*.18));
    for(let leaf=0;leaf<10;leaf++){
      const p=project(tx+(seed(id*11+leaf)-.5)*2,treeHeight*.65+seed(id*7+leaf)*1.6,treeZ),radius=f/treeZ*(.5+seed(id+leaf)*.7);
      const foliage=x.createRadialGradient(p.x-radius*.35,p.y-radius*.4,radius*.05,p.x,p.y,radius);
      foliage.addColorStop(0,leaf%2?'#8d9b68':'#7e905d');foliage.addColorStop(.55,'#5d754f');foliage.addColorStop(1,'#405c44');
      x.fillStyle=foliage;x.beginPath();
      for(let point=0;point<16;point++){const angle=point*Math.PI/8,rr=radius*(.8+.2*seed(id*31+leaf*16+point)),px=p.x+Math.cos(angle)*rr,py=p.y+Math.sin(angle)*rr*.85;point?x.lineTo(px,py):x.moveTo(px,py);}
      x.closePath();x.fill();
    }
    for(const lateral of[-3.2,6.8]){
      const bottom=project(lateral,0,z),top=project(lateral,1.15,z);
      line(bottom,top,'#b6b9a7',Math.max(.7,f/z*.045));
      if(z+24<450)for(const elevation of[.5,1])line(project(lateral,elevation,z),project(lateral,elevation,z+24),'#9baba277',Math.max(.5,f/z*.015));
    }
    // Cantilever supports and contact wire, at approximately 48 metre intervals.
    if(id%2===0){
      const pole=-3.1,base=project(pole,0,z),top=project(pole,6.4,z);
      line(base,top,'#657572',Math.max(1,f/z*.13));
      line(project(pole+.07,0,z),project(pole+.07,6.4,z),'#c8d0c4',Math.max(.5,f/z*.035));
      line(project(pole,6,z),project(.35,5.6,z),'#6e7b76',Math.max(.8,f/z*.065));
      line(project(pole,4.5,z),project(-.1,5.6,z),'#6e7b76',Math.max(.7,f/z*.045));
      line(project(-1.1,5.72,z),project(-.65,5.67,z),'#464f4b',Math.max(1,f/z*.12));
    }
  }
  line(project(0,5.35,1),project(0,5.35,450),'#465653',Math.max(.7,w*.001));
  line(project(0,6.2,1),project(0,6.2,450),'#72817a',Math.max(.5,w*.0007));
  // Thin window seals and subtle glazing keep most of the view unobstructed.
  const tint=x.createLinearGradient(0,0,w,h);tint.addColorStop(0,'#ffffff0a');tint.addColorStop(.5,'#ffffff00');tint.addColorStop(1,'#153d3b13');x.fillStyle=tint;x.fillRect(0,0,w,h);
  x.fillStyle='#243c42';x.fillRect(0,0,w*.018,h);x.fillRect(w*.982,0,w*.018,h);x.fillRect(0,h*.98,w,h*.02);
}
function frame(t){const dt=clamp((t-s.last)/1000,0,.05);s.last=t;physics(dt);ui();resize();draw();if(s.msg&&t>s.msg){$('messagePanel').classList.add('hidden');s.msg=0}requestAnimationFrame(frame)}document.querySelectorAll('[data-power]').forEach(b=>b.onclick=()=>power(+b.dataset.power));document.querySelectorAll('[data-brake]').forEach(b=>b.onclick=()=>brake(+b.dataset.brake));$('emergencyBtn').onclick=emergency;$('doorBtn').onclick=doors;$('announceBtn').onclick=()=>{const t=stations[s.next];say(s.doors?`${stations[Math.max(0,s.next-1)][0]}です。ドアが閉まります。`:`次は、${t[0]}です。`);msg('車内放送',s.doors?'発車案内を放送しました。':`次は ${t[0]} です。`)};$('resetBtn').onclick=reset;$('retryBtn').onclick=reset;$('soundBtn').onclick=()=>{s.sound=!s.sound;$('soundBtn').textContent=s.sound?'🔊':'🔇'};let prompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(prompt){prompt.prompt();await prompt.userChoice;prompt=null;$('installBtn').hidden=true}};if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));buttons();msg('S電鉄 海岸線','ドアを閉め、ブレーキを解除して、マスコンを入れてください。',4500);requestAnimationFrame(frame)})();