(() => {
  'use strict';
  const scene = document.querySelector('.scene-wrap');
  const hudLeft = document.querySelector('.hud-left');
  const speedCenter = document.querySelector('.speed-center');
  const speedometer = document.querySelector('.speedometer');
  const meterCluster = document.querySelector('.meter-cluster');
  const statusBadge = document.querySelector('#statusBadge');

  document.querySelectorAll('.curve-ground-cover,.curve-overlay,.curve-badge').forEach(el => el.remove());

  if (scene && hudLeft && speedCenter && !document.querySelector('.hud-speed')) {
    const speedBox = document.createElement('div');
    speedBox.className = 'hud-speed';
    speedBox.innerHTML = '<span class="hud-speed-label">速度</span>';
    speedBox.append(speedCenter);
    hudLeft.insertBefore(speedBox, hudLeft.firstChild);
  }

  if (scene && statusBadge && !document.querySelector('.scene-status-wrap')) {
    const statusWrap = document.createElement('div');
    statusWrap.className = 'scene-status-wrap';
    scene.append(statusWrap);
    statusWrap.append(statusBadge);
  }

  speedometer?.classList.add('speedometer-relocated');
  meterCluster?.classList.add('route-wide');
})();