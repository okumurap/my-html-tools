(() => {
  'use strict';
  const { transforms, apply, runPipeline } = window.TextFormatter;
  const byId = new Map(transforms.map(item => [item.id, item]));
  const categories = [
    ['all', 'すべて'], ['width', '全角・半角'], ['space', '空白・改行'],
    ['lines', '行操作'], ['dev', '開発・ファイル名']
  ];
  const STORAGE_KEY = 'text-formatter-v7:settings';
  const $ = id => document.getElementById(id);
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const getSettings = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  };
  const saved = getSettings();
  const known = id => typeof id === 'string' && byId.has(id);
  const state = {
    favorites: new Set(Array.isArray(saved.favorites) ? saved.favorites.filter(known) : []),
    expanded: new Set(Array.isArray(saved.expanded) ? saved.expanded.filter(known) : []),
    steps: Array.isArray(saved.steps) ? saved.steps.filter(known).slice(0, 10) : [],
    theme: ['auto', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'auto',
    category: categories.some(([id]) => id === saved.category) ? saved.category : 'all',
    copied: null,
    compared: null
  };
  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        favorites: [...state.favorites], expanded: [...state.expanded],
        steps: state.steps, theme: state.theme, category: state.category
      }));
    } catch (_) { showToast('設定を保存できませんでした。ブラウザの保存設定を確認してください。'); }
  };
  let toastTimer;
  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300);
  }
  const length = str => [...str].length;
  const countLines = str => str ? str.split(/\r\n|\n|\r/).length : 0;
  const countLabel = str => `${length(str).toLocaleString('ja-JP')}文字 · ${countLines(str).toLocaleString('ja-JP')}行`;
  function resizeInput() {
    const input = $('input');
    input.style.height = 'auto';
    input.style.height = Math.max(132, Math.min(320, input.scrollHeight + 2)) + 'px';
  }
  const optionFor = item => {
    const el = node('option', '', item.title);
    el.value = item.id;
    return el;
  };
  function renderCategories() {
    $('filters').replaceChildren(...categories.map(([id, title]) => {
      const button = node('button', '', title);
      button.type = 'button';
      button.dataset.category = id;
      button.setAttribute('aria-pressed', String(state.category === id));
      button.addEventListener('click', () => {
        state.category = id;
        persist();
        renderCategories();
        renderCards();
      });
      return button;
    }));
  }
  function makeCard(item) {
    const result = apply(item.id, $('input').value);
    const card = node('article', 'result-card' + (state.copied === item.id ? ' copied' : ''));
    card.dataset.cardId = item.id;
    const header = node('div', 'card-title');
    header.append(node('h3', '', item.title));
    const star = node('button', 'star', state.favorites.has(item.id) ? '★' : '☆');
    star.type = 'button';
    star.dataset.action = 'favorite';
    star.setAttribute('aria-label', `${item.title}をお気に入り${state.favorites.has(item.id) ? 'から解除' : 'に追加'}`);
    star.setAttribute('aria-pressed', String(state.favorites.has(item.id)));
    header.append(star);
    const preview = node('pre', 'preview' + (state.expanded.has(item.id) ? ' expanded' : ''), result || '（空）');
    preview.dataset.preview = item.id;
    const actions = node('div', 'result-actions');
    const long = length(result) > 100 || /(?:\r\n|\r|\n)/.test(result) && countLines(result) > 3;
    if (long) {
      const toggle = node('button', '', state.expanded.has(item.id) ? '折りたたむ' : '全文表示');
      toggle.type = 'button';
      toggle.dataset.action = 'expand';
      toggle.setAttribute('aria-expanded', String(state.expanded.has(item.id)));
      actions.append(toggle);
    }
    const compare = node('button', '', '比較');
    compare.type = 'button';
    compare.dataset.action = 'compare';
    compare.disabled = !$('input').value;
    const reflect = node('button', '', '入力に反映');
    reflect.type = 'button';
    reflect.dataset.action = 'apply';
    reflect.disabled = !$('input').value;
    const copy = node('button', 'primary', state.copied === item.id ? 'コピー済み ✓' : 'コピー');
    copy.type = 'button';
    copy.dataset.action = 'copy';
    copy.disabled = !$('input').value;
    actions.append(compare, reflect, copy);
    card.append(header, node('p', 'hint', item.hint), preview, actions);
    return card;
  }
  function renderCards() {
    const query = $('search').value.trim().normalize('NFKC').toLocaleLowerCase('ja');
    const matches = transforms.filter(item => (state.category === 'all' || item.category === state.category)
      && `${item.title} ${item.hint}`.normalize('NFKC').toLocaleLowerCase('ja').includes(query));
    const showFavorites = !query && state.category === 'all' && state.favorites.size > 0;
    $('favorites-section').hidden = !showFavorites;
    if (showFavorites) $('favorite-list').replaceChildren(...transforms.filter(item => state.favorites.has(item.id)).map(makeCard));
    else $('favorite-list').replaceChildren();
    const other = showFavorites ? matches.filter(item => !state.favorites.has(item.id)) : matches;
    $('result-list').replaceChildren(...other.map(makeCard));
    $('match-count').textContent = `${matches.length} / ${transforms.length}種類`;
    $('empty').hidden = matches.length !== 0;
  }
  const stepSelect = id => {
    const select = node('select');
    select.append(...transforms.map(optionFor));
    select.value = id;
    return select;
  };
  function renderSteps() {
    $('pipeline-steps').replaceChildren(...state.steps.map((id, index) => {
      const li = node('li');
      const controls = node('div', 'step-controls');
      const select = stepSelect(id);
      select.setAttribute('aria-label', `${index + 1}番目の変換`);
      select.addEventListener('change', () => { state.steps[index] = select.value; persist(); renderSteps(); });
      controls.append(select);
      for (const [action, label, disabled] of [
        ['up', '↑', index === 0], ['down', '↓', index === state.steps.length - 1], ['remove', '×', false]
      ]) {
        const button = node('button', '', label);
        button.type = 'button';
        button.disabled = disabled;
        button.setAttribute('aria-label', `${index + 1}番目の変換を${action === 'up' ? '上に移動' : action === 'down' ? '下に移動' : '削除'}`);
        button.addEventListener('click', () => {
          if (action === 'remove') state.steps.splice(index, 1);
          else {
            const other = index + (action === 'up' ? -1 : 1);
            [state.steps[index], state.steps[other]] = [state.steps[other], state.steps[index]];
          }
          persist(); renderSteps();
        });
        controls.append(button);
      }
      li.append(controls);
      return li;
    }));
    $('add-step').disabled = state.steps.length >= 10;
    renderPipeline();
  }
  function pipelineValue() { return runPipeline($('input').value, state.steps); }
  function renderPipeline() {
    const ready = state.steps.length > 0;
    const result = ready ? pipelineValue() : '';
    $('pipeline-count').textContent = ready ? countLabel(result) : '未設定';
    $('pipeline-output').textContent = ready ? (result || '（空）') : '変換を追加すると、ここに結果を表示します。';
    for (const id of ['pipeline-copy', 'pipeline-apply', 'pipeline-compare']) $(id).disabled = !ready || !$('input').value;
    $('pipeline-copy').textContent = state.copied === 'pipeline' ? 'コピー済み ✓' : 'コピー';
  }
  function sharedPrefixSuffix(before, after) {
    // 入力が長くても二重ループにしない。原文はDOMのtextContentだけで描画する。
    const a = [...before], b = [...after];
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let end = 0;
    while (end < a.length - start && end < b.length - start && a[a.length - end - 1] === b[b.length - end - 1]) end++;
    return { a, b, start, end };
  }
  function drawDiff(target, chars, start, end) {
    const prefix = chars.slice(0, start).join('');
    const middle = chars.slice(start, chars.length - end).join('');
    const suffix = end ? chars.slice(chars.length - end).join('') : '';
    const content = [document.createTextNode(prefix)];
    if (middle) content.push(node('mark', '', middle));
    content.push(document.createTextNode(suffix));
    target.replaceChildren(...content);
  }
  function renderCompare() {
    if (state.compared === null) return;
    const before = $('input').value;
    const after = state.compared === 'pipeline' ? pipelineValue() : apply(state.compared, before);
    const title = state.compared === 'pipeline' ? '連続変換' : byId.get(state.compared).title;
    const diff = sharedPrefixSuffix(before, after);
    $('compare-summary').textContent = `${title} · 変換前 ${countLabel(before)} → 変換後 ${countLabel(after)} · ${before === after ? '差分なし' : '変更あり'}`;
    // 大きな入力では比較用の強調表示を省略し、全文比較自体は維持する。
    if (diff.a.length + diff.b.length > 160000) {
      $('before-output').textContent = before;
      $('after-output').textContent = after;
      $('compare-summary').textContent += '（長文のため強調表示は省略）';
    } else {
      drawDiff($('before-output'), diff.a, diff.start, diff.end);
      drawDiff($('after-output'), diff.b, diff.start, diff.end);
    }
  }
  function update() {
    state.copied = null;
    $('input-count').textContent = countLabel($('input').value);
    resizeInput();
    renderCards();
    renderPipeline();
    renderCompare();
  }
  function compare(id) {
    state.compared = id;
    $('compare-section').hidden = false;
    renderCompare();
    $('compare-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function reflect(result) {
    $('input').value = result;
    state.compared = null;
    $('compare-section').hidden = true;
    update();
    $('input').focus({ preventScroll: true });
    showToast('変換結果を入力欄に反映しました');
  }
  async function copyText(value, label, id) {
    if (!$('input').value) return;
    let success = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard APIを利用できません');
      await navigator.clipboard.writeText(value);
      success = true;
    } catch (_) {
      // HTTPや一部のモバイルブラウザに対するフォールバック。
      const temporary = node('textarea');
      temporary.value = value;
      temporary.setAttribute('readonly', '');
      temporary.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.append(temporary);
      const active = document.activeElement;
      temporary.focus(); temporary.select();
      try { success = document.execCommand('copy'); } catch (_) { success = false; }
      temporary.remove();
      if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    }
    if (success) {
      state.copied = id;
      renderCards(); renderPipeline();
      showToast(`${label}をコピーしました`);
    } else showToast('コピーできませんでした。結果を長押しして選択してください。');
  }
  function cardAction(event) {
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('[data-card-id]');
    if (!button || !card) return;
    const id = card.dataset.cardId;
    if (!byId.has(id)) return;
    if (button.dataset.action === 'favorite') {
      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      persist(); renderCards();
      const replacement = [...document.querySelectorAll(`[data-card-id="${id}"] .star`)][0];
      replacement?.focus({ preventScroll: true });
    } else if (button.dataset.action === 'expand') {
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      persist(); renderCards();
      document.querySelector(`[data-card-id="${id}"] [data-action="expand"]`)?.focus({ preventScroll: true });
    } else if (button.dataset.action === 'compare') compare(id);
    else if (button.dataset.action === 'apply') reflect(apply(id, $('input').value));
    else if (button.dataset.action === 'copy') copyText(apply(id, $('input').value), byId.get(id).title, id);
  }
  for (const id of ['favorite-list', 'result-list']) $(id).addEventListener('click', cardAction);
  $('input').addEventListener('input', update);
  $('search').addEventListener('input', renderCards);
  $('clear').addEventListener('click', () => { $('input').value = ''; update(); $('input').focus(); });
  $('select-all').addEventListener('click', () => { $('input').focus(); $('input').select(); });
  $('copy-input').addEventListener('click', () => copyText($('input').value, '入力テキスト', 'input'));
  $('paste').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('貼り付けAPIがありません');
      const value = await navigator.clipboard.readText();
      const input = $('input');
      input.setRangeText(value, input.selectionStart, input.selectionEnd, 'end');
      update();
      showToast('貼り付けました');
    } catch (_) { $('input').focus(); showToast('貼り付けを許可するか、入力欄を長押しして貼り付けてください。'); }
  });
  $('add-step').addEventListener('click', () => {
    if (state.steps.length >= 10) return;
    state.steps.push($('pipeline-picker').value);
    persist(); renderSteps();
  });
  $('pipeline-copy').addEventListener('click', () => copyText(pipelineValue(), '連続変換の結果', 'pipeline'));
  $('pipeline-apply').addEventListener('click', () => reflect(pipelineValue()));
  $('pipeline-compare').addEventListener('click', () => compare('pipeline'));
  $('close-compare').addEventListener('click', () => {
    state.compared = null;
    $('compare-section').hidden = true;
  });
  $('theme').value = state.theme;
  $('theme').addEventListener('change', () => {
    state.theme = $('theme').value;
    if (state.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
    persist();
  });
  $('pipeline-picker').append(...transforms.map(optionFor));
  renderCategories();
  renderSteps();
  update();
})();