/* Small pure helpers shared by the game and its regression checks. */
((root) => {
  'use strict';
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  function score(actual,target,tolerance){
    if(![actual,target,tolerance].every(Number.isFinite)||tolerance<=0) throw new RangeError('Invalid scoring values');
    return Math.round(clamp(100*(1-Math.abs(actual-target)/tolerance),0,100));
  }
  function rank(total){
    if(!Number.isFinite(total)||total<0||total>300) throw new RangeError('Invalid total');
    if(total>=270) return {name:'神職人',message:'定規のほうが、あなたを参考にするかも。'};
    if(total>=240) return {name:'師匠',message:'その勘、弟子入りして教わりたい。'};
    if(total>=180) return {name:'一人前',message:'いい仕事しています。あとは場数です。'};
    if(total>=120) return {name:'見習い',message:'伸びしろたっぷり。もう一仕事いきますか。'};
    return {name:'修行中',message:'大胆な仕事ぶり。ここからが修行の始まり。'};
  }
  const api={clamp,score,rank};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DaitaiMath=api;
})(globalThis);
