// Sidebar
function toggleSidebar(){const s=document.getElementById('sidebar'),b=document.getElementById('sidebar-backdrop');if(s&&b){s.classList.toggle('open');b.classList.toggle('open');}}
const sidebarState={pomodoro:true,quote:true};
function saveSidebarState(){localStorage.setItem('studyflow_sidebar',JSON.stringify(sidebarState));}
function loadSidebarState(){const r=localStorage.getItem('studyflow_sidebar');if(r){const s=JSON.parse(r);sidebarState.pomodoro=s.pomodoro??true;sidebarState.quote=s.quote??true;}applySidebarState();}
function applySidebarState(){['pomodoro','quote'].forEach(k=>{const el=document.getElementById('section-'+k);if(el)el.classList.toggle('collapsed',!sidebarState[k]);});}
function toggleSection(id){sidebarState[id]=!sidebarState[id];saveSidebarState();applySidebarState();}

// State
let tasks=[],activeFilter='all',activeTab='general',subjects=[],activeSubject=null;
const LS={tasks:'studyflow_tasks',subjects:'studyflow_subjects',sidebar:'studyflow_sidebar',theme:'studyflow_theme',timer:'studyflow_timer',pomo:'studyflow_pomo_settings'};
const get=k=>{const r=localStorage.getItem(k);return r?JSON.parse(r):null;};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function saveTasks(){set(LS.tasks,tasks);}
function loadTasks(){tasks=get(LS.tasks)||[];}
function saveSubjects(){set(LS.subjects,subjects);}
function loadSubjects(){subjects=get(LS.subjects)||[];}

// Tabs & Subjects
function switchTab(tab){
  activeTab=tab;
  document.getElementById('tab-general').classList.toggle('active',tab==='general');
  document.getElementById('tab-study').classList.toggle('active',tab==='study');
  document.getElementById('subject-folders').style.display=tab==='study'?'flex':'none';
  if(tab==='study'&&subjects.length>0&&!activeSubject)activeSubject=subjects[0];
  renderSubjects();renderTasks();
}
function renderSubjects(){
  const c=document.getElementById('subject-folders');c.innerHTML='';
  subjects.forEach(sub=>{
    const btn=document.createElement('button');
    btn.className='folder-btn'+(activeSubject===sub?' active':'');
    const sp=document.createElement('span');sp.textContent='📁 '+sub;btn.appendChild(sp);
    const del=document.createElement('span');
    del.innerHTML='&#x2715;';del.style.cssText='margin-left:.4rem;opacity:.5;font-size:.75rem';del.title='Delete Subject';
    del.onmouseover=()=>del.style.opacity='1';del.onmouseout=()=>del.style.opacity='.5';
    del.onclick=e=>{e.stopPropagation();if(confirm(`Delete subject "${sub}" and all its tasks?`))deleteSubject(sub);};
    btn.appendChild(del);btn.onclick=()=>{activeSubject=sub;renderSubjects();renderTasks();};
    c.appendChild(btn);
  });
  const a=document.createElement('button');a.className='add-folder-btn';a.textContent='+ New Subject';a.onclick=promptAddSubject;c.appendChild(a);
}
function promptAddSubject(){const n=prompt('Enter subject name:');if(n?.trim()){const s=n.trim();if(!subjects.includes(s)){subjects.push(s);saveSubjects();}activeSubject=s;renderSubjects();renderTasks();}}
function deleteSubject(sub){
  subjects=subjects.filter(s=>s!==sub);saveSubjects();
  const prev=tasks.length;tasks=tasks.filter(t=>!(t.taskType==='study'&&t.subject===sub));
  if(tasks.length!==prev)saveTasks();
  if(activeSubject===sub)activeSubject=subjects[0]||null;
  renderSubjects();renderTasks();showToast('🗑 Subject deleted');
}

