/* ============================================================
   PREMIUM STUDYFLOW APP LOGIC
   ============================================================ */

const APP_VERSION = '2.0.0';

// Global State
let state = {
  tasks: [],
  subjects: [],
  activeSubject: null,
  activeView: 'kanban', // 'kanban' | 'list'
  activeFilter: 'general', // 'general', 'subject', 'today', 'upcoming', 'important'
  theme: 'light',
  pomo: {
    mode: 'focus',
    timeLeft: 25 * 60,
    isRunning: false,
    sessions: 0,
    settings: { focus: 25, break: 5 }
  }
};

// DOM Elements
const DOM = {
  taskBoard: document.getElementById('task-board'),
  sidebarNav: document.getElementById('sidebar-nav'),
  subjectDashboard: document.getElementById('subject-dashboard'),
  mainHeader: document.getElementById('main-header'),
  taskModal: document.getElementById('task-modal'),
  toastContainer: document.getElementById('toast-container'),
  bottomNav: document.getElementById('mobile-bottom-nav')
};

// ==========================================
// INITIALIZATION & MIGRATION
// ==========================================
function initApp() {
  loadState();
  initTheme();
  setupEventListeners();
  renderApp();
  
  // Smart interval updates
  setInterval(() => {
    if (state.activeFilter === 'today' || state.activeFilter === 'upcoming') {
      renderTasks();
    }
    checkReminders();
  }, 60000);
}

