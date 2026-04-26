# StudyFlow — Task Planner

A clean, feature-rich study task manager built with vanilla HTML, CSS, and JavaScript. No frameworks, no dependencies, no build step — just open `index.html` and go.

![StudyFlow Preview](preview.png)

---

## Features

### Task Management
- Create tasks with a title, description, due date, priority level (Low / Medium / High), and subject
- Edit and delete tasks at any time
- Mark tasks as complete with a single click
- Overdue tasks are automatically flagged with a visual badge

### Organisation
- **Subject Folders** — group tasks by subject/course (General, Maths, Science, etc.) and create custom folders
- **Tabs** — switch between All Tasks, Pending, and Completed views
- **Sidebar Filters** — filter by priority (High, Medium, Low) or view tasks due Today or This Week
- **Sort** — sort tasks by due date, priority, or creation date

### Pomodoro Timer
- Built-in focus/break timer with configurable durations
- Link a specific task to a timer session, with optional per-task custom focus time
- Session counter tracks completed focus blocks
- Timer state persists across page refreshes via `localStorage`

### Search
- Live search across task titles and descriptions from the top bar

### Motivational Quotes
- Fetches a fresh quote from the [Quotable.io](https://quotable.io) API on load, with a manual refresh button
- Falls back to a local quote if the network is unavailable

### Stats
- Sidebar displays a live count of completed, pending, and high-priority tasks

### Theming
- Light and dark mode with a single toggle button
- Theme preference is saved to `localStorage`

---

## Getting Started

No installation required.

```bash
git clone https://github.com/your-username/studyflow.git
cd studyflow
open index.html   # or just double-click the file
```

That's it. The app runs entirely in the browser.

---

## How It Works

StudyFlow is intentionally dependency-free, making it a great reference for core web concepts:

| Concept | Where it's used |
|---|---|
| **DOM manipulation** | Tasks are created, updated, and removed dynamically without page reloads |
| **localStorage** | Tasks, timer state, Pomodoro settings, theme, and sidebar state all persist across sessions |
| **Fetch API** | `fetchQuote()` makes an async HTTP request to Quotable.io with a local fallback |
| **setInterval / clearInterval** | Powers the Pomodoro countdown timer |
| **CSS custom properties** | All colours are defined as CSS variables, making theming a one-attribute swap on `<html>` |
| **CSS Grid** | Used for the app shell layout, stats row, and the responsive task card grid |
| **Event delegation** | UI interactions (clicks, form submits, keyboard input) are handled cleanly with event listeners |

---

## Project Structure

```
studyflow/
└── index.html      # Everything — markup, styles, and scripts in one file
```

All logic lives in a single file, organised into clearly commented sections:

- **CSS custom properties** — theme tokens
- **Layout** — topbar, sidebar, main content area
- **Component styles** — cards, modals, badges, timer
- **Task logic** — CRUD, filtering, sorting, rendering
- **Timer logic** — Pomodoro start/pause/reset/mode-switch
- **Init** — bootstraps the app on page load

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled. No polyfills needed.

---

## Contributing

Pull requests are welcome! Some ideas for extensions:

- Drag-and-drop task reordering
- Export tasks to CSV or JSON
- Recurring tasks
- Desktop notifications when the Pomodoro timer ends
- A calendar/timeline view

---

## License

[MIT](LICENSE)
