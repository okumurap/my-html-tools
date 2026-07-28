(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const data = {
    train: [
      { value: '0901', title: '普通 0901列車', note: '09:00 坂本車庫発', start: 9 * 3600 },
      { value: '0911', title: '普通 0911列車', note: '09:15 坂本車庫発', start: 9 * 3600 + 15 * 60 },
      { value: '0921', title: '普通 0921列車', note: '09:30 坂本車庫発', start: 9 * 3600 + 30 * 60 }
    ],
    weather: [
      { value: 'clear', title: '晴れ', note: '通常の視界' },
      { value: 'rain', title: '雨', note: '暗めの雨天ビュー' },
      { value: 'evening', title: '夕方', note: '夕焼けの色調' }
    ],
    difficulty: [
      { value: 'beginner', title: '初級', note: 'ガイドを見ながら運転' },
      { value: 'standard', title: '標準', note: '基本の運転評価' },
      { value: 'real', title: '実車寄り', note: '慎重な操作向け' }
    ],
    vehicle: [
      { value: '1000', title: '1000形', note: '海岸線の標準車両' },
      { value: '2000', title: '2000形', note: '新型ワンマン車両' }
    ]
  };

  const defaults = { train: '0901', weather: 'clear', difficulty: 'standard', vehicle: '1000' };
  let state = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem('sakamoto-duty-selection') || '{}');
    Object.keys(defaults).forEach(key => {
      if (data[key].some(item => item.value === saved[key])) state[key] = saved[key];
    });
  } catch (_) {}

  const labelOf = (key, value = state[key]) => data[key].find(item => item.value === value) || data[key][0];
  const optionButtons = (key, extraClass = '') => data[key].map(item =>
    `<button type="button" class="duty-option" data-duty-group="${key}" data-duty-value="${item.value}" aria-pressed="false"><strong>${item.title}</strong><small>${item.note}</small></button>`
  ).join('');

  const screen = document.createElement('section');
  screen.id = 'dutySelection';
  screen.className = 'duty-selection';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-labelledby', 'dutySelectionTitle');
  screen.innerHTML = `
    <div class="duty-card">
      <div class="duty-hero">
        <div class="duty-kicker">SAKAMOTO RAILWAY / CREW ASSIGNMENT</div>
        <div class="duty-title-row">
          <h2 id="dutySelectionTitle" class="duty-title">乗務選択<small>本日の乗務内容を設定してください</small></h2>
          <div class="duty-line-badge"><span>路線</span><strong>海岸線</strong></div>
        </div>
        <div class="duty-route">
          <div class="duty-route-station"><strong>坂本車庫</strong><small>SAKAMOTO DEPOT</small></div>
          <div class="duty-route-track"><i></i></div>
          <div class="duty-route-station" style="text-align:right"><strong>釣り桟橋</strong><small>FISHING PIER</small></div>
        </div>
      </div>
      <div class="duty-form">
        <div class="duty-section"><div class="duty-section-head"><strong>列車</strong><span>全駅停車・4.2 km</span></div><div class="duty-options">${optionButtons('train')}</div></div>
        <div class="duty-section"><div class="duty-section-head"><strong>天候</strong><span>運転ビューへ反映</span></div><div class="duty-options">${optionButtons('weather')}</div></div>
        <div class="duty-section"><div class="duty-section-head"><strong>難易度</strong><span>乗務区分</span></div><div class="duty-options">${optionButtons('difficulty')}</div></div>
        <div class="duty-section"><div class="duty-section-head"><strong>使用車両</strong><span>2両編成</span></div><div class="duty-options two">${optionButtons('vehicle')}</div></div>
        <div class="duty-summary">
          <div><div class="duty-summary-label">SELECTED DUTY</div><div id="dutySummaryMain" class="duty-summary-main"></div><div id="dutySummarySub" class="duty-summary-sub"></div></div>
          <button id="dutyStartBtn" type="button" class="duty-start">乗務開始</button>
        </div>
      </div>
    </div>`;
  document.body.append(screen);

  const scene = $('.scene-wrap');
  if (scene && !$('.scene-weather-layer', scene)) {
    const weatherLayer = document.createElement('div');
    weatherLayer.className = 'scene-weather-layer';
    scene.append(weatherLayer);
  }

  const topActions = $('.top-actions');
  const running = document.createElement('div');
  running.className = 'duty-running-info';
  running.innerHTML = '<div><strong id="dutyRunningMain"></strong><span id="dutyRunningSub"></span></div><button type="button" class="duty-change-btn">乗務変更</button>';
  topActions?.prepend(running);

  function updateSelectionUI() {
    screen.querySelectorAll('[data-duty-group]').forEach(button => {
      button.setAttribute('aria-pressed', String(state[button.dataset.dutyGroup] === button.dataset.dutyValue));
    });
    const train = labelOf('train');
    $('#dutySummaryMain').textContent = `${train.title}　海岸線`;
    $('#dutySummarySub').textContent = `${labelOf('vehicle').title}／${labelOf('weather').title}／${labelOf('difficulty').title}`;
  }

  function updateRunningUI() {
    const train = labelOf('train');
    $('#dutyRunningMain').textContent = train.title;
    $('#dutyRunningSub').textContent = `${labelOf('vehicle').title}・${labelOf('weather').title}・${labelOf('difficulty').title}`;
    const titleLine = document.querySelector('h1 span');
    if (titleLine) titleLine.textContent = `海岸線 ${train.value}`;
  }

  screen.addEventListener('click', event => {
    const button = event.target.closest('[data-duty-group]');
    if (!button) return;
    state[button.dataset.dutyGroup] = button.dataset.dutyValue;
    updateSelectionUI();
  });

  const clock = $('#clock');
  let clockOffset = 0;
  let lastDisplay = '';
  const parseTime = text => {
    const parts = String(text).split(':').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 9 * 3600;
  };
  const formatTime = seconds => {
    const value = ((Math.floor(seconds) % 86400) + 86400) % 86400;
    return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  if (clock) {
    new MutationObserver(() => {
      const current = clock.textContent;
      if (current === lastDisplay) return;
      const desired = formatTime(parseTime(current) + clockOffset);
      lastDisplay = desired;
      if (current !== desired) clock.textContent = desired;
    }).observe(clock, { childList: true, characterData: true, subtree: true });
  }

  function startDuty() {
    const train = labelOf('train');
    clockOffset = train.start - 9 * 3600;
    lastDisplay = '';
    document.body.dataset.weather = state.weather;
    document.body.dataset.difficulty = state.difficulty;
    document.body.dataset.vehicle = state.vehicle;
    try { localStorage.setItem('sakamoto-duty-selection', JSON.stringify(state)); } catch (_) {}
    updateRunningUI();
    $('#resetBtn')?.click();
    screen.hidden = true;
    setTimeout(() => {
      const title = $('#messageTitle');
      const body = $('#messageBody');
      if (title) title.textContent = `${train.title}　乗務開始`;
      if (body) body.textContent = `${labelOf('vehicle').title}／${labelOf('weather').title}／${labelOf('difficulty').title}　戸閉め後、発車してください。`;
    }, 60);
  }

  $('#dutyStartBtn')?.addEventListener('click', startDuty);
  $('.duty-change-btn', running)?.addEventListener('click', () => {
    $('#resetBtn')?.click();
    screen.hidden = false;
    updateSelectionUI();
    screen.scrollTop = 0;
  });

  updateSelectionUI();
  updateRunningUI();
  document.body.dataset.weather = state.weather;
})();
