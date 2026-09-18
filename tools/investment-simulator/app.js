(() => {
  'use strict';
  const {definitions,$,format,signed,clamp,read,simulate,draw,renderRows,setDelta}=SimulatorCore;
  const {renderAdvanced}=SimulatorAdvanced;
  function render(){
    const splitMonths=read('split-months');
    const points=simulate(read('initial'),read('monthly'),read('rate'),read('years'),splitMonths);
    const last=points.at(-1),gain=last.lump-last.principal;
    $('final').textContent=format(last.lump);
    $('principal').textContent=format(last.principal);
    $('profit').textContent=signed(gain);
    $('profit').style.color=gain<0?'var(--loss)':'var(--gain)';
    const principalShare=gain>=0?last.principal/Math.max(last.lump,1)*100:100;
    $('principal-bar').style.width=principalShare+'%';
    $('gain-bar').style.width=(gain>0?100-principalShare:0)+'%';
    $('gain-label').textContent=gain<0?'運用損失（棒は元本基準）':'運用益';
    $('gain-label').className=gain<0?'negative':'growth';
    $('split').setAttribute('aria-label','元本 '+format(last.principal)+'、運用損益 '+signed(gain));
    $('staged-title').textContent=splitMonths+'か月分割';
    $('compare-lump').textContent=format(last.lump);
    $('compare-lump-gain').textContent=signed(gain);
    $('compare-staged').textContent=format(last.staged);
    $('compare-cash').textContent=format(last.cash);
    setDelta('compare-staged-delta',last.staged-last.lump);
    setDelta('compare-cash-delta',last.cash-last.lump);
    draw('comparison-chart',points,[{field:'cash',class:'comparison-cash'},{field:'staged',class:'comparison-staged'},{field:'lump',class:'comparison-lump'}]);
    draw('chart',points,[{field:'principal',class:'invested'},{field:'lump',class:'total'}]);
    renderRows('comparison-rows',points,[p=>format(p.lump),p=>format(p.staged),p=>format(p.cash),p=>signed(p.staged-p.lump)]);
    renderRows('annual-rows',points,[p=>format(p.principal),p=>format(p.lump),p=>signed(p.lump-p.principal)]);
    renderAdvanced(points);
  }
  definitions.forEach(def=>{
    const number=$(def.id),range=$(def.id+'-range');
    range.addEventListener('input',()=>{number.value=range.value;render();});
    number.addEventListener('change',()=>{
      const raw=Number(number.value);
      const normalized=number.value.trim()===''||!Number.isFinite(raw)?def.defaultValue:clamp(raw,def);
      number.value=range.value=String(normalized);
      render();
    });
  });
  $('crash-contribution').addEventListener('change',render);
  $('withdraw-inflate').addEventListener('change',render);
  $('reset').addEventListener('click',()=>{
    definitions.forEach(def=>{$(def.id).value=$(def.id+'-range').value=def.defaultValue;});
    $('crash-contribution').value='continue';$('withdraw-inflate').checked=false;
    render();
  });
  render();
})();