function loadState() {
  try {
    const rawTasks = localStorage.getItem('studyflow_tasks');
    if (rawTasks) {
      state.tasks = JSON.parse(rawTasks).map(t => migrateTask(t));
    }
    const rawSubjects = localStorage.getItem('studyflow_subjects');
    if (rawSubjects) state.subjects = JSON.parse(rawSubjects);
    
    state.theme = localStorage.getItem('studyflow_theme') || 'light';
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function saveState() {
  localStorage.setItem('studyflow_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('studyflow_subjects', JSON.stringify(state.subjects));
  renderSidebar(); // Update counts
}

// Data migration for old tasks
function migrateTask(t) {
  if (!t.energy) t.energy = 'medium'; // low, medium, high (deep work)
  if (!t.status) t.status = t.done ? 'done' : 'todo'; // todo, in-progress, done
  return t;
}

// ==========================================
// RENDERING
// ==========================================
function renderApp() {
  renderSidebar();
  
  if (state.activeFilter === 'subject' && state.activeSubject) {
    DOM.subjectDashboard.classList.add('active');
    DOM.taskBoard.style.display = 'none';
    renderSubjectDashboard();
  } else {
    DOM.subjectDashboard.classList.remove('active');
    DOM.taskBoard.style.display = 'flex';
    renderTasks();
  }
}

function renderSidebar() {
  if (!DOM.sidebarNav) return;
  const todayCount = state.tasks.filter(t => isToday(t.due) && t.status !== 'done').length;
  const importantCount = state.tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
  
  let html = `
    <div class="nav-section">
      <div class="nav-label">General Tasks</div>
      <button class="nav-item ${state.activeFilter === 'general' ? 'active' : ''}" onclick="setFilter('general')">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        All Tasks
      </button>
      <button class="nav-item ${state.activeFilter === 'today' ? 'active' : ''}" onclick="setFilter('today')">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        Today
        ${todayCount > 0 ? `<span class="nav-badge">${todayCount}</span>` : ''}
      </button>
      <button class="nav-item ${state.activeFilter === 'important' ? 'active' : ''}" onclick="setFilter('important')">
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        Important
        ${importantCount > 0 ? `<span class="nav-badge">${importantCount}</span>` : ''}
      </button>
    </div>
    
    <div class="nav-section" style="margin-top: 1rem;">
      <div class="nav-label">Subject Workspaces
        <button onclick="addSubject()" style="color: var(--accent-primary); font-size: 1.2rem;">+</button>
      </div>
      ${state.subjects.map(sub => `
        <button class="nav-item ${state.activeFilter === 'subject' && state.activeSubject === sub ? 'active' : ''}" 
                onclick="setSubject('${escapeHtml(sub)}')">
          <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          ${escapeHtml(sub)}
        </button>
      `).join('')}
    </div>
  `;
  DOM.sidebarNav.innerHTML = html;
}

function renderTasks() {
  const tasks = getFilteredTasks();
  
  if (tasks.length === 0) {
    DOM.taskBoard.innerHTML = `
      <div class="empty-state" style="width: 100%;">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No tasks found</div>
        <p>You're all caught up! Enjoy your free time or add a new task.</p>
      </div>
    `;
    return;
  }

  if (state.activeView === 'kanban') {
    renderKanban(tasks);
  } else {
    renderList(tasks);
  }
}

function renderKanban(tasks) {
  const cols = [
    { id: 'todo', title: 'To Do' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'done', title: 'Completed' }
  ];
  
  let html = '<div class="kanban-board">';
  
  cols.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id);
    html += `
      <div class="kanban-column" data-status="${col.id}" ondragover="allowDrop(event)" ondrop="drop(event)">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span class="status-dot ${col.id}"></span> ${col.title}
          </div>
          <span class="kanban-count">${colTasks.length}</span>
        </div>
        <div class="kanban-list" id="list-${col.id}">
          ${colTasks.map(t => createTaskCardHTML(t)).join('')}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  DOM.taskBoard.innerHTML = html;
  attachDragEvents();
}

function renderList(tasks) {
  let html = '<div class="list-board">';
  html += tasks.map(t => createTaskCardHTML(t)).join('');
  html += '</div>';
  DOM.taskBoard.innerHTML = html;
}

function createTaskCardHTML(task) {
  const isDone = task.status === 'done';
  let badges = '';
  
  if (task.priority === 'high') badges += '<span class="tag tag-high">High</span>';
  if (task.energy === 'high') badges += '<span class="tag tag-energy">Deep Work</span>';
  if (task.due && !isDone) {
    const isLate = isOverdue(task.due, task.dueTime);
    badges += `<span class="tag tag-date ${isLate ? 'overdue' : ''}">📅 ${formatFriendlyDate(task.due)}</span>`;
  }

  return `
    <div class="task-card fade-in ${isDone ? 'is-done' : ''}" draggable="true" data-id="${task.id}">
      <div class="task-top">
        <div class="custom-checkbox ${isDone ? 'done' : ''}" onclick="toggleTaskStatus('${task.id}')"></div>
        <div class="task-content">
          <div class="task-title" onclick="editTask('${task.id}')">${escapeHtml(task.title)}</div>
          ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
          <div class="task-meta">${badges}</div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// DRAG AND DROP (KANBAN)
// ==========================================
function attachDragEvents() {
  const cards = document.querySelectorAll('.task-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function allowDrop(e) {
  e.preventDefault();
}

function drop(e) {
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  const column = e.target.closest('.kanban-column');
  if (!column) return;
  
  const newStatus = column.dataset.status;
  const task = state.tasks.find(t => t.id === id);
  
  if (task && task.status !== newStatus) {
    task.status = newStatus;
    if (newStatus === 'done') task.done = true;
    else task.done = false;
    
    saveState();
    renderTasks();
    if (newStatus === 'done') showToast('🎉 Task completed!');
  }
}

// ==========================================
// SUBJECT DASHBOARDS
// ==========================================
function renderSubjectDashboard() {
  if (!state.activeSubject) return;
  const subTasks = state.tasks.filter(t => t.subject === state.activeSubject);
  const total = subTasks.length;
  const done = subTasks.filter(t => t.status === 'done').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  
  const dash = DOM.subjectDashboard;
  dash.innerHTML = `
    <div class="header-section">
      <div>
        <h1 class="page-title">${escapeHtml(state.activeSubject)} Dashboard</h1>
        <p class="page-subtitle">Subject Workspace & Progress Tracking</p>
      </div>
      <div class="header-actions">
        <button class="primary-btn" style="background: var(--bg-elevated); color: var(--status-high);" onclick="deleteSubject('${escapeHtml(state.activeSubject)}')">
          Delete Subject
        </button>
      </div>
    </div>

    <div class="progress-ring-container fade-in">
      <svg viewBox="0 0 36 36" class="circular-chart">
        <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path class="circle" stroke="var(--accent-primary)" stroke-dasharray="${pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <text x="18" y="20.35" class="percentage">${pct}%</text>
      </svg>
      <div>
        <h3 style="font-family:'Outfit'; font-size:1.2rem; margin-bottom:0.2rem;">Course Progress</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem;">You have completed ${done} out of ${total} tasks for this subject.</p>
      </div>
    </div>

    <div class="stats-grid fade-in">
      <div class="stat-card">
        <div class="stat-value">${total - done}</div>
        <div class="stat-label">Pending Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--status-high)">
          ${subTasks.filter(t => t.priority === 'high' && t.status !== 'done').length}
        </div>
        <div class="stat-label">High Priority</div>
      </div>
    </div>
    
    <div style="margin-top: 2rem;">
      <h3 style="font-family:'Outfit'; margin-bottom: 1rem;">Subject Tasks</h3>
      <div class="list-board">
        ${subTasks.map(t => createTaskCardHTML(t)).join('')}
        ${subTasks.length === 0 ? '<p style="color:var(--text-secondary)">No tasks yet. Add one!</p>' : ''}
      </div>
    </div>
  `;
}

// ==========================================
// FILTERS & HELPERS
// ==========================================
function setFilter(filter) {
  state.activeFilter = filter;
  state.activeSubject = null;
  renderApp();
}

function setSubject(sub) {
  state.activeFilter = 'subject';
  state.activeSubject = sub;
  renderApp();
}

function toggleView(view) {
  state.activeView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  renderTasks();
}

function getFilteredTasks() {
  return state.tasks.filter(t => {
    if (state.activeFilter === 'general') return !t.subject;
    if (state.activeFilter === 'subject') return t.subject === state.activeSubject;
    if (state.activeFilter === 'today') return isToday(t.due) && !t.subject;
    if (state.activeFilter === 'important') return t.priority === 'high' && !t.subject;
    return true;
  });
}

// ==========================================
// TASK CRUD & UI INTERACTIONS
// ==========================================
function openTaskModal(id = null) {
  const m = DOM.taskModal;
  const form = document.getElementById('task-form');
  form.reset();
  
  // Setup Date/Time Chips
  setupDateTimeChips();
  
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    document.getElementById('task-id').value = t.id;
    document.getElementById('task-title').value = t.title;
    document.getElementById('task-desc').value = t.desc;
    document.getElementById('task-due').value = t.due || '';
    document.getElementById('task-time').value = t.dueTime || '';
    document.getElementById('task-priority').value = t.priority;
    document.getElementById('task-energy').value = t.energy;
    document.getElementById('modal-title').textContent = 'Edit Task';
  } else {
    document.getElementById('task-id').value = '';
    document.getElementById('modal-title').textContent = 'New Task';
  }
  
  m.classList.add('active');
}

function closeTaskModal() {
  DOM.taskModal.classList.remove('active');
}

document.getElementById('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const id = document.getElementById('task-id').value;
  const t = {
    id: id || Date.now().toString(),
    title: document.getElementById('task-title').value,
    desc: document.getElementById('task-desc').value,
    due: document.getElementById('task-due').value,
    dueTime: document.getElementById('task-time').value,
    priority: document.getElementById('task-priority').value,
    energy: document.getElementById('task-energy').value,
    status: id ? state.tasks.find(x => x.id === id).status : 'todo',
    done: id ? state.tasks.find(x => x.id === id).done : false,
    subject: state.activeFilter === 'subject' ? state.activeSubject : null
  };
  
  if (id) {
    state.tasks = state.tasks.map(x => x.id === id ? t : x);
    showToast('✏️ Task updated');
  } else {
    state.tasks.unshift(t);
    showToast('✅ Task created');
  }
  
  saveState();
  renderApp();
  closeTaskModal();
});

function toggleTaskStatus(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) {
    if (t.status === 'done') {
      t.status = 'todo';
      t.done = false;
    } else {
      t.status = 'done';
      t.done = true;
    }
    saveState();
    renderApp();
  }
}

function editTask(id) {
  openTaskModal(id);
}

// ==========================================
// SMART DATE / TIME CHIPS
// ==========================================
function setupDateTimeChips() {
  const dateInput = document.getElementById('task-due');
  const timeInput = document.getElementById('task-time');
  const preview = document.getElementById('datetime-preview');
  
  window.setDateChip = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    dateInput.value = d.toISOString().split('T')[0];
    updatePreview();
  };
  
  window.setTimeChip = (timeStr) => {
    timeInput.value = timeStr;
    updatePreview();
  };
  
  const updatePreview = () => {
    if(!dateInput.value) {
      preview.innerHTML = '<i>No due date</i>';
      return;
    }
    preview.innerHTML = `Due ${formatFriendlyDate(dateInput.value)} ${timeInput.value ? 'at ' + timeInput.value : ''}`;
  };
  
  dateInput.addEventListener('change', updatePreview);
  timeInput.addEventListener('change', updatePreview);
  updatePreview();
}

