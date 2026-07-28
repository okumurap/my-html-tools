(() => {
  'use strict';
  const scene = document.querySelector('.scene-wrap');
  const hudLeft = document.querySelector('.hud-left');
  const speedCenter = document.querySelector('.speed-center');
  const speedometer = document.querySelector('.speedometer');
  const meterCluster = document.querySelector('.meter-cluster');

  if (scene && !document.querySelector('.curve-ground-cover')) {
    const cover = document.createElement('div');
    cover.className = 'curve-ground-cover';
    scene.append(cover);
  }

  if (scene && hudLeft && speedCenter && !document.querySelector('.hud-speed')) {
    const speedBox = document.createElement('div');
    speedBox.className = 'hud-speed';
    speedBox.innerHTML = '<span class="hud-speed-label">速度</span>';
    speedBox.append(speedCenter);
    hudLeft.insertBefore(speedBox, hudLeft.firstChild);
  }

  speedometer?.classList.add('speedometer-relocated');
  meterCluster?.classList.add('route-wide');
})();