// Task CRUD
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function addTask(title,desc,due,priority,dueTime,reminderMins){
  const t={id:uid(),title:title.trim(),desc:desc.trim(),due,dueTime:dueTime||null,reminderMins:reminderMins?+reminderMins:null,priority,done:false,createdAt:Date.now(),taskType:activeTab,subject:activeTab==='study'?activeSubject:null};
  tasks.unshift(t);saveTasks();scheduleReminder(t);return t;
}
function updateTask(id,title,desc,due,priority,dueTime,reminderMins){
  tasks=tasks.map(t=>t.id===id?{...t,title:title.trim(),desc:desc.trim(),due,priority,dueTime:dueTime||null,reminderMins:reminderMins?+reminderMins:null}:t);
  saveTasks();const t=tasks.find(t=>t.id===id);if(t)scheduleReminder(t);
}
function deleteTask(id){if(reminderTimeouts[id]){clearTimeout(reminderTimeouts[id]);delete reminderTimeouts[id];}tasks=tasks.filter(t=>t.id!==id);saveTasks();}
function toggleDone(id){
  tasks=tasks.map(t=>t.id===id?{...t,done:!t.done}:t);saveTasks();
  const t=tasks.find(t=>t.id===id);
  if(t?.done&&reminderTimeouts[id]){clearTimeout(reminderTimeouts[id]);delete reminderTimeouts[id];}
}

// Filtering & Sorting
function setFilter(f){
  activeFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));
  renderTasks();
  if(window.innerWidth<=768){const s=document.getElementById('sidebar'),b=document.getElementById('sidebar-backdrop');if(s)s.classList.remove('open');if(b)b.classList.remove('open');}
}
function getFilteredTasks(){
  const q=document.getElementById('search-input').value.trim().toLowerCase();
  return tasks.filter(t=>{
    const ms=!q||(t.title||'').toLowerCase().includes(q)||(t.desc||'').toLowerCase().includes(q);
    let mf=true;
    if(activeFilter==='pending')mf=!t.done;
    else if(activeFilter==='completed')mf=t.done;
    else if(['high','medium','low'].includes(activeFilter))mf=t.priority===activeFilter;
    const type=t.taskType||'general';
    const mt=activeTab==='general'?type==='general':(type==='study'&&t.subject===activeSubject);
    return ms&&mf&&mt;
  });
}
function getSortedTasks(arr){
  const m=document.getElementById('sort-select').value,p={high:0,medium:1,low:2};
  return[...arr].sort((a,b)=>{
    if(m==='date-asc')return new Date(a.due)-new Date(b.due);
    if(m==='date-desc')return new Date(b.due)-new Date(a.due);
    if(m==='priority-desc')return p[a.priority]-p[b.priority];
    if(m==='priority-asc')return p[b.priority]-p[a.priority];
    if(m==='created')return b.createdAt-a.createdAt;
    return 0;
  });
}

