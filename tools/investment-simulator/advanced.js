const SimulatorAdvanced = (() => {
  'use strict';
  const {$,format,signed,read,draw,renderRows}=SimulatorCore;
  const precise=value=>value.toLocaleString('ja-JP',{maximumFractionDigits:1,minimumFractionDigits:1})+'万円';
  const monthlyRate=annual=>Math.pow(1+annual/100,1/12)-1;
  function simulateCrash(initial,monthly,rate,years,crashYear,loss,recoveryYears,keepContributing){
    const r=monthlyRate(rate),crashMonth=(crashYear-1)*12+1;
    const extra=recoveryYears>0&&loss>0?Math.pow(1/(1-loss/100),1/(recoveryYears*12)):1;
    let standard=initial,shocked=initial,principal=initial;
    const graph=[{year:0,standard,shocked,principal}];
    const annual=[{year:0,standard,shocked,principal}];
    for(let month=1;month<=years*12;month++){
      if(month===crashMonth){
        // A duplicate x-coordinate makes the instantaneous crash visible even on a 1-year chart.
        shocked*=1-loss/100;
        graph.push({year:(month-1)/12,standard,shocked,principal});
      }
      const inRecovery=recoveryYears>0&&month>=crashMonth&&month<crashMonth+recoveryYears*12;
      standard=standard*(1+r)+monthly;
      const contribution=keepContributing||month<crashMonth?monthly:0;
      shocked=shocked*(1+r)*(inRecovery?extra:1)+contribution;
      principal+=contribution;
      const point={year:month/12,standard,shocked,principal};
      graph.push(point);
      if(month%12===0)annual.push(point);
    }
    return {graph,annual,crashMonth};
  }
  function renderAdvanced(basePoints){
    const initial=read('initial'),monthly=read('monthly'),rate=read('rate'),years=read('years');
    const maxYear=$('crash-year');
    maxYear.max=$('crash-year-range').max=String(years);
    if(read('crash-year')>years){maxYear.value=$('crash-year-range').value=String(years);}
    $('crash-year-max').textContent=years+'年目';
    const shockYear=read('crash-year'),loss=read('crash-loss'),recovery=read('crash-recovery');
    const keep=$('crash-contribution').value==='continue';
    const stress=simulateCrash(initial,monthly,rate,years,shockYear,loss,recovery,keep);
    const riskLast=stress.annual.at(-1),baseLast=basePoints.at(-1);
    $('crash-final').textContent=format(riskLast.shocked);
    $('crash-delta').textContent=signed(riskLast.shocked-baseLast.lump);
    $('crash-delta').style.color=riskLast.shocked<baseLast.lump?'var(--loss)':'var(--gain)';
    $('crash-principal').textContent=format(riskLast.principal);
    const stressExplain=recovery===0?'追加的な回復リターンなし':recovery+'年間の追加リターンにより、市場価格の下落分を基準価格の想定推移へ戻す仮定';
    $('crash-explain').textContent=shockYear+'年目の開始時に−'+loss+'%。'+stressExplain+'。'+(keep?'暴落後も積立継続。':'暴落した月以降は積立停止。通常ケースより拠出元本が'+format(baseLast.principal-riskLast.principal)+'少ないため、差額には積立停止分も含みます。');
    draw('crash-chart',stress.graph,[{field:'standard',class:'risk-base'},{field:'shocked',class:'risk-shock'}]);
    renderRows('crash-rows',stress.annual,[p=>format(p.standard),p=>format(p.shocked),p=>format(p.principal)]);
    // Monthly contributions occur at month end: FV = initial*(1+r)^n + payment * sum((1+r)^k).
    const goal=read('goal-amount'),r=monthlyRate(rate),n=years*12;
    const factor=Math.abs(r)<1e-12?n:Math.expm1(n*Math.log1p(r))/r;
    const fvInitial=initial*Math.pow(1+r,n);
    const needed=Math.max(0,(goal-fvInitial)/factor);
    $('goal-required').textContent=precise(needed);
    $('goal-gap').textContent=(needed<=monthly?'現在の設定で足りる':'+ '+precise(needed-monthly));
    let reached=initial>=goal?0:null,balance=initial;
    if(reached===null){
      for(let month=1;month<=50*12;month++){
        balance=balance*(1+r)+monthly;
        if(balance>=goal-1e-8){reached=month;break;}
      }
    }
    $('goal-years').textContent=reached===null?'50年以内は未達':reached===0?'開始時点で達成':Math.floor(reached/12)+'年'+(reached%12)+'か月';
    $('goal-explain').textContent=needed===0?'初期資金のみの運用で目標に達する計算です。':years+'年間で'+format(goal)+'に達するための必要額は、毎月末に約'+precise(needed)+'です。小数第1位表示のため、実際の入力は切り上げが必要な場合があります。';
    const inflation=read('inflation-rate')/100;
    const real=basePoints.map(p=>({...p,nominal:p.lump,real:p.lump/Math.pow(1+inflation,p.year)}));
    const nominal=real.at(-1).nominal,realLast=real.at(-1).real;
    $('nominal-final').textContent=format(nominal);
    $('real-final').textContent=format(realLast);
    $('real-gap').textContent=format(nominal-realLast);
    draw('inflation-chart',real,[{field:'nominal',class:'total'},{field:'real',class:'real-line'}]);
    renderRows('inflation-rows',real,[p=>format(p.nominal),p=>format(p.real)]);
    renderWithdrawal(basePoints,inflation);
  }
  function renderWithdrawal(basePoints,inflation){
    const currentAge=read('current-age'),endAge=read('end-age'),retirementAge=currentAge+read('years');
    const starting=basePoints.at(-1).lump,withdrawal=read('withdraw-monthly'),annual=read('withdraw-rate');
    const indexed=$('withdraw-inflate').checked;
    $('withdraw-start').textContent='取り崩し開始：'+retirementAge+'歳（基本の積立期間 '+read('years')+'年間）／開始時資産 '+format(starting)+(indexed?'。取り崩し額は年1回、設定インフレ率に連動して増額。':'。取り崩し額は名目固定。');
    if(endAge<=retirementAge){
      $('withdraw-final').textContent='—';$('withdraw-exhaust').textContent='—';$('withdraw-paid').textContent='—';
      $('withdraw-start').textContent+=' 終了年齢を'+(retirementAge+1)+'歳以上にしてください。';
      $('withdraw-chart').replaceChildren();$('withdraw-rows').replaceChildren();return;
    }
    const r=monthlyRate(annual),months=(endAge-retirementAge)*12;
    let balance=starting,paid=0,shortageMonth=null;
    const acc=basePoints.map(p=>({year:currentAge+p.year,accum:p.lump}));
    const distribution=[{year:retirementAge,drawdown:starting,paid:0}];
    for(let month=1;month<=months;month++){
      const amount=withdrawal*(indexed?Math.pow(1+inflation,Math.floor((month-1)/12)):1);
      const funded=Math.min(balance,amount);
      if(shortageMonth===null&&funded+1e-7<amount)shortageMonth=month;
      balance=Math.max(0,(balance-funded)*(1+r));
      paid+=funded;
      distribution.push({year:retirementAge+month/12,drawdown:balance,paid});
    }
    $('withdraw-final').textContent=format(balance);
    $('withdraw-paid').textContent=format(paid);
    $('withdraw-exhaust').textContent=shortageMonth===null?'終了まで不足なし':(retirementAge+Math.floor((shortageMonth-1)/12))+'歳'+((shortageMonth-1)%12)+'か月';
    // Insert gaps rather than connect line series across phases.
    const plot=[...acc.map(p=>({...p,drawdown:NaN})),...distribution.map(p=>({...p,accum:NaN}))];
    draw('withdraw-chart',plot,[{field:'accum',class:'total'},{field:'drawdown',class:'withdraw-line'}]);
    const annualRows=[...acc.map(p=>({year:p.year,amount:p.accum,paid:0})),...distribution.slice(1).filter((p,i)=>(i+1)%12===0).map(p=>({year:p.year,amount:p.drawdown,paid:p.paid}))];
    const withdrawalRows=document.createDocumentFragment();
    annualRows.forEach(p=>{const tr=document.createElement('tr');[Math.round(p.year)+'歳',format(p.amount),format(p.paid)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});withdrawalRows.append(tr);});
    $('withdraw-rows').replaceChildren(withdrawalRows);
  }
  return {renderAdvanced};
})();
