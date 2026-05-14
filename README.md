# 📚 StudyFlow — Task Planner

A polished, premium productivity web app for students. Manage tasks, track progress, stay focused with a built-in Pomodoro timer, and get inspired — all in one offline-capable PWA.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat&logo=pwa&logoColor=white)

---

## ✨ Features

### 🗂 Task Management
- Add, edit, and delete tasks with titles, descriptions, due dates, times, and priorities
- Two task modes: **General Tasks** and **Study Tasks** (organised into subject folders)
- Mark tasks as done with animated checkboxes
- Overdue detection with visual indicators

### 🔍 Filtering & Sorting
- Sidebar filters: All, Pending, Completed, High / Medium / Low priority
- Sort by due date (soonest/latest), priority, or recently added
- Live search across task titles and descriptions

### 📊 Progress Tracking
- Real-time stats panel: Done, Pending, Urgent counts
- Animated progress bar showing completion percentage

### ⏱ Pomodoro Timer
- Focus and Break modes with configurable durations
- Per-task custom focus times
- Session counter, progress ring, and "Focusing on" task strip
- Persistent state across page reloads via `localStorage`

### 🔔 Reminders & Notifications
- Set reminders 5 min to 1 day before a task's due time
- Web Notifications API integration (with in-modal permission prompt)
- Service Worker push notification support

### 💡 Motivational Quotes
- Fetches a random quote from the [Quotable API](https://api.quotable.io) on load
- Falls back gracefully to a local quote bank if offline

### 🌙 Dark Mode
- Toggle between light and dark themes
- Preference persisted in `localStorage`

### 📱 Responsive & PWA
- Mobile-first responsive layout with slide-in sidebar
- Installable as a Progressive Web App (PWA) via `manifest.json` and Service Worker
- Offline support via cache-first Service Worker strategy

---

## 🚀 Getting Started

### Option 1 — Single File (No Setup)
Just open `index.html` directly in your browser. No build step, no dependencies.

### Option 2 — Local Server (Recommended for PWA features)
PWA install and Service Worker caching require a served origin (not `file://`).

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Then visit `http://localhost:8080`.

---

## 📁 File Structure

```
studyflow/
├── index.html        # App shell and all markup
├── styles.css        # CSS custom properties, layout, components, responsive styles
├── script.js         # All app logic — tasks, timer, filters, quotes, notifications
├── manifest.json     # PWA manifest (name, icons, theme colour)
└── service-worker.js # Cache-first offline strategy + push notification handler
```

---

## 🧠 Concepts Demonstrated

| Concept | Where Used |
|---|---|
| **DOM Manipulation** | `renderTasks()`, `createTaskCard()`, dynamic sidebar counts |
| **Events** | `onclick`, `addEventListener`, form `submit`, keyboard `Escape` |
| **localStorage** | Task persistence, theme, timer state, sidebar collapse state |
| **Fetch API** | `fetchQuote()` — async/await HTTP request to Quotable API |
| **setInterval / clearInterval** | Pomodoro countdown loop in `startTimer()` / `pauseTimer()` |
| **Objects** | `timerState` as a single source of truth for all timer data |
| **Modular Functions** | Each function has one clear responsibility |
| **Service Worker** | Offline caching, push notification handling |
| **Web Notifications API** | Task reminders via `Notification` and SW `showNotification` |
| **CSS Custom Properties** | Full theming system via `:root` variables, dark mode via `[data-theme]` |
| **CSS Grid & Flexbox** | App layout, task grid, sidebar sections |
| **PWA** | `manifest.json` + Service Worker = installable app |

---

## 🎨 Theming

All colours and design tokens are defined as CSS custom properties in `:root` and overridden for dark mode via `[data-theme="dark"]`:

```css
:root {
  --bg: #f5f3ee;
  --accent: #c84b31;
  --low: #3a8a5c;    /* green — low priority */
  --med: #c87c1a;    /* amber — medium priority */
  --high: #c84b31;   /* red — high priority */
  /* ... */
}
```

---

## 📸 App Sections

| Section | Description |
|---|---|
| **Topbar** | Logo, live search, dark mode toggle |
| **Sidebar** | Stats, filters, Pomodoro timer, quote card |
| **Main** | Tab switcher, subject folders (study mode), task grid |
| **Modal** | Add / Edit task form with date chips, time chips, reminder selector |
| **Toast** | Non-blocking feedback messages |

---

## 🛠 Tech Stack

- **Vanilla HTML, CSS, JavaScript** — zero frameworks, zero dependencies
- **Google Fonts** — DM Serif Display & DM Sans
- **Quotable API** — `https://api.quotable.io` (free, public)
- **Web APIs used:** `localStorage`, `Fetch`, `Notification`, `Service Worker`, `setInterval`

---

<p align="center">Made by Tejus Pathania</p>