// Rendering
function formatDate(due){
  if(!due)return'';const d=new Date(due+'T00:00:00');if(isNaN(d))return due;
  const today=new Date();today.setHours(0,0,0,0);const diff=Math.round((d-today)/86400000);
  if(diff===0)return'Due today';if(diff===1)return'Due tomorrow';if(diff===-1)return'Due yesterday';
  if(diff<0)return`${Math.abs(diff)}d overdue`;if(diff<7)return`In ${diff} days`;
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
function createTaskCard(t){
  const card=document.createElement('div');
  card.className='task-card'+(t.done?' done':'');card.dataset.priority=t.priority;card.dataset.id=t.id;
  const due=t.due?new Date(t.due+'T00:00:00'):null,today=new Date();today.setHours(0,0,0,0);
  const overdue=due&&due<today&&!t.done,dateLabel=formatDate(t.due);
  card.innerHTML=`<div class="task-top"><div class="task-checkbox${t.done?' checked':''}" onclick="handleToggleDone('${t.id}')" title="${t.done?'Mark pending':'Mark done'}"></div><div class="task-title">${escapeHtml(t.title)}</div></div>${t.desc?`<div class="task-desc">${escapeHtml(t.desc)}</div>`:''}<div class="task-meta"><span class="badge badge-${t.priority}">${priorityIcon(t.priority)} ${capitalize(t.priority)}</span>${t.due?`<span class="badge ${overdue?'badge-overdue':'badge-date'}">&#128197; ${dateLabel}${t.dueTime?' · '+formatDueTime(t.dueTime):''}</span>`:''} ${t.reminderMins&&!t.done?`<span class="badge badge-date" title="Reminder set">🔔 ${formatReminderLabel(t.reminderMins)}</span>`:''}</div><div class="task-actions"><button class="action-btn" onclick="openModal('${t.id}')">&#9998; Edit</button><button class="action-btn delete" onclick="handleDelete('${t.id}')">&#128465; Delete</button></div>`;
  return card;
}
function renderTasks(){
  const grid=document.getElementById('task-grid');grid.innerHTML='';
  const mt=document.getElementById('main-title');
  if(mt)mt.innerHTML=activeTab==='general'?'General <em>Tasks</em>':(activeSubject?`${escapeHtml(activeSubject)} <em>Tasks</em>`:'Study <em>Tasks</em>');
  const filtered=getSortedTasks(getFilteredTasks());
  if(!filtered.length){
    let em=activeFilter==='all'?'No tasks yet':'Nothing here',sm=activeFilter==='all'?'Click "Add Task" to get started!':'Try a different filter.';
    if(activeTab==='study'&&!activeSubject){em='No subject selected';sm='Create a subject to add tasks.';}
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="big-icon">&#128218;</div><h3>${em}</h3><p>${sm}</p></div>`;
  }else{const f=document.createDocumentFragment();filtered.forEach(t=>f.appendChild(createTaskCard(t)));grid.appendChild(f);}
  renderStats();
}
function renderStats(){
  const tt=tasks.filter(t=>{const type=t.taskType||'general';return activeTab==='general'?type==='general':(type==='study'&&t.subject===activeSubject);});
  const total=tt.length,done=tt.filter(t=>t.done).length,pending=total-done;
  document.getElementById('stat-done').textContent=done;
  document.getElementById('stat-pending').textContent=pending;
  document.getElementById('stat-high').textContent=tt.filter(t=>t.priority==='high'&&!t.done).length;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('progress-bar').style.width=pct+'%';
  document.getElementById('progress-label').textContent=`${done} of ${total} done`;
  document.getElementById('count-all').textContent=total;
  document.getElementById('count-pending').textContent=pending;
  document.getElementById('count-completed').textContent=done;
  ['high','medium','low'].forEach(p=>document.getElementById('count-'+p).textContent=tt.filter(t=>t.priority===p).length);
  if(typeof refreshActiveTaskHighlight==='function')refreshActiveTaskHighlight();
}

// Event Handlers
function handleToggleDone(id){
  toggleDone(id);renderTasks();
  const t=tasks.find(t=>t.id===id);
  if(t?.done){showToast('✓ Task completed!');sendNotification('✅ Task Complete!',t.title+' has been marked as done. Great work!','✅');}
  else showToast('↩ Marked as pending');
}
function handleDelete(id){
  const t=tasks.find(t=>t.id===id);if(!t)return;
  if(!confirm(`Delete "${t.title}"?`))return;
  deleteTask(id);renderTasks();showToast('🗑 Task deleted');
}
function handleFormSubmit(e){
  e.preventDefault();
  const g=id=>document.getElementById(id).value;
  const title=g('task-title'),desc=g('task-desc'),due=g('task-due'),priority=g('task-priority'),dueTime=g('task-due-time'),reminderMins=g('task-reminder'),editId=g('edit-id');
  if(!title.trim()){document.getElementById('task-title').focus();return;}
  if(!due){document.getElementById('task-due').focus();return;}
  if(editId){updateTask(editId,title,desc,due,priority,dueTime,reminderMins);showToast('✏️ Task updated');}
  else{addTask(title,desc,due,priority,dueTime,reminderMins);showToast('✅ Task added');}
  closeModal();renderTasks();
}

// Modal
function openModal(editId=null){
  if(!editId&&activeTab==='study'&&!activeSubject){alert('Please create or select a subject folder first.');return;}
  const ov=document.getElementById('modal-overlay');
  document.getElementById('task-form').reset();
  document.getElementById('edit-id').value='';
  document.getElementById('modal-title-el').textContent='Add Task';
  document.getElementById('form-submit-btn').textContent='Add Task';
  if(editId){
    const t=tasks.find(t=>t.id===editId);if(!t)return;
    document.getElementById('edit-id').value=t.id;
    document.getElementById('task-title').value=t.title||'';
    document.getElementById('task-desc').value=t.desc||'';
    document.getElementById('task-due').value=t.due||'';
    document.getElementById('task-priority').value=t.priority||'medium';
    document.getElementById('task-due-time').value=t.dueTime||'';
    document.getElementById('task-reminder').value=t.reminderMins?String(t.reminderMins):'';
    document.getElementById('modal-title-el').textContent='Edit Task';
    document.getElementById('form-submit-btn').textContent='Save Changes';
  }else{document.getElementById('task-due').value=new Date().toISOString().split('T')[0];}
  updateDatetimePreview();updateChipsFromInputs();checkNotifPermissionBanner();
  ov.classList.add('open');document.getElementById('task-title').focus();
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function handleOverlayClick(e){if(e.target===document.getElementById('modal-overlay'))closeModal();}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

// Quotes
const fallbackQuotes=[
  {content:"The secret of getting ahead is getting started.",author:"Mark Twain"},
  {content:"You don't have to be great to start, but you have to start to be great.",author:"Zig Ziglar"},
  {content:"Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.",author:"Richard Feynman"},
  {content:"Success is the sum of small efforts, repeated day in and day out.",author:"Robert Collier"},
  {content:"The expert in anything was once a beginner.",author:"Helen Hayes"},
  {content:"Education is not the filling of a bucket, but the lighting of a fire.",author:"W.B. Yeats"},
];
async function fetchQuote(){
  const te=document.getElementById('quote-text'),ae=document.getElementById('quote-author');
  te.className='quote-loading';te.textContent='Fetching wisdom…';ae.textContent='';
  try{
    const r=await fetch('https://api.quotable.io/random?tags=education%7Cinspirational%7Cmotivational&maxLength=120');
    if(!r.ok)throw 0;const d=await r.json();te.className='';te.textContent=`"${d.content}"`;ae.textContent=`— ${d.author}`;
  }catch{const q=fallbackQuotes[Math.random()*fallbackQuotes.length|0];te.className='';te.textContent=`"${q.content}"`;ae.textContent=`— ${q.author}`;}
}

// Theme
function initTheme(){const s=localStorage.getItem('studyflow_theme')||'light';document.documentElement.setAttribute('data-theme',s);updateThemeBtn(s);}
function updateThemeBtn(t){document.getElementById('theme-btn').textContent=t==='dark'?'☀':'🌙';}
document.getElementById('theme-btn').addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme'),next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);localStorage.setItem('studyflow_theme',next);updateThemeBtn(next);
});
document.getElementById('search-input').addEventListener('input',renderTasks);

