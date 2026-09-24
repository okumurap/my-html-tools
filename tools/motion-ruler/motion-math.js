(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MotionMeasureMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const EPS = 1e-12;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const magnitude = v => Math.hypot(v.x, v.y, v.z);
  const unit = v => {
    const m = magnitude(v);
    return m > EPS ? scale(v, 1 / m) : { x: 1, y: 0, z: 0 };
  };

  function rotationMatrix(alpha = 0, beta = 0, gamma = 0) {
    const x = Number.isFinite(beta) ? beta * DEG : 0;
    const y = Number.isFinite(gamma) ? gamma * DEG : 0;
    const z = Number.isFinite(alpha) ? alpha * DEG : 0;
    const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
    const sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    return [
      cZ * cY - sZ * sX * sY, -cX * sZ, cY * sZ * sX + cZ * sY,
      cY * sZ + cZ * sX * sY, cZ * cX, sZ * sY - cZ * cY * sX,
      -cX * sY, sX, cX * cY
    ];
  }

  function rotateVector(v, matrix) {
    return {
      x: matrix[0] * v.x + matrix[1] * v.y + matrix[2] * v.z,
      y: matrix[3] * v.x + matrix[4] * v.y + matrix[5] * v.z,
      z: matrix[6] * v.x + matrix[7] * v.y + matrix[8] * v.z
    };
  }

  function meanVector(vectors) {
    if (!vectors.length) return { x: 0, y: 0, z: 0 };
    const sum = vectors.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 });
    return scale(sum, 1 / vectors.length);
  }

  function vectorStd(vectors, mean = meanVector(vectors)) {
    if (vectors.length < 2) return 0;
    const variance = vectors.reduce((sum, v) => {
      const d = sub(v, mean);
      return sum + dot(d, d);
    }, 0) / vectors.length;
    return Math.sqrt(variance);
  }

  function dominantAxis(points) {
    if (points.length < 2) return { x: 1, y: 0, z: 0 };
    const center = meanVector(points);
    const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of points) {
      const d = sub(p, center);
      cov[0] += d.x * d.x; cov[1] += d.x * d.y; cov[2] += d.x * d.z;
      cov[3] += d.y * d.x; cov[4] += d.y * d.y; cov[5] += d.y * d.z;
      cov[6] += d.z * d.x; cov[7] += d.z * d.y; cov[8] += d.z * d.z;
    }
    let v = unit(sub(points[points.length - 1], points[0]));
    for (let i = 0; i < 12; i += 1) {
      const next = {
        x: cov[0] * v.x + cov[1] * v.y + cov[2] * v.z,
        y: cov[3] * v.x + cov[4] * v.y + cov[5] * v.z,
        z: cov[6] * v.x + cov[7] * v.y + cov[8] * v.z
      };
      if (magnitude(next) < EPS) break;
      v = unit(next);
    }
    const endDelta = sub(points[points.length - 1], points[0]);
    return dot(v, endDelta) < 0 ? scale(v, -1) : v;
  }

  function analyzePath(points) {
    if (points.length < 2) {
      return { axis: { x: 1, y: 0, z: 0 }, sideRms: 0, pathDistance: 0, finalVector: { x: 0, y: 0, z: 0 } };
    }
    const origin = points[0];
    const axis = dominantAxis(points);
    let sideSq = 0;
    let pathDistance = 0;
    for (let i = 0; i < points.length; i += 1) {
      const rel = sub(points[i], origin);
      const axial = scale(axis, dot(rel, axis));
      const side = sub(rel, axial);
      sideSq += dot(side, side);
      if (i > 0) pathDistance += magnitude(sub(points[i], points[i - 1]));
    }
    return {
      axis,
      sideRms: Math.sqrt(sideSq / points.length),
      pathDistance,
      finalVector: sub(points[points.length - 1], origin)
    };
  }

  function integrateSamples(samples, calibrationFactor = 1) {
    const clean = (Array.isArray(samples) ? samples : [])
      .filter(s => Number.isFinite(s?.t) && s?.a && Number.isFinite(s.a.x) && Number.isFinite(s.a.y) && Number.isFinite(s.a.z))
      .sort((a, b) => a.t - b.t);
    if (clean.length < 2) {
      return {
        duration: 0, rawStraightMm: 0, straightMm: 0, rawPathMm: 0, pathMm: 0,
        finalVectorMm: { x: 0, y: 0, z: 0 }, rawEndVelocity: 0,
        sideRmsMm: 0, axis: { x: 1, y: 0, z: 0 }, positions: [{ x: 0, y: 0, z: 0 }]
      };
    }

    const startT = clean[0].t;
    const duration = Math.max(0, clean[clean.length - 1].t - startT);
    let velocity = { x: 0, y: 0, z: 0 };
    const rawVelocities = [{ t: clean[0].t, v: velocity }];

    for (let i = 1; i < clean.length; i += 1) {
      const dt = clamp(clean[i].t - clean[i - 1].t, 0, 0.1);
      const avgA = scale(add(clean[i - 1].a, clean[i].a), 0.5);
      velocity = add(velocity, scale(avgA, dt));
      rawVelocities.push({ t: clean[i].t, v: velocity });
    }

    const endV = rawVelocities[rawVelocities.length - 1].v;
    const rawEndVelocity = magnitude(endV);
    const corrected = rawVelocities.map(item => {
      const ratio = duration > EPS ? clamp((item.t - startT) / duration, 0, 1) : 0;
      return { t: item.t, v: sub(item.v, scale(endV, ratio)) };
    });

    let position = { x: 0, y: 0, z: 0 };
    const positions = [position];
    for (let i = 1; i < corrected.length; i += 1) {
      const dt = clamp(corrected[i].t - corrected[i - 1].t, 0, 0.1);
      const avgV = scale(add(corrected[i - 1].v, corrected[i].v), 0.5);
      position = add(position, scale(avgV, dt));
      positions.push(position);
    }

    const path = analyzePath(positions);
    const rawStraightMm = magnitude(path.finalVector) * 1000;
    const rawPathMm = path.pathDistance * 1000;
    const factor = Number.isFinite(calibrationFactor) ? clamp(calibrationFactor, 0.2, 5) : 1;

    return {
      duration,
      rawStraightMm,
      straightMm: rawStraightMm * factor,
      rawPathMm,
      pathMm: rawPathMm * factor,
      finalVectorMm: scale(path.finalVector, 1000 * factor),
      rawEndVelocity,
      sideRmsMm: path.sideRms * 1000 * factor,
      axis: path.axis,
      positions: positions.map(p => scale(p, 1000 * factor))
    };
  }

  function chooseProjection(points) {
    if (!points.length) return { a: 'x', b: 'y' };
    const mean = meanVector(points);
    const variance = { x: 0, y: 0, z: 0 };
    for (const p of points) {
      variance.x += (p.x - mean.x) ** 2;
      variance.y += (p.y - mean.y) ** 2;
      variance.z += (p.z - mean.z) ** 2;
    }
    const axes = ['x', 'y', 'z'].sort((a, b) => variance[b] - variance[a]);
    return { a: axes[0], b: axes[1] };
  }

  return {
    clamp,
    add,
    sub,
    scale,
    dot,
    magnitude,
    rotationMatrix,
    rotateVector,
    meanVector,
    vectorStd,
    dominantAxis,
    analyzePath,
    integrateSamples,
    chooseProjection
  };
});
