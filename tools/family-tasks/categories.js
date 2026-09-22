/* Three drag-to-file groups. Reuses the existing category field, storage key,
   task renderer, Firestore client and long-press handling without migrating data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORE = 'family-tasks:demo:v1';
  const MODE = 'family-tasks:mode:v1';
  const CONFIG = 'my-html-tools:firebase-config:v1';
  const GROUPS = [
    {id:'home', label:'家・その他', value:'家'},
    {id:'shopping', label:'買い物', value:'買い物'},
    {id:'kids', label:'子ども', value:'子ども'},
  ];
  const groupOf = category => category === '買い物' ? 'shopping' :
    ['子ども', '子育て'].includes(category) ? 'kids' : 'home';
  const list = $('taskList');
  const dock = $('categoryDock');
  const buttons = [...dock.querySelectorAll('button[data-category]')];
  const categoryById = new Map();
  let scheduled = false;
  let saving = false;
  let editingId = null;
  let familyUnsub = null;
  let taskUnsub = null;
  let authUnsub = null;
  let currentFamilyId = null;

  function announce(message, isError = false) {
    const node = $('message');
    node.textContent = message;
    node.hidden = !message;
    node.classList.toggle('error', isError);
  }
  function savedDemo() {
    const data = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!data || data.version !== 1 || !Array.isArray(data.tasks)) throw Error('保存データを読み込めません。');
    return data;
  }
  function refreshCategories() {
    if (localStorage.getItem(MODE) === 'firebase' && localStorage.getItem(CONFIG)) return;
    try {
      const data = savedDemo();
      categoryById.clear();
      data.tasks.forEach(task => {
        if (task.scope === 'shared') categoryById.set(task.id, task.category);
      });
    } catch (_) {
      categoryById.clear(); // Do not modify damaged stored data.
    }
  }
  function makeHeader(group, count) {
    const node = document.createElement('li');
    node.className = 'category-heading';
    node.dataset.group = group.id;
    node.setAttribute('aria-label', `${group.label}、${count}件`);
    const label = document.createElement('span');
    label.textContent = group.label;
    const badge = document.createElement('span');
    badge.className = 'category-count';
    badge.textContent = `${count}`;
    node.append(label, badge);
    return node;
  }
  function regroup() {
    refreshCategories();
    const rows = [...list.querySelectorAll(':scope > li.task[data-task-id]')];
    const headings = [...list.querySelectorAll(':scope > li.category-heading')];
    if (!rows.length) {
      if (headings.length) headings.forEach(node => node.remove());
      return;
    }
    const items = GROUPS.map(group => ({group, rows:[]}));
    rows.forEach(row => {
      const groupId = groupOf(categoryById.get(row.dataset.taskId));
      row.dataset.group = groupId;
      const group = GROUPS.find(item => item.id === groupId);
      if (!row.dataset.baseLabel) row.dataset.baseLabel = row.getAttribute('aria-label') || '';
      row.setAttribute('aria-label', `${row.dataset.baseLabel} 分類：${group.label}`);
      items.find(item => item.group.id === groupId).rows.push(row);
    });
    const existing = new Map(headings.map(node => [node.dataset.group,node]));
    const desired = [];
    items.forEach(({group,rows:groupRows}) => {
      let header = existing.get(group.id);
      if (!header) header = makeHeader(group,groupRows.length);
      if (header.lastElementChild.textContent !== String(groupRows.length)) header.lastElementChild.textContent = String(groupRows.length);
      if (header.getAttribute('aria-label') !== `${group.label}、${groupRows.length}件`) header.setAttribute('aria-label', `${group.label}、${groupRows.length}件`);
      desired.push(header, ...groupRows);
    });
    if (list.children.length !== desired.length || desired.some((node,i) => list.children[i] !== node)) {
      list.replaceChildren(...desired);
    }
  }
  function scheduleRegroup() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; regroup(); updateDock(); });
  }
  function updateDock() {
    const dragging = list.querySelector('li.task.dragging[data-task-id]');
    if (!dragging || saving) {
      dock.hidden = true;
      buttons.forEach(button => button.classList.remove('over'));
      return;
    }
    dock.hidden = false;
    const current = groupOf(categoryById.get(dragging.dataset.taskId));
    buttons.forEach(button => {
      button.classList.toggle('current',button.dataset.group === current);
      button.setAttribute('aria-label',`${button.textContent.trim()}に分類`);
    });
  }
  function targetAt(x,y) {
    if (dock.hidden) return null;
    const element = document.elementFromPoint(x,y)?.closest('button[data-category]');
    return element && dock.contains(element) ? element : null;
  }
  function hover(x,y) {
    const target = targetAt(x,y);
    buttons.forEach(button => button.classList.toggle('over',button === target));
    return target;
  }
  async function saveCategory(id,category) {
    if (saving || !['家','買い物','子ども'].includes(category)) return false;
    saving = true;
    dock.hidden = true;
    try {
      if (localStorage.getItem(MODE) !== 'firebase' || !localStorage.getItem(CONFIG)) {
        const data = savedDemo();
        const index = data.tasks.findIndex(task => task.id === id && task.scope === 'shared');
        if (index < 0) throw Error('変更する共有タスクが見つかりません。');
        const old = data.tasks[index];
        if (groupOf(old.category) === groupOf(category)) return false;
        data.tasks[index] = {...old,category,updatedAt:Math.max(Date.now(),old.createdAt)};
        localStorage.setItem(STORE,JSON.stringify(data));
        categoryById.set(id,category);
        window.dispatchEvent(new StorageEvent('storage',{key:STORE}));
        scheduleRegroup();
      } else {
        if (!navigator.onLine) throw Error('オフラインです。接続後にもう一度操作してください。');
        const config = JSON.parse(localStorage.getItem(CONFIG) || 'null');
        if (!config || !['apiKey','authDomain','projectId','appId'].every(key=>typeof config[key] === 'string' && config[key].trim())) throw Error('Firebase設定が見つかりません。');
        const shared = await import('../../assets/js/firebase-shared.js');
        const firestore = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
        const {db,auth} = shared.openSharedFirebase(config);
        const userId = auth.currentUser?.uid;
        if (!userId) throw Error('ログインしてください。');
        const matches = await firestore.getDocs(firestore.query(firestore.collection(db,'families'),firestore.where('memberUids','array-contains',userId)));
        if (!matches.docs[0]) throw Error('家族スペースが見つかりません。');
        const ref = firestore.doc(db,'families',matches.docs[0].id,'tasks',id);
        const source = await firestore.getDoc(ref);
        if (!source.exists() || source.data().scope !== 'shared') throw Error('変更する共有タスクが見つかりません。');
        if (groupOf(source.data().category) === groupOf(category)) return false;
        await firestore.updateDoc(ref,{category,updatedAt:Math.max(Date.now(),source.data().createdAt)});
        categoryById.set(id,category);
        scheduleRegroup();
      }
      announce(`${GROUPS.find(group=>group.value===category).label}に分類しました。`);
      return true;
    } catch (error) {
      announce(`分類できません：${error.message || '保存エラー'}`,true);
      return false;
    } finally {
      saving = false;
    }
  }
  function drop(event,kind) {
    if (kind==='pointer' && event.pointerType === 'touch') return;
    const dragging = list.querySelector('li.task.dragging[data-task-id]');
    if (!dragging || dock.hidden) return;
    const point = kind === 'touch' ? event.changedTouches?.[0] : event;
    if (!point) return;
    const button = targetAt(point.clientX,point.clientY);
    if (!button) return;
    const id = dragging.dataset.taskId, category = button.dataset.category;
    // Let clear-app.js finish/clear its own gesture before writing and rerendering.
    queueMicrotask(() => { dock.hidden = true; buttons.forEach(node=>node.classList.remove('over')); void saveCategory(id,category); });
  }
  document.addEventListener('touchmove',event => {
    if (event.touches?.length === 1 && !dock.hidden) hover(event.touches[0].clientX,event.touches[0].clientY);
  },{capture:true,passive:true});
  document.addEventListener('pointermove',event => {
    if (event.pointerType !== 'touch' && !dock.hidden) hover(event.clientX,event.clientY);
  },true);
  document.addEventListener('touchend',event=>drop(event,'touch'),true);
  document.addEventListener('pointerup',event=>drop(event,'pointer'),true);
  document.addEventListener('touchcancel',()=>{dock.hidden = true;},true);
  document.addEventListener('pointercancel',()=>{dock.hidden = true;},true);
  const observer = new MutationObserver(scheduleRegroup);
  observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('storage',event=>{if(event.key===STORE)scheduleRegroup();});
  scheduleRegroup();

  // Tap-accessible alternative to dragging, only inside the edit dialog.
  list.addEventListener('click',event=>{
    const button = event.target.closest('button.body');
    if (!button) return;
    editingId = button.closest('li.task[data-task-id]')?.dataset.taskId || null;
    queueMicrotask(() => {
      if (!editingId || !$('editDialog').open) return;
      $('editCategory').value = groupOf(categoryById.get(editingId));
      $('editCategoryError').hidden = true;
    });
  },true);
  $('editDialog').addEventListener('close',()=>{editingId = null;});
  $('editCategory').addEventListener('change',async event=>{
    if (!editingId) return;
    const next = GROUPS.find(group=>group.id===event.target.value);
    if (!next) return;
    const ok = await saveCategory(editingId,next.value);
    if (!ok && groupOf(categoryById.get(editingId)) !== next.id) {
      $('editCategoryError').textContent = '分類の変更に失敗しました。もう一度選択してください。';
      $('editCategoryError').hidden = false;
      event.target.value = groupOf(categoryById.get(editingId));
    } else $('editCategoryError').hidden = true;
  });

  // Cloud display categories follow the shared collection; private tasks stay untouched.
  async function observeCloud() {
    if (localStorage.getItem(MODE)!=='firebase' || !localStorage.getItem(CONFIG)) return;
    try {
      const shared = await import('../../assets/js/firebase-shared.js');
      const config = JSON.parse(localStorage.getItem(CONFIG));
      const {auth,db} = shared.openSharedFirebase(config);
      authUnsub = shared.onAuthStateChanged(auth,user=>{
        taskUnsub?.();familyUnsub?.();taskUnsub=null;familyUnsub=null;currentFamilyId=null;
        categoryById.clear();scheduleRegroup();
        if (!user) return;
        familyUnsub = shared.onSnapshot(shared.query(shared.collection(db,'families'),shared.where('memberUids','array-contains',user.uid)),snapshot=>{
          const family=snapshot.docs[0];
          if ((family?.id || null) === currentFamilyId) return;
          taskUnsub?.();taskUnsub=null;categoryById.clear();currentFamilyId=family?.id || null;
          if (family) taskUnsub=shared.onSnapshot(shared.collection(db,'families',family.id,'tasks'),snapshot=>{
            categoryById.clear();
            snapshot.docs.forEach(task=>categoryById.set(task.id,task.data().category));
            scheduleRegroup();
          },()=>{});
          scheduleRegroup();
        },()=>{});
      });
    } catch (error) {
      announce(`分類情報の読込に失敗しました：${error.message}`,true);
    }
  }
  void observeCloud();
})();