// Toast
function showToast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.getElementById('toast-container').appendChild(t);setTimeout(()=>t.remove(),2500);
}

// Utilities
function escapeHtml(s){const el=document.createElement('div');el.appendChild(document.createTextNode(s));return el.innerHTML;}
const capitalize=s=>s.charAt(0).toUpperCase()+s.slice(1);
const priorityIcon=p=>p==='high'?'🔴':p==='medium'?'🟡':'🟢';

// Pomodoro
const timerState={mode:'focus',timeLeft:25*60,isRunning:false,sessions:0,activeTaskId:null};
let pomoSettings={focusDuration:25,breakDuration:5},timerInterval=null;
function saveTimerState(){set(LS.timer,timerState);}
function loadTimerState(){
  const s=get(LS.timer);if(!s)return;
  timerState.mode=s.mode||'focus';timerState.timeLeft=s.timeLeft??getCurrentDuration();
  timerState.isRunning=false;timerState.sessions=s.sessions||0;timerState.activeTaskId=s.activeTaskId||null;
}
function savePomoSettings(){set(LS.pomo,pomoSettings);}
function loadPomoSettings(){const s=get(LS.pomo);if(s)pomoSettings={...pomoSettings,...s};}
function getActiveTimerTask(){
  const p=tasks.filter(t=>!t.done);
  if(timerState.activeTaskId){const t=p.find(t=>t.id===timerState.activeTaskId);if(t)return t;}
  return p[0]||null;
}
function getCurrentDuration(){
  if(timerState.mode==='break')return pomoSettings.breakDuration*60;
  const t=getActiveTimerTask();return(t?.customFocusTime||pomoSettings.focusDuration)*60;
}
const formatTime=s=>(s/60|0<10?'0':'')+(s/60|0)+':'+(s%60<10?'0':'')+(s%60);
function updateTimerDisplay(){
  const total=getCurrentDuration(),pct=total?(timerState.timeLeft/total*100):0;
  document.getElementById('pomo-time').textContent=formatTime(timerState.timeLeft);
  document.getElementById('pomo-mode-badge').textContent=timerState.mode==='focus'?'Focus':'Break';
  document.getElementById('pomodoro-card').setAttribute('data-pmode',timerState.mode);
  document.getElementById('pomo-ring-fill').style.width=Math.min(100,Math.max(0,pct))+'%';
  const isAtFull=timerState.timeLeft>=total;
  document.getElementById('pomo-start-btn').style.display=timerState.isRunning?'none':'';
  document.getElementById('pomo-pause-btn').style.display=timerState.isRunning?'':'none';
  if(!timerState.isRunning)document.getElementById('pomo-start-btn').textContent=isAtFull?'▶ Start':'▶ Resume';
  document.getElementById('pomo-session-count').textContent=timerState.sessions;
  refreshActiveTaskHighlight();
}
function refreshActiveTaskHighlight(){
  const strip=document.getElementById('pomo-active-task'),nameEl=document.getElementById('pomo-task-name'),t=getActiveTimerTask();
  if(timerState.mode==='focus'&&t){nameEl.textContent=t.title+(t.customFocusTime?` (${t.customFocusTime}m)`:'');strip.classList.add('visible');}
  else strip.classList.remove('visible');
}
function startTimer(){
  if(timerState.isRunning)return;timerState.isRunning=true;saveTimerState();updateTimerDisplay();
  timerInterval=setInterval(()=>{
    timerState.timeLeft-=1;
    if(timerState.timeLeft<=0){clearInterval(timerInterval);timerInterval=null;timerState.isRunning=false;onTimerEnd();}
    else{saveTimerState();updateTimerDisplay();}
  },1000);
}
function pauseTimer(){if(!timerState.isRunning)return;clearInterval(timerInterval);timerInterval=null;timerState.isRunning=false;saveTimerState();updateTimerDisplay();showToast('⏸ Timer paused');}
function resetTimer(){clearInterval(timerInterval);timerInterval=null;timerState.isRunning=false;timerState.mode='focus';timerState.timeLeft=getCurrentDuration();saveTimerState();updateTimerDisplay();showToast('🔄 Timer reset');}
function switchMode(){timerState.mode=timerState.mode==='focus'?'break':'focus';timerState.timeLeft=getCurrentDuration();timerState.isRunning=false;saveTimerState();updateTimerDisplay();}
function onTimerEnd(){
  if(timerState.mode==='focus'){timerState.sessions++;saveTimerState();showToast('🎉 Focus session complete! Time for a break.');setTimeout(()=>alert('Focus session complete! Time for a break.'),50);}
  else{showToast('☕ Break over — back to work!');setTimeout(()=>alert('Break over — back to work!'),50);}
  updateTimerDisplay();switchMode();
}

