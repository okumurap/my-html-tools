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
})();
