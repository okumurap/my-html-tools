/* A small, touch-first UI layer. The original task model, edit and sync paths stay intact. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORE = 'family-tasks:demo:v1';
  const CONFIG = 'my-html-tools:firebase-config:v1';
  const filterValues = {
    scope: [['all','すべて'],['shared','家族共有'],['private','自分だけ']],
    status: [['open','未完了'],['all','すべて'],['done','完了']],
  };
  const label = (kind, value) => filterValues[kind].find(([id]) => id === value)?.[1] || 'すべて';
  const info = text => { $('reorderInfo').textContent = text; };
  const rank = task => Number.isFinite(task.sortOrder) ? task.sortOrder : -task.createdAt;
  const compare = (a,b) => rank(a) - rank(b) || a.id.localeCompare(b.id);
  const list = $('taskList');
  let gesture = null;
  let busy = false;
  let suppressClickUntil = 0;
  let suppressClickRow = null;
  let lastTouch = 0;

  function setupCycle(kind) {
    const select = $(kind + 'Filter');
    const button = $(kind + 'Cycle');
    const values = filterValues[kind];
    function sync() {
      const current = label(kind, select.value);
      button.textContent = `${kind === 'scope' ? '公開範囲' : '状態'}：${current} ↻`;
      button.setAttribute('aria-label', `${kind === 'scope' ? '公開範囲' : '状態'}は${current}。タップして切り替える`);
    }
    button.addEventListener('click', () => {
      const index = values.findIndex(([value]) => value === select.value);
      select.value = values[(index + 1) % values.length][0];
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
    select.addEventListener('change', sync);
    sync();
  }

  // The main renderer still requires the old elements, but they must not filter invisibly.
  $('searchInput').value = '';
  $('dateFilter').value = 'all';
  setupCycle('scope');
  setupCycle('status');

  function getDragTarget(x, y, sourceId) {
    const row = document.elementFromPoint(x, y)?.closest('li.task[data-task-id]');
    if (!row || !list.contains(row) || row.dataset.taskId === sourceId) return null;
    return { id: row.dataset.taskId, after: y >= row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2, row };
  }
  function markTarget(target) {
    list.querySelectorAll('.sort-drop-before,.sort-drop-after').forEach(node => node.classList.remove('sort-drop-before','sort-drop-after'));
    if (target) target.row.classList.add(target.after ? 'sort-drop-after' : 'sort-drop-before');
  }
  function positionGhost(x, y) {
    $('dragGhost').style.transform = `translate(${Math.max(8,Math.min(x + 12,window.innerWidth - 172))}px,${Math.max(8,y - 45)}px)`;
  }
  function startDrag(g) {
    if (gesture !== g || busy || !$('reorderToggle') || $('reorderToggle').getAttribute('aria-pressed') !== 'true') return;
    g.active = true;
    g.row.classList.add('drag-source');
    document.body.classList.add('sorting-task');
    $('dragGhost').textContent = g.row.querySelector('.task-title')?.textContent || '';
    $('dragGhost').hidden = false;
    positionGhost(g.x,g.y);
    window.getSelection()?.removeAllRanges();
  }
  function arm(row, x, y, type, pointerId = null, origin = null) {
    if (busy || gesture || row.querySelector('.edit-button')?.disabled || $('reorderToggle').getAttribute('aria-pressed') !== 'true') return;
    const g = { id: row.dataset.taskId, row, x, y, startX:x, startY:y, type, pointerId, active:false, timer:null, target:null, pressedInteractive:!!origin?.closest('button,input,select,textarea,a') };
    gesture = g;
    g.timer = window.setTimeout(() => startDrag(g), type === 'touch' ? 360 : 240);
  }
  function clearGesture() {
    const g = gesture;
    if (!g) return null;
    window.clearTimeout(g.timer);
    gesture = null;
    g.row.classList.remove('drag-source');
    document.body.classList.remove('sorting-task');
    $('dragGhost').hidden = true;
    markTarget(null);
    return g;
  }
  function move(x, y) {
    const g = gesture;
    if (!g) return;
    if (!g.active && Math.hypot(x-g.startX,y-g.startY) > 11) { clearGesture(); return; }
    if (!g.active) return;
    g.x=x;g.y=y;
    positionGhost(x,y);
    g.target=getDragTarget(x,y,g.id);
    markTarget(g.target);
    // Allow moving across tasks near the edge without requiring a visible arrow.
    if (y < 65) window.scrollBy(0,-16);
    else if (y > window.innerHeight - 65) window.scrollBy(0,16);
  }
  async function finish(canceled = false) {
    const g = gesture;
    if (!g) return;
    const target = !canceled && g.active ? getDragTarget(g.x,g.y,g.id) : null;
    const wasActive = g.active;
    clearGesture();
    if (!wasActive) return;
    suppressClickRow = g.pressedInteractive ? g.id : null;
    suppressClickUntil = Date.now() + 650;
    if (!target) return;
    busy = true;
    try {
      const changed = await saveOrder(g.id,target.id,target.after);
      if (changed) info('並び順を保存しました。タスクを長押しすると再び移動できます。');
    } catch (e) {
      info(`並び替えに失敗しました：${e.message || '保存エラー'}`);
    } finally { busy=false; }
  }

  // Reuse the original sortOrder format; update only the moved task unless a rebalance is needed.
  async function saveOrder(id, destinationId, after) {
    const cloud = $('modeBadge').textContent === 'Firebase';
    let tasks, stored, db, sdk, refs;
    if (cloud) {
      const config = JSON.parse(localStorage.getItem(CONFIG) || 'null');
      if (!config) throw new Error('Firebase設定が見つかりません。');
      const shared = await import('../../assets/js/firebase-shared.js');
      sdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
      const connection = shared.openSharedFirebase(config);
      const uid = connection.auth.currentUser?.uid;
      if (!uid) throw new Error('ログインしてください。');
      db = connection.db;
      refs = new Map();
      const load = async collection => {
        const snapshot = await sdk.getDocs(collection);
        return snapshot.docs.map(doc => {refs.set(doc.id,doc.ref); return {id:doc.id,...doc.data()};});
      };
      tasks = await load(sdk.collection(db,'users',uid,'tasks'));
      const members = await sdk.getDocs(sdk.query(sdk.collection(db,'families'),sdk.where('memberUids','array-contains',uid)));
      if (members.docs[0]) tasks.push(...await load(sdk.collection(db,'families',members.docs[0].id,'tasks')));
    } else {
      stored = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!stored || stored.version !== 1 || !Array.isArray(stored.tasks) || stored.tasks.length > 1000) throw new Error('端末の保存データを読み込めません。');
      tasks = stored.tasks;
    }
    const ordered = tasks.slice().sort(compare);
    const previous = ordered.map(task => task.id).join('\0');
    const from = ordered.findIndex(task => task.id === id);
    if (from < 0) throw new Error('移動元が見つかりません。');
    const source = ordered.splice(from,1)[0];
    const to = ordered.findIndex(task => task.id === destinationId);
    if (to < 0) throw new Error('移動先が見つかりません。');
    ordered.splice(to + Number(after),0,source);
    if (previous === ordered.map(task => task.id).join('\0')) return false;
    const at = ordered.indexOf(source), before = ordered[at-1], next = ordered[at+1];
    const low = before ? rank(before) : null, high = next ? rank(next) : null;
    const value = low === null ? (high === null ? 0 : high - 1024) : high === null ? low + 1024 : low + (high-low)/2;
    const rebalance = !Number.isFinite(value) || Math.abs(value)>8e15 || (low !== null && value<=low) || (high !== null && value>=high);
    const updates = rebalance ? ordered.map((task,index) => [task,index*1024]) : [[source,value]];
    const now = Date.now();
    if (cloud) {
      if (updates.length>500) throw new Error('タスクが多いため並び替えを保存できません。');
      const batch = sdk.writeBatch(db);
      updates.forEach(([task,order]) => batch.update(refs.get(task.id),{sortOrder:order,updatedAt:now}));
      await batch.commit();
    } else {
      const changed = new Map(updates.map(([task,order]) => [task.id,order]));
      const result = { ...stored, tasks:stored.tasks.map(task => changed.has(task.id) ? {...task,sortOrder:changed.get(task.id),updatedAt:now} : task) };
      localStorage.setItem(STORE,JSON.stringify(result));
      window.dispatchEvent(new StorageEvent('storage',{key:STORE}));
    }
    return true;
  }

  list.addEventListener('touchstart', event => {
    if (event.touches.length!==1) return;
    lastTouch=Date.now();
    const row=event.target.closest('li.task[data-task-id]');
    if (row) arm(row,event.touches[0].clientX,event.touches[0].clientY,'touch',null,event.target);
  },{passive:true});
  list.addEventListener('touchmove', event => {
    if (!gesture || gesture.type!=='touch') return;
    if (event.touches.length!==1) {clearGesture();return;}
    const touch=event.touches[0];
    move(touch.clientX,touch.clientY);
    if (gesture?.active) event.preventDefault();
  },{passive:false});
  list.addEventListener('touchend', event => {
    if (!gesture || gesture.type!=='touch') return;
    const touch=event.changedTouches[0];
    if (touch) {gesture.x=touch.clientX;gesture.y=touch.clientY;}
    if (gesture.active) event.preventDefault();
    void finish();
  },{passive:false});
  list.addEventListener('touchcancel', () => {if (gesture?.type==='touch')void finish(true);});
  list.addEventListener('pointerdown', event => {
    if (event.pointerType==='touch' || Date.now()-lastTouch<700 || event.button!==0) return;
    const row=event.target.closest('li.task[data-task-id]');
    if (row) arm(row,event.clientX,event.clientY,'pointer',event.pointerId,event.target);
  });
  document.addEventListener('pointermove', event => {
    if (gesture?.type==='pointer' && gesture.pointerId===event.pointerId) move(event.clientX,event.clientY);
  });
  document.addEventListener('pointerup', event => {
    if (gesture?.type!=='pointer' || gesture.pointerId!==event.pointerId) return;
    gesture.x=event.clientX;gesture.y=event.clientY;
    void finish();
  });
  document.addEventListener('pointercancel', event => {
    if (gesture?.type==='pointer' && gesture.pointerId===event.pointerId)void finish(true);
  });
  list.addEventListener('click', event => {
    if (suppressClickRow && Date.now()<suppressClickUntil && event.target.closest('li.task')?.dataset.taskId === suppressClickRow) {
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  list.addEventListener('contextmenu', event => {
    if (event.target.closest('li.task')) event.preventDefault();
  });
  // Visible arrows are gone, but sorting remains accessible without a pointer.
  list.addEventListener('keydown', event => {
    if (!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key) || event.target.closest('input,button,textarea,select')) return;
    const row=event.target.closest('li.task[data-task-id]');
    if (!row || busy) return;
    const rows=[...list.querySelectorAll('li.task[data-task-id]')],i=rows.indexOf(row),down=event.key==='ArrowDown',neighbor=rows[i+(down?1:-1)];
    if (!neighbor) return;
    event.preventDefault();
    busy=true;
    const position=i+(down?1:-1);
    saveOrder(row.dataset.taskId,neighbor.dataset.taskId,down).then(changed => {
      if (changed) info('並び順を保存しました。');
      // The original renderer replaces nodes after local updates.
      list.querySelectorAll('li.task')[position]?.focus();
    }).catch(e => info(`並び替えに失敗しました：${e.message||'保存エラー'}`)).finally(()=>{busy=false;});
  });
  const markKeyboardAccess = () => list.querySelectorAll('li.task[data-task-id]').forEach(row => {
    row.tabIndex=0;
    row.setAttribute('aria-label', `${row.querySelector('.task-title')?.textContent || 'タスク'}。長押しで移動。キーボードはAltと上下矢印で移動。`);
  });
  new MutationObserver(markKeyboardAccess).observe(list,{childList:true});
  markKeyboardAccess();
})();
