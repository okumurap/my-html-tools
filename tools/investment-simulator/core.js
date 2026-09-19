const SimulatorCore = (() => {
  'use strict';
  const definitions=[
    {id:'initial',min:0,max:20000,step:100,numberStep:0.01,defaultValue:2000},
    {id:'monthly',min:0,max:100,step:5,numberStep:0.01,defaultValue:10},
    {id:'rate',min:-5,max:15,step:1,numberStep:0.1,defaultValue:5},
    {id:'years',min:5,max:50,step:5,numberStep:1,defaultValue:20},
    {id:'split-months',min:1,max:36,step:1,numberStep:1,defaultValue:12},
    {id:'crash-year',min:1,max:50,step:1,numberStep:1,defaultValue:5},
    {id:'crash-loss',min:0,max:70,step:5,numberStep:0.1,defaultValue:30},
    {id:'crash-recovery',min:0,max:20,step:1,numberStep:1,defaultValue:3},
    {id:'goal-amount',min:100,max:100000,step:100,numberStep:0.01,defaultValue:10000},
    {id:'inflation-rate',min:0,max:10,step:0.5,numberStep:0.1,defaultValue:2},
    {id:'current-age',min:20,max:70,step:1,numberStep:1,defaultValue:40},
    {id:'end-age',min:60,max:120,step:1,numberStep:1,defaultValue:90},
    {id:'withdraw-monthly',min:0,max:100,step:1,numberStep:0.01,defaultValue:20},
    {id:'withdraw-rate',min:-5,max:15,step:0.5,numberStep:0.1,defaultValue:3}
  ];
  const $=id=>document.getElementById(id);
  const displayed=value=>Math.round(value);
  const displayDelta=(a,b)=>displayed(a)-displayed(b);
  const format=value=>displayed(value).toLocaleString('ja-JP')+'万円';
  const signed=value=>{const rounded=displayed(value);return (rounded>0?'+':'')+rounded.toLocaleString('ja-JP')+'万円';};
  const clamp=(v,def)=>{
    const min=Number(def.min),max=Number(def.max),step=def.numberStep??def.step;
    const bounded=Math.min(max,Math.max(min,v));
    const precision=(String(step).split('.')[1]||'').length;
    return Number((Math.round((bounded-min)/step)*step+min).toFixed(precision));
  };
  const read=id=>Number($(id).value);
  // All scenarios receive the same money on the same dates; idle cash is included in total assets.
  function simulate(initial,monthly,rate,years,splitMonths){
    const monthlyRate=Math.pow(1+rate/100,1/12)-1;
    let lump=initial,stagedInvestment=0,stagedCash=initial,cash=initial,principal=initial;
    const points=[{year:0,lump,staged:stagedInvestment+stagedCash,cash,principal}];
    for(let month=1;month<=years*12;month++){
      lump=lump*(1+monthlyRate)+monthly;
      stagedInvestment*=1+monthlyRate;
      if(month<=splitMonths){
        const installment=month===splitMonths?stagedCash:initial/splitMonths;
        stagedCash-=installment;
        stagedInvestment+=installment;
      }
      stagedInvestment+=monthly;
      cash+=monthly;
      principal+=monthly;
      if(month%12===0)points.push({year:month/12,lump,staged:stagedInvestment+stagedCash,cash,principal});
    }
    return points;
  }
  function svgEl(tag,attributes,text){
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attributes).forEach(([name,value])=>el.setAttribute(name,String(value)));
    if(text!==undefined)el.textContent=text;
    return el;
  }
  function draw(id,points,series){
    const svg=$(id);svg.replaceChildren();
    const w=660,h=240,left=68,right=14,top=12,bottom=30;
    const maxValue=Math.max(1,...points.flatMap(p=>series.map(s=>Number.isFinite(p[s.field])?p[s.field]:0)))*1.1;
    const firstYear=points[0].year,finalYear=points.at(-1).year;
    const duration=Math.max(finalYear-firstYear,1/12);
    const x=year=>left+(w-left-right)*(year-firstYear)/duration;
    const y=value=>h-bottom-(h-top-bottom)*value/maxValue;
    for(let i=0;i<=4;i++){
      const val=maxValue*i/4,py=y(val);
      svg.append(svgEl('line',{x1:left,y1:py,x2:w-right,y2:py,class:'grid'}));
      svg.append(svgEl('text',{x:left-7,y:py+4,'text-anchor':'end'},Math.round(val).toLocaleString('ja-JP')));
    }
    const labels=[];
    const interval=Math.max(1,Math.ceil((finalYear-firstYear)/5));
    for(let year=firstYear;year<=finalYear;year+=interval)labels.push(year);
    if(Math.abs(labels.at(-1)-finalYear)>0.00001)labels.push(finalYear);
    const ageAxis=id==='withdraw-chart';
    labels.forEach(year=>svg.append(svgEl('text',{x:x(year),y:h-8,'text-anchor':year===firstYear?'start':year===finalYear?'end':'middle'},Math.round(year)+(ageAxis?'歳':'年'))));
    series.forEach(s=>{
      let started=false;
      const path=points.map(p=>{if(!Number.isFinite(p[s.field])){started=false;return '';}const command=started?'L':'M';started=true;return command+x(p.year).toFixed(2)+','+y(p[s.field]).toFixed(2);}).filter(Boolean).join(' ');
      svg.append(svgEl('path',{d:path,class:s.class}));
    });
  }
  function renderRows(id,points,fields){
    const rows=document.createDocumentFragment();
    points.forEach(p=>{
      const tr=document.createElement('tr');
      [p.year+'年',...fields.map(f=>f(p))].forEach(value=>{
        const td=document.createElement('td');td.textContent=value;tr.append(td);
      });
      rows.append(tr);
    });
    $(id).replaceChildren(rows);
  }
  function setDelta(id,value){
    const el=$(id);el.textContent=signed(value);
    el.className='delta'+(displayed(value)>0?' positive':displayed(value)<0?' negative':'');
  }

  return {definitions,$,format,signed,displayed,displayDelta,clamp,read,simulate,draw,renderRows,setDelta};
})();
