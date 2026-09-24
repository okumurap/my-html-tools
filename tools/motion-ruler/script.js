(() => {
  'use strict';

  const M = window.MotionMeasureMath;
  if (!M) return;
  const $ = id => document.getElementById(id);
  const KEY = 'motion-ruler:v1';
  const ID = [1,0,0,0,1,0,0,0,1];

  const ui = Object.fromEntries([
    ['axisBadge','axisBadge'], ['phase','phaseLabel'], ['main','mainValue'], ['hint','measureHint'], ['ruler','rulerCanvas'],
    ['sensorBadge','sensorBadge'], ['sensorStatus','sensorStatus'], ['enable','enableSensor'], ['retry','retrySensor'],
    ['factor','factorLabel'], ['progress','calibrationProgress'], ['start','startMeasure'], ['stop','stopMeasure'], ['again','measureAgain'],
    ['live','liveMeta'], ['elapsed','elapsedValue'], ['axis','axisValue'], ['orientation','orientationValue'],
    ['result','resultCard'], ['quality','qualityBadge'], ['qualityText','qualityText'], ['resultValue','resultValue'],
    ['duration','durationValue'], ['side','sideValue'], ['endVelocity','endVelocityValue'],
    ['known','knownLength'], ['applyCal','applyCalibration'], ['resetCal','resetCalibration'], ['calStatus','calStatus'],
    ['history','historyList'], ['historyEmpty','historyEmpty'], ['clearHistory','clearHistory']
  ].map(([key,id]) => [key,$(id)]));

  let settings = { factor: 1, history: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Number.isFinite(saved.factor) && saved.factor >= .2 && saved.factor <= 5) settings.factor = saved.factor;
    if (Array.isArray(saved.history)) settings.history = saved.history.slice(0, 8);
  } catch (_) {}

  const st = {
    phase: 'locked', attached: false, motion: false, orient: false, matrix: ID, lastT: 0, kind: null,
    base: [], baseT: 0, bias: {x:0,y:0,z:0}, noise: 0,
    samples: [], t: 0, rotate: 0, total: 0, oriented: 0,
    axis: null, axisCapture: [], liveMm: 0, last: null,
    endBase: [], endT: 0, timer: 0
  };

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} };
  const badge = (el, text, kind = 'wait') => { el.textContent = text; el.className = `badge badge-${kind}`; };
  const fmt = n => Number.isFinite(n) ? n.toFixed(Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 100 ? 1 : 2) : '—';
  const finite = v => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  const setReading = (value, phase) => {
    ui.main.textContent = Number.isFinite(value) ? fmt(Math.max(0, value)) : '0.0';
    ui.phase.textContent = phase;
    drawRuler(Number.isFinite(value) ? Math.max(0, value) : 0);
  };
  const dtFor = e => {
    const interval = Number(e.interval);
    if (interval > 0) return M.clamp(interval / 1000, .005, .1);
    const now = performance.now();
    const dt = st.lastT ? (now - st.lastT) / 1000 : 1 / 60;
    st.lastT = now;
    return M.clamp(dt, .005, .1);
  };
  const rotation = e => {
    const r = e.rotationRate || {};
    return Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0);
  };

  function vector(e, forced = null) {
    const kind = forced || (finite(e.acceleration) ? 'linear' : finite(e.accelerationIncludingGravity) ? 'gravity' : null);
    const raw = kind === 'linear' ? e.acceleration : kind === 'gravity' ? e.accelerationIncludingGravity : null;
    if (!finite(raw)) return null;
    return { kind, world: M.rotateVector({x:raw.x,y:raw.y,z:raw.z}, st.orient ? st.matrix : ID) };
  }

  function onOrientation(e) {
    if (![e.alpha, e.beta, e.gamma].every(Number.isFinite)) return;
    st.orient = true;
    st.matrix = M.rotationMatrix(e.alpha, e.beta, e.gamma);
    ui.orientation.textContent = '3D補正 ON';
  }

  function onMotion(e) {
    const dt = dtFor(e);
    if (!st.motion) {
      st.motion = true;
      st.phase = 'ready';
      clearTimeout(st.timer);
      badge(ui.sensorBadge, '接続済み', 'ok');
      ui.sensorStatus.textContent = st.orient ? 'モーションと姿勢情報を受信しています。' : 'モーション受信中。大きな回転は避けてください。';
      ui.start.disabled = false;
      ui.enable.hidden = true;
      ui.retry.hidden = true;
      setReading(0, '準備OK');
      ui.hint.textContent = 'スマホの端を始点に当てて「測定開始」を押します。';
    }

    if (st.phase === 'ready' || st.phase === 'result') return;

    if (st.phase === 'calibrating') {
      const p = vector(e, st.kind);
      if (!p) return;
      if (!st.kind) st.kind = p.kind;
      st.baseT += dt;
      st.base.push(p.world);
      if (st.base.length > 220) st.base.shift();
      ui.progress.firstElementChild.style.width = `${Math.min(100, st.baseT / .6 * 100)}%`;
      ui.elapsed.textContent = `${st.baseT.toFixed(2)} s`;
      if (st.baseT >= .6 && st.base.length >= 12) {
        const mean = M.meanVector(st.base);
        const sd = M.vectorStd(st.base, mean);
        if (sd <= .24) beginMeasure(mean, sd);
        else if (st.baseT >= 1.8) calibrationFail(sd);
      }
      return;
    }

    if (st.phase === 'measuring') {
      const p = vector(e, st.kind);
      if (!p) return;
      let a = M.sub(p.world, st.bias);
      let mag = M.magnitude(a);
      const floor = M.clamp(Math.max(.025, st.noise * 2.2), .025, .14);
      if (mag < floor) a = {x:0,y:0,z:0};
      else if (mag > 35) a = M.scale(a, 35 / mag);

      st.t += dt;
      st.rotate = Math.max(st.rotate, rotation(e));
      st.total += 1;
      if (st.orient) st.oriented += 1;

      if (!st.axis) {
        if (M.magnitude(a) > Math.max(.14, floor * 1.3)) st.axisCapture.push(a);
        if (st.axisCapture.length >= 4 || (st.t > .45 && st.axisCapture.length)) {
          st.axis = M.lockAxis(st.axisCapture);
          if (st.axis) {
            badge(ui.axisBadge, '方向ロック', 'ok');
            ui.axis.textContent = axisName(st.axis);
            ui.hint.textContent = 'その方向のまま終点まで滑らせてください。';
          }
        }
      }

      st.samples.push({ t: st.t, a });
      if (st.samples.length > 1400) st.samples.shift();
      ui.elapsed.textContent = `${st.t.toFixed(2)} s`;

      if (st.axis && st.samples.length % 3 === 0) {
        const provisional = M.integrateAxisSamples(st.samples, st.axis, settings.factor);
        st.liveMm = Math.max(st.liveMm, provisional.distanceMm);
        setReading(st.liveMm, '測定中');
      } else if (!st.axis) {
        setReading(0, '方向を検出中');
      }

      if (st.t >= 5) requestStop('timeout');
      return;
    }

    if (st.phase === 'ending') {
      const p = vector(e, st.kind);
      if (!p) return;
      st.endT += dt;
      st.endBase.push(M.sub(p.world, st.bias));
      if (st.endBase.length > 180) st.endBase.shift();
      ui.progress.firstElementChild.style.width = `${Math.min(100, st.endT / .4 * 100)}%`;
      ui.elapsed.textContent = `${(st.t + st.endT).toFixed(2)} s`;
      if (st.endT >= .4 && st.endBase.length >= 8) finalizeMeasurement();
    }
  }

  function startCalibration() {
    if (!st.motion || !['ready','result'].includes(st.phase)) return;
    Object.assign(st, {
      phase:'calibrating', kind:null, base:[], baseT:0, bias:{x:0,y:0,z:0}, noise:0,
      samples:[], t:0, rotate:0, total:0, oriented:0, axis:null, axisCapture:[], liveMm:0,
      endBase:[], endT:0
    });
    ui.result.hidden = true;
    ui.start.hidden = true;
    ui.stop.hidden = true;
    ui.again.hidden = true;
    ui.live.hidden = false;
    ui.progress.hidden = false;
    ui.progress.firstElementChild.style.width = '0%';
    badge(ui.axisBadge, '方向未設定', 'wait');
    ui.axis.textContent = '—';
    ui.elapsed.textContent = '0.00 s';
    setReading(0, '静止補正中');
    ui.hint.textContent = '約0.6秒、そのまま動かさないでください。';
  }

  function calibrationFail(sd) {
    st.phase = 'ready';
    ui.progress.hidden = true;
    ui.start.hidden = false;
    setReading(0, '静止できませんでした');
    ui.hint.textContent = `静止時ノイズ ${sd.toFixed(2)} m/s²。もう一度開始してください。`;
  }

  function beginMeasure(mean, sd) {
    st.phase = 'measuring';
    st.bias = mean;
    st.noise = sd;
    st.samples = [{t:0,a:{x:0,y:0,z:0}}];
    st.t = 0;
    st.rotate = 0;
    st.total = 0;
    st.oriented = 0;
    st.axis = null;
    st.axisCapture = [];
    st.liveMm = 0;
    ui.progress.hidden = true;
    ui.stop.hidden = false;
    setReading(0, '方向を検出中');
    ui.hint.textContent = '始点から終点へ、1方向だけに滑らせてください。';
    if (navigator.vibrate) navigator.vibrate(35);
  }

  function requestStop(reason = 'manual') {
    if (st.phase !== 'measuring') return;
    st.phase = 'ending';
    ui.stop.hidden = true;
    st.endBase = [];
    st.endT = 0;
    st.stopReason = reason;
    ui.progress.hidden = false;
    ui.progress.firstElementChild.style.width = '0%';
    setReading(st.liveMm, '終点で静止確認中');
    ui.hint.textContent = 'そのまま約0.4秒、スマホを動かさないでください。';
  }

  function finalizeMeasurement() {
    if (st.phase !== 'ending') return;
    st.phase = 'result';
    ui.progress.hidden = true;
    const endResidual = M.meanVector(st.endBase);
    const r = st.axis ? M.integrateAxisSamples(st.samples, st.axis, settings.factor, endResidual) : null;
    const q = quality(r, endResidual);
    st.last = r ? {...r, quality:q, endResidual, reason:st.stopReason || 'manual'} : null;

    ui.again.hidden = false;
    ui.result.hidden = false;
    ui.applyCal.disabled = !r || r.rawMm < 1;
    badge(ui.quality, q.label, q.kind);
    ui.qualityText.textContent = q.text;

    const distance = r ? r.distanceMm : 0;
    ui.resultValue.textContent = fmt(distance);
    ui.duration.textContent = r ? r.duration.toFixed(2) : '—';
    ui.side.textContent = r ? r.sideAccelRms.toFixed(2) : '—';
    ui.endVelocity.textContent = r ? r.rawEndVelocity.toFixed(2) : '—';
    setReading(distance, r ? '測定結果' : '測定失敗');
    ui.hint.textContent = r ? '結果は概算です。必要なら既知寸法で校正してください。' : '方向を認識できませんでした。もう一度測ってください。';

    if (r) addHistory(r, q);
    if (navigator.vibrate) navigator.vibrate([25,45,25]);
  }

  function quality(r, endResidual) {
    if (!r) return { label:'再測定推奨', kind:'bad', text:'測定方向を認識できませんでした。' };
    let score = 100;
    const notes = [];
    const endNoise = M.vectorStd(st.endBase, M.meanVector(st.endBase));
    if (st.noise > .12) { score -= 20; notes.push('開始時の静止が不安定'); }
    if (endNoise > .16) { score -= 20; notes.push('終了時の静止が不安定'); }
    if (M.magnitude(endResidual) > .25) { score -= 15; notes.push('センサーバイアス変化が大きい'); }
    if (st.rotate > 35) { score -= 20; notes.push('測定中の回転が大きい'); }
    if (r.rawEndVelocity > .18) { score -= 20; notes.push('終端速度補正が大きい'); }
    if (r.duration > 2.5) { score -= 10; notes.push('測定時間が長い'); }
    if (r.rawMm < 20) { score -= 10; notes.push('短距離'); }
    if (r.sideAccelRms > .45) { score -= 15; notes.push('横方向の揺れが大きい'); }
    if (st.total && st.oriented / st.total < .6) { score -= 10; notes.push('姿勢補正不足'); }
    score = M.clamp(score, 0, 100);
    return {
      label: score >= 75 ? 'センサー状態 良好' : score >= 50 ? 'センサー状態 注意' : '再測定推奨',
      kind: score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'bad',
      text: (notes.length ? notes.join(' / ') : '開始・終了・方向固定の状態は良好です。') + ' ※寸法精度の保証ではありません。'
    };
  }

  function axisName(axis) {
    const values = [['X', Math.abs(axis.x)], ['Y', Math.abs(axis.y)], ['Z', Math.abs(axis.z)]].sort((a,b) => b[1] - a[1]);
    return `${values[0][0]}主体`;
  }

  function drawRuler(valueMm) {
    const canvas = ui.ruler;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, rect.width || 600);
    const h = Math.max(90, w / 4);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--text').trim();
    const muted = css.getPropertyValue('--muted').trim();
    const border = css.getPropertyValue('--border').trim();
    const accent = css.getPropertyValue('--accent').trim();
    ctx.clearRect(0, 0, w, h);

    const pointerX = w * .24;
    const pxPerMm = M.clamp(w / 145, 1.8, 4.2);
    const startMm = valueMm - pointerX / pxPerMm;
    const endMm = valueMm + (w - pointerX) / pxPerMm;
    const first = Math.max(0, Math.floor(startMm));
    const last = Math.ceil(endMm);

    ctx.strokeStyle = border;
    ctx.fillStyle = muted;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let mm = first; mm <= last; mm += 1) {
      const x = pointerX + (mm - valueMm) * pxPerMm;
      if (x < -2 || x > w + 2) continue;
      const major = mm % 10 === 0;
      const mid = !major && mm % 5 === 0;
      const top = major ? 20 : mid ? 34 : 45;
      const bottom = major ? h - 28 : mid ? h - 35 : h - 42;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      if (major && x > 14 && x < w - 14) {
        ctx.fillStyle = text;
        ctx.fillText(String(mm), x, h - 24);
        ctx.fillStyle = muted;
      }
    }

    const zeroX = pointerX - valueMm * pxPerMm;
    if (zeroX >= 0 && zeroX <= w) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(zeroX, 12); ctx.lineTo(zeroX, h - 10); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('START', zeroX, 2);
    }
  }

  async function enable() {
    clearTimeout(st.timer);
    if (!window.isSecureContext) {
      badge(ui.sensorBadge, 'HTTPS必要', 'bad');
      ui.sensorStatus.textContent = 'HTTPSまたはlocalhostで開いてください。';
      return;
    }
    if (!('DeviceMotionEvent' in window)) {
      badge(ui.sensorBadge, '非対応', 'bad');
      ui.sensorStatus.textContent = 'DeviceMotion非対応です。';
      return;
    }
    ui.enable.disabled = true;
    badge(ui.sensorBadge, '許可確認中', 'wait');
    try {
      const motionPermission = typeof DeviceMotionEvent.requestPermission === 'function' ? await DeviceMotionEvent.requestPermission() : 'granted';
      if (motionPermission !== 'granted') throw new Error('モーションセンサーが許可されませんでした。');
      let orientationPermission = 'granted';
      if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission === 'function') {
        orientationPermission = await DeviceOrientationEvent.requestPermission().catch(() => 'denied');
      }
      if (!st.attached) {
        addEventListener('devicemotion', onMotion, {passive:true});
        if ('DeviceOrientationEvent' in window) addEventListener('deviceorientation', onOrientation, {passive:true});
        st.attached = true;
      }
      badge(ui.sensorBadge, '接続待ち', 'wait');
      ui.sensorStatus.textContent = orientationPermission === 'granted' ? '端末を少し動かしてください。' : '姿勢情報なしで接続します。';
      st.timer = setTimeout(() => {
        if (!st.motion) { badge(ui.sensorBadge, '応答なし', 'warn'); ui.retry.hidden = false; }
      }, 2200);
    } catch (error) {
      badge(ui.sensorBadge, '許可されていません', 'bad');
      ui.sensorStatus.textContent = error.message || 'センサーを有効化できません。';
      ui.retry.hidden = false;
    } finally {
      ui.enable.disabled = false;
    }
  }

  function applyCalibration() {
    const known = Number(ui.known.value);
    const raw = st.last?.rawMm;
    if (!(known >= 10 && known <= 2000)) {
      ui.calStatus.textContent = '既知寸法は10〜2000 mmで入力してください。';
      return;
    }
    if (!(raw >= 1)) {
      ui.calStatus.textContent = '先に既知寸法を測定してください。';
      return;
    }
    const factor = known / raw;
    if (factor < .2 || factor > 5) {
      ui.calStatus.textContent = '補正倍率が範囲外です。再測定してください。';
      return;
    }
    settings.factor = factor;
    save();
    updateFactor();
    ui.calStatus.textContent = `補正 ${factor.toFixed(3)}× を保存しました。`;
  }

  function updateFactor() { ui.factor.textContent = `補正 ${settings.factor.toFixed(3)}×`; }

  function addHistory(r, q) {
    settings.history.unshift({ at:Date.now(), mode:'axis', distance:r.distanceMm, straight:r.distanceMm, quality:q.label });
    settings.history = settings.history.slice(0, 8);
    save();
    renderHistory();
  }

  function renderHistory() {
    ui.history.replaceChildren();
    ui.historyEmpty.hidden = settings.history.length > 0;
    settings.history.forEach(item => {
      const distance = Number.isFinite(item.distance) ? item.distance : Number.isFinite(item.straight) ? item.straight : Number.isFinite(item.path) ? item.path : 0;
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      const small = document.createElement('small');
      strong.textContent = `${fmt(distance)} mm`;
      small.textContent = `${new Date(item.at || Date.now()).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${item.quality || '—'}`;
      li.append(strong, small);
      ui.history.append(li);
    });
  }

  function ready() {
    if (!st.motion) return;
    st.phase = 'ready';
    ui.start.hidden = false;
    ui.stop.hidden = true;
    ui.again.hidden = true;
    ui.progress.hidden = true;
    ui.live.hidden = false;
    badge(ui.axisBadge, '方向未設定', 'wait');
    ui.axis.textContent = '—';
    setReading(0, '準備OK');
    ui.hint.textContent = 'スマホの端を始点に当てて「測定開始」を押します。';
  }

  ui.enable.addEventListener('click', enable);
  ui.retry.addEventListener('click', enable);
  ui.start.addEventListener('click', startCalibration);
  ui.stop.addEventListener('click', () => requestStop('manual'));
  ui.again.addEventListener('click', startCalibration);
  ui.applyCal.addEventListener('click', applyCalibration);
  ui.resetCal.addEventListener('click', () => {
    settings.factor = 1;
    save();
    updateFactor();
    ui.calStatus.textContent = '補正を1.000×に戻しました。';
  });
  ui.clearHistory.addEventListener('click', () => { settings.history = []; save(); renderHistory(); });
  addEventListener('resize', () => requestAnimationFrame(() => drawRuler(Number(ui.main.textContent) || 0)));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['calibrating','measuring','ending'].includes(st.phase)) {
      ready();
      ui.hint.textContent = '画面が非表示になったため測定を中止しました。';
    }
  });

  updateFactor();
  renderHistory();
  drawRuler(0);
})();
