(() => {
  "use strict";

  const DIAMETERS = [24, 28, 32, 36, 45];
  const CONTROL_MIN = 0;
  const CONTROL_MAX = 200;
  const SIDES = ["A", "B"];
  const CUSHION_MM = 10;
  const VP_FILL_RATIO = 0.95;
  const LINKED_KEYS = ["speed", "rpm", "stroke"];

  const getElement = (id) => document.getElementById(id);
  const calculateArea = (diameter) => Math.PI * diameter ** 2 / 4;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const formatInteger = (value) => Number.isFinite(value)
    ? Math.round(value).toLocaleString("ja-JP")
    : "―";

  const formatOneDecimal = (value) => Number.isFinite(value)
    ? value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "―";

  const formatTwoDecimals = (value) => Number.isFinite(value)
    ? value.toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "―";

  const state = {
    cushionA: 10, cushionB: 10, fillA: 95, fillB: 95,
    dA: 28,
    dB: 32,
    speedA: 50,
    speedB: 38,
    rpmA: 150,
    rpmB: 131,
    volume: Math.round(calculateArea(28) * 50),
    speedDriver: "A",
    rpmDriver: "A",
    strokeDriver: "A",
  };

  function rangeField(label, key, side, unit) {
    const inputLabel = `${label}（条件${side}）`;
    return `
      <div class="field">
        <div class="field-head">
          <label for="${key}Range${side}">${label}</label>
          <div class="number-wrap">
            <input
              id="${key}Number${side}"
              type="number"
              min="${CONTROL_MIN}"
              max="${CONTROL_MAX}"
              step="1"
              inputmode="numeric"
              aria-label="${inputLabel}の数値入力"
            >
            <span class="unit">${unit}</span>
          </div>
        </div>
        <input
          id="${key}Range${side}"
          type="range"
          min="${CONTROL_MIN}"
          max="${CONTROL_MAX}"
          step="1"
          aria-label="${inputLabel}"
        >
        <div class="limits"><span>${CONTROL_MIN}</span><span id="${key}Max${side}">${CONTROL_MAX}</span></div>
      </div>`;
  }

  function sideMarkup(side) {
    return `
      <div class="field">
        <div class="field-head">
          <label for="d${side}">スクリュ径</label>
          <b id="dValue${side}">―</b>
        </div>
        <input id="d${side}" type="range" min="0" max="4" step="1" aria-label="条件${side}のスクリュ径">
        <div class="diam-labels">
          ${DIAMETERS.map((diameter) => `<span>Φ${diameter}</span>`).join("")}
        </div>
      </div>
      <div class="circle-area" aria-hidden="true"><div id="circle${side}" class="circle"></div></div>
      <div class="metrics">
        <div class="metric"><span>スクリュ断面積</span><output id="area${side}">―</output></div>
        <div class="metric"><span>射出体積</span><output id="volume${side}">―</output></div>
      </div>
      ${rangeField("射出速度（整数）", "speed", side, "mm/s")}
      ${rangeField("回転数（整数）", "rpm", side, "rpm")}
      ${rangeField("計量完からクッションまでの概算移動量（整数）", "stroke", side, "mm")}
      <section class="vp-card" aria-labelledby="vpTitle${side}">
        <h3 id="vpTitle${side}">想定V-P切替位置</h3>
        <output id="vpPosition${side}" class="vp-position">―</output>
        <p id="vpCondition${side}">95％充填・クッション10 mm</p>
        <dl>
          <div><dt>計量完位置</dt><dd><output id="meteringPosition${side}">―</output></dd></div>
          <div><dt>切替までの前進量</dt><dd><output id="vpTravel${side}">―</output></dd></div>
        </dl>
      </section>
      <div class="metrics">
        <div class="metric"><span>体積流量</span><output id="flow${side}">―</output></div>
        <div class="metric"><span>スクリュ周速</span><output id="surface${side}">―</output></div>
        <div class="metric wide"><span>概算射出時間</span><output id="time${side}">―</output></div>
      </div>`;
  }

  getElement("bodyA").innerHTML = sideMarkup("A");
  getElement("bodyB").innerHTML = sideMarkup("B");

  function setInputPair(key, side, value) {
    const inputMax = Math.max(CONTROL_MAX, Math.ceil(value));
    const numberInput = getElement(`${key}Number${side}`);
    const rangeInput = getElement(`${key}Range${side}`);
    numberInput.max = inputMax;
    rangeInput.max = inputMax;
    numberInput.value = value;
    rangeInput.value = value;
    getElement(`${key}Max${side}`).textContent = formatInteger(inputMax);
  }

  let positionDrag = null;
  const positionDiagram = getElement('positionDiagram');
  const roundTenth = value => Math.round(value * 10) / 10;
  const commonVolumeMax = () => Math.floor(Math.min(calculateArea(state.dA), calculateArea(state.dB)) * CONTROL_MAX);

  function positions(area, side) {
    const stroke = state.volume / area, cushion = state['cushion' + side], fill = state['fill' + side] / 100;
    return { cushion, stroke, metering: cushion + stroke, vp: cushion + stroke * (1 - fill), travel: stroke * fill };
  }

  function setPosition(side, handle, value, volumeMax = commonVolumeMax(), cushionMax = 200) {
    const area = calculateArea(state['d' + side]), v = positions(area, side);
    if (handle === 'offset' || handle === 'cushion') state['cushion' + side] = clamp(roundTenth(value), 0, cushionMax);
    if (handle === 'metering') {
      state.volume = clamp(Math.round((value - v.cushion) * area), 0, volumeMax);
      state.strokeDriver = side;
    }
    if (handle === 'vp' && v.stroke > 0) state['fill' + side] = roundTenth(clamp((v.metering - value) / v.stroke * 100, 0, 100));
    if (handle === 'fill') state['fill' + side] = roundTenth(clamp(value, 0, 100));
  }

  function renderPositionDiagram(areaA, areaB, forceInputs = false) {
    const values = [positions(areaA, 'A'), positions(areaB, 'B')];
    // Freeze the scale for a gesture so a moving marker never changes the drag sensitivity.
    const limit = positionDrag ? positionDrag.limit : Math.max(20, Math.ceil((Math.max(...values.map(v => v.metering)) + 20) / 10) * 10);
    const x = value => 24 + value / limit * 472;
    const active = document.activeElement;
    const focusHandle = active?.closest('[data-handle]');
    const restoreHandle = focusHandle && { side: focusHandle.closest('[data-side]').dataset.side, handle: focusHandle.dataset.handle };
    if (!getElement('positionLaneA')) {
      positionDiagram.innerHTML = SIDES.map(side => `<div id="positionLane${side}" class="position-lane position-${side.toLowerCase()}" data-side="${side}">
        <h3></h3><svg id="positionSvg${side}" viewBox="0 0 520 90" style="display:block;width:100%;height:auto;max-height:none" role="group" aria-label="条件${side}の位置を調整"></svg>
        <dl class="position-values"><div><dt>■ 計量完</dt><dd></dd></div><div><dt>◆ V-P切替</dt><dd></dd></div><div><dt>● クッション</dt><dd></dd></div></dl>
        <div class="position-editor">${[['cushion', 'クッション位置', 'mm'], ['metering', '計量完位置', 'mm'], ['vp', 'V-P切替位置', 'mm'], ['fill', '切替時の充填率', '%']].map(([key, label, unit]) => `<label for="${key}Input${side}">${label}<span><input id="${key}Input${side}" data-position-input="${key}" type="number" step="0.1" inputmode="decimal" aria-label="条件${side}の${label}"> ${unit}</span></label>`).join('')}</div>
      </div>`).join('');
    }
    values.forEach((v, i) => {
      const side = SIDES[i], lane = getElement('positionLane' + side), svg = getElement('positionSvg' + side);
      lane.querySelector('h3').textContent = `条件${side} · φ${state['d' + side]} mm`;
      svg.dataset.limit = limit;
      svg.setAttribute('aria-label', `条件${side}：計量完${formatTwoDecimals(v.metering)} mmからV-P切替${formatTwoDecimals(v.vp)} mm、クッション${formatTwoDecimals(v.cushion)} mmへ前進`);
      const slider = (handle, label, value, min, max, content) => `<g class="position-handle" data-handle="${handle}" tabindex="0" role="slider" aria-label="条件${side}の${label}" aria-orientation="horizontal" aria-valuenow="${value}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuetext="${formatTwoDecimals(value)} mm" aria-describedby="positionHelp">${content}</g>`;
      svg.innerHTML = `<g class="position-axis" aria-hidden="true"><path d="M24 8H496" stroke="currentColor"/>${[0, limit / 2, limit].map(tick => `<path d="M${x(tick)} 4v8" stroke="currentColor"/><text x="${x(tick)}" y="26" text-anchor="middle">${tick} mm</text>`).join('')}</g>
        <g transform="translate(0 39)">
          <path d="M24 26H496" class="position-track"/>
          ${slider('offset', '帯全体・クッション位置', v.cushion, 0, 200, `<path d="M${x(v.metering)} 26H${x(v.vp)}" class="position-band-hit"/><path d="M${x(v.metering)} 26H${x(v.vp)}" class="position-travel"/><path d="M${x(v.vp)} 26H${x(v.cushion)}" class="position-remaining"/>${v.travel > 0 ? `<path d="M${x((v.metering + v.vp) / 2) + 8} 18l-12 8 12 8" class="position-arrow"/>` : ''}`)}
          ${slider('metering', '計量完位置', v.metering, v.cushion, v.cushion + commonVolumeMax() / calculateArea(state['d' + side]), `<rect x="${x(v.metering) - 12}" y="9" width="24" height="34" class="position-hit"/><rect x="${x(v.metering) - 6}" y="20" width="12" height="12" class="position-meter"/>`)}
          ${slider('cushion', 'クッション位置', v.cushion, 0, 200, `<circle cx="${x(v.cushion)}" cy="26" r="12" class="position-hit"/><circle cx="${x(v.cushion)}" cy="26" r="7" class="position-cushion"/>`)}
          ${slider('vp', 'V-P切替位置', v.vp, v.cushion, v.metering, `<path d="M${x(v.vp)} 8V26" class="position-vp-guide"/><circle cx="${x(v.vp)}" cy="26" r="3" class="position-vp-point"/><path d="M${x(v.vp)} -12l10 10-10 10-10-10Z" class="position-vp"/>`)}
        </g>`;
      const outputs = lane.querySelectorAll('dd');
      [v.metering, v.vp, v.cushion].forEach((value, index) => outputs[index].textContent = formatTwoDecimals(value) + ' mm');
      for (const [key, value, min, max] of [['cushion', v.cushion, 0, 200], ['metering', v.metering, v.cushion, v.cushion + commonVolumeMax() / calculateArea(state['d' + side])], ['vp', v.vp, v.cushion, v.metering], ['fill', state['fill' + side], 0, 100]]) {
        const input = getElement(key + 'Input' + side);
        input.min = min; input.max = max;
        if (input !== active || positionDrag || forceInputs) input.value = key === 'fill' ? value : value.toFixed(2);
      }
      getElement('vpCondition' + side).textContent = `${formatOneDecimal(state['fill' + side])}％充填・クッション${formatOneDecimal(v.cushion)} mm`;
    });
    if (restoreHandle && !positionDrag) getElement('positionLane' + restoreHandle.side).querySelector(`[data-handle="${restoreHandle.handle}"]`)?.focus({ preventScroll: true });
    getElement('positionSummary').textContent = state.volume === 0 ? '体積0：各条件の3つの位置は、そのクッション位置で重なります。' : '帯・●の移動はその側だけ。■計量完を変えると共通体積と反対側も連動し、◆V-Pを変えるとその側の充填率が変わります。';
  }

  function positionNotice(side) {
    const v = positions(calculateArea(state['d' + side]), side);
    getElement('positionNotice').textContent = `条件${side}：クッション${formatTwoDecimals(v.cushion)} mm ／ 計量完${formatTwoDecimals(v.metering)} mm ／ V-P${formatTwoDecimals(v.vp)} mm（${formatOneDecimal(state['fill' + side])}％）`;
  }

  positionDiagram.addEventListener('change', event => {
    const input = event.target.closest('[data-position-input]'); if (!input) return;
    const side = input.closest('[data-side]').dataset.side, value = input.valueAsNumber;
    if (!Number.isFinite(value)) { getElement('positionNotice').textContent = '数値を入力してください。直前の設定は維持しています。'; input.value = ''; return; }
    setPosition(side, input.dataset.positionInput, value);
    render(); input.value = input.dataset.positionInput === 'fill' ? state['fill' + side] : positions(calculateArea(state['d' + side]), side)[input.dataset.positionInput].toFixed(2);
    positionNotice(side);
  });

  positionDiagram.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-handle]');
    if (!handle || positionDrag || event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    const lane = handle.closest('[data-side]'), side = lane.dataset.side, svg = lane.querySelector('svg');
    const v = positions(calculateArea(state['d' + side]), side), ctm = svg.getScreenCTM();
    if (!ctm) return;
    positionDrag = { pointer: event.pointerId, side, handle: handle.dataset.handle, startX: event.clientX, limit: Number(svg.dataset.limit), snapshot: { ...state }, v, unitsPerPixel: Number(svg.dataset.limit) / (472 * ctm.a) };
    positionDiagram.setPointerCapture(event.pointerId); positionDiagram.classList.add('dragging');
  });
  positionDiagram.addEventListener('pointermove', event => {
    const d = positionDrag; if (!d || d.pointer !== event.pointerId) return;
    event.preventDefault();
    const delta = (event.clientX - d.startX) * d.unitsPerPixel;
    const base = d.handle === 'offset' || d.handle === 'cushion' ? d.v.cushion : d.v[d.handle];
    const maxVolume = Math.max(0, Math.floor(Math.min(commonVolumeMax(), ...SIDES.map(side => (d.limit - state['cushion' + side]) * calculateArea(state['d' + side])))));
    setPosition(d.side, d.handle, base + delta, maxVolume, Math.min(200, d.limit - d.v.stroke));
    render();
  });
  function finishPositionDrag(cancel = false) {
    const d = positionDrag; if (!d) return;
    positionDrag = null; positionDiagram.classList.remove('dragging');
    if (cancel) Object.assign(state, d.snapshot);
    if (positionDiagram.hasPointerCapture(d.pointer)) positionDiagram.releasePointerCapture(d.pointer);
    render(true); if (cancel) getElement('positionNotice').textContent = 'ドラッグを取り消しました。'; else positionNotice(d.side);
  }
  positionDiagram.addEventListener('pointerup', event => { if (positionDrag?.pointer === event.pointerId) finishPositionDrag(); });
  positionDiagram.addEventListener('pointercancel', event => { if (positionDrag?.pointer === event.pointerId) finishPositionDrag(true); });
  positionDiagram.addEventListener('lostpointercapture', () => { if (positionDrag) finishPositionDrag(true); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && positionDrag) { event.preventDefault(); finishPositionDrag(true); } });
  window.addEventListener('blur', () => finishPositionDrag(true));
  window.addEventListener('resize', () => finishPositionDrag(true));
  positionDiagram.addEventListener('keydown', event => {
    const handle = event.target.closest('[data-handle]'); if (!handle || positionDrag) return;
    const side = handle.closest('[data-side]').dataset.side, key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const value = key === 'Home' ? Number(handle.getAttribute('aria-valuemin')) : key === 'End' ? Number(handle.getAttribute('aria-valuemax')) : Number(handle.getAttribute('aria-valuenow')) + (key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1);
    setPosition(side, handle.dataset.handle, value); render(); positionNotice(side);
  });
  getElement('resetPositions').addEventListener('click', () => {
    finishPositionDrag(true); state.cushionA = state.cushionB = CUSHION_MM; state.fillA = state.fillB = VP_FILL_RATIO * 100; render(); getElement('positionNotice').textContent = '両側のクッションを10 mm、充填率を95％に戻しました。径・共通体積は維持しています。';
  });

  function renderSide(side, values) {
    getElement(`d${side}`).value = DIAMETERS.indexOf(values.diameter);
    getElement(`dValue${side}`).textContent = `Φ${values.diameter} mm`;

    const circleSize = 52 + ((values.diameter - 24) / (45 - 24)) * 96;
    const circle = getElement(`circle${side}`);
    circle.style.width = `${circleSize}px`;
    circle.style.height = `${circleSize}px`;
    circle.textContent = `Φ${values.diameter}`;

    getElement(`area${side}`).textContent = `${formatOneDecimal(values.area)} mm²`;
    getElement(`volume${side}`).textContent = `${formatInteger(state.volume)} mm³`;
    setInputPair("speed", side, values.speed);
    setInputPair("rpm", side, values.rpm);
    setInputPair("stroke", side, values.stroke);
    // Position decreases toward the forward end (0 mm). The common volume excludes cushion.
    // Keep full precision here; the existing stroke controls display rounded integers.
    const { metering: meteringPosition, travel: vpTravel, vp: vpPosition } = positions(values.area, side);
    getElement(`vpPosition${side}`).textContent = `${formatTwoDecimals(vpPosition)} mm`;
    getElement(`meteringPosition${side}`).textContent = `${formatTwoDecimals(meteringPosition)} mm`;
    getElement(`vpTravel${side}`).textContent = `${formatTwoDecimals(vpTravel)} mm`;
    getElement(`flow${side}`).textContent = `${formatInteger(values.area * values.speed)} mm³/s`;
    getElement(`surface${side}`).textContent = `${formatInteger(Math.PI * values.diameter * values.rpm)} mm/min`;
    getElement(`time${side}`).textContent = values.speed > 0
      ? `${formatTwoDecimals(values.stroke / values.speed)} s`
      : "―";
  }

  function render(forcePositionInputs = false) {
    const areaA = calculateArea(state.dA);
    const areaB = calculateArea(state.dB);
    const volumeMax = Math.max(1, Math.floor(Math.min(areaA, areaB) * CONTROL_MAX));
    state.volume = clamp(Math.round(state.volume), 0, volumeMax);

    if (state.speedDriver === "A") {
      state.speedB = Math.round(state.speedA * areaA / areaB);
    } else {
      state.speedA = Math.round(state.speedB * areaB / areaA);
    }

    if (state.rpmDriver === "A") {
      state.rpmB = Math.round(state.rpmA * state.dA / state.dB);
    } else {
      state.rpmA = Math.round(state.rpmB * state.dB / state.dA);
    }

    const strokeA = Math.round(state.volume / areaA);
    const strokeB = Math.round(state.volume / areaB);

    renderSide("A", {
      diameter: state.dA,
      area: areaA,
      speed: state.speedA,
      rpm: state.rpmA,
      stroke: strokeA,
    });
    renderSide("B", {
      diameter: state.dB,
      area: areaB,
      speed: state.speedB,
      rpm: state.rpmB,
      stroke: strokeB,
    });

    renderPositionDiagram(areaA, areaB, forcePositionInputs);

    getElement("volumeNumber").max = volumeMax;
    getElement("volumeRange").max = volumeMax;
    getElement("volumeNumber").value = state.volume;
    getElement("volumeRange").value = state.volume;
    getElement("volumeMaxLabel").textContent = `${formatInteger(volumeMax)} mm³`;
    getElement("volumeCm3").textContent = `${formatTwoDecimals(state.volume / 1000)} cm³`;
    getElement("areaRatio").textContent = `${formatTwoDecimals(areaB / areaA)} 倍`;

    const strokeDifference = strokeB - strokeA;
    const strokeSign = strokeDifference > 0 ? "+" : "";
    getElement("strokeDiff").textContent = `${strokeSign}${formatInteger(strokeDifference)} mm`;
    getElement("speedDriver").textContent = `${state.speedDriver}側`;
    getElement("rpmDriver").textContent = `${state.rpmDriver}側`;
    getElement("strokeDriver").textContent = state.strokeDriver.includes("体積")
      ? state.strokeDriver
      : `${state.strokeDriver}側`;
  }

  function readIntegerInput(input) {
    const number = Number(input.value);
    const maximum = Number(input.max) || CONTROL_MAX;
    return clamp(Number.isFinite(number) ? Math.round(number) : 0, CONTROL_MIN, maximum);
  }

  SIDES.forEach((side) => {
    getElement(`d${side}`).addEventListener("input", (event) => {
      state[`d${side}`] = DIAMETERS[Number(event.target.value)];
      render();
    });

    LINKED_KEYS.forEach((key) => {
      ["Range", "Number"].forEach((kind) => {
        getElement(`${key}${kind}${side}`).addEventListener("input", (event) => {
          const value = readIntegerInput(event.target);
          const areaA = calculateArea(state.dA);
          const areaB = calculateArea(state.dB);

          if (key === "speed") {
            state.speedDriver = side;
            state[`speed${side}`] = value;
          } else if (key === "rpm") {
            state.rpmDriver = side;
            state[`rpm${side}`] = value;
          } else {
            state.strokeDriver = side;
            state.volume = Math.round(value * (side === "A" ? areaA : areaB));
          }

          render();
        });
      });
    });
  });

  ["volumeNumber", "volumeRange"].forEach((id) => {
    getElement(id).addEventListener("input", (event) => {
      const volumeMax = Number(getElement("volumeRange").max);
      const volume = Number(event.target.value);
      state.volume = clamp(Number.isFinite(volume) ? Math.round(volume) : 0, 0, volumeMax);
      state.strokeDriver = id === "volumeRange" ? "体積スライダー" : "体積入力";
      render();
    });
  });

  render();
})();

