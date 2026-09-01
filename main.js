import { subscribe, getJobs } from "./state.js";
import { initMap, refreshJobs, invalidate } from "./map.js";
import { renderBoard } from "./board.js";
import { initCalendar, renderCalendar } from "./calendar.js";
import { initJobDetail, openJobDetail } from "./jobDetail.js";

const tabs = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");

init();

function init() {
  initMap();
  initJobDetail();
  initCalendar();

  document.getElementById("add-job-btn").addEventListener("click", () => openJobDetail(null));
  tabs.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

  subscribe(() => {
    renderBoard();
    renderCalendar();
    refreshJobs(getJobs());
  });
}

function switchView(view) {
  tabs.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  views.forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "map") setTimeout(invalidate, 0);
}