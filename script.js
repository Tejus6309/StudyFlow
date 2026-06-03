function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar && backdrop) {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('open');
      }
    }

    /* =============================================================
       SIDEBAR COLLAPSIBLE STATE
       ============================================================= */
    const sidebarState = {
      pomodoro: true,
      quote: true
    };

    function saveSidebarState() {
      localStorage.setItem('studyflow_sidebar', JSON.stringify(sidebarState));
    }

    function loadSidebarState() {
      const raw = localStorage.getItem('studyflow_sidebar');
      if (raw) {
        const saved = JSON.parse(raw);
        sidebarState.pomodoro = saved.pomodoro !== undefined ? saved.pomodoro : true;
        sidebarState.quote = saved.quote !== undefined ? saved.quote : true;
      }
      applySidebarState();
    }

    function applySidebarState() {
      const pomoSection = document.getElementById('section-pomodoro');
      const quoteSection = document.getElementById('section-quote');
      if (pomoSection) {
        if (sidebarState.pomodoro) pomoSection.classList.remove('collapsed');
        else pomoSection.classList.add('collapsed');
      }
      if (quoteSection) {
        if (sidebarState.quote) quoteSection.classList.remove('collapsed');
        else quoteSection.classList.add('collapsed');
      }
    }

    function toggleSection(sectionId) {
      sidebarState[sectionId] = !sidebarState[sectionId];
      saveSidebarState();
      applySidebarState();
    }

    /* =============================================================
       STATE
       tasks: array of task objects stored in / loaded from localStorage
       activeFilter: string controlling which tasks are rendered
       ============================================================= */
    let tasks = [];
    let activeFilter = 'all';
    let activeTab = 'general';
    let subjects = [];
    let activeSubject = null;

    /* =============================================================
       localStorage HELPERS
       Every time tasks change, saveTasks() serialises the array.
       loadTasks() deserialises on page load so data persists.
       ============================================================= */
    function saveTasks() {
      // localStorage only stores strings, so we JSON-stringify the array
      localStorage.setItem('studyflow_tasks', JSON.stringify(tasks));
    }

    function loadTasks() {
      const raw = localStorage.getItem('studyflow_tasks');
      tasks = raw ? JSON.parse(raw) : [];
    }

    function saveSubjects() {
      localStorage.setItem('studyflow_subjects', JSON.stringify(subjects));
    }

    function loadSubjects() {
      const raw = localStorage.getItem('studyflow_subjects');
      subjects = raw ? JSON.parse(raw) : [];
    }

    /* =============================================================
       TABS & SUBJECTS
       ============================================================= */
    function switchTab(tab) {
      activeTab = tab;
      document.getElementById('tab-general').classList.toggle('active', tab === 'general');
      document.getElementById('tab-study').classList.toggle('active', tab === 'study');
      document.getElementById('subject-folders').style.display = tab === 'study' ? 'flex' : 'none';

      if (tab === 'study' && subjects.length > 0 && !activeSubject) {
        activeSubject = subjects[0];
      }

      renderSubjects();
      renderTasks();
    }

    function renderSubjects() {
      const container = document.getElementById('subject-folders');
      container.innerHTML = '';

      subjects.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'folder-btn' + (activeSubject === sub ? ' active' : '');

        const textSpan = document.createElement('span');
        textSpan.textContent = '📁 ' + sub;
        btn.appendChild(textSpan);

        const delBtn = document.createElement('span');
        delBtn.innerHTML = '&#x2715;';
        delBtn.style.marginLeft = '0.4rem';
        delBtn.style.opacity = '0.5';
        delBtn.style.fontSize = '0.75rem';
        delBtn.title = 'Delete Subject';
        delBtn.onmouseover = () => delBtn.style.opacity = '1';
        delBtn.onmouseout = () => delBtn.style.opacity = '0.5';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Delete subject "${sub}" and all its tasks?`)) {
            deleteSubject(sub);
          }
        };
        btn.appendChild(delBtn);

        btn.onclick = () => {
          activeSubject = sub;
          renderSubjects();
          renderTasks();
        };
        container.appendChild(btn);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'add-folder-btn';
      addBtn.textContent = '+ New Subject';
      addBtn.onclick = promptAddSubject;
      container.appendChild(addBtn);
    }

    function promptAddSubject() {
      const name = prompt('Enter subject name:');
      if (name && name.trim()) {
        const sub = name.trim();
        if (!subjects.includes(sub)) {
          subjects.push(sub);
          saveSubjects();
        }
        activeSubject = sub;
        renderSubjects();
        renderTasks();
      }
    }

    function deleteSubject(sub) {
      subjects = subjects.filter(s => s !== sub);
      saveSubjects();

      const oldLen = tasks.length;
      tasks = tasks.filter(t => !(t.taskType === 'study' && t.subject === sub));
      if (tasks.length !== oldLen) saveTasks();

      if (activeSubject === sub) {
        activeSubject = subjects.length > 0 ? subjects[0] : null;
      }

      renderSubjects();
      renderTasks();
      showToast('🗑 Subject deleted');
    }

    /* =============================================================
       TASK CRUD
       ============================================================= */

    /** Creates a unique ID using timestamp + random suffix */
    function uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    /** Adds a new task object to the array and persists it */
    function addTask(title, desc, due, priority, dueTime, reminderMins) {
      const task = {
        id: uid(),
        title: title.trim(),
        desc: desc.trim(),
        due,
        dueTime: dueTime || null,
        reminderMins: reminderMins ? parseInt(reminderMins, 10) : null,
        priority,
        done: false,
        createdAt: Date.now(),
        taskType: activeTab,
        subject: activeTab === 'study' ? activeSubject : null
      };
      tasks.unshift(task);
      saveTasks();
      scheduleReminder(task);
      return task;
    }

    /** Replaces an existing task's fields while preserving id, done, createdAt */
    function updateTask(id, title, desc, due, priority, dueTime, reminderMins) {
      tasks = tasks.map(t =>
        t.id === id ? { ...t, title: title.trim(), desc: desc.trim(), due, priority, dueTime: dueTime || null, reminderMins: reminderMins ? parseInt(reminderMins, 10) : null } : t
      );
      saveTasks();
      const updated = tasks.find(t => t.id === id);
      if (updated) scheduleReminder(updated);
    }

    /** Removes a task by id */
    function deleteTask(id) {
      firedReminders.delete(id);
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
    }

    /** Flips the done boolean for a task */
    function toggleDone(id) {
      tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
      saveTasks();
      const t = tasks.find(t => t.id === id);
      if (t && t.done) {
        firedReminders.delete(id);
      } else if (t && !t.done) {
        scheduleReminder(t);
      }
    }

    /* =============================================================
       FILTERING & SORTING
       ============================================================= */

    /** Sets the active filter, updates sidebar button styles, re-renders */
    function setFilter(filter) {
      activeFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
      });
      renderTasks();

      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
      }
    }

    /** Returns tasks matching the active filter and search query */
    function getFilteredTasks() {
      const query = document.getElementById('search-input').value.trim().toLowerCase();
      return tasks.filter(t => {
        // 1. text search across title + description
        const matchesSearch = !query ||
          (t.title || '').toLowerCase().includes(query) ||
          (t.desc || '').toLowerCase().includes(query);

        // 2. sidebar filter
        let matchesFilter = true;
        if (activeFilter === 'pending') matchesFilter = !t.done;
        if (activeFilter === 'completed') matchesFilter = t.done;
        if (activeFilter === 'high') matchesFilter = t.priority === 'high';
        if (activeFilter === 'medium') matchesFilter = t.priority === 'medium';
        if (activeFilter === 'low') matchesFilter = t.priority === 'low';

        // 3. tab filter
        let matchesTab = false;
        const tType = t.taskType || 'general';
        if (activeTab === 'general') {
          matchesTab = (tType === 'general');
        } else {
          matchesTab = (tType === 'study' && t.subject === activeSubject);
        }

        return matchesSearch && matchesFilter && matchesTab;
      });
    }

    /** Returns a copy of the array sorted by the select dropdown value */
    function getSortedTasks(arr) {
      const mode = document.getElementById('sort-select').value;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return [...arr].sort((a, b) => {
        if (mode === 'date-asc') return new Date(a.due) - new Date(b.due);
        if (mode === 'date-desc') return new Date(b.due) - new Date(a.due);
        if (mode === 'priority-desc') return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (mode === 'priority-asc') return priorityOrder[b.priority] - priorityOrder[a.priority];
        if (mode === 'created') return b.createdAt - a.createdAt;
        return 0;
      });
    }

    /* =============================================================
       DOM RENDERING
       renderTasks() clears #task-grid and rebuilds it entirely from
       the current tasks array — pure DOM manipulation, no frameworks.
       ============================================================= */

    /** Formats a due date string into a readable label */
    function formatDate(due) {
      if (!due) return '';
      const d = new Date(due + 'T00:00:00'); // force local time
      if (isNaN(d.getTime())) return due; // fallback if date is invalid
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / 86400000); // days from today

      if (diff === 0) return 'Due today';
      if (diff === 1) return 'Due tomorrow';
      if (diff === -1) return 'Due yesterday';
      if (diff < 0) return `${Math.abs(diff)}d overdue`;
      if (diff < 7) return `In ${diff} days`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    /** Creates a task card DOM node */
    function createTaskCard(task) {
      const card = document.createElement('div');
      card.className = 'task-card' + (task.done ? ' done' : '');
      card.dataset.priority = task.priority;
      card.dataset.id = task.id;

      const due = task.due ? new Date(task.due + 'T00:00:00') : null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const overdue = due && due < today && !task.done;
      const dateLabel = formatDate(task.due);
      const dateBadgeClass = overdue ? 'badge badge-overdue' : 'badge badge-date';

      card.innerHTML = `
    <div class="task-top">
      <div class="task-checkbox${task.done ? ' checked' : ''}"
           onclick="handleToggleDone('${task.id}')"
           title="${task.done ? 'Mark pending' : 'Mark done'}"></div>
      <div class="task-title">${escapeHtml(task.title)}</div>
    </div>
    ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
    <div class="task-meta">
      <span class="badge badge-${task.priority}">
        ${priorityIcon(task.priority)} ${capitalize(task.priority)}
      </span>
      ${task.due ? `<span class="${dateBadgeClass}">&#128197; ${dateLabel}${task.dueTime ? ' · ' + formatDueTime(task.dueTime) : ''}</span>` : ''}
      ${task.reminderMins && !task.done ? `<span class="badge badge-date" title="Reminder set">🔔 ${formatReminderLabel(task.reminderMins)}</span>` : ''}
    </div>
    <div class="task-actions">
      <button class="action-btn" onclick="openModal('${task.id}')">&#9998; Edit</button>
      <button class="action-btn delete" onclick="handleDelete('${task.id}')">&#128465; Delete</button>
    </div>`;
      return card;
    }

    /** Renders all tasks into #task-grid and updates stats / counts */
    function renderTasks() {
      const grid = document.getElementById('task-grid');
      grid.innerHTML = '';

      const mainTitle = document.getElementById('main-title');
      if (mainTitle) {
        if (activeTab === 'general') {
          mainTitle.innerHTML = 'General <em>Tasks</em>';
        } else {
          mainTitle.innerHTML = activeSubject ? `${escapeHtml(activeSubject)} <em>Tasks</em>` : 'Study <em>Tasks</em>';
        }
      }

      const filtered = getSortedTasks(getFilteredTasks());

      if (filtered.length === 0) {
        let emptyMsg = activeFilter === 'all' ? 'No tasks yet' : 'Nothing here';
        if (activeTab === 'study' && !activeSubject) emptyMsg = 'No subject selected';

        let subMsg = activeFilter === 'all' ? 'Click "Add Task" to get started!' : 'Try a different filter.';
        if (activeTab === 'study' && !activeSubject) subMsg = 'Create a subject to add tasks.';

        grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="big-icon">&#128218;</div>
        <h3>${emptyMsg}</h3>
        <p>${subMsg}</p>
      </div>`;
      } else {
        // DocumentFragment batches DOM writes for performance
        const frag = document.createDocumentFragment();
        filtered.forEach(t => frag.appendChild(createTaskCard(t)));
        grid.appendChild(frag);
      }

      renderStats();
    }

    /** Updates sidebar counts and progress bar */
    function renderStats() {
      const tabTasks = tasks.filter(t => {
        const tType = t.taskType || 'general';
        if (activeTab === 'general') return tType === 'general';
        return tType === 'study' && t.subject === activeSubject;
      });

      const total = tabTasks.length;
      const done = tabTasks.filter(t => t.done).length;
      const pending = total - done;
      const highCount = tabTasks.filter(t => t.priority === 'high' && !t.done).length;

      document.getElementById('stat-done').textContent = done;
      document.getElementById('stat-pending').textContent = pending;
      document.getElementById('stat-high').textContent = highCount;

      const pct = total ? Math.round(done / total * 100) : 0;
      document.getElementById('progress-bar').style.width = pct + '%';
      document.getElementById('progress-label').textContent = `${done} of ${total} done`;

      document.getElementById('count-all').textContent = total;
      document.getElementById('count-pending').textContent = pending;
      document.getElementById('count-completed').textContent = done;
      document.getElementById('count-high').textContent = tabTasks.filter(t => t.priority === 'high').length;
      document.getElementById('count-medium').textContent = tabTasks.filter(t => t.priority === 'medium').length;
      document.getElementById('count-low').textContent = tabTasks.filter(t => t.priority === 'low').length;

      // Keep Pomodoro "Focusing on" strip in sync with current task list
      if (typeof refreshActiveTaskHighlight === 'function') refreshActiveTaskHighlight();
    }

    /* =============================================================
       EVENT HANDLERS
       ============================================================= */

    /** Handles toggle-done button: updates state and re-renders */
    function handleToggleDone(id) {
      toggleDone(id);
      renderTasks();
      const t = tasks.find(t => t.id === id);
      if (t && t.done) {
        showToast('✓ Task completed!');
        sendNotification('✅ Task Complete!', t.title + ' has been marked as done. Great work!', '✅');
      } else {
        showToast('↩ Marked as pending');
      }
    }

    /** Handles delete button with a small confirmation */
    function handleDelete(id) {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      if (!confirm(`Delete "${t.title}"?`)) return;
      deleteTask(id);
      renderTasks();
      showToast('🗑 Task deleted');
    }

    /** Handles form submit for both Add and Edit */
    function handleFormSubmit(e) {
      e.preventDefault();

      const title = document.getElementById('task-title').value;
      const desc = document.getElementById('task-desc').value;
      const due = document.getElementById('task-due').value;
      const priority = document.getElementById('task-priority').value;
      const dueTime = document.getElementById('task-due-time').value;
      const reminderMins = document.getElementById('task-reminder').value;
      const editId = document.getElementById('edit-id').value;

      if (!title.trim()) { document.getElementById('task-title').focus(); return; }
      if (!due) { document.getElementById('task-due').focus(); return; }

      if (editId) {
        updateTask(editId, title, desc, due, priority, dueTime, reminderMins);
        showToast('✏️ Task updated');
      } else {
        addTask(title, desc, due, priority, dueTime, reminderMins);
        showToast('✅ Task added');
      }

      closeModal();
      renderTasks();
    }

    /* =============================================================
       MODAL OPEN / CLOSE
       DOM: toggling .open class controls visibility via CSS transitions
       ============================================================= */

    function openModal(editId = null) {
      if (!editId && activeTab === 'study' && !activeSubject) {
        alert('Please create or select a subject folder first.');
        return;
      }

      const overlay = document.getElementById('modal-overlay');
      const form = document.getElementById('task-form');
      form.reset();
      document.getElementById('edit-id').value = '';
      document.getElementById('modal-title-el').textContent = 'Add Task';
      document.getElementById('form-submit-btn').textContent = 'Add Task';

      if (editId) {
        const t = tasks.find(t => t.id === editId);
        if (!t) return;
        document.getElementById('edit-id').value = t.id;
        document.getElementById('task-title').value = t.title || '';
        document.getElementById('task-desc').value = t.desc || '';
        document.getElementById('task-due').value = t.due || '';
        document.getElementById('task-priority').value = t.priority || 'medium';
        document.getElementById('task-due-time').value = t.dueTime || '';
        document.getElementById('task-reminder').value = t.reminderMins ? String(t.reminderMins) : '';
        document.getElementById('modal-title-el').textContent = 'Edit Task';
        document.getElementById('form-submit-btn').textContent = 'Save Changes';
      } else {
        // default to today
        const today = new Date();
        document.getElementById('task-due').value = today.toISOString().split('T')[0];
      }
      
      updateDatetimePreview();
      updateChipsFromInputs();
      checkNotifPermissionBanner();

      overlay.classList.add('open');
      document.getElementById('task-title').focus();
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('open');
    }

    /** Closes modal when clicking the dark overlay background */
    function handleOverlayClick(e) {
      if (e.target === document.getElementById('modal-overlay')) closeModal();
    }

    /** Keyboard: Escape closes modal */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    /* =============================================================
       FETCH API — Motivational Quotes
       Fetches a random quote from the public quotable.io API.
       On failure, falls back to a local array of study quotes.
       ============================================================= */
    const fallbackQuotes = [
      { content: "The secret of getting ahead is getting started.", author: "Mark Twain" },
      { content: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
      { content: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
      { content: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
      { content: "The expert in anything was once a beginner.", author: "Helen Hayes" },
      { content: "Education is not the filling of a bucket, but the lighting of a fire.", author: "W.B. Yeats" },
    ];

    /** Fetches a motivational quote and updates the sidebar quote card.
        Uses the Fetch API — a browser-native way to make HTTP requests. */
    async function fetchQuote() {
      const textEl = document.getElementById('quote-text');
      const authorEl = document.getElementById('quote-author');
      textEl.className = 'quote-loading';
      textEl.textContent = 'Fetching wisdom…';
      authorEl.textContent = '';

      try {
        // Fetch API: returns a Promise that resolves to a Response object
        const res = await fetch('https://api.quotable.io/random?tags=education%7Cinspirational%7Cmotivational&maxLength=120');
        if (!res.ok) throw new Error('Network response not ok');
        const data = await res.json();        // parse JSON body
        textEl.className = '';
        textEl.textContent = `"${data.content}"`;
        authorEl.textContent = `— ${data.author}`;
      } catch (_) {
        // API failed → use local fallback quotes
        const q = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        textEl.className = '';
        textEl.textContent = `"${q.content}"`;
        authorEl.textContent = `— ${q.author}`;
      }
    }

    /* =============================================================
       DARK MODE
       Reads saved preference from localStorage and toggles on click.
       ============================================================= */
    function initTheme() {
      const saved = localStorage.getItem('studyflow_theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      updateThemeBtn(saved);
    }

    function updateThemeBtn(theme) {
      document.getElementById('theme-btn').textContent = theme === 'dark' ? '☀' : '🌙';
    }

    document.getElementById('theme-btn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('studyflow_theme', next);
      updateThemeBtn(next);
    });

    /* =============================================================
       SEARCH — live filtering on every keystroke
       ============================================================= */
    document.getElementById('search-input').addEventListener('input', renderTasks);

    /* =============================================================
       TOAST NOTIFICATIONS
       Creates a small DOM element, auto-removes it after 2.5 seconds.
       ============================================================= */
    function showToast(msg) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }

    /* =============================================================
       UTILITY HELPERS
       ============================================================= */
    function escapeHtml(str) {
      const el = document.createElement('div');
      el.appendChild(document.createTextNode(str));
      return el.innerHTML;
    }

    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function priorityIcon(p) {
      return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
    }

    /* =============================================================
       POMODORO TIMER
       Concepts used: objects, functions, setInterval/clearInterval,
       DOM manipulation, events, localStorage.
       ============================================================= */

    /* --- Timer State Object ---
       A single object holds all timer state so it's easy to
       serialise to localStorage and restore on reload.             */
    const timerState = {
      mode: 'focus',   // 'focus' | 'break'
      timeLeft: 25 * 60,   // seconds remaining
      isRunning: false,
      sessions: 0,         // completed focus sessions today
      activeTaskId: null      // explicitly selected task
    };

    /* Global Pomodoro Settings */
    let pomoSettings = {
      focusDuration: 25, // minutes
      breakDuration: 5   // minutes
    };

    /* Background Web Worker and Fallback Ticker State */
    let worker = null;
    let fallbackInterval = null;
    const firedReminders = new Set();

    /* --- localStorage helpers for timer state ---
       Keys are namespaced to avoid collision with task storage.    */
    function saveTimerState() {
      localStorage.setItem('studyflow_timer', JSON.stringify(timerState));
    }

    function loadTimerState() {
      const raw = localStorage.getItem('studyflow_timer');
      if (!raw) return;                       // nothing saved yet
      const saved = JSON.parse(raw);
      // Merge saved values into timerState object
      timerState.mode = saved.mode || 'focus';
      timerState.sessions = saved.sessions || 0;
      timerState.activeTaskId = saved.activeTaskId || null;

      if (saved.targetEndTime && saved.isRunning) {
        timerState.targetEndTime = saved.targetEndTime;
        const now = Date.now();
        const secondsLeft = Math.max(0, Math.ceil((saved.targetEndTime - now) / 1000));
        if (secondsLeft > 0) {
          timerState.timeLeft = secondsLeft;
          timerState.isRunning = true;
        } else {
          timerState.timeLeft = 0;
          timerState.isRunning = false;
          setTimeout(() => {
            onTimerEnd();
          }, 1000);
        }
      } else {
        timerState.timeLeft = saved.timeLeft != null ? saved.timeLeft : getCurrentDuration();
        timerState.isRunning = false;
      }
    }

    function savePomoSettings() {
      localStorage.setItem('studyflow_pomo_settings', JSON.stringify(pomoSettings));
    }

    function loadPomoSettings() {
      const raw = localStorage.getItem('studyflow_pomo_settings');
      if (raw) {
        pomoSettings = { ...pomoSettings, ...JSON.parse(raw) };
      }
    }

    function getActiveTimerTask() {
      const pending = tasks.filter(t => !t.done);
      if (timerState.activeTaskId) {
        const t = pending.find(task => task.id === timerState.activeTaskId);
        if (t) return t;
      }
      return pending.length > 0 ? pending[0] : null;
    }

    function getCurrentDuration() {
      if (timerState.mode === 'break') {
        return pomoSettings.breakDuration * 60;
      }
      const activeTask = getActiveTimerTask();
      if (activeTask && activeTask.customFocusTime) {
        return activeTask.customFocusTime * 60;
      }
      return pomoSettings.focusDuration * 60;
    }

    /* --- DOM helpers ---
       All UI updates go through these functions (no inline HTML
       manipulation in logic functions).                            */

    /** Formats a raw seconds count into "MM:SS" string */
    function formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    /** Updates every part of the timer UI from the current state */
    function updateTimerDisplay() {
      const card = document.getElementById('pomodoro-card');
      const timeEl = document.getElementById('pomo-time');
      const badgeEl = document.getElementById('pomo-mode-badge');
      const fillEl = document.getElementById('pomo-ring-fill');
      const startBtn = document.getElementById('pomo-start-btn');
      const pauseBtn = document.getElementById('pomo-pause-btn');
      const countEl = document.getElementById('pomo-session-count');

      // Clock face
      timeEl.textContent = formatTime(timerState.timeLeft);

      // Mode badge text and card colour scheme (via data attribute)
      const modeLabel = timerState.mode === 'focus' ? 'Focus' : 'Break';
      badgeEl.textContent = modeLabel;
      card.setAttribute('data-pmode', timerState.mode);

      // Progress ring fill: percentage of total duration remaining
      const total = getCurrentDuration();
      const pct = total > 0 ? (timerState.timeLeft / total) * 100 : 0;
      fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';

      // Show Start or Pause based on running state
      if (timerState.isRunning) {
        startBtn.style.display = 'none';
        pauseBtn.style.display = '';
      } else {
        startBtn.style.display = '';
        pauseBtn.style.display = 'none';
        // Label the start button differently if timer was paused mid-way
        const isAtFull = timerState.timeLeft >= total;
        startBtn.textContent = isAtFull ? '▶ Start' : '▶ Resume';
      }

      // Session counter
      countEl.textContent = timerState.sessions;

      // Highlight active task if any pending task exists
      refreshActiveTaskHighlight();
    }

    /** Shows the explicitly selected task or first pending task in the "Focusing on" strip */
    function refreshActiveTaskHighlight() {
      const strip = document.getElementById('pomo-active-task');
      const nameEl = document.getElementById('pomo-task-name');

      const activeTask = getActiveTimerTask();

      if (timerState.mode === 'focus' && activeTask) {
        let labelText = activeTask.title;
        if (activeTask.customFocusTime) {
          labelText += ` (${activeTask.customFocusTime}m)`;
        }
        nameEl.textContent = labelText;
        strip.classList.add('visible');
      } else {
        strip.classList.remove('visible');
      }
    }

    /* --- Core Timer Logic --- */

    function initWorker() {
      try {
        const workerCode = `
          setInterval(() => {
            self.postMessage('tick');
          }, 1000);
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = function (e) {
          if (e.data === 'tick') {
            handleTick();
          }
        };
      } catch (err) {
        console.warn('Web Worker not supported or blocked, using fallback interval', err);
        worker = null;
      }

      // If worker failed to initialize, run fallbackInterval
      if (!worker && !fallbackInterval) {
        fallbackInterval = setInterval(handleTick, 1000);
      }
    }

    function handleTick() {
      const now = Date.now();
      
      // 1. Pomodoro Timer Tick
      if (timerState.isRunning && timerState.targetEndTime) {
        const secondsLeft = Math.max(0, Math.ceil((timerState.targetEndTime - now) / 1000));
        
        if (secondsLeft !== timerState.timeLeft) {
          timerState.timeLeft = secondsLeft;
          
          if (timerState.timeLeft <= 0) {
            timerState.isRunning = false;
            delete timerState.targetEndTime;
            saveTimerState();
            updateTimerDisplay();
            onTimerEnd();
          } else {
            saveTimerState();
            updateTimerDisplay();
          }
        }
      }

      // 2. Task Reminders check
      checkTaskReminders();
    }

    function checkTaskReminders() {
      const now = Date.now();
      tasks.forEach(task => {
        if (task.done || !task.due || !task.dueTime || !task.reminderMins) return;

        const dueDateTime = new Date(task.due + 'T' + task.dueTime);
        if (isNaN(dueDateTime.getTime())) return;

        const reminderAt = new Date(dueDateTime.getTime() - task.reminderMins * 60 * 1000);
        
        if (now >= reminderAt.getTime()) {
          if (!firedReminders.has(task.id)) {
            firedReminders.add(task.id);
            const timeStr = formatDueTime(task.dueTime);
            sendNotification(
              '⏰ Reminder: ' + task.title,
              'Due in ' + formatReminderLabel(task.reminderMins) + ' at ' + timeStr + '. Don\'t forget!',
              '⏰'
            );
            showToast('⏰ Reminder: ' + task.title);
          }
        }
      });
    }

    /**
     * startTimer()
     * Starts (or resumes) the countdown.
     * Guards against double-starting.
     */
    function startTimer() {
      if (timerState.isRunning) return;   // already running — do nothing
      timerState.isRunning = true;
      if (!timerState.targetEndTime) {
        timerState.targetEndTime = Date.now() + timerState.timeLeft * 1000;
      }
      saveTimerState();
      updateTimerDisplay();
    }

    /**
     * pauseTimer()
     * Stops the countdown without resetting the remaining time.
     */
    function pauseTimer() {
      if (!timerState.isRunning) return;
      timerState.isRunning = false;
      
      const now = Date.now();
      timerState.timeLeft = Math.max(0, Math.ceil((timerState.targetEndTime - now) / 1000));
      delete timerState.targetEndTime;
      
      saveTimerState();
      updateTimerDisplay();
      showToast('⏸ Timer paused');
    }

    /**
     * resetTimer()
     * Resets time to the full duration for the current mode.
     */
    function resetTimer() {
      timerState.isRunning = false;
      timerState.mode = 'focus';
      timerState.timeLeft = getCurrentDuration();
      delete timerState.targetEndTime;
      
      saveTimerState();
      updateTimerDisplay();
      showToast('🔄 Timer reset');
    }

    /**
     * switchMode()
     * Toggles between 'focus' and 'break', resets time accordingly.
     * Called automatically by onTimerEnd().
     */
    function switchMode() {
      timerState.mode = timerState.mode === 'focus' ? 'break' : 'focus';
      timerState.timeLeft = getCurrentDuration();
      timerState.isRunning = false;
      delete timerState.targetEndTime;
      saveTimerState();
      updateTimerDisplay();
    }

    /**
     * onTimerEnd()
     * Called when countdown reaches zero.
     * Shows a toast and a browser notification, increments sessions if a focus block just ended,
     * then automatically switches to the next mode.
     */
    function onTimerEnd() {
      if (timerState.mode === 'focus') {
        timerState.sessions += 1;
        saveTimerState();
        showToast('🎉 Focus session complete! Time for a break.');
        sendNotification('🎉 Focus Session Complete!', 'Time for a break. Great job!', '⏰');
        setTimeout(() => alert('Focus session complete! Time for a break.'), 50);
      } else {
        showToast('☕ Break over — back to work!');
        sendNotification('☕ Break Over!', 'Time to get back to work!', '⏰');
        setTimeout(() => alert('Break over — back to work!'), 50);
      }
      updateTimerDisplay();
      // Auto-switch mode; timer waits for user to press Start
      switchMode();
    }

    /* =============================================================
       POMODORO SETTINGS MODAL LOGIC
       ============================================================= */

    function openPomoSettings() {
      const overlay = document.getElementById('pomo-settings-overlay');

      document.getElementById('global-focus-time').value = pomoSettings.focusDuration;
      document.getElementById('global-break-time').value = pomoSettings.breakDuration;

      const selectEl = document.getElementById('pomo-active-task-select');
      selectEl.innerHTML = '<option value="">-- No specific task (Use next pending) --</option>';

      const pending = tasks.filter(t => !t.done);
      pending.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title;
        selectEl.appendChild(opt);
      });

      const activeTask = getActiveTimerTask();
      if (activeTask && timerState.activeTaskId === activeTask.id) {
        selectEl.value = activeTask.id;
        document.getElementById('custom-focus-time').value = activeTask.customFocusTime || '';
      } else {
        selectEl.value = '';
        document.getElementById('custom-focus-time').value = '';
      }

      // Handle dropdown change to show existing custom time
      selectEl.onchange = (e) => {
        const tId = e.target.value;
        if (tId) {
          const t = tasks.find(x => x.id === tId);
          document.getElementById('custom-focus-time').value = t.customFocusTime || '';
        } else {
          document.getElementById('custom-focus-time').value = '';
        }
      };

      overlay.classList.add('open');
    }

    function closePomoSettings() {
      document.getElementById('pomo-settings-overlay').classList.remove('open');
    }

    function handlePomoOverlayClick(e) {
      if (e.target === document.getElementById('pomo-settings-overlay')) closePomoSettings();
    }

    function resetPomoDefaults() {
      document.getElementById('global-focus-time').value = 25;
      document.getElementById('global-break-time').value = 5;
      document.getElementById('pomo-active-task-select').value = '';
      document.getElementById('custom-focus-time').value = '';
    }

    function handlePomoSettingsSubmit(e) {
      e.preventDefault();

      const focusTime = parseInt(document.getElementById('global-focus-time').value, 10);
      const breakTime = parseInt(document.getElementById('global-break-time').value, 10);

      if (!focusTime || focusTime < 1) { document.getElementById('global-focus-time').focus(); return; }
      if (!breakTime || breakTime < 1) { document.getElementById('global-break-time').focus(); return; }

      pomoSettings.focusDuration = focusTime;
      pomoSettings.breakDuration = breakTime;
      savePomoSettings();

      const oldActiveTaskId = timerState.activeTaskId;
      const taskId = document.getElementById('pomo-active-task-select').value;
      const customFocus = parseInt(document.getElementById('custom-focus-time').value, 10);

      timerState.activeTaskId = taskId || null;
      saveTimerState();

      if (taskId) {
        tasks = tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, customFocusTime: (customFocus && customFocus >= 1) ? customFocus : null };
          }
          return t;
        });
        saveTasks();
        renderTasks(); // Re-render tasks just in case
      }

      const newTotalDuration = getCurrentDuration();
      if (timerState.isRunning) {
        timerState.timeLeft = Math.min(timerState.timeLeft, newTotalDuration);
        timerState.targetEndTime = Date.now() + timerState.timeLeft * 1000;
      } else {
        timerState.timeLeft = newTotalDuration;
        delete timerState.targetEndTime;
      }

      saveTimerState();
      updateTimerDisplay();
      closePomoSettings();
      showToast('⚙️ Timer settings saved');
    }

    /* =============================================================
       NOTIFICATIONS — Reminder & Completion
       Uses the Web Notifications API (supported on PC and mobile).
       Reminder timeouts are keyed by task id and stored in memory.
       On page reload we re-schedule any still-pending reminders.
       ============================================================= */

    /** Ask the user for notification permission and update banner */
    function requestNotifPermission() {
      if (!('Notification' in window)) return;
      Notification.requestPermission().then(perm => {
        checkNotifPermissionBanner();
        if (perm === 'granted') showToast('🔔 Notifications enabled!');
      });
    }

    /** Show/hide the in-modal permission banner */
    function checkNotifPermissionBanner() {
      const banner = document.getElementById('notif-permission-banner');
      if (!banner) return;
      const reminderSel = document.getElementById('task-reminder');
      const hasReminder = reminderSel && reminderSel.value !== '';
      if (!('Notification' in window) || Notification.permission === 'granted' || !hasReminder) {
        banner.style.display = 'none';
      } else {
        banner.style.display = 'flex';
      }
    }

    /** Send a browser push notification (falls back silently if denied) */
    async function sendNotification(title, body, icon) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            reg.showNotification(title, {
              body,
              icon: icon || '📚',
              badge: '📚',
              vibrate: [100, 50, 100],
              tag: 'studyflow-' + Date.now()
            });
            return;
          }
        }
        // Fallback if SW not active
        const n = new Notification(title, {
          body,
          icon: icon || '📚',
          badge: '📚',
          tag: 'studyflow-' + Date.now()
        });
        setTimeout(() => n.close(), 8000);
      } catch (e) { console.error('Notification error', e); }
    }

    /** Schedule (or reschedule) a reminder for a task.
        Clears any existing timeout for the same task first. */
    function scheduleReminder(task) {
      if (task.done || !task.due || !task.dueTime || !task.reminderMins) {
        firedReminders.delete(task.id);
        return;
      }

      const dueDateTime = new Date(task.due + 'T' + task.dueTime);
      if (isNaN(dueDateTime.getTime())) return;

      const reminderAt = new Date(dueDateTime.getTime() - task.reminderMins * 60 * 1000);
      const now = Date.now();

      if (reminderAt.getTime() <= now) {
        firedReminders.add(task.id); // already in the past, don't fire
      } else {
        firedReminders.delete(task.id); // in the future, can fire
      }
    }

    /** Re-schedule reminders for all pending tasks on page load */
    function rescheduleAllReminders() {
      firedReminders.clear();
      tasks.forEach(t => { if (!t.done) scheduleReminder(t); });
    }

    /** Human-readable time from "HH:MM" string */
    function formatDueTime(timeStr) {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return hour + ':' + String(m).padStart(2, '0') + ' ' + period;
    }

    /** Human-readable reminder label from minutes */
    function formatReminderLabel(mins) {
      if (!mins) return '';
      if (mins < 60) return mins + 'min before';
      if (mins === 60) return '1hr before';
      if (mins === 1440) return '1 day before';
      return (mins / 60) + 'hr before';
    }

    // Show/hide banner when reminder dropdown changes
    document.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'task-reminder') checkNotifPermissionBanner();
    });

    /* =============================================================
       INIT — runs once when the page loads
       1. Load tasks from localStorage
       2. Apply saved theme
       3. Render tasks
       4. Fetch a motivational quote via Fetch API
       5. Load and display saved Pomodoro state
       ============================================================= */
    (function init() {
      loadSidebarState();
      loadTasks();
      loadSubjects();
      initTheme();
      switchTab('general'); // This will initialize UI and call renderTasks
      fetchQuote();
      // Pomodoro: load settings, restore state, then draw the UI
      loadPomoSettings();
      loadTimerState();
      initWorker();
      if (timerState.isRunning) {
        timerState.isRunning = false;
        startTimer();
      } else {
        updateTimerDisplay();
      }
      rescheduleAllReminders();
      setupDatetimeChips();

      // Listen to visibility/focus changes to handle background catch-up
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleTick();
        }
      });
      window.addEventListener('focus', () => {
        handleTick();
      });
    })();
    
    /* =============================================================
       DATE / TIME CHIPS UI
       ============================================================= */
    function setupDatetimeChips() {
      const dateInput = document.getElementById('task-due');
      const timeInput = document.getElementById('task-due-time');
      const customDateBtn = document.getElementById('custom-date-btn');
      const customTimeBtn = document.getElementById('custom-time-btn');

      document.querySelectorAll('.date-chip[data-date]').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const d = new Date();
          if (chip.dataset.date === 'tomorrow') d.setDate(d.getDate() + 1);
          if (chip.dataset.date === 'next-week') d.setDate(d.getDate() + 7);
          dateInput.value = d.toISOString().split('T')[0];
          updateDatetimePreview();
          updateChipsFromInputs();
        });
      });

      document.querySelectorAll('.time-chip[data-time]').forEach(chip => {
        chip.addEventListener('click', (e) => {
          timeInput.value = chip.dataset.time;
          updateDatetimePreview();
          updateChipsFromInputs();
        });
      });

      customDateBtn.addEventListener('click', () => {
        try { dateInput.showPicker(); } catch (e) { dateInput.focus(); }
      });
      
      customTimeBtn.addEventListener('click', () => {
        // if already has a custom time not matching chips, maybe clear it?
        // or just show picker
        try { timeInput.showPicker(); } catch (e) { timeInput.focus(); }
      });

      dateInput.addEventListener('change', () => {
        updateDatetimePreview();
        updateChipsFromInputs();
      });

      timeInput.addEventListener('change', () => {
        updateDatetimePreview();
        updateChipsFromInputs();
      });
    }

    function updateDatetimePreview() {
      const dateInput = document.getElementById('task-due');
      const timeInput = document.getElementById('task-due-time');
      const previewDate = document.getElementById('preview-date');
      const previewTime = document.getElementById('preview-time');
      
      if (dateInput.value) {
        previewDate.textContent = formatDate(dateInput.value);
      } else {
        previewDate.textContent = 'No date';
      }

      if (timeInput.value) {
        previewTime.textContent = ' at ' + formatDueTime(timeInput.value);
      } else {
        previewTime.textContent = '';
      }
    }

    function updateChipsFromInputs() {
      const dateInput = document.getElementById('task-due');
      const timeInput = document.getElementById('task-due-time');
      
      const todayStr = new Date().toISOString().split('T')[0];
      const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
      const tmrwStr = tmrw.toISOString().split('T')[0];
      const nw = new Date(); nw.setDate(nw.getDate() + 7);
      const nwStr = nw.toISOString().split('T')[0];

      document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
      let dateMatched = false;
      if (dateInput.value === todayStr) {
        document.querySelector('.date-chip[data-date="today"]')?.classList.add('active');
        dateMatched = true;
      } else if (dateInput.value === tmrwStr) {
        document.querySelector('.date-chip[data-date="tomorrow"]')?.classList.add('active');
        dateMatched = true;
      } else if (dateInput.value === nwStr) {
        document.querySelector('.date-chip[data-date="next-week"]')?.classList.add('active');
        dateMatched = true;
      }
      if (!dateMatched && dateInput.value) {
        document.getElementById('custom-date-btn').classList.add('active');
      }

      document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
      let timeMatched = false;
      if (timeInput.value) {
        const matchingChip = document.querySelector('.time-chip[data-time="' + timeInput.value + '"]');
        if (matchingChip) {
          matchingChip.classList.add('active');
          timeMatched = true;
        }
        if (!timeMatched) {
          document.getElementById('custom-time-btn').classList.add('active');
        }
      }
    }

    /* =============================================================
       SERVICE WORKER REGISTRATION
       ============================================================= */
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(err => {
          console.log('SW registration failed: ', err);
        });
      });
    }
