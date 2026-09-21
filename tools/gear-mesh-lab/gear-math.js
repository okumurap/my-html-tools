/* 外歯・平歯車／標準並歯・基準圧力角（ラジアン）／KHK 表4.3 の計算法。 */
(function (root) {
  'use strict';
  const rad = Math.PI / 180;
  const inv = a => Math.tan(a) - a;
  const finite = (value, name, min, max, integer = false) => {
    if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) throw Error(`${name}は数値で入力してください。`);
    const n = Number(value);
    if (n < min || n > max || (integer && !Number.isInteger(n))) throw Error(`${name}は${min}～${max}${integer ? 'の整数' : ''}で入力してください。`);
    return n;
  };
  function calculate(params) {
    const m = finite(params.m, 'モジュール', 0.5, 10);
    const z1 = finite(params.z1, '歯数1', 8, 80, true);
    const z2 = finite(params.z2, '歯数2', 8, 80, true);
    const alphaDeg = finite(params.alpha, '基準圧力角', 14.5, 30);
    const x1 = finite(params.x1, '転位係数1', -0.8, 1);
    const x2 = finite(params.x2, '転位係数2', -0.8, 1);
    const extra = finite(params.extra, '中心距離の追加量', 0, 20);
    if (extra > 2 * m) throw Error('中心距離の追加量はモジュールの2倍以下にしてください。');
    const alpha = alphaDeg * rad;
    const sum = z1 + z2;
    const target = inv(alpha) + 2 * Math.tan(alpha) * (x1 + x2) / sum;
    if (target <= 0) throw Error('転位係数の合計が小さすぎ、すきまゼロ条件のかみ合い圧力角を求められません。');
    // inv(a) は 0<a<π/2 で単調増加。二分法により逆算。
    let low = 0, high = 1.2;
    for (let i = 0; i < 65; i++) {
      const mid = (low + high) / 2;
      if (inv(mid) < target) low = mid; else high = mid;
    }
    const nominalAlpha = (low + high) / 2;
    const a0 = m * sum / 2;
    const y = sum / 2 * (Math.cos(alpha) / Math.cos(nominalAlpha) - 1);
    const nominalCenter = a0 + m * y;
    const a = nominalCenter + extra;
    const workingCos = a0 * Math.cos(alpha) / a;
    if (workingCos <= 0 || workingCos > 1) throw Error('中心距離の設定が基礎円の幾何条件を満たしません。');
    const workingAlpha = Math.acos(workingCos);
    const k = x1 + x2 - y;
    const make = (z, x, otherX) => {
      const r = m * z / 2;
      const rb = r * Math.cos(alpha);
      // KHK表4.3：歯先はゼロバックラッシ組合せの転位・中心距離係数で決定。
      const ra = r + m * (1 + y - otherX);
      const rf = r - m * (1.25 - x);
      const rw = rb / Math.cos(workingAlpha);
      if (rf <= 0 || ra <= rb || ra <= rf) throw Error('歯先・歯底寸法が成立しません。歯数または転位係数を変更してください。');
      const toothAngle = radius => {
        const at = Math.acos(Math.min(1, rb / Math.max(rb, radius)));
        return Math.PI / (2 * z) + 2 * x * Math.tan(alpha) / z + inv(alpha) - inv(at);
      };
      const tipAngle = toothAngle(ra);
      if (tipAngle <= 0) throw Error('歯先が尖り、実用歯形を描けません。転位係数を小さくしてください。');
      return { z, x, r, rb, ra, rf, rw, d: 2*r, db: 2*rb, da: 2*ra, df: 2*rf, dw: 2*rw, toothAngle, tipThickness: 2*ra*tipAngle, xMin: 1-z*Math.sin(alpha)**2/2 };
    };
    const g1 = make(z1, x1, x2), g2 = make(z2, x2, x1);
    const basePitch = Math.PI * m * Math.cos(alpha);
    const length = Math.sqrt(g1.ra**2 - g1.rb**2) + Math.sqrt(g2.ra**2 - g2.rb**2) - a*Math.sin(workingAlpha);
    const ratio = length / basePitch;
    if (length <= 0) throw Error('歯先円が作用線上で重ならず、かみ合いが成立しません。');
    const approach = g2.rw*Math.sin(workingAlpha) - Math.sqrt(g2.ra**2 - g2.rb**2);
    const recess = Math.sqrt(g1.ra**2 - g1.rb**2) - g1.rw*Math.sin(workingAlpha);
    const clearance1 = a-g1.ra-g2.rf;
    const clearance2 = a-g2.ra-g1.rf;
    const warnings = [];
    for (const [i, g] of [[1,g1],[2,g2]]) {
      if (g.x < g.xMin-1e-9) warnings.push(`歯車${i}：標準ラック工具では切下げの可能性（目安 x ≧ ${g.xMin.toFixed(3)}）。歯元形状は近似表示です。`);
      if (g.tipThickness < 0.2*m) warnings.push(`歯車${i}：歯先厚さが0.2m未満です。`);
    }
    if (ratio < 1) warnings.push('かみ合い率が1未満のため、連続した歯の接触を維持できません。');
    if (Math.min(clearance1,clearance2)<0) warnings.push('歯先と相手歯底に計算上の干渉があります。');
    if (extra>0) warnings.push('中心距離の追加量によるバックラッシは一次近似値です。歯形・歯先径は変わりません。');
    return {m,z1,z2,alpha,alphaDeg,x1,x2,extra,a0,y,k,nominalCenter,a,nominalAlpha,workingAlpha,basePitch,ratio,length,approach,recess,clearance1,clearance2,backlashApprox:2*extra*Math.tan(workingAlpha),g1,g2,warnings};
  }
  root.GearMath = {calculate, inv};
  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate,inv};
})(typeof window !== 'undefined' ? window : globalThis);
