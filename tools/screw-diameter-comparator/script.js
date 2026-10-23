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
        <p>95％充填・クッション10 mm</p>
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

  function positions(area) {
    const stroke = state.volume / area;
    return { metering: CUSHION_MM + stroke, vp: CUSHION_MM + stroke * (1 - VP_FILL_RATIO), travel: stroke * VP_FILL_RATIO };
  }

  function renderPositionDiagram(areaA, areaB) {
    const values = [positions(areaA), positions(areaB)];
    const limit = Math.max(20, Math.ceil(Math.max(...values.map(v => v.metering)) / 10) * 10);
    const x = value => 24 + value / limit * 472;
    const axis = `<g class="position-axis" aria-hidden="true"><path d="M24 8H496" stroke="currentColor"/>${[0, limit / 2, limit].map(v => `<path d="M${x(v)} 4v8" stroke="currentColor"/><text x="${x(v)}" y="26" text-anchor="middle">${v} mm</text>`).join('')}</g>`;
    getElement('positionDiagram').innerHTML = values.map((v, i) => {
      const side = SIDES[i], diameter = state['d' + side];
      return `<div class="position-lane position-${side.toLowerCase()}"><h3>条件${side} · φ${diameter} mm</h3>
        <svg viewBox="0 0 520 90" style="display:block;width:100%;height:auto;max-height:none" role="img" aria-label="条件${side}：計量完${formatTwoDecimals(v.metering)} mmからV-P切替${formatTwoDecimals(v.vp)} mm、クッション10 mmへ前進">
          ${axis}
          <g transform="translate(0 39)">
          <path d="M24 26H496" class="position-track"/>
          <path d="M${x(v.metering)} 26H${x(v.vp)}" class="position-travel"/>
          <path d="M${x(v.vp)} 26H${x(CUSHION_MM)}" class="position-remaining"/>
          ${v.travel > 0 ? `<path d="M${x((v.metering + v.vp)/2)+8} 18l-12 8 12 8" class="position-arrow"/>` : ''}
          <rect x="${x(v.metering)-6}" y="20" width="12" height="12" class="position-meter"/>
          <circle cx="${x(CUSHION_MM)}" cy="26" r="7" class="position-cushion"/>
          <path d="M${x(v.vp)} 16l10 10-10 10-10-10Z" class="position-vp"/>
          </g>
        </svg>
        <dl class="position-values"><div><dt>■ 計量完</dt><dd>${formatTwoDecimals(v.metering)} mm</dd></div><div><dt>◆ V-P切替</dt><dd>${formatTwoDecimals(v.vp)} mm</dd></div><div><dt>● クッション</dt><dd>10.00 mm</dd></div></dl>
      </div>`;
    }).join('');
    getElement('positionSummary').textContent = state.volume === 0 ? '体積0：3つの位置はすべて10 mmで重なります。' : '同じ体積では、径が大きいほど移動量が短くなります。実際の位置差を同じ縮尺で表示しています。';
  }

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
    const { metering: meteringPosition, travel: vpTravel, vp: vpPosition } = positions(values.area);
    getElement(`vpPosition${side}`).textContent = `${formatTwoDecimals(vpPosition)} mm`;
    getElement(`meteringPosition${side}`).textContent = `${formatTwoDecimals(meteringPosition)} mm`;
    getElement(`vpTravel${side}`).textContent = `${formatTwoDecimals(vpTravel)} mm`;
    getElement(`flow${side}`).textContent = `${formatInteger(values.area * values.speed)} mm³/s`;
    getElement(`surface${side}`).textContent = `${formatInteger(Math.PI * values.diameter * values.rpm)} mm/min`;
    getElement(`time${side}`).textContent = values.speed > 0
      ? `${formatTwoDecimals(values.stroke / values.speed)} s`
      : "―";
  }

  function render() {
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

    renderPositionDiagram(areaA, areaB);

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

