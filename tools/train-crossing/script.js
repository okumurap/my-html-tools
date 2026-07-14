(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const tapCard = document.querySelector("#tapCard");
  const cardTitle = document.querySelector("#cardTitle");
  const cardText = document.querySelector("#cardText");
  const soundButton = document.querySelector("#soundButton");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const status = document.querySelector("#status");
  const dots = [...document.querySelectorAll(".dot")];

  if (!context) {
    status.textContent = "このブラウザではゲーム画面を表示できません。";
    tapCard.classList.remove("is-hidden");
    cardTitle.textContent = "表示できません";
    cardText.textContent = "別のブラウザでお試しください";
    return;
  }

  let width = window.innerWidth;
  let height = window.innerHeight;
  let pixelRatio = 1;
  let state = "idle";
  let trainX = 220;
  let speed = 0;
  let cameraX = 0;
  let lastTime = performance.now();
  let trip = 0;
  let soundOn = true;
  let audioContext = null;
  let nextClack = 0;
  let nextBell = 0;
  let arrivalTime = 0;
  let currentProgress = -1;
  let confetti = [];
  let puffs = [];
  let stars = [];
  let clouds = [];
  let scenerySeed = 7;

  const stationNames = ["パンダえき", "おはなえき", "うみえき", "ほしぞらえき", "りんごえき"];
  const trainColors = ["#ff5f5f", "#42a5f5", "#ffb000", "#65c466", "#a76ee8"];
  const confettiColors = ["#ff5f5f", "#ffd63d", "#49b9ff", "#61d477", "#aa6dec", "#ff8e3c"];

  const announce = (message) => {
    status.textContent = message;
  };

  const buildClouds = () => {
    clouds = [];
    const count = Math.max(5, Math.ceil(width / 260));

    for (let index = 0; index < count; index += 1) {
      clouds.push({
        x: (index * 310 + 80) % (width + 300),
        y: 70 + (index * 53) % Math.max(80, height * 0.25),
        scale: 0.7 + (index % 3) * 0.18,
      });
    }
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    buildClouds();
  };

  const pseudoRandom = (number) => {
    const value = Math.sin(number * 12.9898 + scenerySeed * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const initAudio = () => {
    if (audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  };

  const tone = (frequency, duration = 0.12, type = "sine", volume = 0.08, delay = 0) => {
    if (!soundOn) return;
    initAudio();
    if (!audioContext) return;

    const startAt = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const whistle = () => {
    tone(740, 0.18, "triangle", 0.08);
    tone(920, 0.28, "triangle", 0.075, 0.16);
  };

  const bell = () => {
    tone(980, 0.08, "square", 0.035);
    tone(760, 0.1, "square", 0.03, 0.1);
  };

  const clack = () => {
    tone(125, 0.035, "square", 0.018);
    tone(105, 0.035, "square", 0.014, 0.065);
  };

  const successSound = () => {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      tone(frequency, 0.18, "triangle", 0.07, index * 0.12);
    });
  };

  const setProgress = (step) => {
    if (step === currentProgress) return;
    currentProgress = step;
    dots.forEach((dot, index) => {
      const isCurrent = index === step;
      dot.classList.toggle("is-current", isCurrent);
      if (isCurrent) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  };

  const showCard = (title, text) => {
    cardTitle.textContent = title;
    cardText.textContent = text;
    tapCard.classList.remove("is-hidden");
  };

  const hideCard = () => {
    tapCard.classList.add("is-hidden");
  };

  const startTrip = () => {
    if (state === "running" || state === "arriving") return;
    initAudio();
    if (audioContext?.state === "suspended") audioContext.resume();
    state = "running";
    speed = 40;
    arrivalTime = 0;
    confetti = [];
    stars = [];
    nextClack = 0;
    nextBell = 0;
    hideCard();
    whistle();
    setProgress(0);
    announce("電車が出発しました。画面をタップするとスピードアップします。");
  };

  const resetTrip = () => {
    trip += 1;
    scenerySeed += 11;
    trainX = 220;
    speed = 0;
    cameraX = 0;
    state = "idle";
    confetti = [];
    stars = [];
    puffs = [];
    setProgress(0);
    const nextStation = stationNames[(trip + 1) % stationNames.length];
    showCard("タップで しゅっぱつ！", `${nextStation}へ いこう`);
    announce(`タップすると${nextStation}へ向けて出発します。`);
  };

  const addStar = (x, y) => {
    stars.push({
      x: x + (Math.random() - 0.5) * 100,
      y: y + (Math.random() - 0.5) * 60,
      velocityX: (Math.random() - 0.5) * 80,
      velocityY: -60 - Math.random() * 90,
      life: 1,
      radius: 5 + Math.random() * 8,
    });
  };

  const handleTap = () => {
    if (state === "idle") {
      startTrip();
    } else if (state === "done" && performance.now() - arrivalTime > 700) {
      resetTrip();
      startTrip();
    } else if (state === "done") {
      for (let index = 0; index < 8; index += 1) addStar(width * 0.5, height * 0.35);
    } else if (state === "running") {
      speed = Math.min(speed + 45, 330);
      tone(520, 0.06, "sine", 0.025);
    }
  };

  const celebrate = () => {
    for (let index = 0; index < 70; index += 1) {
      confetti.push({
        x: width * 0.5 + (Math.random() - 0.5) * 180,
        y: height * 0.24 + (Math.random() - 0.5) * 40,
        velocityX: (Math.random() - 0.5) * 260,
        velocityY: -70 - Math.random() * 190,
        gravity: 190 + Math.random() * 160,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
        life: 1.8 + Math.random() * 1.2,
        shape: Math.random() > 0.35 ? "rect" : "circle",
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      });
    }

    for (let index = 0; index < 18; index += 1) addStar(width * 0.5, height * 0.32);
  };

  const trackY = () => height * (height < 520 ? 0.72 : 0.69);

  const update = (deltaTime, now) => {
    clouds.forEach((cloud) => {
      cloud.x -= deltaTime * 7 * cloud.scale;
      if (cloud.x < -130) cloud.x = width + 150;
    });

    if (state === "running") {
      const crossingDistance = Math.abs(trainX - 910);
      const tunnelStart = 1420;
      const destination = 2250;

      if (trainX < destination - 260) {
        speed += (280 - speed) * Math.min(1, deltaTime * 1.8);
      } else {
        state = "arriving";
        announce("もうすぐ次の駅に到着します。");
      }

      trainX += speed * deltaTime;
      cameraX += (Math.max(0, trainX - width * 0.28) - cameraX) * Math.min(1, deltaTime * 4);

      if (now > nextClack) {
        clack();
        nextClack = now + Math.max(130, 390 - speed);
      }

      if (crossingDistance < 420 && now > nextBell) {
        bell();
        nextBell = now + 520;
      }

      if (trainX > 520 && trainX < 1250) {
        if (currentProgress !== 1) announce("踏切を通過しています。カンカンカン！");
        setProgress(1);
      } else if (trainX >= tunnelStart && trainX < 1850) {
        if (currentProgress !== 2) announce("トンネルを通過しています。");
        setProgress(2);
      } else if (trainX >= 1850) {
        setProgress(3);
      }

      if (Math.random() < deltaTime * 3.5) {
        puffs.push({ x: trainX - 70, y: trackY() - 92, radius: 5, life: 1 });
      }
    }

    if (state === "arriving") {
      speed = Math.max(0, speed - 155 * deltaTime);
      trainX += speed * deltaTime;
      cameraX += (Math.max(0, trainX - width * 0.28) - cameraX) * Math.min(1, deltaTime * 4);

      if (speed <= 1) {
        state = "done";
        arrivalTime = now;
        setProgress(3);
        successSound();
        celebrate();
        showCard("とうちゃく！ 🎉", "タップで つぎの えきへ");
        announce("次の駅に到着しました。タップすると次の旅が始まります。");
      }
    }

    puffs.forEach((puff) => {
      puff.y -= 18 * deltaTime;
      puff.radius += 12 * deltaTime;
      puff.life -= 0.7 * deltaTime;
    });
    puffs = puffs.filter((puff) => puff.life > 0);

    stars.forEach((star) => {
      star.x += star.velocityX * deltaTime;
      star.y += star.velocityY * deltaTime;
      star.velocityY += 120 * deltaTime;
      star.life -= 0.65 * deltaTime;
    });
    stars = stars.filter((star) => star.life > 0);

    confetti.forEach((piece) => {
      piece.x += piece.velocityX * deltaTime;
      piece.y += piece.velocityY * deltaTime;
      piece.velocityY += piece.gravity * deltaTime;
      piece.angle += piece.spin * deltaTime;
      piece.life -= deltaTime;
    });
    confetti = confetti.filter((piece) => piece.life > 0 && piece.y < height + 30);
  };

  const roundRect = (x, y, rectWidth, rectHeight, radius, fill, stroke, lineWidth = 2) => {
    const safeRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + rectWidth - safeRadius, y);
    context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + safeRadius);
    context.lineTo(x + rectWidth, y + rectHeight - safeRadius);
    context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - safeRadius, y + rectHeight);
    context.lineTo(x + safeRadius, y + rectHeight);
    context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();

    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.stroke();
    }
  };

  const drawCloud = (x, y, scale) => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.beginPath();
    context.arc(0, 12, 24, 0, Math.PI * 2);
    context.arc(26, 0, 31, 0, Math.PI * 2);
    context.arc(58, 13, 24, 0, Math.PI * 2);
    context.arc(31, 22, 39, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const drawTree = (x, y, scale) => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = "#87552e";
    context.fillRect(-7, -45, 14, 45);
    context.fillStyle = "#46a94e";
    [[0, -62, 28], [-18, -48, 22], [18, -48, 22]].forEach(([circleX, circleY, radius]) => {
      context.beginPath();
      context.arc(circleX, circleY, radius, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  };

  const drawHouse = (x, y, randomValue) => {
    context.fillStyle = randomValue > 0.5 ? "#ffac67" : "#f48f9a";
    context.fillRect(x - 34, y - 50, 68, 50);
    context.fillStyle = "#8d5b43";
    context.beginPath();
    context.moveTo(x - 44, y - 50);
    context.lineTo(x, y - 86);
    context.lineTo(x + 44, y - 50);
    context.closePath();
    context.fill();
    context.fillStyle = "#fff4c8";
    context.fillRect(x - 22, y - 35, 18, 18);
    context.fillRect(x + 7, y - 35, 18, 18);
    context.fillStyle = "#76513a";
    context.fillRect(x - 6, y - 29, 16, 29);
  };

  const drawFlowers = (x, y) => {
    for (let index = -2; index <= 2; index += 1) {
      const flowerX = x + index * 15;
      const flowerY = y - Math.abs(index % 2) * 8;
      context.strokeStyle = "#338a39";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(flowerX, flowerY + 20);
      context.lineTo(flowerX, flowerY);
      context.stroke();
      context.fillStyle = index % 2 ? "#ff6c91" : "#ffd23f";
      context.beginPath();
      context.arc(flowerX, flowerY, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.beginPath();
      context.arc(flowerX, flowerY, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  };

  const drawScenery = () => {
    const start = Math.floor(cameraX / 180) - 2;
    const end = start + Math.ceil(width / 180) + 5;

    for (let index = start; index < end; index += 1) {
      const worldX = index * 180 + 90;
      const reservedArea = (worldX > 40 && worldX < 390)
        || (worldX > 760 && worldX < 1050)
        || (worldX > 1320 && worldX < 1880)
        || (worldX > 2120 && worldX < 2520);
      if (reservedArea) continue;

      const x = worldX - cameraX;
      const randomValue = pseudoRandom(index);
      if (randomValue < 0.48) drawTree(x, trackY() - 62, 0.75 + pseudoRandom(index + 1) * 0.45);
      else if (randomValue < 0.78) drawHouse(x, trackY() - 62, pseudoRandom(index + 2));
      else drawFlowers(x, trackY() - 42);
    }
  };

  const drawTrack = (now) => {
    const y = trackY();
    context.fillStyle = "#98714f";
    context.fillRect(0, y - 3, width, height - y + 3);
    context.fillStyle = "#d8c5a8";
    context.fillRect(0, y + 8, width, 38);

    const sleeperGap = 54;
    const offset = -(cameraX % sleeperGap);
    context.fillStyle = "#6d4d35";
    for (let x = offset - 60; x < width + 60; x += sleeperGap) context.fillRect(x, y + 5, 14, 48);

    context.fillStyle = "#dfe7eb";
    context.fillRect(0, y + 7, width, 8);
    context.fillRect(0, y + 35, width, 8);
    context.fillStyle = "#68747a";
    context.fillRect(0, y + 14, width, 3);
    context.fillRect(0, y + 42, width, 3);
    context.fillStyle = "rgba(255, 255, 255, 0.18)";
    for (let x = (now * 0.09) % 120 - 120; x < width; x += 120) context.fillRect(x, y + 54, 60, 4);
  };

  const drawBackground = (now) => {
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#77d4ff");
    sky.addColorStop(0.62, "#d7f4ff");
    sky.addColorStop(0.63, "#94db69");
    sky.addColorStop(1, "#54b852");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#ffe36a";
    context.beginPath();
    context.arc(width - 78, 92, 38, 0, Math.PI * 2);
    context.fill();
    clouds.forEach((cloud) => drawCloud(cloud.x, cloud.y, cloud.scale));

    const horizon = trackY() - 55;
    context.fillStyle = "#7ec65e";
    context.beginPath();
    context.moveTo(0, horizon);
    for (let x = 0; x <= width + 80; x += 80) {
      const y = horizon - 25 - Math.sin((x + cameraX * 0.12) / 150) * 22;
      context.quadraticCurveTo(x + 40, y - 32, x + 80, horizon);
    }
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();

    drawScenery();
    drawTrack(now);
  };

  const drawStation = (worldX, name, destination = false) => {
    const x = worldX - cameraX;
    const y = trackY();
    if (x < -260 || x > width + 260) return;

    context.fillStyle = "#eee6d5";
    context.fillRect(x - 135, y - 105, 270, 105);
    context.fillStyle = destination ? "#ff885e" : "#5c9fe8";
    context.fillRect(x - 148, y - 116, 296, 18);
    context.fillStyle = "#704b36";
    for (let offset = -110; offset <= 110; offset += 55) context.fillRect(x + offset, y - 96, 10, 96);
    context.fillStyle = "#fff9df";
    context.fillRect(x - 112, y - 90, 224, 46);
    roundRect(x - 92, y - 82, 184, 30, 8, "#fff", "#36526a", 3);
    context.fillStyle = "#27465f";
    context.font = `900 ${Math.min(24, Math.max(17, width * 0.028))}px "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, x, y - 66);

    context.fillStyle = "#8d6c4d";
    context.fillRect(x - 150, y - 12, 300, 12);
    context.fillStyle = "#f7d658";
    for (let offset = -140; offset < 140; offset += 24) context.fillRect(x + offset, y - 10, 14, 5);

    if (destination) {
      context.fillStyle = "#fff";
      context.beginPath();
      context.arc(x + 96, y - 137, 32, 0, Math.PI * 2);
      context.fill();
      context.font = "26px sans-serif";
      context.fillText("🐼", x + 96, y - 136);
    }
  };

  const drawCrossing = (now) => {
    const x = 910 - cameraX;
    const y = trackY();
    if (x < -220 || x > width + 220) return;

    const isNear = Math.abs(trainX - 910) < 430;
    const gateAngle = isNear ? 0 : -Math.PI * 0.34;
    const blink = isNear && Math.floor(now / 280) % 2 === 0;
    context.fillStyle = "#3c444b";
    context.fillRect(x - 145, y - 138, 12, 138);
    context.fillRect(x + 130, y - 138, 12, 138);

    context.save();
    context.translate(x - 139, y - 112);
    context.rotate(gateAngle);
    context.fillStyle = "#fff";
    context.fillRect(0, -8, 126, 16);
    context.fillStyle = "#ff4c4c";
    for (let offset = 8; offset < 120; offset += 28) context.fillRect(offset, -8, 14, 16);
    context.restore();

    context.save();
    context.translate(x + 136, y - 112);
    context.scale(-1, 1);
    context.rotate(gateAngle);
    context.fillStyle = "#fff";
    context.fillRect(0, -8, 126, 16);
    context.fillStyle = "#ff4c4c";
    for (let offset = 8; offset < 120; offset += 28) context.fillRect(offset, -8, 14, 16);
    context.restore();

    const drawSignal = (signalX) => {
      context.fillStyle = "#f7c93d";
      context.beginPath();
      context.moveTo(signalX - 28, y - 150);
      context.lineTo(signalX, y - 122);
      context.lineTo(signalX + 28, y - 150);
      context.lineTo(signalX, y - 178);
      context.closePath();
      context.fill();
      context.strokeStyle = "#343b40";
      context.lineWidth = 5;
      context.stroke();
      context.fillStyle = "#343b40";
      context.fillRect(signalX - 35, y - 126, 70, 18);
      context.fillStyle = blink ? "#ff3939" : "#601f1f";
      context.beginPath();
      context.arc(signalX - 17, y - 117, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = !blink && isNear ? "#ff3939" : "#601f1f";
      context.beginPath();
      context.arc(signalX + 17, y - 117, 8, 0, Math.PI * 2);
      context.fill();
    };

    drawSignal(x - 139);
    drawSignal(x + 136);
    roundRect(x - 72, y - 202, 144, 34, 8, "#fff", "#3f4a52", 3);
    context.fillStyle = "#263f51";
    context.font = "900 18px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("ふみきり", x, y - 185);
  };

  const drawTunnel = () => {
    const start = 1420 - cameraX;
    const end = 1830 - cameraX;
    const y = trackY();
    if (end < -100 || start > width + 100) return;

    context.fillStyle = "#6a7772";
    context.beginPath();
    context.moveTo(start - 100, y);
    context.quadraticCurveTo(start + 30, y - 265, start + 150, y - 270);
    context.lineTo(end - 120, y - 270);
    context.quadraticCurveTo(end + 30, y - 260, end + 100, y);
    context.closePath();
    context.fill();

    context.fillStyle = "#4e5d58";
    for (let blockX = start - 70; blockX < end + 70; blockX += 55) {
      for (let blockY = y - 235; blockY < y; blockY += 32) {
        context.fillRect(blockX + ((Math.floor((blockY - y) / 32) & 1) * 18), blockY, 48, 26);
      }
    }

    context.fillStyle = "#202b2c";
    context.beginPath();
    context.moveTo(start - 15, y);
    context.lineTo(start - 15, y - 120);
    context.quadraticCurveTo(start + 40, y - 230, start + 115, y - 230);
    context.lineTo(end - 95, y - 230);
    context.quadraticCurveTo(end - 15, y - 210, end - 15, y - 120);
    context.lineTo(end - 15, y);
    context.closePath();
    context.fill();

    roundRect((start + end) / 2 - 75, y - 263, 150, 38, 8, "#fff", "#354441", 3);
    context.fillStyle = "#263f51";
    context.font = "900 19px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("トンネル", (start + end) / 2, y - 244);
  };

  const drawTrain = (now) => {
    const screenX = trainX - cameraX;
    const y = trackY() - 4;
    const color = trainColors[trip % trainColors.length];
    const bounce = state === "running" || state === "arriving" ? Math.sin(now * 0.025) * 1.8 : 0;
    context.save();
    context.translate(screenX, y + bounce);

    puffs.forEach((puff) => {
      const puffX = puff.x - cameraX - screenX;
      const puffY = puff.y - y;
      context.globalAlpha = Math.max(0, puff.life) * 0.55;
      context.fillStyle = "#fff";
      context.beginPath();
      context.arc(puffX, puffY, puff.radius, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;

    context.fillStyle = "#263947";
    context.fillRect(-82, -107, 20, 36);
    context.fillRect(-88, -111, 32, 8);
    roundRect(-98, -88, 150, 64, 15, color, "#283946", 4);
    roundRect(39, -70, 92, 46, 12, color, "#283946", 4);
    context.fillStyle = "#ffe8a6";
    context.beginPath();
    context.moveTo(52, -70);
    context.lineTo(70, -96);
    context.lineTo(112, -96);
    context.lineTo(129, -70);
    context.closePath();
    context.fill();
    context.strokeStyle = "#283946";
    context.lineWidth = 4;
    context.stroke();

    roundRect(-66, -76, 35, 28, 7, "#bdeeff", "#283946", 3);
    roundRect(-22, -76, 35, 28, 7, "#bdeeff", "#283946", 3);
    roundRect(57, -61, 26, 23, 6, "#bdeeff", "#283946", 3);
    roundRect(91, -61, 26, 23, 6, "#bdeeff", "#283946", 3);
    context.fillStyle = "#fff7b2";
    context.beginPath();
    context.arc(-88, -56, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#263947";
    context.beginPath();
    context.arc(-88, -56, 3, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(-10, -112, 27, 0, Math.PI * 2);
    context.fill();
    context.font = "24px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("🐼", -10, -110);
    context.fillStyle = "#f4ce45";
    context.fillRect(-107, -32, 249, 10);
    context.fillStyle = "#263947";
    context.fillRect(-111, -25, 258, 10);

    const wheelSpin = trainX * 0.09;
    [-63, 9, 70, 113].forEach((wheelX) => {
      context.save();
      context.translate(wheelX, -14);
      context.rotate(wheelSpin);
      context.fillStyle = "#28343d";
      context.beginPath();
      context.arc(0, 0, 17, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#aebbc3";
      context.beginPath();
      context.arc(0, 0, 8, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-7, 0);
      context.lineTo(7, 0);
      context.moveTo(0, -7);
      context.lineTo(0, 7);
      context.stroke();
      context.restore();
    });

    context.restore();
  };

  const drawTunnelDarkness = () => {
    if (trainX < 1440 || trainX > 1825) return;
    const center = 1632;
    const strength = Math.min(1, 1 - Math.abs(trainX - center) / 210);
    context.fillStyle = `rgba(8, 17, 24, ${0.65 * strength})`;
    context.fillRect(0, 0, width, height);
    const lightX = trainX - cameraX - 86;
    const lightY = trackY() - 55;
    const gradient = context.createRadialGradient(lightX, lightY, 2, lightX, lightY, 150);
    gradient.addColorStop(0, `rgba(255, 247, 176, ${0.52 * strength})`);
    gradient.addColorStop(1, "rgba(255, 247, 176, 0)");
    context.fillStyle = gradient;
    context.fillRect(lightX - 170, lightY - 170, 340, 340);
  };

  const drawCelebration = () => {
    stars.forEach((star) => {
      context.save();
      context.globalAlpha = Math.max(0, star.life);
      context.translate(star.x, star.y);
      context.fillStyle = "#ffd93f";
      context.beginPath();
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const radius = index % 2 === 0 ? star.radius : star.radius * 0.45;
        context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      context.closePath();
      context.fill();
      context.restore();
    });

    confetti.forEach((piece) => {
      context.save();
      context.globalAlpha = Math.min(1, piece.life);
      context.translate(piece.x, piece.y);
      context.rotate(piece.angle);
      context.fillStyle = piece.color;
      if (piece.shape === "rect") {
        context.fillRect(-6, -3, 12, 7);
      } else {
        context.beginPath();
        context.arc(0, 0, 5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });
  };

  const draw = (now) => {
    context.clearRect(0, 0, width, height);
    drawBackground(now);
    drawStation(160, stationNames[trip % stationNames.length]);
    drawCrossing(now);
    drawTunnel();
    drawStation(2290, stationNames[(trip + 1) % stationNames.length], true);
    drawTrain(now);
    drawTunnelDarkness();
    drawCelebration();
  };

  const frame = (now) => {
    const deltaTime = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(deltaTime, now);
    draw(now);
    window.requestAnimationFrame(frame);
  };

  soundButton.addEventListener("click", (event) => {
    event.stopPropagation();
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "🔊" : "🔇";
    soundButton.setAttribute("aria-label", soundOn ? "音を切る" : "音を出す");
    soundButton.title = soundOn ? "音を切る" : "音を出す";
    announce(soundOn ? "音をオンにしました。" : "音をオフにしました。");
    if (soundOn) {
      initAudio();
      tone(660, 0.12, "sine", 0.05);
    }
  });

  fullscreenButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error("unsupported");
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      announce("このブラウザでは全画面表示に切り替えられませんでした。");
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute("aria-label", isFullscreen ? "全画面表示を終了" : "全画面で表示");
    fullscreenButton.title = isFullscreen ? "全画面表示を終了" : "全画面で表示";
  });

  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a")) return;
    event.preventDefault();
    handleTap();
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      handleTap();
    }
  });

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
  });

  resize();
  setProgress(0);
  window.requestAnimationFrame(frame);
})();
