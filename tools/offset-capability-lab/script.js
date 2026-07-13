(() => {
  "use strict";

  const SAMPLE_SIZE = 10000;
  const BIN_COUNT = 100;
  const DEFAULTS = {
    offset: 5,
    stddev: 2.3,
    mean: -5.5,
    usl: 19.5,
    lsl: -30.5,
  };

  const ui = {
    offset: document.getElementById("offset"),
    stddev: document.getElementById("stddev"),
    mean: document.getElementById("meanInput"),
    usl: document.getElementById("uslInput"),
    lsl: document.getElementById("lslInput"),
    offsetValue: document.getElementById("offsetValue"),
    stddevValue: document.getElementById("stddevValue"),
    validation: document.getElementById("validationMessage"),
    resampleButton: document.getElementById("resampleButton"),
    resetButton: document.getElementById("resetButton"),
    advancedSettings: document.getElementById("advancedSettings"),
    summaryMean: document.getElementById("summaryMean"),
    summaryUsl: document.getElementById("summaryUsl"),
    summaryLsl: document.getElementById("summaryLsl"),
    canvas: document.getElementById("histogram"),
    chartDescription: document.getElementById("chartDescription"),
  };

  const metricElements = Object.fromEntries(
    ["plus", "minus", "all"].map((key) => [key, {
      card: document.getElementById(`${key}Card`),
      state: document.getElementById(`${key}State`),
      cp: document.getElementById(`${key}Cp`),
      cpk: document.getElementById(`${key}Cpk`),
      mean: document.getElementById(`${key}Mean`),
      sigma: document.getElementById(`${key}Sigma`),
    }]),
  );

  const context = ui.canvas.getContext("2d");
  let latestResult = null;
  let updateFrame = 0;
  let chartFrame = 0;
  const mobileLayoutQuery = window.matchMedia("(max-width: 41.99rem)");

  function format(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : "—";
  }

  function readRequiredNumber(element, label) {
    const rawValue = element.value.trim();
    const value = Number(rawValue);

    if (rawValue === "" || !Number.isFinite(value)) {
      throw new Error(`${label}に有効な数値を入力してください。`);
    }

    return value;
  }

  function readSettings() {
    const settings = {
      offset: Number(ui.offset.value),
      stddev: Number(ui.stddev.value),
      mean: readRequiredNumber(ui.mean, "Mean"),
      usl: readRequiredNumber(ui.usl, "USL"),
      lsl: readRequiredNumber(ui.lsl, "LSL"),
    };

    if (!Number.isFinite(settings.stddev) || settings.stddev <= 0) {
      throw new Error("Standard Deviationは0より大きい値にしてください。");
    }

    if (settings.usl <= settings.lsl) {
      throw new Error("USLはLSLより大きい値にしてください。");
    }

    return settings;
  }

  function generateNormalData(mean, standardDeviation, offset) {
    const source = new Float64Array(SAMPLE_SIZE);

    for (let index = 0; index < SAMPLE_SIZE; index += 2) {
      const u = Math.max(Math.random(), Number.EPSILON);
      const v = Math.max(Math.random(), Number.EPSILON);
      const magnitude = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      source[index] = mean + standardDeviation * magnitude * Math.cos(angle);

      if (index + 1 < SAMPLE_SIZE) {
        source[index + 1] = mean + standardDeviation * magnitude * Math.sin(angle);
      }
    }

    const half = SAMPLE_SIZE / 2;
    const plus = new Float64Array(half);
    const minus = new Float64Array(half);

    for (let index = 0; index < half; index += 1) {
      plus[index] = source[index] + offset;
      minus[index] = source[index + half] - offset;
    }

    return { plus, minus };
  }

  function calculateCapability(values, usl, lsl) {
    let sum = 0;
    for (const value of values) sum += value;
    const mean = sum / values.length;

    let squaredDifferenceSum = 0;
    for (const value of values) {
      const difference = value - mean;
      squaredDifferenceSum += difference * difference;
    }

    const sigma = Math.sqrt(squaredDifferenceSum / values.length);
    const cp = (usl - lsl) / (6 * sigma);
    const cpk = Math.min(
      (usl - mean) / (3 * sigma),
      (mean - lsl) / (3 * sigma),
    );

    return { mean, sigma, cp, cpk };
  }

  function combineData(first, second) {
    const combined = new Float64Array(first.length + second.length);
    combined.set(first);
    combined.set(second, first.length);
    return combined;
  }

  function capabilityLabel(cpk) {
    if (cpk >= 1.33) return { text: "良好", level: "good" };
    if (cpk >= 1) return { text: "要監視", level: "watch" };
    return { text: "規格注意", level: "alert" };
  }

  function updateMetricCard(key, stats) {
    const elements = metricElements[key];
    const label = capabilityLabel(stats.cpk);
    elements.card.dataset.level = label.level;
    elements.state.textContent = label.text;
    elements.cp.textContent = format(stats.cp);
    elements.cpk.textContent = format(stats.cpk);
    elements.mean.textContent = format(stats.mean);
    elements.sigma.textContent = format(stats.sigma);
  }

  function clearMetricCards() {
    Object.values(metricElements).forEach((elements) => {
      delete elements.card.dataset.level;
      elements.state.textContent = "入力待ち";
      elements.cp.textContent = "—";
      elements.cpk.textContent = "—";
      elements.mean.textContent = "—";
      elements.sigma.textContent = "—";
    });
  }

  function computeHistogram(values, minimum, maximum) {
    const bins = new Float64Array(BIN_COUNT);
    const binWidth = (maximum - minimum) / BIN_COUNT;

    for (const value of values) {
      const rawIndex = Math.floor((value - minimum) / binWidth);
      const index = Math.max(0, Math.min(BIN_COUNT - 1, rawIndex));
      bins[index] += 1;
    }

    const densityFactor = 1 / (values.length * binWidth);
    for (let index = 0; index < bins.length; index += 1) {
      bins[index] *= densityFactor;
    }

    return bins;
  }

  function dataBounds(result) {
    let minimum = result.settings.lsl;
    let maximum = result.settings.usl;

    for (const values of [result.plus, result.minus]) {
      for (const value of values) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }

    const span = Math.max(maximum - minimum, 1);
    return {
      minimum: minimum - span * 0.04,
      maximum: maximum + span * 0.04,
    };
  }

  function resizeCanvas() {
    const rectangle = ui.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rectangle.width));
    const height = Math.max(1, Math.round(rectangle.height));
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (ui.canvas.width !== pixelWidth || ui.canvas.height !== pixelHeight) {
      ui.canvas.width = pixelWidth;
      ui.canvas.height = pixelHeight;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function drawEmptyChart(message) {
    const { width, height } = resizeCanvas();
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#66707b";
    context.font = "12px SFMono-Regular, Consolas, monospace";
    context.textAlign = "center";
    context.fillText(message, width / 2, height / 2);
    context.textAlign = "left";
  }

  function drawHistogram(result) {
    if (!context || !result) return;

    const { width, height } = resizeCanvas();
    const compact = width < 520;
    const margin = {
      top: compact ? 26 : 32,
      right: compact ? 14 : 24,
      bottom: compact ? 42 : 52,
      left: compact ? 44 : 58,
    };
    const plotWidth = Math.max(1, width - margin.left - margin.right);
    const plotHeight = Math.max(1, height - margin.top - margin.bottom);
    const bounds = dataBounds(result);
    const plusHistogram = computeHistogram(result.plus, bounds.minimum, bounds.maximum);
    const minusHistogram = computeHistogram(result.minus, bounds.minimum, bounds.maximum);
    let maximumDensity = 0;

    for (let index = 0; index < BIN_COUNT; index += 1) {
      maximumDensity = Math.max(maximumDensity, plusHistogram[index], minusHistogram[index]);
    }
    maximumDensity = Math.max(maximumDensity * 1.16, Number.EPSILON);

    const xToPixel = (value) => margin.left
      + ((value - bounds.minimum) / (bounds.maximum - bounds.minimum)) * plotWidth;
    const yToPixel = (value) => margin.top + plotHeight - (value / maximumDensity) * plotHeight;

    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.font = `${compact ? 9 : 10}px SFMono-Regular, Consolas, monospace`;

    context.strokeStyle = "#e3e7eb";
    context.fillStyle = "#66707b";
    const horizontalLines = 4;
    for (let index = 0; index <= horizontalLines; index += 1) {
      const ratio = index / horizontalLines;
      const y = margin.top + plotHeight - ratio * plotHeight;
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(margin.left + plotWidth, y);
      context.stroke();

      if (index > 0) {
        context.fillText((maximumDensity * ratio).toFixed(3), 5, y + 3);
      }
    }

    const tickCount = compact ? 4 : 6;
    context.textAlign = "center";
    for (let index = 0; index <= tickCount; index += 1) {
      const ratio = index / tickCount;
      const value = bounds.minimum + (bounds.maximum - bounds.minimum) * ratio;
      const x = margin.left + plotWidth * ratio;
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + plotHeight);
      context.stroke();
      context.fillText(value.toFixed(compact ? 0 : 1), x, height - 18);
    }
    context.textAlign = "left";

    const barWidth = plotWidth / BIN_COUNT;
    const drawBars = (histogram, color) => {
      context.fillStyle = color;
      for (let index = 0; index < BIN_COUNT; index += 1) {
        const barHeight = margin.top + plotHeight - yToPixel(histogram[index]);
        context.fillRect(
          margin.left + index * barWidth,
          yToPixel(histogram[index]),
          Math.max(1, barWidth),
          Math.max(0, barHeight),
        );
      }
    };

    drawBars(plusHistogram, "rgb(37 99 169 / 58%)");
    drawBars(minusHistogram, "rgb(217 119 6 / 44%)");

    const drawSpecLine = (value, label) => {
      const x = xToPixel(value);
      context.save();
      context.strokeStyle = "#dc2626";
      context.fillStyle = "#b91c1c";
      context.lineWidth = 1.5;
      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + plotHeight);
      context.stroke();
      context.setLineDash([]);
      context.textAlign = x > width / 2 ? "right" : "left";
      context.fillText(label, x + (x > width / 2 ? -5 : 5), margin.top - 9);
      context.restore();
    };

    drawSpecLine(result.settings.lsl, "LSL");
    drawSpecLine(result.settings.usl, "USL");

    context.strokeStyle = "#94a3b8";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(margin.left, margin.top);
    context.lineTo(margin.left, margin.top + plotHeight);
    context.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    context.stroke();

    context.fillStyle = "#66707b";
    context.textAlign = "center";
    context.fillText("VALUE", margin.left + plotWidth / 2, height - 3);
    context.save();
    context.translate(11, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("DENSITY", 0, 0);
    context.restore();
    context.textAlign = "left";
  }

  function scheduleChartDraw() {
    window.cancelAnimationFrame(chartFrame);
    chartFrame = window.requestAnimationFrame(() => {
      if (latestResult) drawHistogram(latestResult);
    });
  }

  function showValidationError(error) {
    latestResult = null;
    ui.validation.textContent = error.message;
    ui.validation.hidden = false;
    ui.chartDescription.textContent = error.message;
    clearMetricCards();
    drawEmptyChart("入力値を確認してください");
  }

  function update() {
    ui.offsetValue.textContent = Number(ui.offset.value).toFixed(1);
    ui.stddevValue.textContent = Number(ui.stddev.value).toFixed(1);

    try {
      const settings = readSettings();
      const { plus, minus } = generateNormalData(
        settings.mean,
        settings.stddev,
        settings.offset,
      );
      const combined = combineData(plus, minus);
      const stats = {
        plus: calculateCapability(plus, settings.usl, settings.lsl),
        minus: calculateCapability(minus, settings.usl, settings.lsl),
        all: calculateCapability(combined, settings.usl, settings.lsl),
      };

      latestResult = { settings, plus, minus, stats };
      ui.validation.hidden = true;
      ui.validation.textContent = "";
      ui.summaryMean.textContent = format(settings.mean);
      ui.summaryUsl.textContent = format(settings.usl);
      ui.summaryLsl.textContent = format(settings.lsl);
      updateMetricCard("plus", stats.plus);
      updateMetricCard("minus", stats.minus);
      updateMetricCard("all", stats.all);
      ui.chartDescription.textContent = [
        `Offset + の平均は${format(stats.plus.mean)}、Cpkは${format(stats.plus.cpk)}。`,
        `Offset − の平均は${format(stats.minus.mean)}、Cpkは${format(stats.minus.cpk)}。`,
        `全体のCpkは${format(stats.all.cpk)}です。`,
      ].join("");
      drawHistogram(latestResult);
    } catch (error) {
      showValidationError(error);
    }
  }

  function scheduleUpdate() {
    window.cancelAnimationFrame(updateFrame);
    updateFrame = window.requestAnimationFrame(update);
  }

  function reset() {
    ui.offset.value = DEFAULTS.offset;
    ui.stddev.value = DEFAULTS.stddev;
    ui.mean.value = DEFAULTS.mean;
    ui.usl.value = DEFAULTS.usl;
    ui.lsl.value = DEFAULTS.lsl;
    scheduleUpdate();
  }

  function syncAdvancedSettings() {
    ui.advancedSettings.open = !mobileLayoutQuery.matches;
    scheduleChartDraw();
  }

  [ui.offset, ui.stddev, ui.mean, ui.usl, ui.lsl].forEach((element) => {
    element.addEventListener("input", scheduleUpdate);
  });
  ui.resampleButton.addEventListener("click", scheduleUpdate);
  ui.resetButton.addEventListener("click", reset);

  if (typeof mobileLayoutQuery.addEventListener === "function") {
    mobileLayoutQuery.addEventListener("change", syncAdvancedSettings);
  } else {
    mobileLayoutQuery.addListener(syncAdvancedSettings);
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleChartDraw);
    observer.observe(ui.canvas);
  } else {
    window.addEventListener("resize", scheduleChartDraw);
  }

  if (!context) {
    ui.validation.textContent = "このブラウザではCanvasを利用できません。";
    ui.validation.hidden = false;
    clearMetricCards();
    return;
  }

  syncAdvancedSettings();
  update();
})();
