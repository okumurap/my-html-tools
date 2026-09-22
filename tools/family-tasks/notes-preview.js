/* メモ表示だけを追加。元のタスク描画・保存・分類処理には介入しない。 */
(() => {
  'use strict';
  const list = document.getElementById('taskList');
  const STORE = 'family-tasks:demo:v1';
  const MODE = 'family-tasks:mode:v1';
  const CONFIG = 'my-html-tools:firebase-config:v1';
  const notes = new Map();
  let scheduled = false;

  function isCloud() {
    try { return localStorage.getItem(MODE) === 'firebase' && !!localStorage.getItem(CONFIG); }
    catch (_) { return false; }
  }
  function loadDemoNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!saved || saved.version !== 1 || !Array.isArray(saved.tasks)) return;
      notes.clear();
      for (const task of saved.tasks) {
        if (task.scope === 'shared' && typeof task.notes === 'string') notes.set(task.id, task.notes);
      }
    } catch (_) { /* 破損データの修復・上書きは既存アプリに任せる。 */ }
  }
  function renderPreviews() {
    scheduled = false;
    if (!isCloud()) loadDemoNotes();
    for (const row of list.querySelectorAll('li.task[data-task-id]')) {
      const body = row.querySelector('button.body');
      if (!body) continue;
      const text = (notes.get(row.dataset.taskId) || '').trim();
      let preview = body.querySelector('.note-preview');
      if (!text) {
        preview?.remove();
        continue;
      }
      if (!preview) {
        preview = document.createElement('small');
        preview.className = 'note-preview';
        body.append(preview);
      }
      if (preview.textContent !== text) preview.textContent = text;
      const title = body.querySelector('span')?.textContent || 'タスク';
      const accessible = `${title}を編集。メモ：${text.slice(0, 160)}`;
      if (body.getAttribute('aria-label') !== accessible) body.setAttribute('aria-label', accessible);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(renderPreviews);
  }
  new MutationObserver(schedule).observe(list, {childList:true});
  window.addEventListener('storage', event => {
    if (event.key === STORE && !isCloud()) schedule();
  });
  schedule();

  // Firebaseモードでは共有コレクションを購読し、別端末からのメモ更新も反映。
  async function observeCloud() {
    if (!isCloud()) return;
    let unsubscribeFamily = null;
    let unsubscribeTasks = null;
    try {
      const shared = await import('../../assets/js/firebase-shared.js');
      const config = JSON.parse(localStorage.getItem(CONFIG) || 'null');
      if (!config || !['apiKey','authDomain','projectId','appId'].every(key => typeof config[key] === 'string' && config[key].trim())) return;
      const {auth, db} = shared.openSharedFirebase(config);
      shared.onAuthStateChanged(auth, user => {
        unsubscribeTasks?.();
        unsubscribeFamily?.();
        unsubscribeTasks = unsubscribeFamily = null;
        notes.clear();
        schedule();
        if (!user) return;
        unsubscribeFamily = shared.onSnapshot(
          shared.query(shared.collection(db, 'families'), shared.where('memberUids', 'array-contains', user.uid)),
          snapshot => {
            unsubscribeTasks?.();
            unsubscribeTasks = null;
            notes.clear();
            schedule();
            const family = snapshot.docs[0];
            if (!family) return;
            unsubscribeTasks = shared.onSnapshot(shared.collection(db, 'families', family.id, 'tasks'), tasks => {
              notes.clear();
              tasks.docs.forEach(task => {
                if (task.data().scope === 'shared' && typeof task.data().notes === 'string') notes.set(task.id, task.data().notes);
              });
              schedule();
            }, () => { /* 接続エラーは既存アプリ側の状態表示に任せる。 */ });
          }, () => { /* 同上 */ }
        );
      });
    } catch (_) { /* 設定不備でもタスク本体の表示・編集を妨げない。 */ }
  }
  void observeCloud();
})();
