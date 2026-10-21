(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const scene=$('.scene-wrap');
  const speed=$('.speed-center'),limit=$('.limit-row');
  const next=$('#nextStation'),distance=$('.distance-row'),clock=$('#clock'),status=$('#statusBadge');
  document.querySelectorAll('.curve-ground-cover,.curve-overlay,.curve-badge').forEach(el=>el.remove());

  // Move instruments below the view, leaving the sky and track unobstructed.
  if(scene&&speed&&next&&clock&&!$('.drive-readout')){
    const readout=document.createElement('section');readout.className='drive-readout';readout.setAttribute('aria-label','速度・次駅・運行状態');
    readout.innerHTML='<div class="drive-speed"><span class="readout-label">速度</span></div><div class="drive-next"><span class="readout-label">次の停車駅</span></div><div class="drive-clock"><span class="readout-label">現在時刻</span></div>';
    readout.querySelector('.drive-speed').append(speed);if(limit)readout.querySelector('.drive-speed').append(limit);
    readout.querySelector('.drive-next').append(next);if(distance)readout.querySelector('.drive-next').append(distance);
    readout.querySelector('.drive-clock').append(clock);if(status)readout.querySelector('.drive-clock').append(status);
    scene.insertAdjacentElement('afterend',readout);
    $('.hud-left')?.remove();$('.hud-right')?.remove();$('.scene-status-wrap')?.remove();
  }
  $('.speedometer')?.classList.add('speedometer-relocated');$('.meter-cluster')?.classList.add('route-wide');

  const cab=$('.cab-panel'),cluster=$('.meter-cluster'),controls=$('.controls'),mini=$('.mini-grid');
  if(cab&&cluster&&controls&&!$('.speed-history')){
    if(mini){mini.classList.add('cab-summary');cab.prepend(mini);}
    const history=document.createElement('details');history.className='speed-history';history.open=true;
    history.innerHTML='<summary><span>速度推移・運行記録<small>区間を拡大・左右にスクロール</small></span></summary>';
    controls.insertAdjacentElement('afterend',history);history.append(cluster);
  }
  // Reuse the same graph and instruments in a modal on small screens.
  const history=$('.speed-history');
  if(history&&cab&&mini){
    const query=window.matchMedia('(max-width:760px), (max-width:1000px) and (max-height:520px) and (orientation:landscape)');
    const openButton=document.createElement('button');openButton.type='button';openButton.className='chart-open-btn';openButton.textContent='速度推移';openButton.hidden=true;
    openButton.setAttribute('aria-haspopup','dialog');openButton.setAttribute('aria-controls','telemetryDialog');openButton.setAttribute('aria-expanded','false');
    $('.top-actions')?.prepend(openButton);
    const dialog=document.createElement('dialog');dialog.id='telemetryDialog';dialog.className='telemetry-dialog';dialog.setAttribute('aria-labelledby','telemetryTitle');
    dialog.innerHTML='<div class="telemetry-dialog-head"><div><h2 id="telemetryTitle">速度推移・運行記録</h2><small>表示中も運転は継続します</small></div><button type="button" class="telemetry-close" aria-label="速度推移を閉じる">閉じる ×</button></div><div class="telemetry-dialog-body"></div>';
    document.body.append(dialog);
    const content=dialog.querySelector('.telemetry-dialog-body');
    let desktopOpen=history.open;
    function closeGraph(){if(dialog.open)dialog.close();}
    function adapt(){
      const fit=query.matches;document.documentElement.classList.toggle('rail-fit',fit);openButton.hidden=!fit;
      if(fit&&history.parentElement!==content){
        desktopOpen=history.open;content.append(mini,history);history.open=true;window.scrollTo(0,0);
      }else if(!fit&&history.parentElement===content){
        closeGraph();cab.prepend(mini);cab.append(history);history.open=desktopOpen;
      }
    }
    openButton.addEventListener('click',()=>{if(!dialog.open){history.open=true;dialog.showModal();openButton.setAttribute('aria-expanded','true');}});
    dialog.querySelector('.telemetry-close').addEventListener('click',closeGraph);
    dialog.addEventListener('close',()=>openButton.setAttribute('aria-expanded','false'));
    query.addEventListener('change',adapt);adapt();
  }
})();