// Pomo Settings
function openPomoSettings(){
  const ov=document.getElementById('pomo-settings-overlay');
  document.getElementById('global-focus-time').value=pomoSettings.focusDuration;
  document.getElementById('global-break-time').value=pomoSettings.breakDuration;
  const sel=document.getElementById('pomo-active-task-select');
  sel.innerHTML='<option value="">-- No specific task (Use next pending) --</option>';
  tasks.filter(t=>!t.done).forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;sel.appendChild(o);});
  const at=getActiveTimerTask();
  if(at&&timerState.activeTaskId===at.id){sel.value=at.id;document.getElementById('custom-focus-time').value=at.customFocusTime||'';}
  else{sel.value='';document.getElementById('custom-focus-time').value='';}
  sel.onchange=e=>{const t=tasks.find(x=>x.id===e.target.value);document.getElementById('custom-focus-time').value=t?.customFocusTime||'';};
  ov.classList.add('open');
}
function closePomoSettings(){document.getElementById('pomo-settings-overlay').classList.remove('open');}
function handlePomoOverlayClick(e){if(e.target===document.getElementById('pomo-settings-overlay'))closePomoSettings();}
function resetPomoDefaults(){document.getElementById('global-focus-time').value=25;document.getElementById('global-break-time').value=5;document.getElementById('pomo-active-task-select').value='';document.getElementById('custom-focus-time').value='';}
function handlePomoSettingsSubmit(e){
  e.preventDefault();
  const ft=+document.getElementById('global-focus-time').value,bt=+document.getElementById('global-break-time').value;
  if(!ft||ft<1){document.getElementById('global-focus-time').focus();return;}
  if(!bt||bt<1){document.getElementById('global-break-time').focus();return;}
  pomoSettings.focusDuration=ft;pomoSettings.breakDuration=bt;savePomoSettings();
  const taskId=document.getElementById('pomo-active-task-select').value,cf=+document.getElementById('custom-focus-time').value;
  timerState.activeTaskId=taskId||null;saveTimerState();
  if(taskId){tasks=tasks.map(t=>t.id===taskId?{...t,customFocusTime:(cf&&cf>=1)?cf:null}:t);saveTasks();renderTasks();}
  const newDur=getCurrentDuration();
  timerState.timeLeft=timerState.isRunning?Math.min(timerState.timeLeft,newDur):newDur;
  saveTimerState();updateTimerDisplay();closePomoSettings();showToast('⚙️ Timer settings saved');
}

