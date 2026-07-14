(() => {
  "use strict";

  const DIAMETERS = [24, 28, 32, 36, 45];
  const CONTROL_MIN = 0;
  const CONTROL_MAX = 200;
  const SIDES = ["A", "B"];
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
