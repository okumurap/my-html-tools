(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const card = $('#tapCard');
  const cardTitle = $('#cardTitle');
  const cardText = $('#cardText');
  const startButton = $('#startButton');
  const driveControls = $('#driveControls');
  const boostButton = $('#boostButton');
  const brakeButton = $('#brakeButton');
  const hornButton = $('#hornButton');
  const soundButton = $('#soundButton');
  const fullscreenButton = $('#fullscreenButton');
  const toastNode = $('#toast');
  const hint = $('#hint');
  const status = $('#status');
  const dots = [...document.querySelectorAll('.dot')];
  const choices = [...document.querySelectorAll('.train-choice')];

  if (!ctx) {
    cardTitle.textContent = 'このブラウザでは うごかせません';
    cardText.textContent = 'ほかのブラウザで あそんでね';
    startButton.disabled = true;
    status.textContent = 'Canvasに対応していないためゲームを表示できません。';
    return;
  }

  const KEY = 'train-crossing:v2:';
  const read = (key, fallback) => {
    try { return localStorage.getItem(KEY + key) ?? fallback; } catch (_) { return fallback; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(KEY + key, String(value)); } catch (_) { /* プライベートモードでも遊べる */ }
  };
  const stations = ['パンダえき', 'おはなえき', 'うみえき', 'ほしぞらえき', 'りんごえき'];
  const starsAt = [600, 1250, 1960];
  const CROSSING = 910;
  const TUNNEL_START = 1420;
  const TUNNEL_END = 1830;
  const DESTINATION = 2290;
  const TAU = Math.PI * 2;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const storedTrips = Number(read('trips', '0'));
  let trips = Number.isSafeInteger(storedTrips) ? clamp(storedTrips, 0, 999999) : 0;
  let trainType = ['local', 'bullet', 'steam'].includes(read('train', 'local')) ? read('train', 'local') : 'local';
  let soundOn = read('sound', 'true') !== 'false';
  let state = 'idle';
  let width = 375;
  let height = 650;
  let ratio = 1;
  let trackHeight = 440;
  let trainX = 160;
  let speed = 0;
  let boost = 0;
  let braking = false;
  let gateDown = 0;
  let cameraX = 0;
  let collected = new Set();
  let progress = -1;
  let confetti = [];
  let particles = [];
  let popupUntil = 0;
  let lastTime = 0;
  let audio = null;
  let nextClack = 0;
  let nextBell = 0;
  let stageAnnounced = -1;
  let lastHorn = 0;
  let runSeed = 0;

  const announce = text => { status.textContent = text; };
  const showToast = (text, now = performance.now(), duration = 1550) => {
    toastNode.textContent = text;
    popupUntil = now + duration;
    toastNode.classList.add('is-visible');
  };
  const updateRoute = () => {
    const routeTrip = state === 'done' ? trips - 1 : trips;
    $('#routeName').textContent = `${stations[routeTrip % stations.length]} → ${stations[(routeTrip + 1) % stations.length]}`;
    $('#tripCount').textContent = `のった ${trips}かい`;
    $('#starCount').textContent = `${collected.size} / ${starsAt.length}`;
  };
  const setPhase = text => { $('#routePhase').textContent = text; };
  const setProgress = step => {
    if (progress === step) return;
    progress = step;
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-current', index === step);
      dot.classList.toggle('is-done', index < step);
      if (index === step) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
  };
  const setTrain = type => {
    if (!['local', 'bullet', 'steam'].includes(type)) return;
    trainType = type;
    save('train', type);
    choices.forEach(button => {
      const selected = button.dataset.train === type;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const name = { local: 'ふつうでんしゃ', bullet: 'しんかんせん', steam: 'きかんしゃ' }[type];
    announce(`${name}を選びました。出発ボタンを押してください。`);
  };

  const resize = () => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    trackHeight = Math.round(height * (height < 470 ? 0.73 : 0.69));
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const unlockSound = () => {
    if (!soundOn) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audio && Audio) audio = new Audio();
      if (audio?.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) { audio = null; }
  };
  const tone = (freq, seconds = .12, type = 'sine', volume = .045, delay = 0) => {
    if (!soundOn) return;
    unlockSound();
    if (!audio) return;
    try {
      const now = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds + .04);
    } catch (_) { /* 一部のブラウザでは音無しで続行 */ }
  };
  const horn = () => {
    const now = performance.now();
    if (now - lastHorn < 380) return;
    lastHorn = now;
    tone(392, .25, 'triangle', .085);
    tone(523, .37, 'triangle', .055, .1);
    showToast('プップー！');
    announce('警笛を鳴らしました。プップー！');
  };
  const bell = () => { tone(920, .095, 'square', .025); tone(760, .1, 'square', .025, .115); };
  const success = () => [523, 659, 784, 1047].forEach((pitch, i) => tone(pitch, .22, 'triangle', .062, i * .14));
  const wheelSound = () => { tone(128, .04, 'square', .013); tone(102, .03, 'square', .011, .06); };

  const spark = (x, y, count, colors = ['#ffd24a', '#fff', '#f86f83']) => {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + Math.random() * .28;
      const force = 75 + Math.random() * 185;
      particles.push({ x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force - 25,
        life: .8 + Math.random() * .6, maxLife: 1.4, size: 3 + Math.random() * 5, color: colors[i % colors.length] });
    }
    if (particles.length > 100) particles = particles.slice(-100);
  };
  const celebrate = () => {
    if (reducedMotion) return;
    confetti = Array.from({ length: 70 }, (_, i) => ({
      x: width * .5 + (Math.random() - .5) * 220, y: height * .25 - Math.random() * 85,
      vx: (Math.random() - .5) * 300, vy: -70 - Math.random() * 190,
      spin: (Math.random() - .5) * 12, angle: Math.random() * TAU,
      size: 4 + Math.random() * 6, life: 2.3 + Math.random() * 1.5,
      color: ['#ff5e64', '#f9d83c', '#48b7fa', '#6acb83', '#a079ef'][i % 5]
    }));
  };

  const start = () => {
    if (state !== 'idle' && state !== 'done') return;
    unlockSound();
    state = 'running';
    speed = 34;
    boost = .4;
    braking = false;
    trainX = 160;
    cameraX = 0;
    gateDown = 0;
    collected.clear();
    particles = [];
    confetti = [];
    nextBell = 0;
    nextClack = 0;
    stageAnnounced = -1;
    runSeed += 7;
    card.classList.add('is-hidden');
    driveControls.hidden = false;
    hint.textContent = 'がめんタップでも はやくなるよ';
    setPhase('はしっているよ！');
    setProgress(0);
    updateRoute();
    tone(659, .19, 'triangle', .055);
    tone(880, .28, 'triangle', .052, .15);
    showToast('しゅっぱつ しんこう！');
    announce('電車が出発しました。スピードアップ、ブレーキ、警笛が使えます。');
  };
  const reset = () => {
    state = 'idle';
    speed = 0;
    boost = 0;
    braking = false;
    trainX = 160;
    cameraX = 0;
    gateDown = 0;
    collected.clear();
    confetti = [];
    particles = [];
    setProgress(0);
    setPhase('しゅっぱつ じゅんび');
    cardTitle.textContent = 'どのでんしゃに する？';
    cardText.textContent = `${stations[(trips + 1) % stations.length]}へ いこう！`;
    startButton.textContent = '▶ しゅっぱつ！';
    card.classList.remove('is-hidden');
    driveControls.hidden = true;
    brakeButton.classList.remove('is-held');
    hint.textContent = 'でんしゃを えらんでね';
    updateRoute();
  };
  const arrive = () => {
    if (state === 'done') return;
    state = 'done';
    speed = 0;
    braking = false;
    trainX = DESTINATION;
    driveControls.hidden = true;
    const perfect = collected.size === starsAt.length;
    trips += 1;
    save('trips', trips);
    setProgress(3);
    setPhase('とうちゃく！');
    updateRoute();
    celebrate();
    success();
    cardTitle.textContent = perfect ? '⭐ ぜんぶ あつめた！' : '🎉 とうちゃく！';
    cardText.textContent = `${stations[trips % stations.length]}に ついたよ！　のった ${trips}かい`;
    startButton.textContent = '▶ つぎの えきへ！';
    card.classList.remove('is-hidden');
    hint.textContent = 'つぎは どのでんしゃ？';
    showToast('やったね！ とうちゃく！', performance.now(), 1800);
    announce(`${stations[trips % stations.length]}に到着しました。これまでに${trips}回乗りました。`);
  };
  const accelerate = () => {
    if (state === 'idle' || state === 'done') { start(); return; }
    if (state !== 'running' || braking) return;
    boost = 1.6;
    speed = Math.min(390, speed + 55);
    if (!reducedMotion) spark(clamp(trainX - cameraX, 40, width - 30), trackHeight - 100, 5);
    tone(610, .06, 'sine', .018);
    setPhase('スピード アップ！');
  };
  const brakeOn = event => {
    if (state !== 'running' || event.button > 0) return;
    braking = true;
    boost = 0;
    brakeButton.classList.add('is-held');
    setPhase('ブレーキ！');
    try { brakeButton.setPointerCapture(event.pointerId); } catch (_) { /* 非対応でも操作可能 */ }
    event.preventDefault();
  };
  const brakeOff = () => {
    braking = false;
    brakeButton.classList.remove('is-held');
    if (state === 'running') setPhase('はしっているよ！');
  };

  const rand = n => {
    const v = Math.sin(n * 12.9898 + runSeed * 2.331) * 43758.5453;
    return v - Math.floor(v);
  };
  const update = (dt, now) => {
    if (popupUntil && now > popupUntil) {
      popupUntil = 0;
      toastNode.classList.remove('is-visible');
    }
    if (state === 'running') {
      const remain = DESTINATION - trainX;
      const stoppingDistance = speed * speed / (2 * 205);
      const approaching = remain <= stoppingDistance + 4;
      if (approaching) {
        state = 'arriving';
        braking = false;
        brakeButton.classList.remove('is-held');
        setPhase('えきに とまるよ');
        announce('もうすぐ駅に到着します。ゆっくり停車します。');
      } else {
        boost = Math.max(0, boost - dt);
        const target = braking ? 0 : boost > 0 ? 335 : 230;
        const change = braking ? 330 : target > speed ? 165 : 115;
        speed += clamp(target - speed, -change * dt, change * dt);
        speed = Math.max(0, speed);
      }
    }
    if (state === 'arriving') {
      speed = Math.max(0, speed - 205 * dt);
      if (DESTINATION - trainX < 15) speed = Math.min(speed, Math.max(0, (DESTINATION - trainX) * 3.4));
    }
    if (state === 'running' || state === 'arriving') {
      trainX = Math.min(DESTINATION, trainX + speed * dt);
      const desiredCamera = Math.max(0, trainX - width * .37);
      cameraX += (desiredCamera - cameraX) * Math.min(1, dt * 5);
      if (speed > 45 && now >= nextClack) {
        wheelSound();
        nextClack = now + clamp(390 - speed * .57, 150, 370);
      }
      if (Math.abs(trainX - CROSSING) < 380 && now >= nextBell) {
        bell();
        nextBell = now + 590;
      }
      const stage = trainX < 525 ? 0 : trainX < 1390 ? 1 : trainX < 1840 ? 2 : 3;
      if (stage !== progress) setProgress(stage);
      if (stage !== stageAnnounced) {
        stageAnnounced = stage;
        if (stage === 1) { showToast('カン カン カン！', now); announce('踏切を通過しています。カンカンカン！'); }
        if (stage === 2) { showToast('トンネルに はいるよ！', now); announce('トンネルに入りました。'); }
        if (stage === 3) { showToast('つぎは えきだよ！', now); announce('トンネルを抜け、次の駅が見えてきました。'); }
      }
      starsAt.forEach((x, i) => {
        if (!collected.has(i) && trainX >= x) {
          collected.add(i);
          updateRoute();
          const starX = clamp(x - cameraX, 35, width - 35);
          spark(starX, trackHeight - 165, 14);
          tone(680 + collected.size * 120, .13, 'sine', .05);
          showToast(`おほしさま ${collected.size}こ！`, now);
          announce(`お星さまを${collected.size}個集めました。`);
        }
      });
      if (trainType === 'steam' && !reducedMotion && Math.random() < dt * 8 && particles.length < 90) {
        particles.push({ x: trainX - cameraX - 66, y: trackHeight - 126,
          vx: -22, vy: -41, life: 1, maxLife: 1, size: 10, color: '#e6f2f4', smoke: true });
      }
      if (state === 'arriving' && (trainX >= DESTINATION - .75 || speed <= 1.8)) arrive();
    }
    const shouldClose = trainX > 450 && trainX < 1250 && state !== 'idle' && state !== 'done';
    gateDown += ((shouldClose ? 1 : 0) - gateDown) * Math.min(1, dt * 3.4);
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.smoke) p.size += dt * 12;
      else p.vy += 130 * dt;
      p.life -= dt * (p.smoke ? .95 : .9);
    });
    particles = particles.filter(p => p.life > 0);
    confetti.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.angle += p.spin * dt;
      p.life -= dt;
    });
    confetti = confetti.filter(p => p.life > 0 && p.y < height + 30);
  };

  const path = (fill, stroke, lineWidth = 2) => {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  };
  const rectangle = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const circle = (x, y, r, color, stroke, lineWidth = 2) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); path(color, stroke, lineWidth);
  };
  const round = (x, y, w, h, r, fill, stroke = null, sw = 2) => {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad); ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad); ctx.quadraticCurveTo(x, y, x + rad, y); ctx.closePath();
    path(fill, stroke, sw);
  };
  const label = (text, x, y, size = 19, color = '#21435b') => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  };
  const cloud = (x, y, s) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.globalAlpha = .93;
    circle(0, 10, 19, '#fff'); circle(20, 0, 27, '#fff');
    circle(47, 9, 22, '#fff'); round(-16, 8, 80, 20, 10, '#fff');
    ctx.restore();
  };
  const tree = (x, y, s = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    rectangle(-6, -43, 12, 47, '#835530');
    circle(-14, -47, 21, '#50a955'); circle(13, -48, 22, '#64bc62');
    circle(0, -68, 23, '#77ce73'); circle(8, -77, 4, '#c9efa9');
    ctx.restore();
  };
  const house = (x, y, variety) => {
    rectangle(x - 31, y - 49, 62, 49, variety > .5 ? '#ffbb75' : '#eaa4bb');
    ctx.beginPath(); ctx.moveTo(x - 40, y - 48); ctx.lineTo(x, y - 80); ctx.lineTo(x + 40, y - 48); ctx.closePath(); path('#9a6571');
    rectangle(x - 21, y - 34, 16, 19, '#bcf1ff'); rectangle(x + 9, y - 34, 16, 19, '#bcf1ff');
    rectangle(x - 2, y - 28, 13, 28, '#785344');
  };
  const background = now => {
    const sky = ctx.createLinearGradient(0, 0, 0, trackHeight);
    sky.addColorStop(0, '#76cefa'); sky.addColorStop(.76, '#d5f4ff'); sky.addColorStop(1, '#f5f9db');
    rectangle(0, 0, width, height, sky);
    const sunX = width - 55 - cameraX * .015;
    circle(sunX, height < 460 ? 115 : 151, 36, '#fff8b4');
    for (let i = -2; i < Math.ceil(width / 200) + 2; i++) {
      const cloudX = i * 215 + 105 - (cameraX * .07 + now * .0014) % 215;
      cloud(cloudX, 92 + (i % 3) * 35, .75 + (Math.abs(i) % 3) * .16);
    }
    const hillsY = trackHeight - 88;
    ctx.beginPath(); ctx.moveTo(0, trackHeight);
    for (let x = -80; x < width + 100; x += 50) {
      const y = hillsY - 25 + 32 * Math.sin((x + cameraX * .15) / 165);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, trackHeight); ctx.closePath(); path('#a2d98b');
    ctx.beginPath(); ctx.moveTo(0, trackHeight);
    for (let x = -30; x < width + 60; x += 32) {
      ctx.lineTo(x, hillsY + 38 + 15 * Math.cos((x + cameraX * .35) / 82));
    }
    ctx.lineTo(width, trackHeight); ctx.closePath(); path('#70c770');
    rectangle(0, trackHeight - 45, width, height - trackHeight + 45, '#6dbb61');
    // 遠景・近景はカメラの移動速度を変えて奥行きを出す。
    const cityOffset = cameraX * .32;
    for (let i = Math.floor(cityOffset / 130) - 1; i < Math.ceil((cityOffset + width) / 130) + 1; i++) {
      const x = i * 130 - cityOffset + 50;
      const top = trackHeight - 95 - rand(i + 30) * 65;
      rectangle(x, top, 47 + rand(i + 40) * 35, trackHeight - 48 - top, i % 2 ? '#c0dfd0' : '#d5e8d1');
      for (let w = 0; w < 3; w++) for (let h = 0; h < 3; h++) {
        rectangle(x + 9 + w * 18, top + 12 + h * 25, 8, 13, '#e9faff');
      }
    }
    const start = Math.floor(cameraX / 175) - 2;
    for (let i = start; i < start + Math.ceil(width / 175) + 5; i++) {
      const world = i * 175 + 80;
      if ((world > 5 && world < 370) || (world > 750 && world < 1090)
        || (world > 1310 && world < 1880) || (world > 2120 && world < 2500)) continue;
      const x = world - cameraX;
      const r = rand(i);
      if (r < .5) tree(x, trackHeight - 50, .72 + rand(i + 4) * .48);
      else if (r < .86) house(x, trackHeight - 50, r);
      else for (let f = 0; f < 5; f++) circle(x - 25 + f * 12, trackHeight - 58 - (f % 2) * 6, 5, f % 2 ? '#ef6fba' : '#fff0a1');
    }
  };
  const tracks = () => {
    const y = trackHeight;
    rectangle(0, y - 5, width, height - y + 5, '#ac8457');
    rectangle(0, y + 3, width, 50, '#d6bea1');
    for (let x = -(cameraX % 51) - 51; x < width + 55; x += 51) {
      round(x, y + 7, 17, 43, 3, '#76513a');
    }
    for (const railY of [y + 13, y + 40]) {
      rectangle(0, railY - 4, width, 9, '#65717a');
      rectangle(0, railY - 4, width, 3, '#e9f5fa');
    }
    rectangle(0, y + 58, width, height - y - 58, '#6ebc61');
    for (let x = -(cameraX % 72) - 72; x < width + 72; x += 72) {
      circle(x, y + 77, 3, '#c0e678');
    }
  };
  const station = (worldX, name, destination = false) => {
    const x = worldX - cameraX;
    const y = trackHeight;
    if (x < -240 || x > width + 240) return;
    rectangle(x - 143, y - 111, 286, 104, '#fff2d7');
    rectangle(x - 151, y - 124, 302, 16, destination ? '#fb8860' : '#5d9dc7');
    for (let post = -117; post <= 118; post += 79) rectangle(x + post, y - 108, 9, 98, '#8e745e');
    rectangle(x - 112, y - 102, 224, 44, '#e6f4f6');
    round(x - 102, y - 98, 204, 32, 8, '#fff', '#4b7289', 3);
    label(name, x, y - 81, 21);
    rectangle(x - 155, y - 14, 310, 14, '#897159');
    rectangle(x - 155, y - 13, 310, 4, '#ffec76');
    for (let i = -130; i <= 130; i += 33) rectangle(x + i, y - 21, 20, 5, '#c7b09a');
    if (destination) {
      circle(x + 115, y - 146, 25, '#fff');
      label('🐼', x + 115, y - 146, 23);
    }
  };
  const crossing = (now, foreground = false) => {
    const x = CROSSING - cameraX;
    const y = trackHeight;
    if (x < -240 || x > width + 240) return;
    const active = gateDown > .05;
    const blink = active && Math.floor(now / 280) % 2 === 0;
    const posts = [-125, 125];
    if (!foreground) {
      rectangle(x - 157, y - 15, 314, 15, '#a3aaa8');
      for (const p of posts) {
        rectangle(x + p - 5, y - 154, 10, 154, '#3b454c');
        rectangle(x + p - 27, y - 152, 54, 8, '#ffd63f');
        // 日本風の黄黒のクロスバック標識。
        ctx.save(); ctx.translate(x + p, y - 173);
        for (const angle of [-Math.PI / 4, Math.PI / 4]) {
          ctx.save(); ctx.rotate(angle);
          round(-33, -6, 66, 12, 1, '#ffdb36', '#263640', 2);
          rectangle(-17, -5, 10, 10, '#263640'); rectangle(7, -5, 10, 10, '#263640');
          ctx.restore();
        }
        ctx.restore();
        round(x + p - 28, y - 137, 56, 26, 8, '#343d43', '#f6d02b', 2);
        circle(x + p - 14, y - 124, 9, active && blink ? '#ff4545' : '#61292c');
        circle(x + p + 14, y - 124, 9, active && !blink ? '#ff4545' : '#61292c');
        if (active) {
          circle(x + p + (blink ? -14 : 14), y - 127, 3, '#ffe9d1');
        }
      }
      round(x - 61, y - 218, 122, 30, 7, '#fff', '#405267', 3);
      label('ふみきり', x, y - 202, 17);
    } else {
      posts.forEach((p, index) => {
        const left = index === 0;
        ctx.save();
        ctx.translate(x + p, y - 100);
        if (!left) ctx.scale(-1, 1);
        ctx.rotate(-Math.PI * .43 * (1 - gateDown));
        round(0, -7, 125, 14, 3, '#fff', '#3c4d56', 2);
        for (let part = 8; part < 120; part += 26) rectangle(part, -6, 13, 12, '#fb5755');
        ctx.restore();
        circle(x + p, y - 100, 9, '#3a464d', '#f8db3e', 3);
      });
    }
  };
  const tunnel = (front = false) => {
    const start = TUNNEL_START - cameraX;
    const end = TUNNEL_END - cameraX;
    const y = trackHeight;
    if (end < -145 || start > width + 145) return;
    if (!front) {
      ctx.beginPath(); ctx.moveTo(start - 94, y);
      ctx.quadraticCurveTo(start - 20, y - 258, start + 145, y - 275);
      ctx.lineTo(end - 125, y - 274);
      ctx.quadraticCurveTo(end + 30, y - 250, end + 110, y);
      ctx.closePath(); path('#7b8b78');
      ctx.beginPath(); ctx.moveTo(start - 33, y); ctx.lineTo(start - 33, y - 108);
      ctx.quadraticCurveTo(start + 17, y - 236, start + 115, y - 237);
      ctx.lineTo(end - 96, y - 237); ctx.quadraticCurveTo(end + 12, y - 222, end + 15, y - 100);
      ctx.lineTo(end + 15, y); ctx.closePath(); path('#253438', '#52615c', 8);
      for (let i = 0; i < 16; i++) {
        const world = start + i * 32 - 30;
        rectangle(world, y - 32, 10, 2, '#51605d');
      }
    } else {
      for (const portal of [start - 12, end - 19]) {
        ctx.beginPath(); ctx.moveTo(portal - 22, y); ctx.lineTo(portal - 22, y - 109);
        ctx.quadraticCurveTo(portal + 29, y - 258, portal + 128, y - 256);
        ctx.lineTo(portal + 128, y - 235);
        ctx.quadraticCurveTo(portal + 42, y - 235, portal + 2, y - 110);
        ctx.lineTo(portal + 2, y); ctx.closePath(); path('#98a59a', '#5a6b63', 4);
      }
      round((start + end) / 2 - 70, y - 276, 140, 30, 7, '#fff', '#55695d', 3);
      label('トンネル', (start + end) / 2, y - 260, 18);
    }
  };
  const star = (x, y, radius, fill = '#ffdc4e') => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? radius * .43 : radius;
      ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    ctx.closePath(); path(fill, '#f5a22b', 2);
  };
  const drawStars = now => {
    starsAt.forEach((world, i) => {
      if (collected.has(i)) return;
      const x = world - cameraX;
      if (x < -50 || x > width + 50) return;
      const y = trackHeight - 168 + Math.sin(now * .003 + i) * (reducedMotion ? 0 : 7);
      circle(x, y, 29, 'rgba(255,255,255,.35)');
      star(x, y, 20);
    });
  };
  const wheels = xs => xs.forEach(wx => {
    circle(wx, -11, 15, '#263945'); circle(wx, -11, 8, '#b9d8e5');
    const angle = trainX * .08;
    ctx.strokeStyle = '#f4ffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx - Math.cos(angle) * 7, -11 - Math.sin(angle) * 7);
    ctx.lineTo(wx + Math.cos(angle) * 7, -11 + Math.sin(angle) * 7); ctx.stroke();
  });
  const commuter = () => {
    round(-125, -96, 243, 72, 15, '#f3f7ef', '#314e60', 4);
    rectangle(-119, -51, 231, 23, '#ef695f');
    round(-124, -96, 35, 72, 14, '#ef695f', '#314e60', 3);
    for (const wx of [-81, -42, 15, 58]) round(wx, -86, 31, 30, 5, '#9bdcf5', '#42637b', 3);
    round(-25, -91, 43, 65, 5, null, '#4a6876', 3);
    rectangle(-120, -25, 235, 9, '#476376');
    round(-119, -104, 68, 17, 5, '#204761');
    label('ふつう', -85, -95, 11, '#fff');
    circle(109, -54, 6, '#fff8bb');
    wheels([-84, -43, 51, 92]);
  };
  const bullet = () => {
    ctx.beginPath(); ctx.moveTo(-135, -29); ctx.lineTo(-118, -91);
    ctx.quadraticCurveTo(-110, -105, -88, -105); ctx.lineTo(53, -105);
    ctx.quadraticCurveTo(104, -104, 131, -71);
    ctx.quadraticCurveTo(141, -52, 146, -36); ctx.lineTo(126, -24);
    ctx.closePath(); path('#f4fbfc', '#3b5d7b', 4);
    ctx.beginPath(); ctx.moveTo(-126, -45); ctx.lineTo(139, -45); ctx.lineTo(123, -33);
    ctx.lineTo(-129, -33); ctx.closePath(); path('#3f8bd8');
    for (const wx of [-87, -52, -17, 18, 53]) round(wx, -91, 25, 19, 5, '#6dbfdd', '#3b5d7b', 2);
    round(80, -89, 34, 23, 9, '#6dbfdd', '#3b5d7b', 2);
    round(-113, -106, 45, 14, 5, '#2f6bb7');
    label('はやい', -91, -99, 10, '#fff');
    circle(133, -51, 5, '#fff8bf');
    wheels([-91, -58, 80, 110]);
  };
  const steam = () => {
    rectangle(-107, -118, 22, 51, '#3f444e');
    rectangle(-115, -121, 38, 11, '#303b45');
    round(-125, -86, 169, 62, 13, '#424a56', '#202d39', 4);
    round(-68, -73, 96, 50, 15, '#333e4a', '#101f2b', 3);
    round(22, -91, 105, 67, 8, '#e9b755', '#343d47', 4);
    round(52, -105, 60, 23, 5, '#304550', '#253340', 3);
    round(44, -81, 31, 27, 5, '#b8ecfa', '#293f55', 3);
    round(86, -81, 30, 27, 5, '#b8ecfa', '#293f55', 3);
    rectangle(-119, -37, 246, 14, '#d44c4b');
    circle(-114, -59, 9, '#fff1af', '#273c4c', 2);
    circle(-31, -51, 18, '#eac960', '#35404a', 3);
    label('🐼', -31, -52, 21);
    wheels([-85, -43, 58, 101]);
  };
  const train = (now) => {
    const x = trainX - cameraX;
    const scale = height < 415 ? .79 : height < 520 ? .88 : 1;
    const bob = (state === 'running' || state === 'arriving') && !reducedMotion ? Math.sin(now * .027) * Math.min(1.5, speed / 160) : 0;
    ctx.save(); ctx.translate(x, trackHeight + 10 + bob); ctx.scale(scale, scale);
    circle(0, -15, 104, 'rgba(0,0,0,0)');
    if (trainType === 'bullet') bullet();
    else if (trainType === 'steam') steam();
    else commuter();
    ctx.restore();
  };
  const effects = () => {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.smoke) circle(p.x, p.y, p.size, p.color);
      else circle(p.x, p.y, p.size, p.color);
      ctx.restore();
    }
    for (const p of confetti) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / 2, 0, 1);
      ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      rectangle(-p.size / 2, -p.size / 3, p.size, p.size * .65, p.color);
      ctx.restore();
    }
  };
  const draw = now => {
    ctx.clearRect(0, 0, width, height);
    background(now);
    const displayTrip = state === 'done' ? trips - 1 : trips;
    station(160, stations[displayTrip % stations.length]);
    crossing(now);
    tunnel();
    station(DESTINATION, stations[(displayTrip + 1) % stations.length], true);
    tracks();
    // 線路は前景なので、駅のホームや踏切の奥行きを描き足す。
    for (const wx of [160, DESTINATION]) {
      const x = wx - cameraX;
      if (x > -180 && x < width + 180) {
        rectangle(x - 155, trackHeight - 15, 310, 13, '#9c8569');
        rectangle(x - 155, trackHeight - 15, 310, 3, '#ffee7d');
      }
    }
    drawStars(now);
    train(now);
    crossing(now, true);
    tunnel(true);
    if (trainX > TUNNEL_START && trainX < TUNNEL_END && state !== 'idle') {
      const fade = clamp(Math.min(trainX - TUNNEL_START, TUNNEL_END - trainX) / 85, 0, 1);
      rectangle(0, 0, width, height, `rgba(11,26,35,${fade * .34})`);
      const x = trainX - cameraX + (trainType === 'steam' ? -112 : 126);
      const g = ctx.createRadialGradient(x, trackHeight - 64, 2, x, trackHeight - 64, 105);
      g.addColorStop(0, `rgba(255,245,179,${fade * .55})`);
      g.addColorStop(1, 'rgba(255,245,179,0)');
      rectangle(x - 110, trackHeight - 174, 220, 220, g);
    }
    effects();
  };
  const frame = now => {
    const dt = lastTime ? Math.min(.034, Math.max(0, (now - lastTime) / 1000)) : 0;
    lastTime = now;
    if (!document.hidden) { update(dt, now); draw(now); }
    window.requestAnimationFrame(frame);
  };

  choices.forEach(button => button.addEventListener('click', () => setTrain(button.dataset.train)));
  startButton.addEventListener('click', start);
  boostButton.addEventListener('click', accelerate);
  hornButton.addEventListener('click', horn);
  brakeButton.addEventListener('pointerdown', brakeOn);
  brakeButton.addEventListener('pointerup', brakeOff);
  brakeButton.addEventListener('pointercancel', brakeOff);
  brakeButton.addEventListener('lostpointercapture', brakeOff);
  window.addEventListener('pointerup', brakeOff);
  window.addEventListener('blur', brakeOff);
  canvas.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    event.preventDefault();
    if (state === 'running') accelerate();
    else if (state === 'idle' || state === 'done') start();
  }, { passive: false });
  window.addEventListener('keydown', event => {
    if (event.repeat || /^(BUTTON|A)$/.test(document.activeElement?.tagName || '')) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault(); accelerate();
    } else if (event.code === 'KeyH') {
      event.preventDefault(); horn();
    } else if (event.code === 'ArrowDown') {
      event.preventDefault(); braking = true; brakeButton.classList.add('is-held');
    }
  });
  window.addEventListener('keyup', event => { if (event.code === 'ArrowDown') brakeOff(); });
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    save('sound', soundOn);
    soundButton.textContent = soundOn ? '🔊' : '🔇';
    soundButton.setAttribute('aria-label', soundOn ? '音を切る' : '音を出す');
    soundButton.title = soundOn ? '音を切る' : '音を出す';
    if (soundOn) tone(650, .11);
    announce(soundOn ? '音をオンにしました。' : '音をオフにしました。');
  });
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('このブラウザは ぜんがめんに できないよ');
    } catch (_) { showToast('ぜんがめんに できなかったよ'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const full = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-label', full ? '全画面表示を終了' : '全画面で表示');
    fullscreenButton.title = full ? '全画面表示を終了' : '全画面で表示';
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { lastTime = 0; brakeOff(); });

  resize();
  soundButton.textContent = soundOn ? '🔊' : '🔇';
  soundButton.setAttribute('aria-label', soundOn ? '音を切る' : '音を出す');
  setTrain(trainType);
  reset();
  window.requestAnimationFrame(frame);
})();
