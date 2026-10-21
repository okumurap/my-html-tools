/* Shared, deterministic game rules. Distances are game metres, not a fishing forecast. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KissRules=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const speeds={slow:4.3,normal:8.4,fast:14};
  function bottomAt(distance,zones){return Math.abs(distance-zones.weed)<6?'weed':Math.abs(distance-zones.break)<9?'break':'sand';}
  function lureQuality({moving,pace,pause,pull,bottom}){
    if(moving)return pace==='slow'?.56:pace==='normal'?.4:.12;
    if(pause<.45)return .35;
    if(pause>4.5)return .22;
    return (pull>=.35&&pull<=2.6?.95:.48)*(bottom==='weed'?.7:1);
  }
  function hookGrade(progress){return progress>=.18&&progress<=.62?'perfect':'good';}
  function catchBonus(base,perfect,control){return {timing:perfect?Math.round(base*.25):0,control:Math.round(clamp(control,0,1)*60)};}
  function snagRate(pace,bottom,moving){return bottom==='weed'&&moving?{slow:.13,normal:.5,fast:1.5}[pace]:-.75;}
  return Object.freeze({speeds,bottomAt,lureQuality,hookGrade,catchBonus,snagRate});
});
