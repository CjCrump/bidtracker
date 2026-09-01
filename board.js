import { STATUSES, getJobs, updateJob } from "./state.js";
import { openJobDetail } from "./jobDetail.js";

// Forward pipeline order for swipe/chevron advance. "Lost" is an exit, not a
// pipeline step, so it's reached only via the status popover's separate action.
const PIPELINE = ["walkdown", "estimate", "sent", "scheduled", "done"];
const SWIPE_THRESHOLD = 80;

const boardEl = document.getElementById("board");
const filterEl = document.getElementById("board-filter");

export function renderBoard() {
  renderFilterPills();
  boardEl.innerHTML = "";

  const jobs = getJobs();
  const groupOrder = [...PIPELINE, "lost"];

  groupOrder.forEach((statusId) => {
    const status = STATUSES.find((s) => s.id === statusId);
    const jobsInGroup = jobs.filter((j) => j.status === statusId);
    if (jobsInGroup.length === 0) return;

    const section = document.createElement("div");
    section.className = "board-section";
    section.id = `section-${statusId}`;
    section.innerHTML = `
      <div class="board-section-header" style="border-color:${status.color}">
        <span class="dot" style="background:${status.color}"></span>
        <span>${status.label}</span>
        <span class="count">${jobsInGroup.length}</span>
      </div>
    `;
    const body = document.createElement("div");
    body.className = "board-section-body";
    jobsInGroup.forEach((job) => body.appendChild(renderCard(job)));
    section.appendChild(body);
    boardEl.appendChild(section);
  });

  if (boardEl.children.length === 0) {
    boardEl.innerHTML = `<div class="board-empty">No jobs yet. Tap "New job" to add one.</div>`;
  }
}

function renderFilterPills() {
  filterEl.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "board-filter-btn";
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => boardEl.scrollTo({ top: 0, behavior: "smooth" }));
  filterEl.appendChild(allBtn);

  STATUSES.forEach((status) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "board-filter-btn";
    btn.style.borderColor = status.color;
    btn.textContent = status.label;
    btn.addEventListener("click", () => {
      const section = document.getElementById(`section-${status.id}`);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    filterEl.appendChild(btn);
  });
}

function renderCard(job) {
  const status = STATUSES.find((s) => s.id === job.status);
  const card = document.createElement("div");
  card.className = "job-card";
  card.dataset.id = job.id;
  card.style.borderLeftColor = status.color;

  card.innerHTML = `
    <button class="card-chevron card-chevron-left" aria-label="Move back" type="button">&lsaquo;</button>
    <div class="card-body">
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
    </div>
    <button class="card-status-dot" style="background:${status.color}" aria-label="Change status" type="button"></button>
    <button class="card-chevron card-chevron-right" aria-label="Move forward" type="button">&rsaquo;</button>
  `;

  card.querySelector(".card-body").addEventListener("click", () => openJobDetail(job.id));
  card.querySelector(".card-chevron-left").addEventListener("click", (e) => {
    e.stopPropagation();
    stepStatus(job.id, -1);
  });
  card.querySelector(".card-chevron-right").addEventListener("click", (e) => {
    e.stopPropagation();
    stepStatus(job.id, 1);
  });
  card.querySelector(".card-status-dot").addEventListener("click", (e) => {
    e.stopPropagation();
    openStatusPopover(card, job);
  });

  attachSwipe(card, job);
  return card;
}

// ---------- Swipe (pointer events cover touch + mouse drag) ----------

function attachSwipe(card, job) {
  const body = card.querySelector(".card-body");
  let startX = null;
  let dx = 0;
  let dragging = false;

  body.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    dragging = true;
    card.classList.add("dragging");
  });

  body.addEventListener("pointermove", (e) => {
    if (!dragging || startX === null) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity = String(1 - Math.min(Math.abs(dx) / 300, 0.5));
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");
    card.style.transform = "";
    card.style.opacity = "";

    if (dx > SWIPE_THRESHOLD) stepStatus(job.id, 1);
    else if (dx < -SWIPE_THRESHOLD) stepStatus(job.id, -1);
    dx = 0;
    startX = null;
  }

  body.addEventListener("pointerup", endDrag);
  body.addEventListener("pointercancel", endDrag);
  body.addEventListener("pointerleave", () => {
    if (dragging) endDrag();
  });
}

// ---------- Status changes ----------

function stepStatus(jobId, direction) {
  const jobs = getJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  const idx = PIPELINE.indexOf(job.status);
  if (idx === -1) return; // job is "lost" — swipe/chevron does nothing, use popover to reactivate
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= PIPELINE.length) return;

  changeStatus(job, PIPELINE[nextIdx]);
}

function changeStatus(job, newStatusId) {
  const prevStatusId = job.status;
  if (prevStatusId === newStatusId) return;
  updateJob(job.id, { status: newStatusId });

  const newStatus = STATUSES.find((s) => s.id === newStatusId);
  showToast(`Moved to ${newStatus.label}`, () => updateJob(job.id, { status: prevStatusId }));
}

function openStatusPopover(card, job) {
  document.querySelectorAll(".status-popover").forEach((p) => p.remove());

  const popover = document.createElement("div");
  popover.className = "status-popover";

  PIPELINE.filter((id) => id !== job.status).forEach((id) => {
    const status = STATUSES.find((s) => s.id === id);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "status-popover-item";
    item.innerHTML = `<span class="dot" style="background:${status.color}"></span>${status.label}`;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      changeStatus(job, id);
      popover.remove();
    });
    popover.appendChild(item);
  });

  if (job.status !== "lost") {
    const lostStatus = STATUSES.find((s) => s.id === "lost");
    const lostBtn = document.createElement("button");
    lostBtn.type = "button";
    lostBtn.className = "status-popover-item status-popover-lost";
    lostBtn.innerHTML = `<span class="dot" style="background:${lostStatus.color}"></span>Mark as Lost`;
    lostBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeStatus(job, "lost");
      popover.remove();
    });
    popover.appendChild(lostBtn);
  }

  document.body.appendChild(popover);
  const rect = card.querySelector(".card-status-dot").getBoundingClientRect();
  popover.style.top = `${rect.bottom + 6}px`;
  popover.style.left = `${Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12)}px`;

  setTimeout(() => {
    document.addEventListener("click", function closePopover(e) {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener("click", closePopover);
      }
    });
  }, 0);
}

// ---------- Undo toast ----------

let toastTimer = null;

function showToast(message, onUndo) {
  const toastEl = document.getElementById("toast");
  clearTimeout(toastTimer);
  toastEl.innerHTML = `<span>${message}</span><button type="button" class="toast-undo">Undo</button>`;
  toastEl.classList.remove("hidden");

  toastEl.querySelector(".toast-undo").onclick = () => {
    onUndo();
    toastEl.classList.add("hidden");
    clearTimeout(toastTimer);
  };

  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 4000);
}