// Notifications & Reminders
const reminderTimeouts={};
function requestNotifPermission(){if(!('Notification'in window))return;Notification.requestPermission().then(p=>{checkNotifPermissionBanner();if(p==='granted')showToast('🔔 Notifications enabled!');});}
function checkNotifPermissionBanner(){
  const b=document.getElementById('notif-permission-banner');if(!b)return;
  const r=document.getElementById('task-reminder');
  b.style.display=(!('Notification'in window)||Notification.permission==='granted'||!r?.value)?'none':'flex';
}
async function sendNotification(title,body,icon){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  try{
    if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg){reg.showNotification(title,{body,icon:icon||'📚',badge:'📚',vibrate:[100,50,100],tag:'studyflow-'+Date.now()});return;}}
    const n=new Notification(title,{body,icon:icon||'📚',badge:'📚',tag:'studyflow-'+Date.now()});setTimeout(()=>n.close(),8000);
  }catch(e){console.error('Notification error',e);}
}
function scheduleReminder(task){
  if(reminderTimeouts[task.id]){clearTimeout(reminderTimeouts[task.id]);delete reminderTimeouts[task.id];}
  if(task.done||!task.due||!task.dueTime||!task.reminderMins)return;
  const due=new Date(task.due+'T'+task.dueTime);if(isNaN(due))return;
  const ms=due-task.reminderMins*60000-Date.now();
  if(ms<=0||ms>2147483647)return;
  reminderTimeouts[task.id]=setTimeout(()=>{
    delete reminderTimeouts[task.id];const live=tasks.find(t=>t.id===task.id);if(!live||live.done)return;
    const msg='Due in '+formatReminderLabel(live.reminderMins)+' at '+formatDueTime(live.dueTime)+". Don't forget!";
    sendNotification('⏰ Reminder: '+live.title,msg,'⏰');showToast('⏰ Reminder: '+live.title);
  },ms);
}
function rescheduleAllReminders(){tasks.forEach(t=>{if(!t.done)scheduleReminder(t);});}
function formatDueTime(s){if(!s)return'';const[h,m]=s.split(':').map(Number);return(h%12||12)+':'+(m+'').padStart(2,'0')+(h>=12?' PM':' AM');}
function formatReminderLabel(m){if(!m)return'';if(m<60)return m+'min before';if(m===60)return'1hr before';if(m===1440)return'1 day before';return(m/60)+'hr before';}
document.addEventListener('change',e=>{if(e.target?.id==='task-reminder')checkNotifPermissionBanner();});

