(() => {
  'use strict';
  const {definitions,$,format,signed,displayDelta,clamp,read,simulate,draw,renderRows,setDelta}=SimulatorCore;
  const {renderAdvanced}=SimulatorAdvanced;
  function render(){
    const splitMonths=read('split-months');
    const points=simulate(read('initial'),read('monthly'),read('rate'),read('years'),splitMonths);
    const last=points.at(-1),gain=displayDelta(last.lump,last.principal);
    $('final').textContent=format(last.lump);
    $('principal').textContent=format(last.principal);
    $('profit').textContent=signed(gain);
    $('profit').style.color=gain<0?'var(--loss)':'var(--gain)';
    const actualGain=last.lump-last.principal;
    const principalShare=actualGain>=0?last.principal/Math.max(last.lump,1)*100:100;
    $('principal-bar').style.width=principalShare+'%';
    $('gain-bar').style.width=(actualGain>0?100-principalShare:0)+'%';
    $('gain-label').textContent=actualGain<0?'運用損失（棒は元本基準）':'運用益';
    $('gain-label').className=actualGain<0?'negative':'growth';
    $('split').setAttribute('aria-label','元本 '+format(last.principal)+'、運用損益 '+signed(gain));
    $('staged-title').textContent=splitMonths+'か月分割';
    $('compare-lump').textContent=format(last.lump);
    $('compare-lump-gain').textContent=signed(gain);
    $('compare-staged').textContent=format(last.staged);
    $('compare-cash').textContent=format(last.cash);
    setDelta('compare-staged-delta',displayDelta(last.staged,last.lump));
    setDelta('compare-cash-delta',displayDelta(last.cash,last.lump));
    draw('comparison-chart',points,[{field:'cash',class:'comparison-cash'},{field:'staged',class:'comparison-staged'},{field:'lump',class:'comparison-lump'}]);
    draw('chart',points,[{field:'principal',class:'invested'},{field:'lump',class:'total'}]);
    renderRows('comparison-rows',points,[p=>format(p.lump),p=>format(p.staged),p=>format(p.cash),p=>signed(displayDelta(p.staged,p.lump))]);
    renderRows('annual-rows',points,[p=>format(p.principal),p=>format(p.lump),p=>signed(displayDelta(p.lump,p.principal))]);
    renderAdvanced(points);
  }
  function syncWithdrawalAge(){
    const retirementAge=read('current-age')+read('years');
    const minAge=Math.max(60,retirementAge+1);
    const impossible=minAge>120;
    const number=$('end-age'),range=$('end-age-range');
    number.disabled=range.disabled=impossible;
    number.min=range.min=String(Math.min(minAge,120));
    if(!impossible&&read('end-age')<minAge)number.value=range.value=String(minAge);
    return impossible;
  }
  function syncRange(def,number,range){
    // A slider is a coarse control; a number field retains its finer precision.
    const nearest=Math.min(Number(range.max),Math.max(Number(range.min),
      Math.round((Number(number.value)-Number(range.min))/def.step)*def.step+Number(range.min)));
    range.value=String(nearest);
  }
  definitions.forEach(def=>{
    const number=$(def.id),range=$(def.id+'-range');
    number.step=String(def.numberStep??def.step);
    if((def.numberStep??def.step)<1)number.inputMode='decimal';
    range.addEventListener('input',()=>{
      number.value=range.value;
      if(def.id==='current-age'||def.id==='years')syncWithdrawalAge();
      render();
    });
    number.addEventListener('change',()=>{
      const raw=Number(number.value);
      const normalized=number.value.trim()===''||!Number.isFinite(raw)?def.defaultValue:clamp(raw,{
        ...def,min:Math.max(def.min,Number(number.min)),max:Math.min(def.max,Number(number.max))
      });
      number.value=String(normalized);
      syncRange(def,number,range);
      if(def.id==='current-age'||def.id==='years')syncWithdrawalAge();
      render();
    });
  });
  $('crash-contribution').addEventListener('change',render);
  $('withdraw-inflate').addEventListener('change',render);
  $('reset').addEventListener('click',()=>{
    definitions.forEach(def=>{$(def.id).value=$(def.id+'-range').value=def.defaultValue;});
    $('crash-contribution').value='continue';$('withdraw-inflate').checked=false;
    syncWithdrawalAge();render();
  });
  syncWithdrawalAge();
  render();
})();
