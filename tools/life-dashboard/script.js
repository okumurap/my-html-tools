
(() => {
  "use strict";
  const DAY=86400000,WEEK=7*DAY,YEAR_DAYS=365.2425;
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12)};
  const parseDate=v=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const [y,m,d]=v.split("-").map(Number);const date=new Date(y,m-1,d,12);return y>=1900&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const fmt=n=>Math.max(0,Math.round(n)).toLocaleString("ja-JP");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uid=()=>Math.random().toString(36).slice(2,9);
  const STORAGE="life-dashboard:data:v1";

  function defaults(){
    return {birthDate:"",lifeYears:90,unitLabel:"目安の年齢",members:[],events:[],heatmaps:{}};
  }
  function load(){
    try{
      const s=JSON.parse(localStorage.getItem(STORAGE)||"null");
      if(!s)return defaults();
      if(typeof s!=="object"||!Array.isArray(s.members)||!Array.isArray(s.events))throw Error();
      return {...defaults(),birthDate:parseDate(s.birthDate)&&parseDate(s.birthDate)<=today()?s.birthDate:"",
        lifeYears:[80,90,100].includes(s.lifeYears)?s.lifeYears:90,
        members:s.members.filter(m=>m&&typeof m.id==="string").map(m=>({...m,id:uid(),name:String(m.name||"").slice(0,80),birthDate:parseDate(m.birthDate)&&parseDate(m.birthDate)<=today()?m.birthDate:""})),
        events:s.events.filter(e=>e&&typeof e.id==="string").map(e=>({...e,id:uid(),name:String(e.name||"").slice(0,120),start:parseDate(e.start)?e.start:"",end:parseDate(e.end)?e.end:"",color:/^#[0-9a-f]{6}$/i.test(e.color)?e.color:"#8b5cf6"})),
        heatmaps:s.heatmaps&&typeof s.heatmaps==="object"?s.heatmaps:{}};
    }catch(_){queueMicrotask(()=>{$("saveStatus").textContent="保存データを読み込めませんでした。ブラウザの保存設定を確認してください。"});return defaults()}
  }

  let state=load(),calendarMeta=null,timelineFilter="all",heatYear=new Date().getFullYear();
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$("saveStatus").textContent="このブラウザに保存しました。別の端末とは同期されません。"}catch(_){$("saveStatus").textContent="保存できませんでした。ブラウザの保存設定や空き容量を確認してください。この画面を閉じると変更が失われます。"}}

  function ageExact(birth,at=today()){return birth?Math.max(0,(at-birth)/DAY/YEAR_DAYS):0}
  function yearsUntil(date){return Math.max(0,(date-today())/DAY/YEAR_DAYS)}
  function birthdayAt(birth,age){return new Date(birth.getFullYear()+age,birth.getMonth(),birth.getDate(),12)}
  function targetLabel(){return `${state.unitLabel} ${state.lifeYears}歳`}

  function syncInputs(){
    $("birthDate").value=state.birthDate;
    $("lifeYears").value=state.lifeYears;
    $("unitLabel").value=state.unitLabel;
    document.querySelectorAll("[data-years]").forEach(b=>b.classList.toggle("active",Number(b.dataset.years)===Number(state.lifeYears)));
  }

  function validEvents(birth,totalWeeks){
    return state.events.map(e=>{
      const start=parseDate(e.start),end=parseDate(e.end)||(e.type==="period"?today():null);
      if(!start||start<birth||(e.type==="period"&&end<start))return null;
      const startWeek=Math.floor((start-birth)/WEEK);
      let endWeek=e.type==="period"&&end&&end>=start?Math.floor((end-birth)/WEEK):startWeek;
      endWeek=Math.max(startWeek,endWeek);
      if(startWeek>=totalWeeks)return null;
      return {...e,startDate:start,endDate:end,startWeek,endWeek:Math.min(totalWeeks-1,endWeek)};
    }).filter(Boolean);
  }

  function renderCore(){
    const birth=parseDate(state.birthDate),now=today();
    $("unitCaption").textContent=state.unitLabel;
    $("lifeTargetText").textContent=targetLabel();
    if(!birth||birth>now){
      ["remainingWeeks","livedWeeks","totalWeeks","healthWeeks","birthdayDays","birthdayText","livedYearsText","percent"].forEach(id=>$(id).textContent="—");$("progressBar").style.width="0%";$("eventLegend").innerHTML="";calendarMeta=null;
      $("canvasWrap").hidden=true;$("calendarEmpty").hidden=false;return;
    }
    const livedExact=(now-birth)/WEEK,lived=Math.floor(livedExact);
    const total=Math.round(state.lifeYears*YEAR_DAYS/7);
    const remaining=Math.max(0,total-lived);
    const progress=Math.min(100,Math.max(0,livedExact/total*100));
    const yearEnd=new Date(now.getFullYear()+1,0,1,12);
    $("remainingWeeks").textContent=fmt(remaining);
    $("livedWeeks").textContent=fmt(lived);
    $("totalWeeks").textContent=fmt(total);
    $("healthWeeks").textContent=fmt(Math.round((yearEnd-now)/DAY));
    $("percent").textContent=`${progress.toFixed(1)}%`;
    $("progressBar").style.width=`${progress}%`;
    $("livedYearsText").textContent=`約${ageExact(birth,now).toFixed(1)}年`;
    let next=new Date(now.getFullYear(),birth.getMonth(),birth.getDate(),12);
    if(next<now)next.setFullYear(next.getFullYear()+1);
    $("birthdayDays").textContent=fmt(Math.ceil((next-now)/DAY));
    $("birthdayText").textContent=`${next.getFullYear()-birth.getFullYear()}歳`;
    const events=validEvents(birth,total);
    renderEventLegend(events);
    $("canvasWrap").hidden=false;$("calendarEmpty").hidden=true;
    drawCalendar(total,lived,events);
  }

  function renderEventLegend(events){
    $("eventLegend").innerHTML=events.slice(0,8).map(e=>`<span class="event-chip"><i style="background:${e.color}"></i>${esc(e.name)}</span>`).join("");
  }

  function drawCalendar(totalWeeks,livedWeeks,events){
    const canvas=$("lifeCanvas"),wrap=$("canvasWrap"),cols=52,rows=Math.ceil(totalWeeks/cols);
    const dpr=Math.max(1,Math.min(2,devicePixelRatio||1)),w=Math.max(240,wrap.clientWidth||300);
    const left=25,right=4,top=10,bottom=9,gap=.7,available=w-left-right-gap*(cols-1);
    const cell=Math.max(3.7,available/cols),step=cell+gap,cellHeight=Math.min(6,cell),rowStep=cellHeight+gap,h=top+bottom+rows*rowStep+Math.ceil(rows/5);
    canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;canvas.width=w*dpr;canvas.height=h*dpr;
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const eventMap=new Map();
    events.forEach(e=>{for(let i=e.startWeek;i<=e.endWeek;i++){if(!eventMap.has(i))eventMap.set(i,[]);eventMap.get(i).push(e)}});
    ctx.font="7px -apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif";ctx.textAlign="right";ctx.textBaseline="middle";
    let y=top;const positions=[];
    for(let row=0;row<rows;row++){
      if(row&&row%5===0)y+=1;
      if(row%5===0){ctx.fillStyle="#8a94a3";ctx.fillText(`${row}`,left-4,y+cellHeight/2)}
      for(let col=0;col<cols;col++){
        const index=row*cols+col;if(index>=totalWeeks)break;
        const x=left+col*step,evs=eventMap.get(index)||[];
        ctx.fillStyle=evs.length?evs[evs.length-1].color:index<livedWeeks?"#202938":index===livedWeeks?"#f59e0b":"#dbe3ec";
        roundRect(ctx,x,y,cell,cellHeight,Math.min(1.1,cellHeight/3));ctx.fill();
        if(index===livedWeeks){ctx.strokeStyle="#f59e0b";ctx.lineWidth=2;ctx.strokeRect(x,y,cell,cellHeight)}
        positions.push({x,y,w:cell,h:cellHeight,index,row,col,events:evs});
      }y+=rowStep
    }
    calendarMeta={positions,livedWeeks};
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()
  }

  function renderFamily(){
    const now=today(),children=state.members.filter(m=>m.relation==="子"&&parseDate(m.birthDate));
    const metrics=[];
    children.forEach(child=>{
      const birth=parseDate(child.birthDate),eighteen=birthdayAt(birth,18),twentyTwo=birthdayAt(birth,22);
      metrics.push({name:`${child.name}が18歳まで`,number:fmt(Math.max(0,(eighteen-now)/WEEK)),unit:"週",note:`週末も約${fmt(Math.max(0,(eighteen-now)/WEEK))}回`});
      metrics.push({name:`${child.name}が22歳まで`,number:fmt(Math.max(0,(twentyTwo-now)/WEEK)),unit:"週",note:`あと約${yearsUntil(twentyTwo).toFixed(1)}年`});
    });
    if(!metrics.length)metrics.push({name:"子どもの情報",number:"—",unit:"",note:"編集タブで追加"});
    $("familyMetrics").innerHTML=metrics.map(metricHtml).join("");
    const currentYear=now.getFullYear(),years=[0,5,10,15,20,30].map(n=>currentYear+n);
    const members=[...(state.birthDate?[{name:"自分",birthDate:state.birthDate}]:[]),...state.members].filter(m=>parseDate(m.birthDate));
    $("ageTable").innerHTML=`<thead><tr><th>年</th>${members.map(m=>`<th>${esc(m.name)}</th>`).join("")}</tr></thead><tbody>`+
      years.map(y=>`<tr><td>${y}</td>${members.map(m=>{
        const b=parseDate(m.birthDate);return `<td>${Math.max(0,y-b.getFullYear())}歳</td>`
      }).join("")}</tr>`).join("")+`</tbody>`;
  }

  function metricHtml(m){return `<div class="metric"><div class="metric-name">${esc(m.name)}</div><div class="metric-number">${m.number}<span class="metric-unit">${m.unit}</span></div><div class="metric-note">${esc(m.note||"")}</div></div>`}

  function renderLife(){
    const birth=parseDate(state.birthDate),age=birth?ageExact(birth):0,years=Math.max(0,state.lifeYears-age);
    const weeks=Math.max(0,Math.round(years*YEAR_DAYS/7));
    const counts=[
      {name:"残りの夏",number:fmt(Math.ceil(years)),unit:"回",note:"1年に1回として"},
      {name:"残りの正月",number:fmt(Math.ceil(years)),unit:"回",note:"1年に1回として"},
      {name:"残りの週末",number:fmt(weeks),unit:"回",note:"1週に1回として"},
      {name:"残りの月",number:fmt(Math.ceil(years*12)),unit:"回",note:"約"}
    ];
    $("remainingCounts").innerHTML=birth?counts.map(metricHtml).join(""):`<p class="empty">生年月日を入力すると、これからの時間が表示されます。</p>`;
    if(birth)renderSeasons(age);else{$("seasonBar").innerHTML="";$("seasonCurrent").textContent="生年月日を入力してください";}
    renderTimeline(birth);
  }

  function renderSeasons(age){
    const max=Math.max(1,state.lifeYears);
    const defs=[
      {name:"育つ",start:0,end:18},{name:"試す",start:18,end:30},{name:"築く",start:30,end:45},
      {name:"深める",start:45,end:60},{name:"選ぶ",start:60,end:max}
    ].filter(s=>s.start<max).map(s=>({...s,end:Math.min(s.end,max)}));
    $("seasonBar").innerHTML=defs.map(s=>`<div class="season-segment ${age>=s.start&&age<s.end?"active":""}" style="flex:${Math.max(.1,s.end-s.start)}">${s.name}<br>${s.start}–${Math.round(s.end)}</div>`).join("");
    const current=defs.find(s=>age>=s.start&&age<s.end)||defs[defs.length-1];
    $("seasonCurrent").textContent=current?`ひとつの見方：${current.name}時期（${age.toFixed(1)}歳）`:"";
  }

  function renderTimeline(birth){
    const totalWeeks=Math.round(state.lifeYears*YEAR_DAYS/7);
    const events=birth?validEvents(birth,totalWeeks):[];
    const now=today();
    const currentWeek=birth?Math.max(0,Math.min(totalWeeks,Math.floor((now-birth)/WEEK))):0;
    const currentPercent=totalWeeks?currentWeek/totalWeeks*100:0;

    const ticks=[0,20,40,60,Math.round(state.lifeYears)]
      .filter((v,i,a)=>v<=state.lifeYears&&a.indexOf(v)===i);
    $("timelineAxis").innerHTML=ticks.map(x=>`<span>${x}歳</span>`).join("");

    if(!events.length){
      $("eventTimeline").innerHTML=`<div class="empty">編集タブでイベントを追加</div>`;
      $("eventMiniList").innerHTML="";
      $("timelineCount").textContent="";
      return;
    }

    const filtered=events.filter(e=>{
      const isFuture=e.startDate>now;
      return timelineFilter==="all" || (timelineFilter==="past"&&!isFuture) || (timelineFilter==="future"&&isFuture);
    });

    $("eventTimeline").innerHTML=filtered.map(e=>{
      const isFuture=e.startDate>now;
      const statusClass=isFuture?"future":"past";
      const left=Math.max(0,Math.min(100,e.startWeek/totalWeeks*100));
      const end=Math.max(left,Math.min(100,e.endWeek/totalWeeks*100));
      const width=Math.max(.8,end-left);

      const mark=e.type==="period"
        ?`<span class="timeline-bar ${statusClass}" style="left:${left}%;width:${width}%;${isFuture?`color:${e.color}`:`background:${e.color}`}"></span>`
        :`<span class="timeline-dot ${statusClass}" style="left:${left}%;${isFuture?`color:${e.color}`:`background:${e.color}`}"></span>`;

      const periodText=e.type==="period"&&e.end
        ?`${e.start}〜${e.end}`
        :e.start;

      return `<div class="timeline-row">
        <div class="timeline-name-wrap">
          <div class="timeline-name">${esc(e.name)}</div>
          <div class="timeline-meta">${periodText}</div>
        </div>
        <div class="timeline-track">
          <span class="timeline-now" style="left:${currentPercent}%"></span>
          ${mark}
        </div>
      </div>`;
    }).join("");

    const sorted=[...filtered].sort((a,b)=>a.startDate-b.startDate);
    $("eventMiniList").innerHTML=sorted.map(e=>{
      const isFuture=e.startDate>now;
      const status=isFuture?"予定":e.type==="period"&&e.endDate>=now?"進行中":"過去";
      const typeLabel=e.type==="period"?"期間":"1日";
      const dateText=e.type==="period"?`${e.start}〜${e.end||"現在"}`:e.start;
      return `<div class="event-mini">
        <div class="event-mini-main">
          <div class="event-mini-title">
            <i style="background:${e.color}"></i>
            <strong>${esc(e.name)}</strong>
          </div>
          <div class="event-mini-date">${dateText}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
          <span class="status-chip ${isFuture?"future":"past"}">${status}</span>
          <span class="status-chip period">${typeLabel}</span>
        </div>
      </div>`;
    }).join("");

    $("timelineCount").textContent=`${filtered.length}件`;
  }

  function weekNumber(d){
    const first=new Date(d.getFullYear(),0,1,12);
    return Math.max(1,Math.floor((d-first)/WEEK)+1)
  }

  function renderHeatmap(){
    const y=heatYear;
    const days=Math.round((new Date(y+1,0,1,12)-new Date(y,0,1,12))/DAY),length=Math.ceil(days/7);
    const saved=state.heatmaps[y];
    const values=Array.from({length},(_,i)=>Array.isArray(saved)&&Number.isInteger(saved[i])&&saved[i]>=0&&saved[i]<=4?saved[i]:0);
    state.heatmaps[y]=values;
    $("heatYear").textContent=y;$("nextYear").disabled=y>=today().getFullYear();
    const current=y===today().getFullYear()?weekNumber(today()):0;
    $("heatmap").innerHTML=values.map((level,i)=>`<button class="heat-week ${i+1===current?"current":""}" data-index="${i}" data-level="${level}" aria-label="${i+1}週目 充実度${level}" title="${i+1}週目：${level===0?'未記録':'充実度'+level}"><span>${i+1}</span></button>`).join("");
    const total=values.reduce((a,b)=>a+b,0);
    $("heatTotal").textContent=`記録 ${values.filter(v=>v>0).length}/${length}週・合計${total}`;
    $("heatmap").querySelectorAll(".heat-week").forEach(btn=>btn.addEventListener("click",()=>{
      const i=Number(btn.dataset.index);values[i]=(values[i]+1)%5;save();renderHeatmap()
    }))
  }

  function renderEditors(){
    $("memberEditor").innerHTML=state.members.map(m=>`
      <div class="editor-row" data-member="${m.id}">
        <div class="editor-grid three">
          <label>呼び名<input maxlength="80" class="m-name" value="${esc(m.name)}" placeholder="名前"></label>
          <label>関係<select class="m-relation"><option ${m.relation==="配偶者"?"selected":""}>配偶者</option><option ${m.relation==="子"?"selected":""}>子</option><option ${m.relation==="親"?"selected":""}>親</option><option ${m.relation==="その他"?"selected":""}>その他</option></select></label>

        </div>
        <label>生年月日<input class="m-date" type="date" value="${m.birthDate||""}" style="margin-top:6px"></label>
        <div class="editor-actions"><button class="delete-btn">削除</button></div>
      </div>`).join("");
    $("memberEditor").querySelectorAll(".editor-row").forEach(row=>{
      const m=state.members.find(x=>x.id===row.dataset.member);
      row.querySelector(".m-name").addEventListener("input",e=>{m.name=e.target.value;save();renderAll(false)});
      row.querySelector(".m-relation").addEventListener("change",e=>{m.relation=e.target.value;save();renderAll(false)});
      row.querySelector(".m-date").addEventListener("change",e=>{if(e.target.value&&(!parseDate(e.target.value)||parseDate(e.target.value)>today())){e.target.value=m.birthDate;$("saveStatus").textContent="生年月日は今日以前の日付を入力してください。";return;}m.birthDate=e.target.value;save();renderAll(false)});
      row.querySelector(".delete-btn").addEventListener("click",()=>{if(!confirm("この家族を削除しますか？"))return;state.members=state.members.filter(x=>x.id!==m.id);save();renderAll()})
    });

    $("eventEditor").innerHTML=state.events.map(e=>`
      <div class="editor-row" data-event="${e.id}">
        <div class="editor-grid three">
          <label>イベント名<input maxlength="120" class="e-name" value="${esc(e.name)}" placeholder="イベント名"></label>
          <label>種類<select class="e-type"><option value="point" ${e.type==="point"?"selected":""}>1日</option><option value="period" ${e.type==="period"?"selected":""}>期間</option></select></label>
          <label>色<input class="e-color" type="color" value="${e.color||"#8b5cf6"}"></label>
        </div>
        <div class="editor-grid" style="margin-top:6px">
          <label>開始日<input class="e-start" type="date" value="${e.start||""}"></label>
          <label>終了日（空欄なら現在まで）<input class="e-end" type="date" value="${e.end||""}" ${e.type==="point"?"disabled":""}></label>
        </div>
        <div class="editor-actions"><button class="delete-btn">削除</button></div>
      </div>`).join("");
    $("eventEditor").querySelectorAll(".editor-row").forEach(row=>{
      const e=state.events.find(x=>x.id===row.dataset.event);
      const update=()=>{save();renderAll(false)};
      row.querySelector(".e-name").addEventListener("input",x=>{e.name=x.target.value;update()});
      row.querySelector(".e-type").addEventListener("change",x=>{e.type=x.target.value;if(e.type==="point")e.end="";renderEditors();update()});
      row.querySelector(".e-color").addEventListener("input",x=>{e.color=x.target.value;update()});
      row.querySelector(".e-start").addEventListener("change",x=>{if(x.target.value&&(!parseDate(x.target.value)||(e.end&&x.target.value>e.end))){x.target.value=e.start;$("saveStatus").textContent="開始日と終了日の順序を確認してください。";return;}e.start=x.target.value;update()});
      row.querySelector(".e-end").addEventListener("change",x=>{if(x.target.value&&(!parseDate(x.target.value)||x.target.value<e.start)){x.target.value=e.end;$("saveStatus").textContent="終了日は開始日以降にしてください。";return;}e.end=x.target.value;update()});
      row.querySelector(".delete-btn").addEventListener("click",()=>{if(!confirm("このイベントを削除しますか？"))return;state.events=state.events.filter(x=>x.id!==e.id);save();renderAll()})
    })
  }

  function renderAll(editors=true){
    syncInputs();renderCore();renderFamily();renderLife();renderHeatmap();if(editors)renderEditors()
  }

  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${b.dataset.panel}`));
    document.querySelector(".start-card").hidden=b.dataset.panel!=="weeks";document.querySelectorAll(".nav-btn").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));tooltip.style.display="none";window.scrollTo({top:0,behavior:"smooth"});
    if(b.dataset.panel==="weeks")setTimeout(renderCore,60)
  }));

  document.querySelectorAll(".timeline-filter").forEach(btn=>btn.addEventListener("click",()=>{
    timelineFilter=btn.dataset.filter;
    document.querySelectorAll(".timeline-filter").forEach(x=>x.classList.toggle("active",x===btn));
    renderLife();
  }));

  $("birthDate").addEventListener("change",e=>{
    if(e.target.value&&(!parseDate(e.target.value)||parseDate(e.target.value)>today())){$("saveStatus").textContent="生年月日は1900年以降、今日以前の日付を入力してください。";syncInputs();return;}state.birthDate=e.target.value;
    const self=state.members.find(m=>m.relation==="本人");if(self)self.birthDate=e.target.value;
    save();renderAll(false)
  });
  document.querySelectorAll("[data-years]").forEach(b=>b.addEventListener("click",()=>{
    state.lifeYears=Number(b.dataset.years);state.unitLabel=b.dataset.label;save();renderAll(false)
  }));
  $("addMember").addEventListener("click",()=>{state.members.push({id:uid(),name:"",birthDate:"",relation:"その他"});save();renderEditors();$("memberEditor").lastElementChild.querySelector("input").focus()});
  $("addEvent").addEventListener("click",()=>{state.events.push({id:uid(),name:"",type:"point",start:iso(today()),end:"",color:"#8b5cf6"});save();renderAll();$("eventEditor").lastElementChild.querySelector("input").focus()});
  $("resetData").addEventListener("click",()=>{if(confirm("このブラウザに保存した生年月日・家族・イベント・週の記録をすべて削除しますか？")){state=defaults();heatYear=today().getFullYear();save();renderAll()}});
  let resizeTimer;
  window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderCore,100)});

  const tooltip=$("tooltip"),canvas=$("lifeCanvas");
  canvas.addEventListener("mousemove",showTip);canvas.addEventListener("touchstart",showTip,{passive:true});
  canvas.addEventListener("mouseleave",()=>tooltip.style.display="none");
  function showTip(ev){
    if(!calendarMeta)return;
    const rect=canvas.getBoundingClientRect(),p=ev.touches?ev.touches[0]:ev;
    const x=(p.clientX-rect.left)*(canvas.offsetWidth/rect.width),y=(p.clientY-rect.top)*(canvas.offsetHeight/rect.height);
    const c=calendarMeta.positions.find(q=>x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h);
    if(!c){tooltip.style.display="none";return}
    const status=c.index<calendarMeta.livedWeeks?"過去":c.index===calendarMeta.livedWeeks?"今週":"これから";
    tooltip.innerHTML=`誕生から${c.row}×52週・第${c.col+1}週<br>${fmt(c.index+1)}週目｜${status}${c.events.length?`<br><strong>${c.events.map(e=>esc(e.name)).join("・")}</strong>`:""}`;
    tooltip.style.display="block";tooltip.style.left=`${Math.min(innerWidth-150,p.clientX+10)}px`;tooltip.style.top=`${Math.max(6,p.clientY-50)}px`
  }

  $("prevYear").addEventListener("click",()=>{heatYear--;renderHeatmap()});
  $("nextYear").addEventListener("click",()=>{heatYear=Math.min(today().getFullYear(),heatYear+1);renderHeatmap()});
  $("birthDate").max=iso(today());$("birthDate").min="1900-01-01";
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)renderAll(false)});
  renderAll();
})();
