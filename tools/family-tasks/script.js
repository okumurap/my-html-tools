(() => {
  'use strict';

  // 公開サイトに実ユーザーのデータ・Firebase 設定をハードコードしない。
  const STORE = 'family-tasks:demo:v1';
  const MODE_KEY = 'family-tasks:mode:v1';
  const CONFIG_KEY = 'my-html-tools:firebase-config:v1';
  const CATEGORIES = ['家事', '買い物', '子育て', '住宅', '仕事', 'その他'];
  const $ = id => document.getElementById(id);
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const plusDays = days => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const uuid = () => (globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const getSaved = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const setSaved = (key, value) => { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } };
  const validDate = value => {
    if (value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return year >= 1900 && year <= 9999 && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
  };
  const VALID_SCOPE = new Set(['shared', 'private']);
  let demoCorrupted = false;
  const validConfig = config => config && typeof config === 'object' &&
    ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => typeof config[key] === 'string' && config[key].trim().length > 0) &&
    !('private_key' in config) && !('client_email' in config);

  // インポート・ストレージ破損・手動入力はすべて同一の検証関数を通す。
  function normalizeTask(raw, allowDemo = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('タスクの形式が正しくありません。');
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';
    const dueDate = raw.dueDate ?? '';
    if (!title || title.length > 120) throw new Error('タスク名は1～120文字で入力してください。');
    if (notes.length > 1000) throw new Error('メモは1000文字以内で入力してください。');
    if (!validDate(dueDate)) throw new Error('期限の日付が正しくありません。');
    if (!VALID_SCOPE.has(raw.scope)) throw new Error('公開範囲が正しくありません。');
    if (typeof raw.assigneeUid !== 'string' || raw.assigneeUid.length > 128) throw new Error('担当者が正しくありません。');
    if (typeof raw.done !== 'boolean') throw new Error('完了状態が正しくありません。');
    if (!CATEGORIES.includes(raw.category)) throw new Error('カテゴリが正しくありません。');
    if (!allowDemo && (!raw.ownerUid || typeof raw.ownerUid !== 'string')) throw new Error('所有者が正しくありません。');
    const createdAt = Number.isSafeInteger(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : Date.now();
    const updatedAt = Number.isSafeInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : Date.now();
    return { title, notes, dueDate, scope: raw.scope, assigneeUid: raw.assigneeUid,
      category: raw.category, done: raw.done, ownerUid: String(raw.ownerUid || 'demo-me'), createdAt, updatedAt };
  }

  const exampleTasks = () => [
    { title: 'ゴミ出しの準備', notes: 'これはサンプルです。自由に編集・削除できます。', dueDate: today(), category: '家事', scope: 'shared', assigneeUid: 'demo-me', done: false },
    { title: '牛乳を買う', notes: '', dueDate: plusDays(1), category: '買い物', scope: 'shared', assigneeUid: '', done: false },
    { title: '書類を確認する', notes: 'このタスクは自分だけに表示される想定です。', dueDate: '', category: '住宅', scope: 'private', assigneeUid: 'demo-me', done: false },
  ].map(task => ({ id: uuid(), ...normalizeTask({ ...task, ownerUid: 'demo-me', createdAt: Date.now(), updatedAt: Date.now() }, true) }));

  function loadDemo() {
    const value = getSaved(STORE);
    if (value === null) {
      const sample = exampleTasks();
      if (!setSaved(STORE, JSON.stringify({ version: 1, tasks: sample }))) {
        showMessage('このブラウザでは端末内保存を利用できません。画面を閉じると変更が消えます。');
      }
      return sample;
    }
    try {
      const parsed = JSON.parse(value);
      if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || parsed.tasks.length > 1000) throw new Error();
      return parsed.tasks.map(item => ({ id: typeof item.id === 'string' && item.id.length <= 128 ? item.id : uuid(), ...normalizeTask(item, true) }));
    } catch (_) {
      demoCorrupted = true;
      showMessage('保存済みデータを読み込めません。元データを保護するため、書き込みを停止しています。正しいJSONを読み込むか、ブラウザのデータを別途確認してください。');
      return [];
    }
  }

  const state = {
    mode: getSaved(MODE_KEY) === 'firebase' ? 'firebase' : 'demo',
    demo: [], privateTasks: [], sharedTasks: [], user: null, family: null,
    sdk: null, connection: null, unsubscribers: [], familyUnsub: null, sharedUnsub: null,
    metadata: { private: null, shared: null }, editing: null, creatingFamily: false,
  };
  state.demo = loadDemo();
  if (state.mode === 'firebase' && !getSaved(CONFIG_KEY)) state.mode = 'demo';

  function showMessage(message) { $('message').classList.remove('notice'); $('message').textContent = message; $('message').hidden = !message; }
  function notify(message) { showMessage(message); $('message').classList.add('notice'); }
  function modeIsReady() { return state.mode === 'demo' ? !demoCorrupted : !!state.user; }
  function userId() { return state.mode === 'demo' ? 'demo-me' : state.user?.uid || ''; }
  function partnerId() {
    if (state.mode === 'demo') return 'demo-partner';
    return state.family?.memberUids.find(uid => uid !== userId()) || '';
  }
  function taskCollection(scope) {
    const { sdk, connection, family, user } = state;
    if (scope === 'private') return sdk.collection(connection.db, 'users', user.uid, 'tasks');
    if (!family) throw new Error('共有タスクには家族スペースの作成が必要です。');
    return sdk.collection(connection.db, 'families', family.id, 'tasks');
  }
  function docFor(task) {
    const collectionRef = taskCollection(task.scope);
    return state.sdk.doc(collectionRef, task.id);
  }
  function allTasks() {
    return state.mode === 'demo' ? state.demo : [...state.privateTasks, ...state.sharedTasks];
  }
  function saveDemo() {
    if (demoCorrupted) {
      showMessage('破損した保存データの上書きを防ぐため、保存していません。正しいJSONを読み込んで復旧してください。');
      return false;
    }
    if (!setSaved(STORE, JSON.stringify({ version: 1, tasks: state.demo }))) {
      showMessage('端末内保存に失敗しました。この画面を閉じると変更が失われます。');
      return false;
    }
    return true;
  }
  function writeDoc(operation, task, update = null) {
    const ref = docFor(task);
    let promise;
    if (operation === 'add') promise = state.sdk.setDoc(ref, taskToCloud(task));
    if (operation === 'update') promise = state.sdk.updateDoc(ref, update);
    if (operation === 'delete') promise = state.sdk.deleteDoc(ref);
    promise.catch(error => showMessage(`同期に失敗しました。データは確定していない可能性があります：${firebaseError(error)}`));
    setSyncStatus();
  }
  function taskToCloud(task) {
    const { id: _id, ...data } = task;
    return data;
  }
  function firebaseError(error) {
    const code = error?.code || '';
    if (code === 'permission-denied') return 'アクセス権がありません。Firestoreルールと家族登録を確認してください。';
    if (code === 'auth/popup-blocked') return 'ポップアップがブロックされました。Safariの設定を確認してください。';
    if (code === 'auth/popup-closed-by-user') return 'ログイン画面が閉じられました。';
    if (code === 'auth/unauthorized-domain') return 'Firebase認証の承認済みドメインにこのサイトを追加してください。';
    return code ? `エラーコード：${code}` : (error?.message || '通信または保存のエラー');
  }
  function setSyncStatus(extra = '') {
    const node = $('syncStatus');
    node.classList.remove('pending', 'error');
    if (state.mode === 'demo') {
      node.textContent = 'デモ · この端末にのみ保存（他端末には同期しません）';
      $('modeBadge').textContent = 'デモ';
      return;
    }
    $('modeBadge').textContent = 'Firebase';
    if (!state.user) { node.textContent = extra || 'Firebase接続 · ログイン待ち'; return; }
    const meta = Object.values(state.metadata).filter(Boolean);
    const pending = meta.some(item => item.hasPendingWrites);
    const cache = meta.some(item => item.fromCache);
    if (!navigator.onLine || pending || cache) {
      node.classList.add('pending');
      node.textContent = !navigator.onLine ? 'オフライン · 変更は端末に保持し、接続後に同期します' : pending ? '変更を同期中 · ほかの端末への反映は未完了' : 'キャッシュを表示中 · サーバーを確認しています';
    } else node.textContent = extra || 'Firebaseと同期中 · 端末間で共有されます';
  }
  function displayStatus() {
    if (state.mode === 'demo') return 'デモ';
    if (!state.user) return 'ログイン待ち';
    return state.family ? '共有中' : '個人のみ';
  }
  function adjustForm() {
    const ready = modeIsReady();
    const shareAvailable = state.mode === 'demo' || !!state.family;
    $('taskTitle').disabled = !ready;
    $('taskDate').disabled = !ready;
    $('taskCategory').disabled = !ready;
    $('taskNotes').disabled = !ready;
    $('taskScope').disabled = !ready;
    $('taskScope').querySelector('[value="shared"]').disabled = !shareAvailable;
    if (!shareAvailable) $('taskScope').value = 'private';
    if (!ready) $('taskScope').value = 'private';
    const personal = $('taskScope').value === 'private';
    $('taskAssignee').disabled = !ready || personal;
    $('taskAssignee').querySelector('[value="partner"]').disabled = state.mode !== 'demo' && !partnerId();
    if (personal) $('taskAssignee').value = 'self';
    else if (!partnerId() && $('taskAssignee').value === 'partner') $('taskAssignee').value = '';
    $('addBtn').disabled = !ready;
    $('formHint').textContent = !ready ? (demoCorrupted && state.mode === 'demo' ? '破損したデータの復旧が必要です' : 'Firebaseにログインしてください') : !shareAvailable ? '家族を作成すると共有タスクを追加できます' : '公開範囲は作成後に変更できません';
  }
  function updateSettings() {
    if (document.activeElement !== $('configInput')) $('configInput').value = getSaved(CONFIG_KEY) || '';
    $('accountText').textContent = state.user ? `${state.user.displayName || 'ログイン中'} · ${state.user.email || ''}` : (state.sdk ? 'ログインしていません' : 'Firebase未接続');
    $('myUid').value = userId() === 'demo-me' ? '' : userId();
    $('loginBtn').hidden = state.mode !== 'firebase' || !state.sdk || !!state.user;
    $('logoutBtn').hidden = !state.user;
    $('demoBtn').hidden = state.mode === 'demo';
    $('familySection').hidden = !state.user;
    $('createFamily').hidden = !!state.family;
    $('createFamily').disabled = state.creatingFamily;
    $('inviteArea').hidden = !state.family || state.family.ownerUid !== userId() || state.family.memberUids.length >= 2;
    $('familyDescription').textContent = !state.family ? 'まだ家族スペースがありません。どちらか1人が作成してください。' :
      `家族スペース：${state.family.memberUids.length}/2人 · ${state.family.ownerUid === userId() ? 'あなたが管理者' : '相手が管理者'}`;
    $('importInput').disabled = state.mode !== 'demo';
    $('exportBtn').disabled = demoCorrupted && state.mode === 'demo';
    $('importInput').previousElementSibling?.classList.toggle('disabled', state.mode !== 'demo');
    adjustForm();
  }
  function assigneeName(uid) { return uid === '' ? '担当なし・共同' : uid === userId() ? '担当：自分' : '担当：相手'; }
  function render() {
    const tasks = allTasks();
    const currentDate = today();
    $('todayCount').textContent = tasks.filter(task => !task.done && task.dueDate && task.dueDate <= currentDate).length;
    $('upcomingCount').textContent = tasks.filter(task => !task.done && (!task.dueDate || task.dueDate > currentDate)).length;
    $('doneCount').textContent = tasks.filter(task => task.done).length;
    const search = $('searchInput').value.trim().normalize('NFKC').toLowerCase();
    const scope = $('scopeFilter').value;
    const status = $('statusFilter').value;
    const dateFilter = $('dateFilter').value;
    const visible = tasks.filter(task => {
      if (scope !== 'all' && task.scope !== scope) return false;
      if (status === 'open' && task.done || status === 'done' && !task.done) return false;
      if (search && !`${task.title} ${task.notes} ${task.category}`.normalize('NFKC').toLowerCase().includes(search)) return false;
      if (dateFilter === 'today' && (!task.dueDate || task.dueDate > currentDate)) return false;
      if (dateFilter === 'week' && (!task.dueDate || task.dueDate > plusDays(7))) return false;
      if (dateFilter === 'none' && task.dueDate !== '') return false;
      return true;
    }).sort((a, b) => (a.done - b.done) || ((a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')) || (b.createdAt - a.createdAt));
    $('visibleCount').textContent = String(visible.length);
    const list = $('taskList');
    const fragment = document.createDocumentFragment();
    visible.forEach(task => {
      const item = document.createElement('li'); item.className = `task${task.done ? ' done' : ''}`;
      const checkWrap = document.createElement('div'); checkWrap.className = 'check-wrap';
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.done;
      check.setAttribute('aria-label', `${task.title}を${task.done ? '未完了' : '完了'}にする`);
      check.disabled = !modeIsReady();
      check.addEventListener('change', () => updateTask(task, { done: check.checked, updatedAt: Date.now() }));
      checkWrap.append(check);
      const main = document.createElement('div'); main.className = 'task-main';
      const title = document.createElement('p'); title.className = 'task-title'; title.textContent = task.title; main.append(title);
      const meta = document.createElement('div'); meta.className = 'task-meta';
      const chip = (value, classname = '') => {
        const node = document.createElement('span'); node.className = `chip ${classname}`; node.textContent = value; meta.append(node);
      };
      chip(task.scope === 'private' ? '自分だけ' : '家族共有', task.scope);
      chip(task.category);
      chip(task.scope === 'private' ? '担当：自分' : assigneeName(task.assigneeUid));
      if (task.dueDate) chip(task.dueDate < currentDate && !task.done ? `期限切れ ${task.dueDate}` : `期限 ${task.dueDate}`, task.dueDate < currentDate && !task.done ? 'overdue' : '');
      main.append(meta);
      if (task.notes) { const notes = document.createElement('p'); notes.className = 'task-notes'; notes.textContent = task.notes; main.append(notes); }
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'ghost edit-button'; edit.textContent = '編集';
      edit.disabled = !modeIsReady();
      edit.setAttribute('aria-label', `${task.title}を編集`); edit.addEventListener('click', () => openEdit(task));
      item.append(checkWrap, main, edit); fragment.append(item);
    });
    list.replaceChildren(fragment);
    $('emptyState').hidden = visible.length > 0;
    $('emptyText').textContent = !modeIsReady() ? '設定からGoogleでログインしてください。' : tasks.length === 0 ? 'タスクはまだありません。上から追加できます。' : '条件に合うタスクはありません。';
    updateSettings();
    setSyncStatus();
  }
  function submitTask(values) {
    const scope = values.scope;
    if (state.mode !== 'demo' && !state.user) throw new Error('ログインしてください。');
    if (scope === 'shared' && state.mode !== 'demo' && !state.family) throw new Error('家族スペースを先に作成してください。');
    let assigneeUid = scope === 'private' ? userId() : values.assignee === 'self' ? userId() : values.assignee === 'partner' ? partnerId() : '';
    if (values.assignee === 'partner' && !assigneeUid) throw new Error('相手の登録が完了していません。');
    if (!['', userId(), partnerId()].includes(assigneeUid)) throw new Error('担当者が正しくありません。');
    return normalizeTask({ title: values.title, notes: values.notes, dueDate: values.dueDate, scope,
      category: values.category, assigneeUid, ownerUid: userId(), done: false, createdAt: Date.now(), updatedAt: Date.now() });
  }
  function updateTask(task, patch) {
    if (state.mode === 'demo') {
      const index = state.demo.findIndex(item => item.id === task.id);
      if (index < 0) return;
      state.demo[index] = { ...state.demo[index], ...patch };
      saveDemo(); render();
    } else if (state.user) writeDoc('update', task, patch);
  }
  function openEdit(task) {
    if (!modeIsReady()) return;
    state.editing = task;
    $('editScopeInfo').textContent = `${task.scope === 'shared' ? '家族共有' : '自分だけ'} · 公開範囲は変更できません`;
    $('editTaskTitle').value = task.title;
    $('editTaskDate').value = task.dueDate;
    $('editTaskCategory').value = task.category;
    $('editTaskNotes').value = task.notes;
    $('editTaskAssignee').disabled = task.scope === 'private';
    $('editTaskAssignee').querySelector('[value="partner"]').disabled = state.mode !== 'demo' && !partnerId();
    $('editTaskAssignee').value = task.scope === 'private' ? 'self' : task.assigneeUid === '' ? '' : task.assigneeUid === userId() ? 'self' : 'partner';
    $('editDialog').showModal();
  }
  function closeEdit() { $('editDialog').close(); state.editing = null; }

  async function startFirebase() {
    const configText = getSaved(CONFIG_KEY);
    if (!configText) throw new Error('Firebase設定がありません。');
    const config = JSON.parse(configText);
    if (!validConfig(config)) throw new Error('Firebase設定の必須項目が不足しています。');
    state.sdk = await import('../../assets/js/firebase-shared.js');
    state.connection = state.sdk.openSharedFirebase(config);
    state.unsubscribers.push(state.sdk.onAuthStateChanged(state.connection.auth, user => {
      clearSubscriptions();
      state.user = user;
      state.family = null; state.privateTasks = []; state.sharedTasks = [];
      state.metadata = { private: null, shared: null };
      if (user) attachUser(user.uid);
      render();
    }, error => showMessage(`認証状態の取得に失敗しました：${firebaseError(error)}`)));
    render();
  }
  function clearSubscriptions() {
    if (state.familyUnsub) { state.familyUnsub(); state.familyUnsub = null; }
    if (state.sharedUnsub) { state.sharedUnsub(); state.sharedUnsub = null; }
    if (state.privateUnsub) { state.privateUnsub(); state.privateUnsub = null; }
  }
  function attachUser(uid) {
    const { sdk, connection } = state;
    state.privateUnsub = sdk.onSnapshot(sdk.collection(connection.db, 'users', uid, 'tasks'), { includeMetadataChanges: true }, snapshot => {
      state.privateTasks = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      state.metadata.private = snapshot.metadata; render();
    }, error => showMessage(`個人タスクの読込に失敗しました：${firebaseError(error)}`));
    const families = sdk.query(sdk.collection(connection.db, 'families'), sdk.where('memberUids', 'array-contains', uid));
    state.familyUnsub = sdk.onSnapshot(families, { includeMetadataChanges: true }, snapshot => {
      const familyDoc = snapshot.docs[0] || null;
      const nextFamily = familyDoc ? { id: familyDoc.id, ...familyDoc.data() } : null;
      const oldId = state.family?.id || '';
      state.family = nextFamily;
      if ((nextFamily?.id || '') !== oldId) {
        if (state.sharedUnsub) { state.sharedUnsub(); state.sharedUnsub = null; }
        state.sharedTasks = []; state.metadata.shared = null;
        if (nextFamily) attachShared(nextFamily.id);
      }
      render();
    }, error => showMessage(`家族情報の読込に失敗しました：${firebaseError(error)}`));
  }
  function attachShared(familyId) {
    const { sdk, connection } = state;
    state.sharedUnsub = sdk.onSnapshot(sdk.collection(connection.db, 'families', familyId, 'tasks'), { includeMetadataChanges: true }, snapshot => {
      state.sharedTasks = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      state.metadata.shared = snapshot.metadata; render();
    }, error => showMessage(`共有タスクの読込に失敗しました：${firebaseError(error)}`));
  }
  function showSettings(open) {
    $('settings').hidden = !open;
    $('settingsToggle').setAttribute('aria-expanded', String(open));
    if (open) { updateSettings(); $('settings').scrollIntoView({ block: 'nearest' }); }
  }

  $('settingsToggle').addEventListener('click', () => showSettings($('settings').hidden));
  $('closeSettings').addEventListener('click', () => showSettings(false));
  $('taskScope').addEventListener('change', adjustForm);
  ['searchInput', 'scopeFilter', 'statusFilter', 'dateFilter'].forEach(id => $(id).addEventListener(id === 'searchInput' ? 'input' : 'change', render));
  $('addForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const task = { id: uuid(), ...submitTask({ title: $('taskTitle').value, notes: $('taskNotes').value,
        dueDate: $('taskDate').value, scope: $('taskScope').value, assignee: $('taskAssignee').value, category: $('taskCategory').value }) };
      let saved = true;
      if (state.mode === 'demo') { state.demo.push(task); saved = saveDemo(); render(); }
      else writeDoc('add', task);
      if (saved) {
        $('taskTitle').value = ''; $('taskNotes').value = ''; $('taskTitle').focus();
        notify(state.mode === 'demo' ? 'タスクを端末内に追加しました。' : 'タスクを送信しました。同期完了は上部の表示で確認してください。');
      }
    } catch (error) { showMessage(error.message); }
  });
  $('cancelEdit').addEventListener('click', closeEdit);
  $('editDialog').addEventListener('close', () => { state.editing = null; });
  $('editForm').addEventListener('submit', event => {
    event.preventDefault(); const task = state.editing; if (!task) return;
    try {
      const title = $('editTaskTitle').value.trim(); const notes = $('editTaskNotes').value.trim();
      const dueDate = $('editTaskDate').value; const category = $('editTaskCategory').value;
      const assignee = $('editTaskAssignee').value;
      const assigneeUid = task.scope === 'private' ? userId() : assignee === '' ? '' : assignee === 'self' ? userId() : partnerId();
      if (assignee === 'partner' && !partnerId()) throw new Error('相手の登録が完了していません。');
      const next = normalizeTask({ ...task, title, notes, dueDate, category, assigneeUid, updatedAt: Date.now() });
      updateTask(task, { title: next.title, notes: next.notes, dueDate: next.dueDate, category: next.category, assigneeUid: next.assigneeUid, updatedAt: next.updatedAt });
      closeEdit(); notify(state.mode === 'demo' ? '変更を反映しました。' : '変更を送信しました。同期完了は上部の表示で確認してください。');
    } catch (error) { showMessage(error.message); }
  });
  $('deleteTask').addEventListener('click', () => {
    const task = state.editing; if (!task || !window.confirm(`「${task.title}」を削除しますか？`)) return;
    if (state.mode === 'demo') { state.demo = state.demo.filter(item => item.id !== task.id); saveDemo(); render(); }
    else writeDoc('delete', task);
    closeEdit(); notify(state.mode === 'demo' ? '削除しました。' : '削除を送信しました。同期完了は上部の表示で確認してください。');
  });
  $('saveConfig').addEventListener('click', () => {
    try {
      const config = JSON.parse($('configInput').value.trim());
      if (!validConfig(config)) throw new Error('firebaseConfigのapiKey・authDomain・projectId・appIdが必要です。');
      const old = getSaved(CONFIG_KEY);
      if (old && old !== JSON.stringify(config) && !window.confirm('共通Firebase設定を変更します。ほかのアプリにも影響する可能性があります。続行しますか？')) return;
      if (!setSaved(CONFIG_KEY, JSON.stringify(config)) || !setSaved(MODE_KEY, 'firebase')) throw new Error('設定を保存できません。ブラウザの保存許可を確認してください。');
      location.reload();
    } catch (error) { showMessage(`設定できません：${error.message}`); }
  });
  $('removeConfig').addEventListener('click', () => {
    if (!window.confirm('同じサイト内のほかのアプリも使う共通Firebase設定を削除しますか？クラウドのタスク自体は削除されません。')) return;
    try { localStorage.removeItem(CONFIG_KEY); localStorage.setItem(MODE_KEY, 'demo'); location.reload(); }
    catch (_) { showMessage('設定を削除できませんでした。'); }
  });
  $('demoBtn').addEventListener('click', () => { setSaved(MODE_KEY, 'demo'); location.reload(); });
  $('loginBtn').addEventListener('click', () => {
    if (!state.connection) return;
    // ユーザーのクリックから直接ポップアップを開く。Safariではリダイレクト方式を使わない。
    state.sdk.signInWithPopup(state.connection.auth, new state.sdk.GoogleAuthProvider())
      .catch(error => showMessage(`ログインできません：${firebaseError(error)}`));
  });
  $('logoutBtn').addEventListener('click', () => {
    if (state.connection) state.sdk.signOut(state.connection.auth).catch(error => showMessage(`ログアウトできません：${firebaseError(error)}`));
  });
  $('copyUid').addEventListener('click', async () => {
    if (!state.user) { showMessage('ログイン後にコピーできます。'); return; }
    try { await navigator.clipboard.writeText(state.user.uid); notify('ユーザーIDをコピーしました。'); }
    catch (_) { $('myUid').focus(); $('myUid').select(); showMessage('コピーできません。選択されたIDを手動でコピーしてください。'); }
  });
  $('createFamily').addEventListener('click', () => {
    if (!state.user || state.family || state.creatingFamily) return;
    state.creatingFamily = true; updateSettings();
    const { sdk, connection, user } = state;
    const ref = sdk.doc(connection.db, 'families', user.uid);
    sdk.setDoc(ref, { ownerUid: user.uid, memberUids: [user.uid], createdAt: Date.now() })
      .catch(error => showMessage(`家族の作成に失敗しました：${firebaseError(error)}`))
      .finally(() => { state.creatingFamily = false; updateSettings(); });
    notify('家族スペースの作成を送信しました。同期完了後に共有タスクを追加できます。');
  });
  $('addPartner').addEventListener('click', () => {
    const targetUid = $('partnerUid').value.trim();
    if (!state.family || state.family.ownerUid !== userId()) { showMessage('家族の管理者のみ変更できます。'); return; }
    if (!/^[A-Za-z0-9:_-]{6,128}$/.test(targetUid) || targetUid === userId()) { showMessage('相手の正しいユーザーIDを入力してください。'); return; }
    if (state.family.memberUids.length >= 2) { showMessage('プロトタイプは2人までです。'); return; }
    if (!window.confirm('IDが正しいことを確認しましたか？登録したIDの利用者は家族共有タスクを閲覧できます。')) return;
    const ref = state.sdk.doc(state.connection.db, 'families', state.family.id);
    state.sdk.updateDoc(ref, { memberUids: [state.family.ownerUid, targetUid] })
      .catch(error => showMessage(`共有設定に失敗しました：${firebaseError(error)}`));
    notify('共有設定を送信しました。相手がログインすると共有タスクが表示されます。');
  });
  $('exportBtn').addEventListener('click', () => {
    try {
      if (demoCorrupted && state.mode === 'demo') throw new Error('破損データを保護中のためエクスポートできません。');
      const payload = { version: 1, exportedAt: new Date().toISOString(), mode: state.mode, tasks: allTasks() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
      a.download = `family-tasks-${today()}.json`; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      notify(state.mode === 'firebase' ? '現在表示できているデータを保存しました。キャッシュ中は一部が未取得の可能性があります。' : 'JSONバックアップを書き出しました。');
    } catch (_) { showMessage('JSONの保存に失敗しました。'); }
  });
  $('importInput').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (state.mode !== 'demo') { showMessage('Firebaseモードではインポートを受け付けません。'); return; }
    if (file.size > 2_000_000) { showMessage('JSONファイルは2MB以内にしてください。'); return; }
    try {
      const payload = JSON.parse(await file.text());
      if (payload.version !== 1 || !Array.isArray(payload.tasks) || payload.tasks.length > 1000) throw new Error('対応していないJSON形式です。');
      const imported = payload.tasks.map(item => ({ id: uuid(), ...normalizeTask(item, true) }));
      if (!window.confirm(`現在のデモタスク${state.demo.length}件を、読み込んだ${imported.length}件で置き換えますか？`)) return;
      demoCorrupted = false; state.demo = imported; saveDemo(); render(); notify(`${imported.length}件を読み込みました。`);
    } catch (error) { showMessage(`JSONを読み込めません：${error.message}`); }
  });
  window.addEventListener('online', () => setSyncStatus());
  window.addEventListener('offline', () => setSyncStatus());
  window.addEventListener('storage', event => {
    if (state.mode === 'demo' && event.key === STORE) { state.demo = loadDemo(); render(); }
  });

  render();
  if (state.mode === 'firebase') {
    setSyncStatus('Firebase SDKを読み込み中');
    startFirebase().catch(error => {
      showMessage(`Firebaseに接続できません：${firebaseError(error)}。設定を確認するか「デモに戻る」を選んでください。`);
      $('syncStatus').textContent = 'Firebase接続エラー · デモモードへの切り替えは設定から';
      $('syncStatus').classList.add('error');
      updateSettings();
    });
  }
})();