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
    const wide=width>height&&height<560;
    const ticketTop=card.getBoundingClientRect().top;
    trackHeight=Math.round(wide?height*.76:Math.min(height*.65,state==='idle'||state==='done'?ticketTop-24:height-130));
    trackHeight=Math.max(wide?180:220,trackHeight);
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
    state = 'running';document.body.dataset.state=state;
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
    driveControls.hidden = false;resize();
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
    state = 'idle';document.body.dataset.state=state;
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
    state = 'done';document.body.dataset.state=state;
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
    card.classList.remove('is-hidden');resize();
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
        state = 'arriving';document.body.dataset.state=state;
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
        particles.push({ x: trainX - cameraX + 78, y: trackHeight - 126,
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
    const journey=clamp((trainX-160)/(DESTINATION-160),0,1);
    $('#journeyFill').style.transform=`scaleX(${journey})`;
    $('#journeyTrain').style.left=`${journey*100}%`;
    $('#speedFill').style.transform=`scaleX(${clamp(speed/390,0,1)})`;
    const pace=braking?'ブレーキ！':speed<5?'とまってる':speed<160?'ゆっくり':speed<280?'いいかんじ！':'はやい はやい！';
    if($('#speedText').textContent!==pace)$('#speedText').textContent=pace;
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
  const gradient = (top,bottom,y,h) => {
    const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,top);g.addColorStop(1,bottom);return g;
  };
  const cloud = (x,y,s) => {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    const shade=gradient('#fffdf5','#d4e8e7',-28,55);
    circle(0,7,18,shade);circle(22,-2,26,shade);circle(50,7,20,shade);round(-16,8,86,18,9,shade);
    ctx.restore();
  };
  const tree = (x,y,s=1) => {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ctx.save();ctx.scale(1,.25);circle(2,0,30,'#28594020');ctx.restore();
    round(-4,-58,8,63,3,'#8c7455');
    for(const [px,py,r] of [[-15,-47,22],[14,-51,24],[0,-73,25]]){
      circle(px,py,r,gradient('#a0c878','#4e8968',py-r,r*2));
      ctx.beginPath();ctx.arc(px-4,py-4,r*.65,3.6,4.5);path(null,'#d1e0a080',2);
    }
    ctx.restore();
  };
  const house = (x,y,variety) => {
    const wall=gradient('#fff6dc',variety>.5?'#e4bf9a':'#d9b5ac',y-58,58);
    round(x-34,y-58,68,58,3,wall,'#8d8b7933',1);
    rectangle(x+20,y-58,14,58,'#7e78651a');
    ctx.beginPath();ctx.moveTo(x-42,y-55);ctx.lineTo(x-3,y-89);ctx.lineTo(x+42,y-55);ctx.closePath();path(variety>.5?'#818f8b':'#ae7a6c','#677b75',2);
    for(let row=0;row<3;row++)rectangle(x-24+row*7,y-68+row*6,43-row*5,1,'#ffffff25');
    for(const wx of [-22,9]){
      round(x+wx,y-43,17,20,2,gradient('#739ba3','#c6e7db',y-43,20),'#fffff2',2);
      rectangle(x+wx+8,y-42,1,18,'#fff8e8');rectangle(x+wx,y-34,16,1,'#fff8e8');
      round(x+wx-2,y-21,21,5,2,'#7b9982');
    }
    round(x-6,y-23,14,23,2,'#927a5c');circle(x+4,y-11,1,'#f8d689');
    rectangle(x-38,y-2,77,4,'#868e79');
  };
  const person = (x,y,color,wave=0) => {
    ctx.save();ctx.translate(x,y);
    round(-6,-25,12,19,4,color);rectangle(-5,-8,3,9,'#40565d');rectangle(2,-8,3,9,'#40565d');
    circle(0,-32,7,'#e8c4a0');ctx.beginPath();ctx.arc(0,-34,7,Math.PI,TAU);path('#615746');
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(5,-22);ctx.lineTo(12,-22-wave*8);ctx.stroke();
    circle(-2,-32,.8,'#38555b');circle(2,-32,.8,'#38555b');ctx.restore();
  };
  const background = now => {
    const sky=gradient('#8ac7d1','#f7efd6',0,trackHeight);
    rectangle(0,0,width,height,sky);
    const sunX=width*.78-cameraX*.012,sunY=Math.max(135,trackHeight*.35);
    const glow=ctx.createRadialGradient(sunX,sunY,9,sunX,sunY,100);glow.addColorStop(0,'#fff6ccae');glow.addColorStop(1,'#fff6cc00');rectangle(sunX-100,sunY-100,200,200,glow);circle(sunX,sunY,25,'#fff5d0');
    for(let i=-1;i<Math.ceil(width/230)+2;i++)cloud(i*230+80-(cameraX*.06+(reducedMotion?0:now*.001))%230,120+Math.abs(i%3)*30,.6+Math.abs(i%2)*.25);
    for(let layer=2;layer>=0;layer--){
      const base=trackHeight-60-layer*55;
      ctx.beginPath();ctx.moveTo(0,trackHeight);
      for(let x=-40;x<width+50;x+=20)ctx.lineTo(x,base-35-Math.sin((x+cameraX*(.08+.12*(2-layer)))/180+layer)*35-Math.sin(x/330+layer)*20);
      ctx.lineTo(width,trackHeight);ctx.closePath();path(['#98b99d','#afc4ad','#c6d6c2'][layer]);
    }
    rectangle(0,trackHeight-46,width,height-trackHeight+46,gradient('#a8c18b','#86a26e',trackHeight-46,180));
    const cityOffset=cameraX*.32;
    for(let i=Math.floor(cityOffset/150)-1;i<Math.ceil((cityOffset+width)/150)+1;i++){
      const x=i*150-cityOffset+60;ctx.save();ctx.globalAlpha=.7;house(x,trackHeight-58,rand(i+38));ctx.restore();
    }
    for(let i=Math.floor(cameraX/175)-2;i<Math.floor(cameraX/175)+Math.ceil(width/175)+4;i++){
      const world=i*175+80;
      if((world>5&&world<370)||(world>750&&world<1090)||(world>1310&&world<1880)||(world>2120&&world<2500))continue;
      const x=world-cameraX,r=rand(i);
      if(r<.65)tree(x,trackHeight-46,.75+rand(i+4)*.4);else house(x,trackHeight-46,r);
    }
    // A low fence and long shadows anchor the little railway in the landscape.
    for(let px=-(cameraX%38)-38;px<width+38;px+=38){
      rectangle(px,trackHeight-42,4,30,'#e3dbc0');rectangle(px,trackHeight-36,42,3,'#f4ecd3');rectangle(px,trackHeight-24,42,3,'#f4ecd3');
    }
  };
  const tracks = () => {
    const y=trackHeight;
    rectangle(0,y-5,width,63,gradient('#b3b2a2','#d3c7aa',y-5,63));
    for(let i=Math.floor(cameraX/9);i<Math.ceil((cameraX+width)/9);i++){
      const px=i*9-cameraX;circle(px,y+5+rand(i+12)*46,1+rand(i+4)*1.6,i%2?'#8a9187':'#e2dbbf');
    }
    for(let px=-(cameraX%43)-43;px<width+43;px+=43){round(px,y+6,14,45,2,'#807763');rectangle(px+2,y+8,2,40,'#a99c7d');}
    for(const railY of[y+13,y+40]){rectangle(0,railY-3,width,9,'#536d70');rectangle(0,railY-3,width,3,'#e7ede1');rectangle(0,railY+4,width,2,'#7b8580');}
    rectangle(0,y+58,width,height-y-58,gradient('#a5bc83','#86a06d',y+58,Math.max(1,height-y-58)));
    for(let i=Math.floor(cameraX/26)-1;i<Math.ceil((cameraX+width)/26)+1;i++){
      const px=i*26-cameraX,py=y+76+rand(i+8)*45;
      ctx.strokeStyle='#668a64';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py+8);ctx.lineTo(px+2,py);ctx.stroke();
      if(i%3===0){for(let petal=0;petal<5;petal++)circle(px+2+Math.cos(petal*TAU/5)*3,py+Math.sin(petal*TAU/5)*3,2.5,i%2?'#f5d6b8':'#f3ece0');circle(px+2,py,1.7,'#d8ad59');}
    }
  };
  const station = (worldX,name,destination=false) => {
    const x=worldX-cameraX,y=trackHeight;if(x< -250||x>width+250)return;
    const roof=destination?'#bd7763':'#5b908c';
    round(x-143,y-130,286,116,4,gradient('#fff9e6','#e6d7b8',y-130,116),'#c4c4a6',1);
    rectangle(x+112,y-129,31,115,'#cfc2a3');
    for(const px of[-124,80]){round(x+px,y-106,42,75,3,gradient('#86b3b4','#ccdfd1',y-106,75),'#fff7dc',3);rectangle(x+px+20,y-105,2,73,'#f7efd4');}
    ctx.beginPath();ctx.moveTo(x-159,y-127);ctx.lineTo(x-140,y-150);ctx.lineTo(x+139,y-150);ctx.lineTo(x+160,y-127);ctx.closePath();path(roof,'#506d68',2);
    rectangle(x-155,y-129,310,7,'#e2c6a0');
    for(let tile=-135;tile<145;tile+=18)rectangle(x+tile,y-147,1,17,'#ffffff24');
    for(const px of[-133,129])rectangle(x+px,y-119,5,106,'#9b8867');
    round(x-83,y-114,166,32,4,'#fffaf0','#69877b',1.5);label(name,x,y-97,20,'#365b58');
    rectangle(x-80,y-83,160,3,roof);
    round(x-63,y-48,75,6,2,'#a58463');rectangle(x-58,y-42,4,27,'#5f746d');rectangle(x+1,y-42,4,27,'#5f746d');
    person(x-32,y-18,'#b27368',state==='done'?.7:0);person(x+47,y-18,'#6c9490',(Math.sin(trainX*.02)+1)/2);
    for(const px of[-145,143]){round(x+px-9,y-35,18,20,3,'#889b78');circle(x+px,y-40,12,'#7aab78');circle(x+px+5,y-44,3,'#edb6a2');}
    rectangle(x-155,y-14,310,14,'#8b8b75');rectangle(x-155,y-14,310,3,'#eee1a5');
    circle(x+112,y-169,15,'#fff9e8','#607e76',2);ctx.strokeStyle='#607e76';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+112,y-178);ctx.lineTo(x+112,y-169);ctx.lineTo(x+118,y-166);ctx.stroke();
  };
  const crossing = (now, foreground = false) => {
    const x = CROSSING - cameraX;
    const y = trackHeight;
    if (x < -240 || x > width + 240) return;
    const active = gateDown > .05;
    const blink = active && Math.floor(now / 280) % 2 === 0;
    const posts = [-125, 125];
    if (!foreground) {
      rectangle(x-54,y-115,108,115,gradient('#9eaba7','#bfc3b4',y-115,115));
      for(let dash=0;dash<3;dash++)rectangle(x-2,y-108+dash*30,4,16,'#f5e9c5');
      ctx.save();ctx.translate(x+16,y-78);
      round(-27,-20,55,27,9,gradient('#e6b16b','#bc8555',-20,27),'#7b8477',1.5);
      round(-19,-34,37,22,7,'#d4a46a','#7b8477',1.5);round(-14,-31,27,13,4,'#bbd9d2');
      circle(-16,7,6,'#465e60');circle(17,7,6,'#465e60');ctx.restore();
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
        round(0, -7, 125, 14, 3, '#e8c56b', '#3c4d56', 2);
        for (let part = 8; part < 120; part += 26) rectangle(part, -6, 13, 12, '#405653');
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
      for(let i=0;i<4;i++){
        const lampX=start+60+i*90;
        const light=ctx.createRadialGradient(lampX,y-179,2,lampX,y-179,66);
        light.addColorStop(0,'#ffe8a52e');light.addColorStop(1,'#ffe8a500');rectangle(lampX-66,y-245,132,132,light);
        round(lampX-12,y-186,24,5,2,'#f2d39b');
      }
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
      for(const portal of[start-12,end-19])for(let row=0;row<5;row++){
        rectangle(portal-21,y-25-row*18,22,1,'#d8d9c580');
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
  const wheels = xs => {
    for(const wx of xs){
      circle(wx,-10,14,'#30494f','#1e343a',1);circle(wx,-10,9,gradient('#c2d1c8','#718e8f',-19,18));circle(wx,-10,3,'#4a676b');
      const angle=trainX*.08;ctx.strokeStyle='#e8efe4';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(wx-Math.cos(angle)*7,-10-Math.sin(angle)*7);ctx.lineTo(wx+Math.cos(angle)*7,-10+Math.sin(angle)*7);ctx.stroke();
    }
  };
  const windowPane = (wx,wy,w,h,passenger=false) => {
    round(wx,wy,w,h,4,gradient('#456f82','#b2d7d1',wy,h),'#547779',1.5);
    if(passenger){circle(wx+w*.48,wy+h*.55,4.5,'#edc5a0');round(wx+w*.3,wy+h*.73,w*.4,h*.26,3,'#c48c73');}
    ctx.beginPath();ctx.moveTo(wx+4,wy+4);ctx.lineTo(wx+w*.52,wy+4);ctx.lineTo(wx+4,wy+h*.66);ctx.closePath();path('#f4fff032');
  };
  const commuter = () => {
    round(-127,-100,251,76,13,gradient('#fffdf0','#d0dad0',-100,76),'#425f65',2.5);
    round(-122,-108,242,15,6,gradient('#9eb6ac','#718b84',-108,15),'#516f6d',1);
    round(-76,-117,43,10,3,'#a7b7aa');round(35,-117,43,10,3,'#a7b7aa');
    rectangle(-125,-49,247,17,'#c86654');rectangle(-125,-49,247,3,'#eaa77b');
    for(const wx of[-105,-69,34,70])windowPane(wx,-88,29,30,wx===-69||wx===70);
    for(const dx of[-27,0]){round(dx,-91,26,64,3,null,'#718a81',1.5);windowPane(dx+4,-84,18,26);rectangle(dx+19,-48,2,6,'#718a81');}
    windowPane(106,-88,12,27);
    round(-114,-100,66,12,3,'#294e58');label('まちの でんしゃ',-81,-94,7,'#e8ebc0');
    rectangle(-124,-26,247,8,'#405b60');round(-65,-18,30,11,3,'#667e79');round(25,-18,29,11,3,'#667e79');
    circle(119,-46,4,'#fff0a1');circle(-121,-46,3,'#e88f77');
    wheels([-92,-55,55,92]);
  };
  const bullet = () => {
    ctx.beginPath();ctx.moveTo(-135,-28);ctx.lineTo(-124,-88);ctx.quadraticCurveTo(-122,-108,-97,-108);ctx.lineTo(38,-108);ctx.bezierCurveTo(83,-108,101,-74,139,-53);ctx.quadraticCurveTo(154,-45,151,-32);ctx.lineTo(126,-23);ctx.closePath();path(gradient('#fffef4','#ceded8',-108,85),'#4b7180',2.5);
    ctx.beginPath();ctx.moveTo(-130,-49);ctx.lineTo(113,-49);ctx.lineTo(147,-35);ctx.lineTo(126,-30);ctx.lineTo(-131,-34);ctx.closePath();path('#568d9e');
    rectangle(-129,-46,233,3,'#90bfbe');
    for(const wx of[-104,-72,-40,-8,24])windowPane(wx,-90,23,18,wx===-40);
    ctx.beginPath();ctx.moveTo(60,-93);ctx.quadraticCurveTo(81,-82,95,-64);ctx.lineTo(74,-64);ctx.lineTo(52,-90);ctx.closePath();path(gradient('#365d72','#6fa9ad',-93,30),'#395d71',1);
    round(-122,-100,13,63,3,null,'#a1b9b3',1);circle(130,-47,4,'#fff1b4');
    wheels([-97,-62,71,102]);
  };
  const steam = () => {
    // The chimney leads the train to the right; the cab follows behind it.
    round(-127,-97,72,73,5,gradient('#62897d','#365b57',-97,73),'#2c474b',2.5);
    round(-135,-105,87,13,5,'#37585c','#29434a',2);windowPane(-114,-87,42,31,true);
    round(-68,-80,168,55,18,gradient('#677e78','#2d484c',-80,55),'#263e45',2.5);
    for(const band of[-42,2,47])rectangle(band,-76,4,48,'#acb39c');
    round(68,-126,20,54,3,gradient('#60726e','#334b50',-126,54),'#29434a',2);round(60,-131,36,10,3,'#344f53');
    circle(0,-86,12,'#9b9b70','#435c57',2);circle(106,-54,14,'#3b5559','#a7ab89',3);circle(111,-54,6,'#ffecac');
    rectangle(-132,-30,264,12,'#ad6755');rectangle(-131,-30,262,3,'#dfb383');
    wheels([-99,-58,-10,33,78,110]);
    const angle=trainX*.08;ctx.strokeStyle='#c0c3a7';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-58+Math.cos(angle)*6,-10+Math.sin(angle)*6);ctx.lineTo(78+Math.cos(angle)*6,-10+Math.sin(angle)*6);ctx.stroke();
    round(-110,-48,34,13,3,'#c9ad75');label('01',-93,-41,9,'#3c5555');
  };
  const train = (now) => {
    const x = trainX - cameraX;
    const scale = height < 415 ? .79 : height < 520 ? .88 : 1;
    const bob = (state === 'running' || state === 'arriving') && !reducedMotion ? Math.sin(now * .027) * Math.min(1.5, speed / 160) : 0;
    ctx.save(); ctx.translate(x, trackHeight + 10 + bob); ctx.scale(scale, scale);
    ctx.save();ctx.scale(1,.1);circle(0,0,128,'#314b4330');ctx.restore();
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
  brakeButton.addEventListener('keydown',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();brakeOn(event);}});
  brakeButton.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();brakeOff();}});
  brakeButton.addEventListener('blur',brakeOff);
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
    if(event.repeat||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;
    if(event.code==='Space'&&/^(BUTTON|A)$/.test(document.activeElement?.tagName||''))return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault(); accelerate();
    } else if (event.code === 'KeyH') {
      event.preventDefault(); horn();
    } else if (event.code === 'ArrowDown') {
      if(state!=='running')return;
      event.preventDefault();braking=true;boost=0;brakeButton.classList.add('is-held');setPhase('ブレーキ！');
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
  reset();resize();
  window.requestAnimationFrame(frame);
})();