// Datetime Chips
function setupDatetimeChips(){
  const di=document.getElementById('task-due'),ti=document.getElementById('task-due-time');
  document.querySelectorAll('.date-chip[data-date]').forEach(c=>c.addEventListener('click',()=>{
    const d=new Date();if(c.dataset.date==='tomorrow')d.setDate(d.getDate()+1);if(c.dataset.date==='next-week')d.setDate(d.getDate()+7);
    di.value=d.toISOString().split('T')[0];updateDatetimePreview();updateChipsFromInputs();
  }));
  document.querySelectorAll('.time-chip[data-time]').forEach(c=>c.addEventListener('click',()=>{ti.value=c.dataset.time;updateDatetimePreview();updateChipsFromInputs();}));
  document.getElementById('custom-date-btn').addEventListener('click',()=>{try{di.showPicker();}catch{di.focus();}});
  document.getElementById('custom-time-btn').addEventListener('click',()=>{try{ti.showPicker();}catch{ti.focus();}});
  di.addEventListener('change',()=>{updateDatetimePreview();updateChipsFromInputs();});
  ti.addEventListener('change',()=>{updateDatetimePreview();updateChipsFromInputs();});
}
function updateDatetimePreview(){
  const d=document.getElementById('task-due').value,t=document.getElementById('task-due-time').value;
  document.getElementById('preview-date').textContent=d?formatDate(d):'No date';
  document.getElementById('preview-time').textContent=t?' at '+formatDueTime(t):'';
}
function updateChipsFromInputs(){
  const di=document.getElementById('task-due'),ti=document.getElementById('task-due-time');
  const today=new Date().toISOString().split('T')[0];
  const tmrw=new Date();tmrw.setDate(tmrw.getDate()+1);const tmrwS=tmrw.toISOString().split('T')[0];
  const nw=new Date();nw.setDate(nw.getDate()+7);const nwS=nw.toISOString().split('T')[0];
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('active'));
  const map={'today':today,'tomorrow':tmrwS,'next-week':nwS};
  let matched=false;
  for(const[k,v]of Object.entries(map)){if(di.value===v){document.querySelector(`.date-chip[data-date="${k}"]`)?.classList.add('active');matched=true;break;}}
  if(!matched&&di.value)document.getElementById('custom-date-btn').classList.add('active');
  document.querySelectorAll('.time-chip').forEach(c=>c.classList.remove('active'));
  if(ti.value){const mc=document.querySelector(`.time-chip[data-time="${ti.value}"]`);if(mc)mc.classList.add('active');else document.getElementById('custom-time-btn').classList.add('active');}
}

// Init
(function init(){
  loadSidebarState();loadTasks();loadSubjects();initTheme();switchTab('general');fetchQuote();
  loadPomoSettings();loadTimerState();updateTimerDisplay();rescheduleAllReminders();setupDatetimeChips();
})();

// Service Worker
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(e=>console.log('SW registration failed:',e)));
