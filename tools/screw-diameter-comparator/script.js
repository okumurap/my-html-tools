(() => {
  "use strict";

  const DEFAULT_VALUES = {
    diameterA: "36",
    diameterB: "45",
    injectionSpeedA: "10",
    injectionSpeedB: "6.40",
    strokeA: "100",
    strokeB: "64.00",
    rotationSpeed: "100",
    targetVolume: "100000",
  };

  const inputs = Object.fromEntries(
    Object.keys(DEFAULT_VALUES).map((key) => [key, document.getElementById(key)]),
  );

  const validationMessage = document.getElementById("validationMessage");
  const resetButton = document.getElementById("resetButton");
  const sourceElements = {
    injectionSpeed: document.getElementById("injectionSpeedSource"),
    stroke: document.getElementById("strokeSource"),
  };
  const linkedSources = {
    injectionSpeed: "A",
    stroke: "A",
  };
  let updateFrame = 0;

  const resultElements = {
    A: {
      diameter: document.getElementById("diameterDisplayA"),
      area: document.getElementById("areaA"),
      circumference: document.getElementById("circumferenceA"),
      peripheralSpeed: document.getElementById("peripheralSpeedA"),
      flowRate: document.getElementById("flowRateA"),
      shotVolume: document.getElementById("shotVolumeA"),
      requiredStroke: document.getElementById("requiredStrokeA"),
      strokeRatio: document.getElementById("strokeRatioA"),
    },
    B: {
      diameter: document.getElementById("diameterDisplayB"),
      area: document.getElementById("areaB"),
      circumference: document.getElementById("circumferenceB"),
      peripheralSpeed: document.getElementById("peripheralSpeedB"),
      flowRate: document.getElementById("flowRateB"),
      shotVolume: document.getElementById("shotVolumeB"),
      requiredStroke: document.getElementById("requiredStrokeB"),
      strokeRatio: document.getElementById("strokeRatioB"),
    },
  };

  const comparisonRows = {
    diameter: comparisonElements("Diameter"),
    area: comparisonElements("Area"),
    circumference: comparisonElements("Circumference"),
    peripheralSpeed: comparisonElements("PeripheralSpeed"),
    flowRate: comparisonElements("FlowRate"),
    shotVolume: comparisonElements("ShotVolume"),
    requiredStroke: comparisonElements("RequiredStroke"),
    strokeRatio: comparisonElements("StrokeRatio"),
  };

  function comparisonElements(name) {
    return {
      A: document.getElementById(`compare${name}A`),
      B: document.getElementById(`compare${name}B`),
      ratio: document.getElementById(`compare${name}Ratio`),
      change: document.getElementById(`compare${name}Change`),
    };
  }

  function calculateArea(diameterMm) {
    return Math.PI * diameterMm ** 2 / 4;
  }

  function calculateCircumference(diameterMm) {
    return Math.PI * diameterMm;
  }

  function calculatePeripheralSpeed(diameterMm, rpm) {
    return Math.PI * diameterMm * rpm / 60;
  }

  function calculateFlowRate(areaMm2, injectionSpeedMmPerSec) {
    return areaMm2 * injectionSpeedMmPerSec;
  }

  function calculateShotVolume(areaMm2, strokeMm) {
    return areaMm2 * strokeMm;
  }

  function calculateRequiredStroke(areaMm2, targetVolumeMm3) {
    return targetVolumeMm3 / areaMm2;
  }

  function calculateScrew(diameter, injectionSpeed, stroke, conditions) {
    const area = calculateArea(diameter);
    return {
      diameter,
      area,
      circumference: calculateCircumference(diameter),
      peripheralSpeed: calculatePeripheralSpeed(diameter, conditions.rotationSpeed),
      flowRate: calculateFlowRate(area, injectionSpeed),
      shotVolume: calculateShotVolume(area, stroke),
      requiredStroke: calculateRequiredStroke(area, conditions.targetVolume),
      strokeRatio: stroke / diameter,
    };
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) return "－";
    return Math.round(value).toLocaleString("ja-JP");
  }

  function formatWithUnit(value, unit) {
    return `${formatInteger(value)} ${unit}`;
  }

  function formatStrokeRatio(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}D` : "－";
  }

  function formatMultiplier(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}倍` : "－";
  }

  function formatChange(value) {
    if (!Number.isFinite(value)) return "－";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  }

  function readPositiveNumber(input, label) {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${label}には0より大きい数値を入力してください。`);
    }
    return value;
  }

  function calculateEquivalentValue(value, sourceDiameter, targetDiameter) {
    return value * calculateArea(sourceDiameter) / calculateArea(targetDiameter);
  }

  function readLinkedPair(field, label, diameters) {
    const source = linkedSources[field];
    const target = source === "A" ? "B" : "A";
    const sourceValue = readPositiveNumber(inputs[`${field}${source}`], `${label}${source}`);
    const targetValue = calculateEquivalentValue(
      sourceValue,
      diameters[source],
      diameters[target],
    );

    return source === "A"
      ? { A: sourceValue, B: targetValue }
      : { A: targetValue, B: sourceValue };
  }

  function readConditions() {
    const diameters = {
      A: readPositiveNumber(inputs.diameterA, "スクリュ径A"),
      B: readPositiveNumber(inputs.diameterB, "スクリュ径B"),
    };
    const injectionSpeeds = readLinkedPair("injectionSpeed", "射出速度", diameters);
    const strokes = readLinkedPair("stroke", "スクリュ移動量", diameters);

    return {
      diameterA: diameters.A,
      diameterB: diameters.B,
      injectionSpeedA: injectionSpeeds.A,
      injectionSpeedB: injectionSpeeds.B,
      strokeA: strokes.A,
      strokeB: strokes.B,
      rotationSpeed: readPositiveNumber(inputs.rotationSpeed, "スクリュ回転速度"),
      targetVolume: readPositiveNumber(inputs.targetVolume, "目標充填体積"),
    };
  }

  function renderResult(key, result) {
    const elements = resultElements[key];
    elements.diameter.textContent = `φ${formatInteger(result.diameter)} mm`;
    elements.area.textContent = formatWithUnit(result.area, "mm²");
    elements.circumference.textContent = formatWithUnit(result.circumference, "mm");
    elements.peripheralSpeed.textContent = formatWithUnit(result.peripheralSpeed, "mm/s");
    elements.flowRate.textContent = formatWithUnit(result.flowRate, "mm³/s");
    elements.shotVolume.textContent = formatWithUnit(result.shotVolume, "mm³");
    elements.requiredStroke.textContent = formatWithUnit(result.requiredStroke, "mm");
    elements.strokeRatio.textContent = formatStrokeRatio(result.strokeRatio);
  }

  function renderComparison(key, valueA, valueB, formatter) {
    const elements = comparisonRows[key];
    const multiplier = valueB / valueA;
    const change = (multiplier - 1) * 100;
    elements.A.textContent = formatter(valueA);
    elements.B.textContent = formatter(valueB);
    elements.ratio.textContent = formatMultiplier(multiplier);
    elements.change.textContent = formatChange(change);
    elements.change.dataset.direction = change > 0
      ? "positive"
      : change < 0 ? "negative" : "neutral";
  }

  function renderDynamicLabels(conditions) {
    const targetVolume = formatInteger(conditions.targetVolume);
    ["A", "B"].forEach((key) => {
      const stroke = formatInteger(conditions[`stroke${key}`]);
      document.getElementById(`shotVolumeLabel${key}`).textContent = `${stroke} mm移動時の体積`;
      document.getElementById(`requiredStrokeLabel${key}`).textContent = `${targetVolume} mm³に必要なストローク`;
    });
  }

  function renderAll(conditions, resultA, resultB) {
    renderResult("A", resultA);
    renderResult("B", resultB);
    renderDynamicLabels(conditions);

    const integerFormatters = {
      diameter: (value) => formatWithUnit(value, "mm"),
      area: (value) => formatWithUnit(value, "mm²"),
      circumference: (value) => formatWithUnit(value, "mm"),
      peripheralSpeed: (value) => formatWithUnit(value, "mm/s"),
      flowRate: (value) => formatWithUnit(value, "mm³/s"),
      shotVolume: (value) => formatWithUnit(value, "mm³"),
      requiredStroke: (value) => formatWithUnit(value, "mm"),
      strokeRatio: formatStrokeRatio,
    };

    Object.keys(comparisonRows).forEach((key) => {
      renderComparison(key, resultA[key], resultB[key], integerFormatters[key]);
    });
  }

  function clearOutputs(message) {
    validationMessage.textContent = message;
    validationMessage.hidden = false;
    document.querySelectorAll("[data-output]").forEach((element) => {
      element.textContent = "－";
    });
    document.querySelectorAll(".change-cell").forEach((element) => {
      element.dataset.direction = "neutral";
    });
  }

  function update() {
    try {
      const conditions = readConditions();
      const resultA = calculateScrew(
        conditions.diameterA,
        conditions.injectionSpeedA,
        conditions.strokeA,
        conditions,
      );
      const resultB = calculateScrew(
        conditions.diameterB,
        conditions.injectionSpeedB,
        conditions.strokeB,
        conditions,
      );
      validationMessage.hidden = true;
      validationMessage.textContent = "";
      renderAll(conditions, resultA, resultB);
    } catch (error) {
      clearOutputs(error.message);
    }
  }

  function scheduleUpdate() {
    window.cancelAnimationFrame(updateFrame);
    updateFrame = window.requestAnimationFrame(update);
  }

  function syncLinkedPair(field) {
    const source = linkedSources[field];
    const target = source === "A" ? "B" : "A";
    const sourceValue = inputs[`${field}${source}`].valueAsNumber;
    const sourceDiameter = inputs[`diameter${source}`].valueAsNumber;
    const targetDiameter = inputs[`diameter${target}`].valueAsNumber;

    if (
      !Number.isFinite(sourceValue)
      || sourceValue <= 0
      || !Number.isFinite(sourceDiameter)
      || sourceDiameter <= 0
      || !Number.isFinite(targetDiameter)
      || targetDiameter <= 0
    ) {
      return;
    }

    const convertedValue = calculateEquivalentValue(
      sourceValue,
      sourceDiameter,
      targetDiameter,
    );
    inputs[`${field}${target}`].value = convertedValue.toFixed(2);
  }

  function syncAllLinkedPairs() {
    syncLinkedPair("injectionSpeed");
    syncLinkedPair("stroke");
  }

  function updateSourceStatus() {
    Object.keys(linkedSources).forEach((field) => {
      sourceElements[field].textContent = `${linkedSources[field]}基準`;
    });
  }

  function handleInput(event) {
    const { id } = event.currentTarget;
    const linkedField = ["injectionSpeed", "stroke"].find((field) => id.startsWith(field));

    if (linkedField) {
      linkedSources[linkedField] = id.endsWith("A") ? "A" : "B";
      syncLinkedPair(linkedField);
      updateSourceStatus();
    } else if (id === "diameterA" || id === "diameterB") {
      syncAllLinkedPairs();
    }

    scheduleUpdate();
  }

  function reset() {
    Object.entries(DEFAULT_VALUES).forEach(([key, value]) => {
      inputs[key].value = value;
    });
    linkedSources.injectionSpeed = "A";
    linkedSources.stroke = "A";
    syncAllLinkedPairs();
    updateSourceStatus();
    scheduleUpdate();
  }

  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", handleInput);
  });
  resetButton.addEventListener("click", reset);

  update();
})();
