(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const {clamp,score,rank}=DaitaiMath;
  const STORE='rough-craftsman:v1';
  const rounds=[
    {kind:'length',name:'目分量',title:'目分量で、10cm。',help:'黄色い点を左右に動かして「このくらい」。下の1cm見本が唯一のたよりです。',target:100,tolerance:50,note:'画面内の1cm見本が基準です。実際の10cmではありません。赤い破線は判定後に表示します。'},
    {kind:'time',name:'体内時計',title:'5秒で、ぴたりと止める。',help:'スタートを押したら心の中でカウント。「ここ！」と思った瞬間に止めてください。',target:5000,tolerance:2500,note:'15秒で自動終了。別のタブへ移動した場合は、この種目をやり直します。'},
    {kind:'angle',name:'角度感覚',title:'45°。勘で、合わせる。',help:'黄色い点を動かして、水平線から45°の角度に。分度器は、心の中にあります。',target:45,tolerance:45,note:'0〜90°の範囲で調整できます。スマホを傾ける操作やセンサーの許可は不要です。'}
  ];
  let saved={best:0,plays:0},storageBlocked=false;
  function storageMessage(text){$('storageNotice').textContent=text;$('storageNotice').hidden=false;}
  try{
    const raw=localStorage.getItem(STORE);
    if(raw!==null){
      const parsed=JSON.parse(raw);
      if(!parsed||!Number.isInteger(parsed.best)||parsed.best<0||parsed.best>300||!Number.isInteger(parsed.plays)||parsed.plays<0) throw new Error('Invalid record');
      saved={best:parsed.best,plays:parsed.plays};
    }
  }catch(_){storageBlocked=true;storageMessage('記録を読み込めません。今回は保存せずに遊べます。保存済みの記録は上書きしません。');}
  let index=0,phase='home',value=30,answers=[],timerStart=0,timerId=0,pointerId=null,lastTotal=0;
  const show=(id,visible)=>{$(id).toggleAttribute('hidden',!visible);};
  function homeRecord(){ $('bestHome').textContent=saved.plays?`${saved.best}点 / ${rank(saved.best).name}`:'―';$('playsHome').textContent=saved.plays; }
  function screen(id){['home','game','result'].forEach(name=>show(name,name===id));}
  function notice(text=''){$('gameNotice').textContent=text;show('gameNotice',Boolean(text));}
  function clearTimer(){clearTimeout(timerId);timerId=0;timerStart=0;$('timerRing').classList.remove('running');}
  function begin(){clearTimer();index=0;answers=[];notice();screen('game');showRound();}
  function showRound(){
    phase='active';value=index===2?15:30;pointerId=null;
    const round=rounds[index],timed=round.kind==='time';
    $('roundCount').textContent=`0${index+1} / 03`;
    document.querySelectorAll('.round-progress i').forEach((node,i)=>{node.className=i<index?'done':i===index?'current':'';});
    $('roundCategory').textContent=`ROUND 0${index+1} / ${round.name}`;$('roundTitle').textContent=round.title;$('roundHelp').textContent=round.help;$('roundNote').textContent=round.note;
    show('drawingArea',!timed);show('fineControls',!timed);show('timerArea',timed);show('roundResult',false);show('nextBtn',false);show('judgeBtn',true);
    show('lengthDrawing',round.kind==='length');show('angleDrawing',round.kind==='angle');show('lengthTarget',false);show('angleTarget',false);show('targetKey',false);
    document.querySelector('.target-key').hidden=true;
    $('judgeBtn').textContent=timed?'心の準備OK、スタート →':'これで判定する →';$('judgeBtn').disabled=false;
    $('minusBtn').disabled=false;$('plusBtn').disabled=false;$('boardHint').textContent=round.kind==='length'?'点を左右にドラッグ':'点を動かして角度を調整';
    $('timerState').textContent='心の準備はできましたか？';$('timerRing').classList.remove('running');draw();
    $('roundTitle').focus({preventScroll:true});$('game').scrollIntoView({block:'start'});
  }
  function draw(){
    if(rounds[index].kind==='length'){
      const x=36+value*3.6;$('lengthLine').setAttribute('x2',x);$('lengthHandle').setAttribute('cx',x);
    }else if(rounds[index].kind==='angle'){
      const rad=value*Math.PI/180,x=250+200*Math.cos(rad),y=265-200*Math.sin(rad);
      $('angleLine').setAttribute('x2',x);$('angleLine').setAttribute('y2',y);$('angleHandle').setAttribute('cx',x);$('angleHandle').setAttribute('cy',y);
    }
  }
  function adjust(amount){if(phase!=='active'||rounds[index].kind==='time')return;value=clamp(value+amount,0,rounds[index].kind==='angle'?90:180);draw();}
  function movePoint(event){
    const point=$('board').createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const matrix=$('board').getScreenCTM();if(!matrix)return;
    const p=point.matrixTransform(matrix.inverse());
    value=rounds[index].kind==='length'?clamp((p.x-36)/3.6,0,180):Math.atan2(clamp(265-p.y,0,Infinity),clamp(p.x-250,0,Infinity))*180/Math.PI;
    draw();
  }
  $('board').addEventListener('pointerdown',event=>{
    if(phase!=='active'||event.button>0||pointerId!==null)return;
    pointerId=event.pointerId;try{$('board').setPointerCapture(pointerId);}catch(_){}movePoint(event);
  });
  $('board').addEventListener('pointermove',event=>{if(phase==='active'&&pointerId===event.pointerId)movePoint(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('board').addEventListener(type,event=>{if(event.pointerId===pointerId)pointerId=null;});
  function units(kind,actual){return kind==='length'?`${(actual/10).toFixed(1)}cm`:kind==='time'?`${(actual/1000).toFixed(2)}秒`:`${actual.toFixed(1)}°`;}
  function describe(result){
    const round=rounds[result.index],error=result.actual-round.target;
    const difference=units(round.kind,Math.abs(error));
    const precision=round.kind==='length'?.5:round.kind==='time'?5:.05;
    const direction=Math.abs(error)<precision?'ほぼぴったり':round.kind==='length'?(error>0?'長め':'短め'):round.kind==='time'?(error>0?'遅め':'早め'):(error>0?'大きめ':'小さめ');
    return `${units(round.kind,result.actual)} ／ 誤差 ${difference}（${direction}）`;
  }
  function judge(actual=value){
    if(phase!=='active'&&phase!=='timing')return;
    const round=rounds[index];if(round.kind==='time'&&phase!=='timing')return;
    phase='judged';clearTimer();pointerId=null;
    const points=score(actual,round.target,round.tolerance),result={index,actual,points};answers.push(result);
    show('judgeBtn',false);show('roundResult',true);show('nextBtn',true);
    $('minusBtn').disabled=true;$('plusBtn').disabled=true;
    $('roundScore').textContent=`${points}点`;$('roundMessage').textContent=points>=95?'その感覚、ほぼ定規。':points>=80?'いい仕事、してます。':points>=60?'だいたい、いい感じ。':'なかなか大胆な仕事。';
    $('roundActual').textContent=describe(result);$('nextBtn').textContent=index===2?'職人ランクを受け取る →':'次の修行へ →';
    if(round.kind!=='time'){show(round.kind==='length'?'lengthTarget':'angleTarget',true);show('targetKey',true);document.querySelector('.target-key').hidden=false;$('boardHint').textContent='赤い破線が正解です';}
    else $('timerState').textContent=`記録：${units('time',actual)}`;
    $('nextBtn').focus({preventScroll:true});$('roundResult').scrollIntoView({block:'nearest'});
  }
  $('judgeBtn').addEventListener('click',()=>{
    if(rounds[index].kind!=='time'){judge();return;}
    if(phase==='active'){
      phase='timing';timerStart=performance.now();$('judgeBtn').textContent='ここ！ 止める';$('timerState').textContent='心の中で、いち、に、さん…';$('timerRing').classList.add('running');
      timerId=setTimeout(()=>{if(phase==='timing')judge(performance.now()-timerStart);},15000);
    }else if(phase==='timing')judge(performance.now()-timerStart);
  });
  $('minusBtn').addEventListener('click',()=>adjust(-1));$('plusBtn').addEventListener('click',()=>adjust(1));
  document.addEventListener('keydown',event=>{if(phase==='active'&&rounds[index].kind!=='time'&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();adjust(event.key==='ArrowRight'?1:-1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='timing'){clearTimer();showRound();notice('席を外したので時計を止めました。体内時計の修行を、もう一度どうぞ。');}});
  $('nextBtn').addEventListener('click',()=>{if(phase!=='judged')return;notice();if(index===2)finish();else{index++;showRound();}});
  function finish(){
    if(answers.length!==3)return;
    phase='result';lastTotal=answers.reduce((sum,result)=>sum+result.points,0);const grade=rank(lastTotal),isNew=lastTotal>saved.best;
    saved={best:Math.max(saved.best,lastTotal),plays:saved.plays+1};
    if(!storageBlocked){try{localStorage.setItem(STORE,JSON.stringify(saved));}catch(_){storageMessage('今回の記録を保存できませんでした。画面の結果は「結果をコピー」から残せます。');}}
    $('rankName').textContent=grade.name;$('rankMessage').textContent=grade.message;$('totalScore').textContent=lastTotal;show('newBest',isNew);
    $('scoreRows').replaceChildren(...answers.map(result=>{
      const row=document.createElement('div');row.className='score-row';const name=document.createElement('strong');name.textContent=rounds[result.index].name;
      const points=document.createElement('b');points.textContent=`${result.points}点`;const actual=document.createElement('small');actual.textContent=describe(result);
      const track=document.createElement('div');track.className='score-track';const fill=document.createElement('i');fill.style.width=`${result.points}%`;track.append(fill);row.append(name,points,actual,track);return row;
    }));
    $('copyStatus').textContent='';show('copyFallback',false);homeRecord();screen('result');$('resultTitle').focus({preventScroll:true});$('result').scrollIntoView({block:'start'});
  }
  $('startBtn').addEventListener('click',begin);$('replayBtn').addEventListener('click',begin);
  $('homeBtn').addEventListener('click',()=>{phase='home';notice();homeRecord();screen('home');$('startBtn').focus();});
  $('quitBtn').addEventListener('click',()=>{if(!window.confirm('今回の修行をやめますか？ 完了した過去の記録は残ります。'))return;clearTimer();phase='home';answers=[];notice();screen('home');$('startBtn').focus();});
  $('copyBtn').addEventListener('click',async()=>{
    const text=`だいたい職人｜${rank(lastTotal).name} ${lastTotal}/300点\n${answers.map(a=>`${rounds[a.index].name}：${a.points}点 / ${describe(a)}`).join('\n')}`;
    try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);$('copyStatus').textContent='結果をコピーしました。';show('copyFallback',false);}
    catch(_){$('copyFallback').value=text;show('copyFallback',true);$('copyFallback').focus();$('copyFallback').select();$('copyStatus').textContent='自動コピーを利用できません。下の結果を選択してコピーしてください。';}
  });
  $('resetRecordBtn').addEventListener('click',()=>{
    if(!window.confirm('このブラウザの自己ベストと修行回数をリセットしますか？'))return;
    try{localStorage.removeItem(STORE);saved={best:0,plays:0};storageBlocked=false;show('storageNotice',false);homeRecord();notice('自己ベストと修行回数をリセットしました。');}
    catch(_){storageMessage('記録をリセットできませんでした。ブラウザの保存設定を確認してください。');}
  });
  homeRecord();
})();