// ==========================================
// UTILITIES
// ==========================================
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  DOM.toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideUp 0.3s reverse';
    setTimeout(() => t.remove(), 250);
  }, 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isOverdue(dateStr, timeStr) {
  if (!dateStr) return false;
  const dtStr = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T23:59:59`;
  const dt = new Date(dtStr).getTime();
  return !isNaN(dt) && dt < Date.now();
}

function formatFriendlyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if(isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  
  if(diff === 0) return 'Today';
  if(diff === 1) return 'Tomorrow';
  if(diff === -1) return 'Yesterday';
  if(diff > 1 && diff < 7) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

// Theme
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('studyflow_theme', state.theme);
  document.documentElement.setAttribute('data-theme', state.theme);
}

// Subjects
function addSubject() {
  const name = prompt('Enter subject name:');
  if (name && name.trim()) {
    state.subjects.push(name.trim());
    saveState();
    showToast('📚 Subject added');
  }
}

function deleteSubject(name) {
  if(confirm(`Are you sure you want to delete ${name} and all its tasks?`)) {
    state.subjects = state.subjects.filter(s => s !== name);
    state.tasks = state.tasks.filter(t => t.subject !== name);
    state.activeFilter = 'general';
    state.activeSubject = null;
    saveState();
    renderApp();
    showToast('🗑️ Subject deleted');
  }
}

// App Boot
document.addEventListener('DOMContentLoaded', initApp);
