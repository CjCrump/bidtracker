import { STATUSES, getJobsByStatus, updateJob } from "./state.js";
import { openJobDetail } from "./jobDetail.js";

const boardEl = document.getElementById("board");
const filterEl = document.getElementById("board-filter");
let activeFilter = "walkdown";

export function renderBoard() {
  renderFilterPills();
  boardEl.innerHTML = "";

  STATUSES.forEach((status) => {
    const col = document.createElement("div");
    col.className = "board-col";
    if (status.id !== activeFilter) col.classList.add("board-col-hidden");
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

// Mobile shows one status column at a time via these pills (hidden on desktop,
// where all columns are visible side by side — see components.css).
function renderFilterPills() {
  filterEl.innerHTML = "";
  STATUSES.forEach((status) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "board-filter-btn" + (status.id === activeFilter ? " active" : "");
    btn.style.borderColor = status.color;
    if (status.id === activeFilter) btn.style.background = status.color;
    btn.textContent = status.label;
    btn.addEventListener("click", () => {
      activeFilter = status.id;
      renderBoard();
    });
    filterEl.appendChild(btn);
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
