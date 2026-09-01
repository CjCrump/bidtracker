import { STATUSES, getJobsByStatus, updateJob, statusMeta } from "./state.js";
import { openJobDetail } from "./jobDetail.js";

// ---------- Board (kanban) ----------

const boardEl = document.getElementById("board");

export function renderBoard() {
  boardEl.innerHTML = "";

  STATUSES.forEach((status) => {
    const col = document.createElement("div");
    col.className = "board-col";
    col.dataset.status = status.id;
    col.innerHTML = `
      <div class="board-col-header" style="border-color:${status.color}">
        <span class="dot" style="background:${status.color}"></span>
        <span>${status.label}</span>
        <span class="count"></span>
      </div>
      <div class="board-col-body"></div>
    `;

    const body = col.querySelector(".board-col-body");
    const jobs = getJobsByStatus(status.id);
    col.querySelector(".count").textContent = jobs.length;
    jobs.forEach((job) => body.appendChild(renderCard(job)));

    body.addEventListener("dragover", (e) => e.preventDefault());
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      const jobId = e.dataTransfer.getData("text/job-id");
      if (jobId) updateJob(jobId, { status: status.id });
    });

    boardEl.appendChild(col);
  });
}

function renderCard(job) {
  const card = document.createElement("div");
  card.className = "job-card";
  card.draggable = true;
  card.dataset.id = job.id;
  card.innerHTML = `
    <div class="job-card-name">${job.customerName || "Untitled job"}</div>
    <div class="job-card-address">${job.address || ""}</div>
    <div class="job-card-notes">${(job.notes || "").slice(0, 80)}</div>
    ${
      job.scheduledStart
        ? `<div class="job-card-date">${new Date(job.scheduledStart).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}</div>`
        : ""
    }
  `;

  card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/job-id", job.id));
  card.addEventListener("click", () => openJobDetail(job.id));
  return card;
}

// ---------- Schedule (list of 'scheduled' jobs) ----------

const scheduleListEl = document.getElementById("schedule-list");

export function renderSchedule() {
  scheduleListEl.innerHTML = "";
  const jobs = getJobsByStatus("scheduled")
    .filter((j) => j.scheduledStart)
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  if (!jobs.length) {
    scheduleListEl.innerHTML = '<p class="empty">No scheduled jobs yet.</p>';
    return;
  }

  let lastDay = null;
  jobs.forEach((job) => {
    const start = new Date(job.scheduledStart);
    const dayKey = start.toDateString();
    if (dayKey !== lastDay) {
      const heading = document.createElement("div");
      heading.className = "schedule-day-heading";
      heading.textContent = start.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      scheduleListEl.appendChild(heading);
      lastDay = dayKey;
    }

    const row = document.createElement("div");
    row.className = "schedule-row";
    const end = job.scheduledEnd ? new Date(job.scheduledEnd) : null;
    row.innerHTML = `
      <span class="schedule-time">${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${
      end ? " – " + end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""
    }</span>
      <span class="dot" style="background:${statusMeta(job.status).color}"></span>
      <span class="schedule-name">${job.customerName || "Untitled job"}</span>
      <span class="schedule-address">${job.address || ""}</span>
    `;
    row.addEventListener("click", () => openJobDetail(job.id));
    scheduleListEl.appendChild(row);
  });
}
