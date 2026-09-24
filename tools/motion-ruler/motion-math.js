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
    return scale(vectors.reduce((sum, v) => add(sum, v), { x: 0, y: 0, z: 0 }), 1 / vectors.length);
  }

  function vectorStd(vectors, mean = meanVector(vectors)) {
    if (vectors.length < 2) return 0;
    const variance = vectors.reduce((sum, v) => {
      const d = sub(v, mean);
      return sum + dot(d, d);
    }, 0) / vectors.length;
    return Math.sqrt(variance);
  }

  function lockAxis(vectors) {
    if (!vectors.length) return null;
    let strongest = null;
    let strongestMag = 0;
    let weighted = { x: 0, y: 0, z: 0 };
    for (const v of vectors) {
      const mag = magnitude(v);
      if (mag > strongestMag) { strongestMag = mag; strongest = v; }
      if (mag > 0.08) weighted = add(weighted, scale(v, mag));
    }
    const basis = magnitude(weighted) > 0.02 ? weighted : strongest;
    return basis && magnitude(basis) > 0.08 ? unit(basis) : null;
  }

  function integrateAxisSamples(samples, axis, calibrationFactor = 1, endResidual = { x: 0, y: 0, z: 0 }) {
    const clean = (Array.isArray(samples) ? samples : [])
      .filter(s => Number.isFinite(s?.t) && s?.a && [s.a.x, s.a.y, s.a.z].every(Number.isFinite))
      .sort((a, b) => a.t - b.t);
    const safeAxis = unit(axis || { x: 1, y: 0, z: 0 });
    if (clean.length < 2) {
      return { duration: 0, rawMm: 0, distanceMm: 0, rawEndVelocity: 0, sideAccelRms: 0, signedMeters: 0 };
    }

    const startT = clean[0].t;
    const duration = Math.max(0, clean[clean.length - 1].t - startT);
    const projected = clean.map(item => {
      const ratio = duration > EPS ? clamp((item.t - startT) / duration, 0, 1) : 0;
      const correctedA = sub(item.a, scale(endResidual, ratio));
      const axial = dot(correctedA, safeAxis);
      const side = sub(correctedA, scale(safeAxis, axial));
      return { t: item.t, axial, sideMag: magnitude(side) };
    });

    let velocity = 0;
    const rawVelocities = [{ t: projected[0].t, v: 0 }];
    for (let i = 1; i < projected.length; i += 1) {
      const dt = clamp(projected[i].t - projected[i - 1].t, 0, 0.1);
      const avgA = (projected[i - 1].axial + projected[i].axial) * 0.5;
      velocity += avgA * dt;
      rawVelocities.push({ t: projected[i].t, v: velocity });
    }

    const rawEndVelocity = rawVelocities[rawVelocities.length - 1].v;
    const correctedVelocities = rawVelocities.map(item => {
      const ratio = duration > EPS ? clamp((item.t - startT) / duration, 0, 1) : 0;
      return { t: item.t, v: item.v - rawEndVelocity * ratio };
    });

    let position = 0;
    for (let i = 1; i < correctedVelocities.length; i += 1) {
      const dt = clamp(correctedVelocities[i].t - correctedVelocities[i - 1].t, 0, 0.1);
      position += (correctedVelocities[i - 1].v + correctedVelocities[i].v) * 0.5 * dt;
    }

    const sideAccelRms = Math.sqrt(projected.reduce((sum, item) => sum + item.sideMag ** 2, 0) / projected.length);
    const factor = Number.isFinite(calibrationFactor) ? clamp(calibrationFactor, 0.2, 5) : 1;
    const rawMm = Math.abs(position) * 1000;
    return {
      duration,
      rawMm,
      distanceMm: rawMm * factor,
      rawEndVelocity: Math.abs(rawEndVelocity),
      sideAccelRms,
      signedMeters: position
    };
  }

  return {
    clamp, add, sub, scale, dot, magnitude, unit,
    rotationMatrix, rotateVector, meanVector, vectorStd,
    lockAxis, integrateAxisSamples
  };
});
