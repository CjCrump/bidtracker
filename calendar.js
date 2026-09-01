import { getJobs, statusMeta } from "./state.js";
import { openJobDetail } from "./jobDetail.js";

let anchor = new Date();
let viewMode = "month"; // 'month' | 'week' | 'day'

export function initCalendar() {
  document.getElementById("cal-prev").addEventListener("click", () => navigate(-1));
  document.getElementById("cal-next").addEventListener("click", () => navigate(1));
  document.getElementById("cal-today").addEventListener("click", () => {
    anchor = new Date();
    renderCalendar();
  });
  document.querySelectorAll(".cal-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.mode;
      renderCalendar();
    });
  });
}

function navigate(dir) {
  if (viewMode === "month") anchor.setMonth(anchor.getMonth() + dir);
  else if (viewMode === "week") anchor.setDate(anchor.getDate() + dir * 7);
  else anchor.setDate(anchor.getDate() + dir);
  renderCalendar();
}

export function renderCalendar() {
  const body = document.getElementById("cal-body");
  body.innerHTML = "";
  updateLabel();
  updateModeButtons();

  if (viewMode === "month") renderMonth(body);
  else if (viewMode === "week") renderWeek(body);
  else renderDay(body, anchor);
}

function updateLabel() {
  const label = document.getElementById("cal-label");
  if (viewMode === "month") {
    label.textContent = anchor.toLocaleDateString([], { month: "long", year: "numeric" });
  } else if (viewMode === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    label.textContent = `${start.toLocaleDateString([], { month: "short", day: "numeric" })} – ${end.toLocaleDateString(
      [],
      { month: "short", day: "numeric" }
    )}`;
  } else {
    label.textContent = anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }
}

function updateModeButtons() {
  document.querySelectorAll(".cal-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === viewMode);
  });
}

// ---------- Month ----------

function renderMonth(container) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const grid = document.createElement("div");
  grid.className = "cal-month-grid";

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => {
    const head = document.createElement("div");
    head.className = "cal-weekday";
    head.textContent = d;
    grid.appendChild(head);
  });

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day-cell cal-day-empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const jobs = jobsOnDate(date);

    const cell = document.createElement("div");
    cell.className = "cal-day-cell" + (sameDay(date, today) ? " today" : "");
    cell.innerHTML = `
      <div class="cal-day-num">${day}</div>
      <div class="cal-day-dots">${jobs
        .slice(0, 4)
        .map((j) => `<span class="dot" style="background:${statusMeta(j.status).color}"></span>`)
        .join("")}</div>
      ${jobs.length > 4 ? `<div class="cal-day-more">+${jobs.length - 4}</div>` : ""}
    `;
    cell.addEventListener("click", () => {
      anchor = date;
      viewMode = "day";
      renderCalendar();
    });
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

// ---------- Week ----------

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderWeek(container) {
  const start = startOfWeek(anchor);
  const grid = document.createElement("div");
  grid.className = "cal-week-grid";

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    const col = document.createElement("div");
    col.className = "cal-week-col";
    col.innerHTML = `<div class="cal-week-heading">${date.toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
    })}</div>`;

    const list = document.createElement("div");
    list.className = "cal-week-jobs";
    jobsOnDate(date)
      .sort(sortByTime)
      .forEach((job) => list.appendChild(agendaRow(job)));
    col.appendChild(list);

    grid.appendChild(col);
  }

  container.appendChild(grid);
}

// ---------- Day ----------

function renderDay(container, date) {
  const heading = document.createElement("div");
  heading.className = "cal-day-heading";
  heading.textContent = date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  container.appendChild(heading);

  const jobs = jobsOnDate(date).sort(sortByTime);
  if (!jobs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nothing on the books.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "cal-day-list";
  jobs.forEach((job) => list.appendChild(agendaRow(job)));
  container.appendChild(list);
}

// ---------- Shared helpers ----------

function agendaRow(job) {
  const row = document.createElement("div");
  row.className = "cal-agenda-row";
  const time = job.scheduledStart
    ? new Date(job.scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : job.walkdownDate
    ? "Walk-down"
    : "";
  row.innerHTML = `
    <span class="dot" style="background:${statusMeta(job.status).color}"></span>
    <span class="cal-agenda-time">${time}</span>
    <span class="cal-agenda-name">${job.customerName || "Untitled job"}</span>
  `;
  row.addEventListener("click", () => openJobDetail(job.id));
  return row;
}

function sortByTime(a, b) {
  const ta = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
  const tb = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
  return ta - tb;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// A job shows up on a day if it's scheduled that day, OR its walk-down is that day.
function jobsOnDate(date) {
  return getJobs().filter((job) => {
    if (job.scheduledStart && sameDay(new Date(job.scheduledStart), date)) return true;
    if (job.walkdownDate && sameDay(new Date(`${job.walkdownDate}T00:00:00`), date)) return true;
    return false;
  });
}