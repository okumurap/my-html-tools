(() => {
  'use strict';

  // ツールを追加するときはこの一覧だけ更新する。リンクはGitHub Pages用の相対パス。
  // 日付は日本時間の公開日・更新日。未確認の日付は省略する。
  const tools = [
    ['offset-capability-lab', 'work', 'Offset Capability Lab', '工程能力指数（Cp・Cpk）とヒストグラムを比較します。', 'PC・スマートフォン対応', '開く'],
    ['drawing-annotation', 'work', '図面注釈ツール', '画像や図面に注釈を書き込み、PNGで出力します。', 'PC・スマートフォン・ペン対応', '開く'],
    ['screw-diameter-comparator', 'work', 'スクリュ径A/B比較ツール', '射出成形機のスクリュ径による流量・充填体積・必要ストロークの違いを比較します。', 'PC・スマートフォン対応', '開く'],
    ['train-crossing', 'trains', 'でんしゃを走らせよう！', 'タップで電車を走らせ、踏切とトンネルを越えて次の駅を目指すミニゲームです。', 'PC・スマートフォン対応', '開く'],
    ['sakamoto-railway', 'trains', '坂本電鉄 海岸線', 'マスコン、ブレーキ、ドア、車内放送を操作して終点を目指す電車運転ゲームです。', 'PWA・スマートフォン対応', '運転する'],
    ['plarail-layout', 'trains', 'レールタウン・レイアウト', '線路、駅、踏切、ポイントを自由に配置して、電車を走らせるレイアウトゲームです。', 'PC・スマートフォン対応・端末内保存', '遊ぶ'],
    ['sakamoto-kiss-fishing', 'fishing', '坂本のキス釣り', '投げて、海底をさびいて、アタリに合わせる3分間のキス釣りゲームです。', 'PC・スマートフォン対応・端末内記録', '釣る', '2026-07-29', '2026-09-19'],
    ['table-editor', 'utility', '表整形・編集ツール', 'Markdown・CSV・TSVの表を読み込み、並べ替えや編集、コピーができます。', 'PC・スマートフォン対応・端末内処理', '編集する'],
    ['chord-piano', 'music', 'コード鍵盤', '鍵盤を見て・聴いて・押しながら、ピアノコードの構成音を練習します。', 'PC・スマートフォン対応・Web Audio', '練習する'],
    ['investment-simulator', 'finance', '積立投資シミュレーター', '初期投資と毎月の積立から、将来資産・元本・運用益をグラフで試算します。', 'PC・スマートフォン対応・端末内計算', '試算する', '', '2026-09-19'],
    ['drawing-pdf-dimension-manager', 'work', '図面PDF 寸法ID管理', 'PDF図面へ寸法IDを配置し、公差・測定方法・重要度を管理します。', 'PC・スマートフォン対応・端末内処理', '管理する', '2026-09-17', '2026-09-18'],
    ['clamp-force-calculator', 'work', '型締力 Calculator', '形状・寸法から投影面積を算出し、射出成形金型の必要型締力を概算します。', 'PC・スマートフォン対応・端末内保存', '計算する', '2026-09-17', '2026-09-18'],
    ['life-dashboard', 'utility', '人生ダッシュボード', '生年月日だけで人生を週単位で眺め、家族・イベント・毎週の充実度を記録します。', 'PC・スマートフォン対応・端末内保存', '開く', '', '2026-09-19'],
    ['gyro-rush', 'games', 'GYRO RUSH ジャイロ宇宙船', 'スマホを左右に傾けて隕石を回避。ニアミス・コンボ・ブーストで120秒のハイスコアを目指すゲームです。', 'スマートフォン・PC対応・端末内記録', '遊ぶ', '2026-09-19', '2026-09-19'],
    ['gyro-crane', 'games', 'ぐらぐらクレーン！', '左右ボタンでクレーンを動かし、荷物の揺れを止めて着地。90秒・精密着地・積み上げ・強風の4モードで遊べます。', 'スマートフォン・PC対応・ボタン操作・端末内記録', '遊ぶ', '2026-09-19', '2026-09-19'],
    ['text-formatter', 'utility', '文字列整形アプリ v7', '13種類の文字列変換。検索、お気に入り、連続変換、変換前後の比較とコピーに対応します。', 'PC・スマートフォン対応・端末内処理', '整形する', '2026-09-19', '2026-09-19'],
    ['thermal-fit-map', 'work', '金型の熱膨張 × 公差マップ', '穴と凸部の温度差・上下公差から最悪すきまを判定。2Dマップ・加工寸法と加熱温度の逆算に対応します。', 'PC・スマートフォン対応・端末内保存', '計算する', '2026-09-20', '2026-09-20'],
    ['family-tasks', 'utility', 'タスク管理', '家族共有タスクを3つのカテゴリに整理。長押しドラッグで分類・並び替え、スワイプで完了できます。', 'PC・スマートフォン対応・デモは端末内保存', '開く', '2026-09-21', '2026-09-22'],
    ['gear-mesh-lab', 'work', '歯車かみ合いラボ', 'モジュール・圧力角・転位と中心距離を操作し、インボリュート歯形・基準円・作用線・かみ合いを可視化します。', 'PC・スマートフォン対応・端末内保存', '観察する', '2026-09-21', '2026-09-21'],
    ['motion-ruler', 'utility', 'モーション寸法計', 'スマホを物に沿わせて一方向へ滑らせ、常時表示スケールで移動距離を概算します。', 'スマートフォン対応・1方向測定・端末内処理', '測る', '2026-09-24', '2026-09-24'],
    ['flag-learner', 'music', '国旗覚える君', '国旗の4択クイズと世界地図で、195か国の国旗と場所を一緒に覚えます。', 'PC・スマートフォン対応・端末内記録', '覚える', '2026-09-26', '2026-09-26']
  ].map(([id, category, title, description, meta, action, created, updated]) =>
    ({ id, category, title, description, meta, action, created, updated, href: `./tools/${id}/` }));
  const categories = [
    ['all', 'すべて'], ['work', '仕事・設計'], ['utility', '編集・便利'],
    ['finance', 'お金・資産形成'], ['music', '音楽・学習'],
    ['trains', '電車・子ども向け'], ['fishing', '釣り'], ['games', 'ゲーム']
  ];
  const byId = new Map(tools.map(tool => [tool.id, tool]));
  const KEYS = {
    favorites: 'my-html-tools:favorites',
    recent: 'my-html-tools:recent',
    compact: 'my-html-tools:compact',
    theme: 'my-html-tools:theme'
  };
  const getSaved = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* 保存できなくても使用可能 */ } };
  const restoreIds = key => {
    try {
      const value = JSON.parse(getSaved(key));
      return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && byId.has(id)))] : [];
    } catch (_) { return []; }
  };
  let favorites = restoreIds(KEYS.favorites);
  let recent = restoreIds(KEYS.recent).slice(0, 5);
  let compact = getSaved(KEYS.compact) === 'true';
  let activeCategory = 'all';

  const search = document.getElementById('tool-search');
  const filters = document.getElementById('category-filters');
  const mobileCategory = document.getElementById('mobile-category');
  const list = document.getElementById('tool-list');
  const count = document.getElementById('result-count');
  const empty = document.getElementById('catalog-empty');
  const favoritesSection = document.getElementById('favorites-section');
  const favoritesList = document.getElementById('favorites-list');
  const recentSection = document.getElementById('recent-section');
  const recentList = document.getElementById('recent-list');
  const compactButton = document.getElementById('compact-toggle');
  const themeSelect = document.getElementById('theme-select');

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) className && (node.className = className);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja');
  const categoryName = category => categories.find(([id]) => id === category)?.[1] || '';
  const isFresh = date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
    const age = Date.now() - new Date(`${date}T00:00:00+09:00`).getTime();
    return Number.isFinite(age) && age >= 0 && age < 14 * 86400000;
  };
  const statusFor = tool => isFresh(tool.created) ? 'NEW' : (isFresh(tool.updated) ? '更新' : '');

  function makeLink(tool, quick = false, number = 0) {
    const link = element('a', quick ? 'quick-link tool-link' : 'tool-card tool-link');
    link.href = tool.href;
    link.dataset.toolId = tool.id;
    if (!quick) link.append(element('span', 'tool-number', String(number).padStart(3, '0')));
    const content = element('span', quick ? 'quick-content' : 'tool-card__content');
    const title = element('span', quick ? 'quick-title' : 'tool-card__title', tool.title);
    content.append(title);
    const status = statusFor(tool);
    if (status) content.append(element('span', `update-badge ${status === 'NEW' ? 'update-badge--new' : ''}`, status));
    if (!quick) {
      content.append(element('span', 'tool-card__description', tool.description));
      content.append(element('span', 'tool-card__category', categoryName(tool.category)));
      content.append(element('span', 'tool-card__meta', tool.meta));
    }
    link.append(content);
    link.append(element('span', quick ? 'quick-arrow' : 'tool-card__arrow', `${tool.action} →`));
    return link;
  }
  function makeFavoriteButton(tool) {
    const selected = favorites.includes(tool.id);
    const button = element('button', 'favorite-button', selected ? '★' : '☆');
    button.type = 'button';
    button.dataset.favoriteId = tool.id;
    button.setAttribute('aria-label', `${tool.title}をお気に入り${selected ? 'から解除' : 'に登録'}`);
    button.setAttribute('aria-pressed', String(selected));
    button.title = selected ? 'お気に入りを解除' : 'お気に入りに登録';
    return button;
  }
  function makeCard(tool, index) {
    const item = element('li', 'catalog-item');
    item.append(makeLink(tool, false, index + 1), makeFavoriteButton(tool));
    return item;
  }
  function renderQuick(listNode, ids) {
    const fragment = document.createDocumentFragment();
    ids.forEach(id => {
      const tool = byId.get(id);
      if (!tool) return;
      const item = element('li', 'quick-item');
      item.append(makeLink(tool, true), makeFavoriteButton(tool));
      fragment.append(item);
    });
    listNode.replaceChildren(fragment);
  }
  function render() {
    const query = normalize(search.value.trim());
    const matched = tools.filter(tool =>
      (activeCategory === 'all' || tool.category === activeCategory) &&
      normalize(`${tool.title} ${tool.description} ${tool.meta} ${categoryName(tool.category)}`).includes(query));
    list.replaceChildren(...matched.map(tool => makeCard(tool, tools.indexOf(tool))));
    count.textContent = `${matched.length}件表示 / 全${tools.length}件`;
    empty.hidden = matched.length !== 0;
    const showQuick = !query && activeCategory === 'all';
    favoritesSection.hidden = !showQuick || favorites.length === 0;
    recentSection.hidden = !showQuick || recent.length === 0;
    renderQuick(favoritesList, favorites);
    renderQuick(recentList, recent);
    document.body.classList.toggle('compact-mode', compact);
    compactButton.textContent = compact ? '詳細表示' : 'コンパクト表示';
    compactButton.setAttribute('aria-pressed', String(compact));
  }
  function selectCategory(value) {
    activeCategory = categories.some(([id]) => id === value) ? value : 'all';
    mobileCategory.value = activeCategory;
    filters.querySelectorAll('button').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.filter === activeCategory)));
    render();
  }
  categories.forEach(([id, label]) => {
    const total = id === 'all' ? tools.length : tools.filter(tool => tool.category === id).length;
    const button = element('button', 'category-filter', `${label} ${total}`);
    button.type = 'button';
    button.dataset.filter = id;
    button.setAttribute('aria-controls', 'tool-list');
    button.setAttribute('aria-pressed', String(id === 'all'));
    button.addEventListener('click', () => selectCategory(id));
    filters.append(button);
    const option = element('option', '', `${label}（${total}）`);
    option.value = id;
    mobileCategory.append(option);
  });
  mobileCategory.addEventListener('change', () => selectCategory(mobileCategory.value));
  search.addEventListener('input', render);
  compactButton.addEventListener('click', () => {
    compact = !compact;
    save(KEYS.compact, String(compact));
    render();
  });
  document.addEventListener('click', event => {
    const star = event.target.closest('button[data-favorite-id]');
    if (star) {
      const id = star.dataset.favoriteId;
      favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
      save(KEYS.favorites, JSON.stringify(favorites));
      render();
      const replacement = [...document.querySelectorAll('button[data-favorite-id]')]
        .find(button => button.dataset.favoriteId === id && button.closest(star.closest('#tool-list') ? '#tool-list' : '#favorites-list'));
      if (replacement) replacement.focus({ preventScroll: true });
      return;
    }
    const link = event.target.closest('a[data-tool-id]');
    if (link && byId.has(link.dataset.toolId)) {
      recent = [link.dataset.toolId, ...recent.filter(id => id !== link.dataset.toolId)].slice(0, 5);
      save(KEYS.recent, JSON.stringify(recent));
      renderQuick(recentList, recent);
      recentSection.hidden = !!search.value.trim() || activeCategory !== 'all';
    }
  });
  const savedTheme = getSaved(KEYS.theme);
  themeSelect.value = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'auto';
  themeSelect.addEventListener('change', () => {
    if (themeSelect.value === 'auto') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = themeSelect.value;
    }
    save(KEYS.theme, themeSelect.value);
  });
  render();
})();
