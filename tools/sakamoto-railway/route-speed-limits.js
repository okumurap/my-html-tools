(() => {
  'use strict';

  const routeLine = document.querySelector('.route-line');
  const routeProgress = document.getElementById('routeProgress');
  const speedLimitValue = document.getElementById('speedLimit');
  if (!routeLine || !routeProgress || !speedLimitValue || document.querySelector('.speed-limit-map')) return;

  const zones = [
    { start: 0, end: 300, limit: 35 },
    { start: 300, end: 1220, limit: 60 },
    { start: 1220, end: 1550, limit: 40 },
    { start: 1550, end: 2550, limit: 60 },
    { start: 2550, end: 3120, limit: 45 },
    { start: 3120, end: 3900, limit: 60 },
    { start: 3900, end: 4200, limit: 30 }
  ];
  const routeLength = 4200;

  const map = document.createElement('div');
  map.className = 'speed-limit-map';
  map.innerHTML = `
    <div class="speed-limit-caption">
      <span>速度制限区間</span>
      <strong id="routeLimitNow">現在 35 km/h</strong>
    </div>
    <div class="speed-limit-track" aria-label="路線上の速度制限">
      ${zones.map((zone, index) => {
        const left = zone.start / routeLength * 100;
        const width = (zone.end - zone.start) / routeLength * 100;
        return `<div class="speed-limit-zone" data-zone="${index}" data-limit="${zone.limit}" style="left:${left}%;width:${width}%">${zone.limit}</div>`;
      }).join('')}
      <div id="speedLimitCursor" class="speed-limit-cursor" style="left:0%"></div>
    </div>`;
  routeLine.insertAdjacentElement('afterend', map);

  const cursor = document.getElementById('speedLimitCursor');
  const nowLabel = document.getElementById('routeLimitNow');
  const zoneElements = [...map.querySelectorAll('.speed-limit-zone')];
  let lastProgress = -1;
  let lastLimit = -1;

  function update() {
    const progress = Math.max(0, Math.min(100, parseFloat(routeProgress.style.width) || 0));
    const limit = Number(speedLimitValue.textContent) || 0;

    if (progress !== lastProgress) {
      cursor.style.left = `${progress}%`;
      lastProgress = progress;
    }

    if (limit !== lastLimit) {
      nowLabel.textContent = `現在 ${limit} km/h`;
      const position = progress / 100 * routeLength;
      zoneElements.forEach((element, index) => {
        const zone = zones[index];
        element.classList.toggle('active', position >= zone.start && position < zone.end);
      });
      if (position >= routeLength) zoneElements.at(-1)?.classList.add('active');
      lastLimit = limit;
    } else {
      const position = progress / 100 * routeLength;
      zoneElements.forEach((element, index) => {
        const zone = zones[index];
        element.classList.toggle('active', position >= zone.start && position < zone.end);
      });
    }

    requestAnimationFrame(update);
  }

  update();
})();
