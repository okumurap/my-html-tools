// 21 blocks cover -50…+50 cents. The center represents the ±5-cent target.
export function meterState(value) {
  if (value === null || !Number.isFinite(value)) return {active:-1, tuned:false, overflow:false, label:'入力待ち'};
  const tuned = Math.abs(value) <= 5;
  const step = tuned ? 0 : Math.sign(value) * Math.min(10, Math.max(1, Math.round(Math.abs(value) / 5)));
  return {
    active:10 + step,
    tuned,
    overflow:Math.abs(value) > 50,
    label:tuned ? '音程が合っています' : `音程が${value < 0 ? '低い' : '高い'}${Math.abs(value) > 50 ? '・表示範囲外' : ''}`
  };
}
export function createMeter(element) {
  const blocks = Array.from({length:21}, (_,i) => {
    const block = document.createElement('span');
    block.className = 'block' + (i === 10 ? ' target' : '');
    block.setAttribute('aria-hidden','true');
    element.querySelector('.blocks').append(block);
    return block;
  });
  let previous = '';
  return value => {
    const state = meterState(value);
    const key = `${state.active}/${state.tuned}/${state.overflow}`;
    if (key === previous) return;
    previous = key;
    blocks.forEach((block,i) => block.classList.toggle('active',i === state.active));
    element.classList.toggle('in-tune',state.tuned);
    element.classList.toggle('overflow',state.overflow);
    element.setAttribute('aria-label',state.label);
  };
}
