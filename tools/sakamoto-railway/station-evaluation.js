(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const routeLength = 4200;
  const stationPositions = { '滑走台跡前': 1400, '河和海岸': 2900, '釣り桟橋': 4200 };
  const arrivalOffsets = { '滑走台跡前': 95, '河和海岸': 200, '釣り桟橋': 300 };
  const trainStarts = { '0901': 9 * 3600, '0911': 9 * 3600 + 15 * 60, '0921': 9 * 3600 + 30 * 60 };

  const nextStation = $('#nextStation');
  const distanceEl = $('#distance');
  const speedEl = $('#speed');
  const limitEl = $('#speedLimit');
  const brakeEl = $('#brakeValue');
  const comfortEl = $('#comfortValue');
  const clockEl = $('#clock');
  const routeProgress = $('#routeProgress');
  const messageTitle = $('#messageTitle');
  const messageBody = $('#messageBody');
  if (!nextStation || !speedEl || !limitEl || !brakeEl || !comfortEl || !clockEl || !routeProgress || !messageBody) return;

  const overlay = document.createElement('section');
  overlay.id = 'stationEvaluation';
  overlay.className = 'station-evaluation';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'stationEvalTitle');
  overlay.innerHTML = `
    <div class="station-eval-card">
      <div class="station-eval-head">
        <div class="station-eval-kicker">ARRIVAL PERFORMANCE REPORT</div>
        <div class="station-eval-title-row">
          <h2 id="stationEvalTitle" class="station-eval-title"><span id="stationEvalName">滑走台跡前</span><small>停車評価</small></h2>
          <div id="stationEvalRank" class="station-eval-rank">A</div>
        </div>
      </div>
      <div class="station-eval-body">
        <div class="station-eval-summary"><strong id="stationEvalHeadline">良い停車です</strong><span id="stationEvalStopPoints">90 pt</span></div>
        <div class="station-eval-grid">
          <div class="station-eval-metric"><span>停止位置</span><strong id="stationEvalError">±0.0 m</strong><small id="stationEvalErrorSub"></small></div>
          <div class="station-eval-metric"><span>到着時刻</span><strong id="stationEvalArrival">09:01:35</strong><small id="stationEvalTimeDiff"></small></div>
          <div class="station-eval-metric"><span>区間最高速度</span><strong id="stationEvalMaxSpeed">0 km/h</strong><small>実速度</small></div>
          <div class="station-eval-metric"><span>最大速度超過</span><strong id="stationEvalOverspeed">0 km/h</strong><small id="stationEvalSafetySub"></small></div>
          <div class="station-eval-metric"><span>ブレーキ開始</span><strong id="stationEvalBrakeStart">未検出</strong><small>最初の制動操作</small></div>
          <div class="station-eval-metric"><span>乗り心地</span><strong id="stationEvalComfort">100</strong><small id="stationEvalComfortSub"></small></div>
        </div>
        <p id="stationEvalComment" class="station-eval-comment"></p>
        <div class="station-eval-actions">
          <div class="station-eval-score">区間総合評価<strong id="stationEvalScore">0 / 100</strong></div>
          <button id="stationEvalContinue" type="button" class="station-eval-continue">次の駅へ</button>
        </div>
      </div>
    </div>`;
  document.body.append(overlay);

  const parseClock = text => {
    const parts = String(text).split(':').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
  };
  const formatClock = seconds => {
    const value = ((Math.floor(seconds) % 86400) + 86400) % 86400;
    return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const routePosition = () => clamp(parseFloat(routeProgress.style.width) || 0, 0, 100) / 100 * routeLength;
  const trainStart = () => {
    try {
      const selection = JSON.parse(localStorage.getItem('sakamoto-duty-selection') || '{}');
      return trainStarts[selection.train] ?? trainStarts['0901'];
    } catch (_) {
      return trainStarts['0901'];
    }
  };
  const scheduledArrival = station => trainStart() + (arrivalOffsets[station] || 0);
  const timeDifferenceLabel = diff => {
    const seconds = Math.round(Math.abs(diff));
    if (seconds <= 1) return '定刻';
    return `${seconds}秒${diff > 0 ? '遅れ' : '早着'}`;
  };
  const newSegment = target => ({
    target,
    startComfort: Number(comfortEl.textContent) || 100,
    maxSpeed: 0,
    maxExcess: 0,
    brakeStartDistance: null,
    released: brakeEl.textContent.trim() === '解除',
    previousBrake: brakeEl.textContent.trim()
  });

  let targetName = nextStation.textContent.trim();
  let segment = newSegment(targetName);
  let arrivedCandidate = null;
  let lastResultSignature = '';
  const evaluated = new Set();
  let pendingTimer = 0;

  function snapshot(name, source = segment) {
    return {
      name,
      position: routePosition(),
      arrival: parseClock(clockEl.textContent),
      maxSpeed: source.maxSpeed,
      maxExcess: source.maxExcess,
      brakeStartDistance: source.brakeStartDistance,
      startComfort: source.startComfort,
      comfort: Number(comfortEl.textContent) || 0
    };
  }

  function rankFor(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    return 'D';
  }

  function showEvaluation(result) {
    if (evaluated.has(result.name)) return;
    evaluated.add(result.name);

    const stationPos = stationPositions[result.name] ?? result.position;
    const signedError = result.position - stationPos;
    const scheduled = scheduledArrival(result.name);
    const timeDiff = result.arrival - scheduled;
    const timeScore = Math.abs(timeDiff) <= 5 ? 100 : Math.abs(timeDiff) <= 15 ? 90 : Math.abs(timeDiff) <= 30 ? 75 : clamp(105 - Math.abs(timeDiff), 35, 70);
    const safetyScore = result.maxExcess <= .5 ? 100 : result.maxExcess <= 2 ? 90 : result.maxExcess <= 5 ? 70 : result.maxExcess <= 10 ? 45 : 20;
    const comfortScore = clamp(result.comfort, 0, 100);
    const total = Math.round(result.stopPoints * .5 + timeScore * .2 + safetyScore * .2 + comfortScore * .1);
    const rank = rankFor(total);
    const absError = Math.abs(signedError);
    const errorText = absError < .05 ? '±0.0 m' : `${signedError > 0 ? '+' : '−'}${absError.toFixed(1)} m`;
    const errorMeaning = absError < .05 ? '停止位置ぴったり' : signedError > 0 ? '停止位置を通過' : '停止位置の手前';
    const comfortDrop = Math.max(0, result.startComfort - result.comfort);
    const overspeed = Math.max(0, result.maxExcess);
    const brakeStart = result.brakeStartDistance == null ? '未検出' : `${Math.round(result.brakeStartDistance)} m手前`;

    let headline = absError < 3 ? '停止位置は良好です' : absError < 8 ? '概ね良い停車です' : '停止位置に注意してください';
    const comments = [];
    if (absError < 3) comments.push('停止精度は良好でした。');
    else comments.push('ホーム進入時は速度を早めに落とすと、停止位置を合わせやすくなります。');
    if (Math.abs(timeDiff) <= 10) comments.push('ダイヤにもほぼ正確です。');
    else if (timeDiff > 0) comments.push('少し遅れているため、次区間は力行終了のタイミングを意識しましょう。');
    else comments.push('早着傾向です。駅間では制限速度内で無理に詰める必要はありません。');
    if (overspeed > .5) comments.push(`最大${overspeed.toFixed(1)} km/hの速度超過がありました。`);
    if (result.brakeStartDistance == null) comments.push('ブレーキ開始位置は検出できませんでした。');

    $('#stationEvalName').textContent = result.name;
    $('#stationEvalRank').textContent = rank;
    $('#stationEvalHeadline').textContent = headline;
    $('#stationEvalStopPoints').textContent = `${result.stopPoints} pt`;
    $('#stationEvalError').textContent = errorText;
    $('#stationEvalErrorSub').textContent = `${errorMeaning}／停止 ${result.stopPoints}点`;
    $('#stationEvalArrival').textContent = formatClock(result.arrival);
    $('#stationEvalTimeDiff').textContent = `予定 ${formatClock(scheduled)}／${timeDifferenceLabel(timeDiff)}`;
    $('#stationEvalMaxSpeed').textContent = `${Math.round(result.maxSpeed)} km/h`;
    $('#stationEvalOverspeed').textContent = `${overspeed.toFixed(1)} km/h`;
    $('#stationEvalSafetySub').textContent = overspeed <= .5 ? '速度超過なし' : `安全評価 ${safetyScore}点`;
    $('#stationEvalBrakeStart').textContent = brakeStart;
    $('#stationEvalComfort').textContent = String(Math.round(result.comfort));
    $('#stationEvalComfortSub').textContent = comfortDrop > 0 ? `区間 −${Math.round(comfortDrop)}` : '低下なし';
    $('#stationEvalComment').textContent = comments.join(' ');
    $('#stationEvalScore').textContent = `${total} / 100`;
    const terminal = result.name === '釣り桟橋';
    $('#stationEvalContinue').textContent = terminal ? '総合成績へ' : '次の駅へ';
    overlay.dataset.terminal = String(terminal);
    overlay.hidden = false;
    $('#stationEvalContinue').focus({ preventScroll: true });
  }

  function evaluateFromMessage() {
    const match = messageBody.textContent.match(/停止誤差\s*([\d.]+)\s*m／(\d+)\s*pt/);
    if (!match) return;
    const signature = `${messageTitle?.textContent || ''}|${messageBody.textContent}`;
    if (signature === lastResultSignature) return;
    lastResultSignature = signature;

    let result;
    if (arrivedCandidate && !evaluated.has(arrivedCandidate.name)) {
      result = { ...arrivedCandidate, stopPoints: Number(match[2]) };
      arrivedCandidate = null;
    } else if (targetName === '釣り桟橋' && !evaluated.has(targetName)) {
      result = { ...snapshot(targetName), stopPoints: Number(match[2]) };
    }
    if (!result) return;

    clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => showEvaluation(result), result.name === '釣り桟橋' ? 1350 : 180);
  }

  function resetTracking() {
    clearTimeout(pendingTimer);
    overlay.hidden = true;
    evaluated.clear();
    arrivedCandidate = null;
    lastResultSignature = '';
    targetName = nextStation.textContent.trim();
    segment = newSegment(targetName);
  }

  $('#stationEvalContinue').addEventListener('click', () => {
    overlay.hidden = true;
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('#resetBtn,#retryBtn,#dutyStartBtn,.duty-change-btn');
    if (target) setTimeout(resetTracking, 100);
  });

  function tick() {
    const currentTarget = nextStation.textContent.trim();
    const speed = Number(speedEl.textContent) || 0;
    const limit = Number(limitEl.textContent) || 0;
    const brake = brakeEl.textContent.trim();
    const distance = Number(String(distanceEl?.textContent || '').replace(/,/g, ''));

    segment.maxSpeed = Math.max(segment.maxSpeed, speed);
    segment.maxExcess = Math.max(segment.maxExcess, speed - limit);
    if (brake === '解除') segment.released = true;
    if (segment.released && segment.previousBrake === '解除' && brake !== '解除' && speed > 3 && segment.brakeStartDistance == null && Number.isFinite(distance)) {
      segment.brakeStartDistance = distance;
    }
    segment.previousBrake = brake;

    if (currentTarget !== targetName) {
      arrivedCandidate = snapshot(targetName, segment);
      targetName = currentTarget;
      segment = newSegment(targetName);
    }

    evaluateFromMessage();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
