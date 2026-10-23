(() => {
  'use strict';

  // ツールを追加するときはこの一覧だけ更新する。リンクはGitHub Pages用の相対パス。
  // 日付は日本時間の公開日・更新日。未確認の日付は省略する。
  const tools = [
    ['quick-memo', 'utility', 'さっとメモ', '上部の紙をタップしてすぐ手書き。横スクロールのメモ一覧・再タップで画像保存・削除・2本指拡大・自動保存に対応。', 'スマートフォン・PC・ペン対応・端末内保存', '書く', '2026-10-22', '2026-10-22'],
    ['offset-capability-lab', 'work', 'Offset Capability Lab', 'Cp・Cpkと規格範囲・平均±3σを図で比較。平均のずれとばらつきの影響を確認できます。', 'PC・スマートフォン対応', '開く', '', '2026-10-23'],
    ['drawing-annotation', 'work', '図面注釈ツール', '図面と注釈を自動保存して次回も編集。ダークモード固定、PCの操作配置を整理。PNGで出力できます。', 'PC・スマートフォン・ペン対応・端末内保存', '開く', '', '2026-10-23'],
    ['screw-diameter-comparator', 'work', 'スクリュ径A/B比較ツール', '計量完→V-P切替→クッションをA/B共通の位置図で比較。径・体積から速度・回転数・移動量を換算。', 'PC・スマートフォン対応', '開く', '', '2026-10-23'],
    ['train-crossing', 'trains', 'でんしゃを走らせよう！', '3種類の電車で星集めの旅へ。車体・駅・沿線の描写を磨いた、タップで遊べる電車ゲームです。', 'PC・スマートフォン対応', '遊ぶ', '', '2026-10-21'],
    ['sakamoto-railway', 'trains', 'S電鉄 海岸線', '海岸の風景を見ながら電車を運転。スマホでも大きめの速度推移と操作盤を1画面に表示。', 'PWA・スマートフォン対応', '運転する', '', '2026-10-21'],
    ['plarail-layout', 'trains', 'レールタウン・レイアウト', '線路をつなぎ、3両編成を運転。滑らかなカーブ・駅停車・ポイント・踏切を楽しむレイアウトゲームです。', 'PC・スマートフォン対応・端末内保存', '遊ぶ', '', '2026-10-21'],
    ['sakamoto-kiss-fishing', 'fishing', 'Sのキス釣り', '海底・巻く速さ・誘いの間を読み、ジャストアワセで大ギスを狙う釣りゲームです。', 'PC・スマートフォン対応・端末内記録', '釣る', '2026-07-29', '2026-10-21'],
    ['table-editor', 'utility', '表整形・編集ツール', 'Excelから直接読み込み、番地を見ながらセル編集。TSVコピー・Undo・任意の端末保存に対応。', 'PC・スマートフォン対応・任意の端末内保存', '編集する', '', '2026-10-23'],
    ['chord-piano', 'music', 'コード鍵盤', '押さえる位置と左右の指番号を見ながらコード練習。苦手コードを保存し、3回正解まで反復できます。', 'PC・スマートフォン対応・Web Audio', '練習する', '', '2026-10-23'],
    ['investment-simulator', 'finance', '積立投資シミュレーター', '一括・分割・現金比較、暴落、目標逆算、インフレ調整、老後の取り崩しを試算します。', 'PC・スマートフォン対応・端末内計算', '試算する', '', '2026-09-19'],
    ['drawing-pdf-dimension-manager', 'work', '図面PDF 寸法ID管理', '寸法IDから図面・編集へ移動。公差・確認方法の未設定を抽出し、PDF図面の寸法情報を管理。', 'PC・スマートフォン対応・端末内処理', '管理する', '2026-09-17', '2026-10-23'],
    ['clamp-force-calculator', 'work', '型締力 Calculator', '寸法連動の投影図と面積内訳・計算過程を確認し、射出成形金型の必要型締力を概算します。', 'PC・スマートフォン対応・端末内保存', '計算する', '2026-09-17', '2026-10-23'],
    ['life-dashboard', 'utility', '人生ダッシュボード', '今週・今年の位置と直近の予定を確認。週の振り返り・次週の目標・充実度を端末に記録します。', 'PC・スマートフォン対応・端末内保存', '開く', '', '2026-10-23'],
    ['gyro-rush', 'games', 'GYRO RUSH ジャイロ宇宙船', '金属の宇宙船で隕石を回避。ジャイロ・タッチで移動し、画面下部のどこでもタッチでブースト。', 'スマートフォン・PC対応・端末内記録', '遊ぶ', '2026-09-19', '2026-10-21'],
    ['gyro-crane', 'games', 'ぐらぐらクレーン！', '夕暮れの港で吊り荷を運搬。予測軌道を読み、位置・速度・傾きをそろえて着地。4種の荷物と4モードで挑戦。', 'スマートフォン・PC対応・ボタン操作・端末内記録', '遊ぶ', '2026-09-19', '2026-10-21'],
    ['text-formatter', 'utility', '文字列整形アプリ v7', '13種類の文字列変換。検索、お気に入り、連続変換、変換前後の比較とコピーに対応します。', 'PC・スマートフォン対応・端末内処理', '整形する', '2026-09-19', '2026-09-19'],
    ['thermal-fit-map', 'work', '金型の熱膨張 × 公差マップ', '金型温度固定・インサート温度10点のすきまマップ。条件A/B比較、寸法・加熱温度の逆算に対応します。', 'PC・スマートフォン対応・端末内保存', '計算する', '2026-09-20', '2026-10-03'],
    ['family-tasks', 'utility', 'タスク管理', '家族共有タスクを3つのカテゴリに整理。長押しドラッグで分類・並び替え、スワイプで完了できます。', 'PC・スマートフォン対応・デモは端末内保存', '開く', '2026-09-21', '2026-09-22'],
    ['gear-mesh-lab', 'work', '歯車かみ合いラボ', 'モジュール・圧力角・転位と中心距離を操作し、インボリュート歯形・基準円・作用線・かみ合いを可視化します。', 'PC・スマートフォン対応・端末内保存', '観察する', '2026-09-21', '2026-09-21'],
    ['flag-learner', 'music', '国旗覚える君', '5問からの国旗クイズ、苦手の復習、検索できる国旗図鑑と世界地図で195か国を覚えます。', 'PC・スマートフォン対応・SVG国旗・端末内記録', '覚える', '2026-09-26', '2026-10-20'],
    ['csv-inspector', 'utility', 'CSV Inspector', 'CSVの異常から元データの該当セルへ移動。確認ポイント・列ルール・複合キー・Shift_JISに対応。', 'PC・スマートフォン対応・端末内処理', '検査する', '2026-10-01', '2026-10-23'],
    ['rough-craftsman', 'games', 'だいたい職人', '目分量の10cm・体内時計の5秒・勘の45°で職人ランクに挑む感覚ゲーム。', 'PC・スマートフォン対応・端末内記録・プロトタイプ', '腕だめし', '2026-10-20', '2026-10-20']
  ].map(([id, category, title, description, meta, action, created, updated]) =>
    ({ id, category, title, description, meta, action, created, updated, href: `./tools/${id}/` }));
  const changeNotes = {
    'life-dashboard': '2026-10-23：今週の期間・今年の進み具合・直近の予定、年週別の振り返りと次週メモ、自動保存・破損保護を追加。',
    'chord-piano': '2026-10-23：基本形の鍵盤・指番号、音域移動、苦手の端末保存・反復出題・3回正解での卒業を追加。',
    'drawing-pdf-dimension-manager': '2026-10-23：各IDの図面・編集ボタン、絞込内の前後移動、公差・確認方法の未設定抽出、スマホの図面／一覧切替を追加。',
    'clamp-force-calculator': '2026-10-23：6形状の寸法連動投影図、製品・ランナーの面積内訳、数値入り計算過程と印刷式を追加。',
    'offset-capability-lab': '2026-10-23：規格範囲と平均±3σの図、Cp/Cpkの根拠、ヒストグラムの平均線を追加。同じ乱数標本で条件を比較できるよう改善。',
    'screw-diameter-comparator': '2026-10-23：計量完・95％充填V-P切替・クッション10 mmを共通目盛りの位置図でA/B比較。',
    'drawing-annotation': '2026-10-23：元画像と編集可能な注釈・設定を端末内に自動保存して復元。保存失敗・別タブ競合への保護も追加。操作画面をダークモード固定にし、PCのツールバーを2段に整理。',
    'quick-memo': '2026-10-22：上部に横スクロールのメモ一覧を常設。タップで編集、編集中の紙を再タップで画像保存・共有・削除。上部の保存アイコンを削除。見出しと下部説明を省いて筆記領域を拡大。',
    'plarail-layout': '2026-10-21：3両が曲線・分岐の走行経路を追従。駅の減速・ドア開閉、編成全体の踏切、折り返し、拡大と表示移動を追加。',
    'gyro-crane': '2026-10-21：港・クレーン・吊り荷を精細化。風を含む着地予測、荷物別の速度・傾き判定、実位置に積むタワー、小画面での8段積みに対応。',
    'gyro-rush': '2026-10-21：ジャイロの中央デッドゾーンを除去し、微小な傾きにも連続して反応。リアルな機体描画と下部全体のブースト操作に対応。',
    'sakamoto-kiss-fishing': '2026-10-21：海中・魚・釣果の描写を改善。巻く速さと誘いの間、藻場の根掛かり、ジャストアワセ・取り込み加点を追加。',
    'train-crossing': '2026-10-21：車両・沿線・駅・踏切・トンネルの描写を強化。イラストで車両選択、ルート進行とスピード表示、スマホ配置を改善。',
    'sakamoto-railway': '2026-10-21：雨粒・窓の水滴・間欠ワイパー・雨天の霞みと路面を改善。大きな速度グラフも常時表示。',
    'flag-learner': '2026-10-20：国旗を同梱SVGに変更。地図は選択中の国旗だけを表示し、点と線で位置を確認。',
    'table-editor': '2026-10-23：クリップボード読込、セル番地・列名、改行可能な選択セル編集欄、Excel向けTSVコピーとスマホの操作配置を改善。',
    'csv-inspector': '2026-10-23：異常から該当セル・周辺行へ移動、確認ポイント、前後の異常と一覧への移動を追加。',
    'thermal-fit-map': '2026-10-03：条件A/B比較、保存条件のJSON入出力を追加。',
    'investment-simulator': '2026-10-03：比較・暴落・逆算・インフレ・取り崩しの既存機能に合わせて説明を更新。'
  };
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
    if(changeNotes[tool.id]){const details=element('details','tool-changes');details.append(element('summary','','今回の変更'),element('p','',changeNotes[tool.id]));item.append(details);}
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







