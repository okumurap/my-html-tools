(() => {
  'use strict';
  let audio;
  const soundEnabled = () => !document.getElementById('soundBtn')?.textContent.includes('🔇');
  const getAudio = () => audio || (audio = new (window.AudioContext || window.webkitAudioContext)());

  function tone(freq, duration = .055, type = 'square', volume = .035, delay = 0) {
    if (!soundEnabled()) return;
    const ctx = getAudio();
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + .01);
  }

  function resumeAudio() {
    if (!soundEnabled()) return null;
    const ctx = getAudio();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function click(kind) {
    if (!resumeAudio()) return;
    if (kind === 'power') {
      tone(520, .045, 'square', .03);
      tone(700, .04, 'square', .022, .04);
    } else if (kind === 'brake') {
      tone(310, .06, 'sawtooth', .028);
    } else if (kind === 'emergency') {
      tone(180, .12, 'square', .05);
      tone(120, .16, 'square', .04, .11);
    } else if (kind === 'door') {
      tone(760, .06, 'sine', .03);
      tone(560, .07, 'sine', .03, .07);
    } else {
      tone(440, .045, 'sine', .022);
    }
  }

  function leverNotch(detail) {
    if (!detail || detail.source !== 'drag' || !resumeAudio()) return;
    if (detail.emergency) {
      click('emergency');
      return;
    }

    const from = Number.isFinite(detail.fromIndex) ? detail.fromIndex : detail.index;
    const movingDown = detail.index > from;

    if (detail.kind === 'power') {
      const base = 360 + (Math.max(0, detail.count - 1 - detail.index) * 46);
      tone(base, .032, 'square', .038);
      tone(base * (movingDown ? .72 : .82), .04, 'sawtooth', .018, .024);
    } else {
      const base = 360 - Math.min(detail.index, 4) * 32;
      tone(base, .038, 'sawtooth', .036);
      tone(base * (movingDown ? .68 : .82), .045, 'square', .017, .026);
    }
  }

  document.addEventListener('sakamoto:lever-notch', (event) => leverNotch(event.detail));

  document.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('button,.drag-notch');
    if (!target) return;
    if (target.closest('.power-steps') || target.closest('[data-kind="power"]')) click('power');
    else if (target.id === 'emergencyBtn' || target.classList.contains('emergency')) click('emergency');
    else if (target.closest('.brake-steps') || target.closest('[data-kind="brake"]')) click('brake');
    else if (target.id === 'doorBtn' || target.closest('#doorBtn')) click('door');
    else if (target.id !== 'soundBtn') click('normal');
  }, { passive: true });
})();