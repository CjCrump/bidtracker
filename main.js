import { subscribe, getJobsByStatus, STATUSES } from "./state.js";
import { initMap, plotJobs, routeJobs, invalidate } from "./map.js";
import { renderBoard } from "./board.js";
import { initCalendar, renderCalendar } from "./calendar.js";
import { initJobDetail, openJobDetail } from "./jobDetail.js";

const tabs = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");
const mapStatusFilter = document.getElementById("map-status-filter");
const mapStatusEl = document.getElementById("map-status");
const ALL_STATUS_IDS = STATUSES.map((s) => s.id);

init();

function init() {
  initMap();
  initJobDetail();
  initCalendar();

  document.getElementById("add-job-btn").addEventListener("click", () => openJobDetail(null));
  tabs.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  mapStatusFilter.addEventListener("change", updateMapView);
  document.getElementById("route-btn").addEventListener("click", onRoute);
  document.addEventListener("origin-found", updateMapView);

  subscribe(() => {
    renderBoard();
    renderCalendar();
    updateMapView();
  });
}

function switchView(view) {
  tabs.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  views.forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "map") setTimeout(invalidate, 0);
}

function updateMapView() {
  const status = mapStatusFilter.value;
  const jobs = status === "all" ? ALL_STATUS_IDS.flatMap(getJobsByStatus) : getJobsByStatus(status);
  plotJobs(jobs);
}

async function onRoute() {
  const status = mapStatusFilter.value === "all" ? "walkdown" : mapStatusFilter.value;
  mapStatusEl.textContent = "Calculating route…";
  try {
    const trip = await routeJobs(getJobsByStatus(status));
    const etaMin = Math.round(trip.duration / 60);
    const distanceMi = (trip.distance / 1609.34).toFixed(1);
    mapStatusEl.textContent = `${etaMin} min · ${distanceMi} mi`;
  } catch (err) {
    mapStatusEl.textContent = err.message;
  }
}