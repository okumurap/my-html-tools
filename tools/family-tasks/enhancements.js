/* Progressive additions: always-available reorder handles and safe scope changes.
 * Keep legacy task data and the existing task/save/render implementation intact. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORE = 'family-tasks:demo:v1';
  const CONFIG = 'my-html-tools:firebase-config:v1';
  let current = null;
  let busy = false;
  let reorderActivated = false;
  const say = message => {
    $('message').textContent = message;
    $('message').classList.toggle('notice', false);
    $('message').hidden = !message;
  };
  const error = message => {
    $('editError').textContent = message;
    $('editError').hidden = !message;
  };
  const scopeHint = () => {
    if (!current) return;
    const choice = $('editTaskScope').value;
    $('editScopeInfo').textContent = choice === current.scope
      ? '公開範囲はここから変更できます。'
      : choice === 'shared'
        ? '家族共有にすると、家族の相手にもタスクが見えるようになります。'
        : '自分だけにすると、家族の一覧からこのタスクが消えます。';
    $('editScopeInfo').classList.toggle('scope-warning', choice !== current.scope);
  };
  const setBusy = value => {
    busy = value;
    for (const id of ['saveEdit', 'cancelEdit', 'deleteTask', 'editTaskScope', 'editTaskTitle', 'editTaskDate', 'editTaskNotes']) $(id).disabled = value;
  };
  const original = () => {
    if (!current) throw new Error('編集対象が見つかりません。');
    if ($('modeBadge').textContent !== 'Firebase') {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!saved || saved.version !== 1 || !Array.isArray(saved.tasks)) throw new Error('保存済みデータを読み込めません。');
      const index = saved.tasks.findIndex(task => task.id === current.id);
      if (index < 0) throw new Error('編集対象が見つかりません。');
      return { saved, index, task: saved.tasks[index] };
    }
    return null;
  };
  const fields = task => {
    const title = $('editTaskTitle').value.trim();
    const notes = $('editTaskNotes').value.trim();
    const dueDate = $('editTaskDate').value;
    const scope = $('editTaskScope').value;
    if (!title || title.length > 120) throw new Error('タスク名は1～120文字で入力してください。');
    if (notes.length > 1000) throw new Error('メモは1000文字以内で入力してください。');
    if (dueDate) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
      if (!match) throw new Error('期限の日付が正しくありません。');
      const date = new Date(Number(match[1]), Number(match[2])-1, Number(match[3]), 12);
      if (+match[1] < 1900 || +match[1] > 9999 || date.getFullYear() !== +match[1] || date.getMonth()+1 !== +match[2] || date.getDate() !== +match[3]) throw new Error('期限の日付が正しくありません。');
    }
    if (!['shared','private'].includes(scope)) throw new Error('公開範囲が正しくありません。');
    return { ...task, title, notes, dueDate, scope, updatedAt: Math.max(Date.now(), task.createdAt),
      assigneeUid: scope === 'private' ? (task.scope === 'private' ? task.assigneeUid : '') : '', };
  };
  // Preserve old hidden categories while satisfying current Firestore CREATE rules.
  const normalizedCategory = value => ({'家事':'家','住宅':'家','子育て':'子ども','仕事':'その他'})[value] || value;
  async function changeScope() {
    const isFirebase = $('modeBadge').textContent === 'Firebase';
    let saved, index, old, next;
    if (!isFirebase) {
      ({saved, index, task:old} = original());
      next = fields(old);
      next.assigneeUid = next.scope === 'private' ? (old.ownerUid || 'demo-me') : '';
      next.category = normalizedCategory(old.category);
    } else {
      // Reuse the already initialized Firebase app, using the same pinned Web SDK.
      const config = JSON.parse(localStorage.getItem(CONFIG) || 'null');
      if (!config) throw new Error('Firebase設定が見つかりません。');
      const shared = await import('../../assets/js/firebase-shared.js');
      const sdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
      const {auth, db} = shared.openSharedFirebase(config);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('ログインしてください。');
      const families = await sdk.getDocs(sdk.query(sdk.collection(db,'families'),sdk.where('memberUids','array-contains',uid)));
      const family = families.docs[0] || null;
      if (current.scope === 'shared' && !family) throw new Error('家族スペースが見つかりません。');
      if ($('editTaskScope').value === 'shared' && !family) throw new Error('家族スペースを作成してから共有に変更してください。');
      if (!navigator.onLine) throw new Error('公開範囲の変更はオンライン時に実行してください。');
      const source = current.scope === 'private' ? sdk.doc(db,'users',uid,'tasks',current.id) : sdk.doc(db,'families',family.id,'tasks',current.id);
      const snapshot = await sdk.getDoc(source);
      if (!snapshot.exists()) throw new Error('元のタスクが見つかりません。再読み込みしてください。');
      old = snapshot.data();
      next = fields(old);
      next.ownerUid = uid;
      next.assigneeUid = next.scope === 'private' ? uid : '';
      next.category = normalizedCategory(old.category);
      if (!['家','買い物','子ども','その他'].includes(next.category)) throw new Error('旧カテゴリを確認してください。');
      const destination = next.scope === 'private' ? sdk.collection(db,'users',uid,'tasks') : sdk.collection(db,'families',family.id,'tasks');
      const batch = sdk.writeBatch(db);
      batch.set(sdk.doc(destination), next);
      batch.delete(source);
      await batch.commit();
      return;
    }
    // A single localStorage write avoids an intermediate duplicated/missing task.
    saved.tasks[index] = next;
    localStorage.setItem(STORE, JSON.stringify(saved));
    window.dispatchEvent(new StorageEvent('storage', {key: STORE}));
  }
  function makeReorderPermanent() {
    if (reorderActivated) return;
    const toggle = $('reorderToggle');
    if (!toggle || toggle.disabled) return;
    if (toggle.getAttribute('aria-pressed') === 'true') {reorderActivated = true; return;}
    const filters = ['searchInput','scopeFilter','statusFilter','dateFilter'].map(id => [id,$(id).value]);
    toggle.click();
    reorderActivated = toggle.getAttribute('aria-pressed') === 'true';
    if (reorderActivated) {
      // The original toggle clears filters; restore the user's choices.
      for (const [id,value] of filters) $(id).value = value;
      $('statusFilter').dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  // Reorder relative to the next *visible* task when filters hide other items.
  // The original arrow helper uses an unfiltered neighbor, so intercept just this case.
  let arrowBusy = false;
  async function shiftFiltered(id, targetId, after) {
    const isFirebase = $('modeBadge').textContent === 'Firebase';
    let tasks, sdk, db, refs;
    if (isFirebase) {
      const config = JSON.parse(localStorage.getItem(CONFIG) || 'null');
      const shared = await import('../../assets/js/firebase-shared.js');
      sdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
      const conn = shared.openSharedFirebase(config); db = conn.db;
      const uid = conn.auth.currentUser?.uid;
      if (!uid) throw new Error('ログインしてください。');
      refs = new Map();
      const load = async col => {
        const snap = await sdk.getDocs(col);
        return snap.docs.map(doc => {refs.set(doc.id,doc.ref);return {id:doc.id,...doc.data()};});
      };
      tasks = await load(sdk.collection(db,'users',uid,'tasks'));
      const families = await sdk.getDocs(sdk.query(sdk.collection(db,'families'),sdk.where('memberUids','array-contains',uid)));
      if (families.docs[0]) tasks.push(...await load(sdk.collection(db,'families',families.docs[0].id,'tasks')));
    } else {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!saved || saved.version !== 1 || !Array.isArray(saved.tasks)) throw new Error('保存データを読み込めません。');
      tasks = saved.tasks;
    }
    const rank = task => Number.isFinite(task.sortOrder) ? task.sortOrder : -task.createdAt;
    const ordered = tasks.slice().sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id));
    const sourceIndex = ordered.findIndex(t=>t.id===id);
    if (sourceIndex<0) throw new Error('移動元のタスクが見つかりません。');
    const source = ordered.splice(sourceIndex,1)[0];
    const targetIndex = ordered.findIndex(t=>t.id===targetId);
    if (targetIndex<0) throw new Error('移動先のタスクが見つかりません。');
    ordered.splice(targetIndex+Number(after),0,source);
    const index = ordered.indexOf(source), before=ordered[index-1],next=ordered[index+1];
    const low=before?rank(before):null, high=next?rank(next):null;
    const value=low===null?(high===null?0:high-1024):high===null?low+1024:low+(high-low)/2;
    const needsRebalance=!Number.isFinite(value)||Math.abs(value)>8e15||(low!==null&&value<=low)||(high!==null&&value>=high);
    const changes=needsRebalance?ordered.map((t,i)=>[t,i*1024]):[[source,value]];
    if (isFirebase) {
      if (changes.length>500) throw new Error('タスクが多いため、全件表示で並び替えてください。');
      const batch=sdk.writeBatch(db);
      for (const [task,order] of changes) batch.update(refs.get(task.id),{sortOrder:order,updatedAt:Date.now()});
      await batch.commit();
    } else {
      const mapping=new Map(changes.map(([t,v])=>[t.id,v]));
      const saved={version:1,tasks:tasks.map(t=>mapping.has(t.id)?{...t,sortOrder:mapping.get(t.id),updatedAt:Date.now()}:t)};
      localStorage.setItem(STORE,JSON.stringify(saved));
      window.dispatchEvent(new StorageEvent('storage',{key:STORE}));
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const reorder = $('reorderToggle');
    makeReorderPermanent();
    new MutationObserver(makeReorderPermanent).observe(reorder, {attributes:true,attributeFilter:['disabled']});
    const list = $('taskList');
    list.addEventListener('click', async event => {
      const arrow=event.target.closest('button.sort-arrow');
      if (!arrow || arrow.disabled) return;
      const filtered=$('searchInput').value.trim() || $('scopeFilter').value!=='all' || $('statusFilter').value!=='all' || $('dateFilter').value!=='all';
      if (!filtered) return;
      event.preventDefault();event.stopImmediatePropagation();
      if (arrowBusy) return;
      const rows=[...list.querySelectorAll('li.task')],index=rows.indexOf(arrow.closest('li.task'));
      const down=arrow.textContent.trim()==='↓',target=rows[index+(down?1:-1)];
      if (!target) return;
      arrowBusy=true;
      try {await shiftFiltered(rows[index].dataset.taskId,target.dataset.taskId,down);}
      catch (e) {say('並び替えを保存できません：'+(e.message||'保存エラー'));}
      finally {arrowBusy=false;}
    },true);
    list.addEventListener('click', event => {
      const edit = event.target.closest('button.edit-button');
      if (!edit) return;
      const li = edit.closest('li.task[data-task-id]');
      const scope = li.querySelector('.chip')?.textContent === '自分だけ' ? 'private' : 'shared';
      current = {id:li.dataset.taskId,scope};
      queueMicrotask(() => {
        if (!$('editDialog').open || !current) return;
        $('editTaskScope').value = scope;
        $('editTaskScope').querySelector('[value="shared"]').disabled = document.querySelector('#modeBadge')?.textContent === 'Firebase' && !$('createFamily').hidden;
        error('');
        scopeHint();
      });
    }, true);
    $('editTaskScope').addEventListener('change', scopeHint);
    $('editForm').addEventListener('input', () => error(''), true);
    $('editForm').addEventListener('submit', async event => {
      if (!current || $('editTaskScope').value === current.scope) return;
      event.preventDefault();event.stopImmediatePropagation();
      if (busy) return;
      error('');
      const explanation = $('editTaskScope').value === 'shared'
        ? '家族共有に変更すると、家族の相手にも内容が表示されます。続行しますか？'
        : '自分だけに変更すると、家族の一覧からこのタスクが消えます。続行しますか？';
      if (!window.confirm(explanation)) return;
      setBusy(true);
      try {
        await changeScope();
        $('editDialog').close();
        current = null;
        say('公開範囲を変更しました。');
      } catch (e) {error(e.message || '公開範囲を変更できませんでした。');}
      finally {setBusy(false);}
    }, true);
    $('editDialog').addEventListener('close', () => {if (!busy) current = null;});
    $('editDialog').addEventListener('cancel', event => {if (busy) event.preventDefault();});
  });
})();