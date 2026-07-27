(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const controls = $('.controls');
  if (!controls || controls.dataset.dragReady === '1') return;
  controls.dataset.dragReady = '1';
  controls.classList.add('lever-enhanced');

  const powerCard = $('.power-steps')?.closest('.lever-card');
  const brakeCard = $('.brake-steps')?.closest('.lever-card');
  if (!powerCard || !brakeCard) return;

  function panelMarkup(kind, steps, initialIndex, footText) {
    const labels = steps.map((step, index) => {
      const emergency = step.emergency ? ' emergency' : '';
      return `<button type="button" class="drag-notch${emergency}" data-index="${index}">${step.label}</button>`;
    }).join('');
    return `
      <div class="drag-control-panel" data-kind="${kind}">
        <div class="drag-lever-head"><span>上下にドラッグ</span><strong class="drag-lever-readout">${steps[initialIndex].label}</strong></div>
        <div class="drag-lever-body" role="slider" tabindex="0" aria-label="${kind === 'power' ? 'マスコン' : 'ブレーキ'}" aria-valuemin="0" aria-valuemax="${steps.length - 1}" aria-valuenow="${initialIndex}" aria-valuetext="${steps[initialIndex].label}">
          <div class="drag-notch-list">${labels}</div>
          <div class="drag-slot"><div class="drag-guide"><div class="drag-handle"><span>↕</span></div></div></div>
        </div>
        <div class="drag-lever-foot">${footText}</div>
      </div>`;
  }

  const powerSteps = [
    { label: 'P5', selector: '[data-power="5"]' },
    { label: 'P4', selector: '[data-power="4"]' },
    { label: 'P3', selector: '[data-power="3"]' },
    { label: 'P2', selector: '[data-power="2"]' },
    { label: 'P1', selector: '[data-power="1"]' },
    { label: '切', selector: '[data-power="0"]' }
  ];
  const brakeSteps = [
    { label: '解除', selector: '[data-brake="0"]' },
    { label: 'B2', selector: '[data-brake="2"]' },
    { label: 'B4', selector: '[data-brake="4"]' },
    { label: 'B6', selector: '[data-brake="6"]' },
    { label: 'B8', selector: '[data-brake="8"]' },
    { label: '非常', selector: '#emergencyBtn', emergency: true }
  ];

  powerCard.insertAdjacentHTML('beforeend', panelMarkup('power', powerSteps, 5, '上へ動かすほど加速'));
  brakeCard.insertAdjacentHTML('beforeend', panelMarkup('brake', brakeSteps, 4, '下へ引くほど強く制動'));

  function createLever(card, steps, readValue, indexFromValue) {
    const panel = $('.drag-control-panel', card);
    const body = $('.drag-lever-body', panel);
    const guide = $('.drag-guide', panel);
    const handle = $('.drag-handle', panel);
    const readout = $('.drag-lever-readout', panel);
    const notchButtons = [...panel.querySelectorAll('.drag-notch')];
    let pointerId = null;
    let lastTriggered = -1;
    let shownIndex = -1;

    const showIndex = (index) => {
      const safe = clamp(index, 0, steps.length - 1);
      if (safe === shownIndex) return;
      shownIndex = safe;
      handle.style.top = `${safe / (steps.length - 1) * 100}%`;
      readout.textContent = steps[safe].label;
      body.setAttribute('aria-valuenow', String(safe));
      body.setAttribute('aria-valuetext', steps[safe].label);
      notchButtons.forEach((button, i) => button.classList.toggle('active', i === safe));
      panel.classList.toggle('brake-emergency', Boolean(steps[safe].emergency));
    };

    const trigger = (index) => {
      const safe = clamp(index, 0, steps.length - 1);
      if (safe === lastTriggered) return;
      lastTriggered = safe;
      const target = $(steps[safe].selector, card);
      target?.click();
      showIndex(safe);
    };

    const indexAt = (clientY) => {
      const rect = guide.getBoundingClientRect();
      const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
      return Math.round(ratio * (steps.length - 1));
    };

    body.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.drag-notch')) return;
      pointerId = event.pointerId;
      lastTriggered = -1;
      body.classList.add('dragging');
      body.setPointerCapture?.(pointerId);
      trigger(indexAt(event.clientY));
      event.preventDefault();
    });
    body.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      trigger(indexAt(event.clientY));
      event.preventDefault();
    });
    const endDrag = (event) => {
      if (event.pointerId !== pointerId) return;
      trigger(indexAt(event.clientY));
      body.classList.remove('dragging');
      body.releasePointerCapture?.(pointerId);
      pointerId = null;
      lastTriggered = -1;
      event.preventDefault();
    };
    body.addEventListener('pointerup', endDrag);
    body.addEventListener('pointercancel', () => {
      pointerId = null;
      lastTriggered = -1;
      body.classList.remove('dragging');
    });

    notchButtons.forEach((button, index) => button.addEventListener('click', () => {
      lastTriggered = -1;
      trigger(index);
      lastTriggered = -1;
    }));

    body.addEventListener('keydown', (event) => {
      let index = indexFromValue(readValue());
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') index -= 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') index += 1;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = steps.length - 1;
      else return;
      lastTriggered = -1;
      trigger(index);
      lastTriggered = -1;
      event.preventDefault();
    });

    return () => showIndex(indexFromValue(readValue()));
  }

  const syncPower = createLever(
    powerCard,
    powerSteps,
    () => $('#powerValue')?.textContent.trim() || '切',
    (value) => value === '切' ? 5 : clamp(5 - Number(value.replace('P', '')), 0, 5)
  );
  const syncBrake = createLever(
    brakeCard,
    brakeSteps,
    () => $('#brakeValue')?.textContent.trim() || 'B8',
    (value) => value === '非常' ? 5 : value === '解除' ? 0 : clamp(Number(value.replace('B', '')) / 2, 0, 4)
  );

  function sync() {
    syncPower();
    syncBrake();
    requestAnimationFrame(sync);
  }
  sync();
})();

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
        return `<div class="speed-limit-zone" data-zone="${index}" style="left:${left}%;width:${width}%">${zone.limit}</div>`;
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
    const position = progress / 100 * routeLength;

    if (progress !== lastProgress) {
      cursor.style.left = `${progress}%`;
      lastProgress = progress;
    }

    if (limit !== lastLimit) {
      nowLabel.textContent = `現在 ${limit} km/h`;
      lastLimit = limit;
    }

    zoneElements.forEach((element, index) => {
      const zone = zones[index];
      element.classList.toggle('active', position >= zone.start && position < zone.end);
    });
    if (position >= routeLength) zoneElements.at(-1)?.classList.add('active');

    requestAnimationFrame(update);
  }

  update();
})();
