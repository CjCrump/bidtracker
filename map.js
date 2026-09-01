import { STATUSES, statusMeta, getJobs } from "./state.js";

let map, originCoords = null, originMarker = null, routeLine = null;
let jobMarkers = new Map(); // job.id -> marker
let allJobs = [];

// ---------- Route builder state ----------
let selectedStatuses = new Set();
let manualStops = new Set(); // job ids explicitly added, sticky through filter toggles
let manualRemovals = new Set(); // job ids explicitly removed, sticky until "Clear filters"
let startMode = "gps"; // "gps" | "job"
let startJobId = null;
let endMode = "optimize"; // "optimize" | "roundtrip" | "job"
let endJobId = null;

let mapStatusEl, routePanelEl, startSelectEl, endSelectEl, statusChipRow, stopChipRow;

export function initMap() {
  map = L.map("map", { zoomControl: false }).setView([39.8, -89.6], 12);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onLocation, onLocationError);
  }

  wireRoutePanel();
  return map;
}

function onLocation(pos) {
  originCoords = [pos.coords.latitude, pos.coords.longitude];
  map.setView(originCoords, 13);
  originMarker = L.marker(originCoords).addTo(map).bindPopup("My location");
  document.dispatchEvent(new CustomEvent("origin-found", { detail: originCoords }));
}

function onLocationError() {
  document.dispatchEvent(new CustomEvent("origin-error"));
}

export function getOrigin() {
  return originCoords;
}

export function invalidate() {
  if (map) map.invalidateSize();
}

// ---------- Called by main.js whenever the job list changes ----------

export function refreshJobs(jobs) {
  allJobs = jobs;
  renderMarkers();
  renderPanel();
}

// ---------- Route builder state helpers ----------

function computeStopIds() {
  const byFilter = allJobs.filter((j) => j.coords && selectedStatuses.has(j.status)).map((j) => j.id);
  const ids = new Set([...byFilter, ...manualStops]);
  manualRemovals.forEach((id) => ids.delete(id));
  if (startMode === "job" && startJobId) ids.delete(startJobId);
  if (endMode === "job" && endJobId) ids.delete(endJobId);
  return ids;
}

function toggleStop(jobId) {
  const stopIds = computeStopIds();
  if (stopIds.has(jobId)) {
    manualRemovals.add(jobId);
    manualStops.delete(jobId);
  } else {
    manualStops.add(jobId);
    manualRemovals.delete(jobId);
  }
  refreshAll();
}

function removeStopChip(jobId) {
  manualRemovals.add(jobId);
  manualStops.delete(jobId);
  refreshAll();
}

function toggleStatusChip(statusId) {
  if (selectedStatuses.has(statusId)) selectedStatuses.delete(statusId);
  else selectedStatuses.add(statusId);
  refreshAll();
}

function setStart(mode, jobId) {
  startMode = mode;
  startJobId = jobId;
  refreshAll();
}

function setEnd(mode, jobId) {
  endMode = mode;
  endJobId = jobId;
  refreshAll();
}

function clearFilters() {
  selectedStatuses.clear();
  manualStops.clear();
  manualRemovals.clear();
  refreshAll();
}

function refreshAll() {
  renderMarkers();
  renderPanel();
}

// ---------- Markers ----------

function renderMarkers() {
  jobMarkers.forEach((m) => map.removeLayer(m));
  jobMarkers.clear();

  const stopIds = computeStopIds();
  const jobsWithCoords = allJobs.filter((j) => j.coords);

  jobsWithCoords.forEach((job) => {
    const meta = statusMeta(job.status);
    const isStart = startMode === "job" && startJobId === job.id;
    const isEnd = endMode === "job" && endJobId === job.id;
    const included = stopIds.has(job.id) || isStart || isEnd;

    const marker = L.circleMarker(job.coords, {
      radius: isStart || isEnd ? 11 : 8,
      color: isStart || isEnd ? "#111" : meta ? meta.color : "#333",
      weight: isStart || isEnd ? 3 : 1,
      fillColor: meta ? meta.color : "#333",
      fillOpacity: included ? 0.9 : 0.3,
    }).addTo(map);

    marker.bindPopup(() => buildPopupHtml(job, stopIds));
    marker.on("popupopen", (e) => attachPopupHandlers(e.popup, job));
    jobMarkers.set(job.id, marker);
  });

  if (jobMarkers.size) {
    const group = L.featureGroup([...jobMarkers.values()]);
    map.invalidateSize();
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

function buildPopupHtml(job, stopIds) {
  const inRoute = stopIds.has(job.id);
  const isStart = startMode === "job" && startJobId === job.id;
  const isEnd = endMode === "job" && endJobId === job.id;

  const tag = isStart ? " (Start)" : isEnd ? " (End)" : "";
  const parts = [
    `<div class="popup-title">${job.customerName || "Job"}${tag}</div>`,
    `<div class="popup-address">${job.address || ""}</div>`,
    `<div class="popup-actions">`,
  ];

  if (!isStart && !isEnd) {
    parts.push(
      `<button class="popup-btn" data-action="toggle-stop">${inRoute ? "Remove from route" : "Add to route"}</button>`
    );
  }
  parts.push(
    isStart
      ? `<button class="popup-btn" data-action="clear-start">Clear start</button>`
      : `<button class="popup-btn" data-action="set-start">Set as start</button>`
  );
  parts.push(
    isEnd
      ? `<button class="popup-btn" data-action="clear-end">Clear end</button>`
      : `<button class="popup-btn" data-action="set-end">Set as end</button>`
  );
  parts.push(`</div>`);
  return parts.join("");
}

function attachPopupHandlers(popup, job) {
  const el = popup.getElement();
  if (!el) return;
  el.querySelectorAll(".popup-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "toggle-stop") toggleStop(job.id);
      else if (action === "set-start") setStart("job", job.id);
      else if (action === "clear-start") setStart("gps", null);
      else if (action === "set-end") setEnd("job", job.id);
      else if (action === "clear-end") setEnd("optimize", null);
      map.closePopup();
    });
  });
}

// ---------- Route panel wiring ----------

function wireRoutePanel() {
  mapStatusEl = document.getElementById("map-status");
  routePanelEl = document.getElementById("route-panel");
  startSelectEl = document.getElementById("start-job-select");
  endSelectEl = document.getElementById("end-job-select");
  statusChipRow = document.getElementById("status-chip-row");
  stopChipRow = document.getElementById("stop-chip-row");

  document.getElementById("route-panel-toggle").addEventListener("click", () => {
    routePanelEl.classList.toggle("hidden");
  });

  document.querySelectorAll("[data-start-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setStart(btn.dataset.startMode, startJobId));
  });
  document.querySelectorAll("[data-end-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setEnd(btn.dataset.endMode, endJobId));
  });

  startSelectEl.addEventListener("change", () => setStart("job", startSelectEl.value || null));
  endSelectEl.addEventListener("change", () => setEnd("job", endSelectEl.value || null));

  document.getElementById("clear-filters-btn").addEventListener("click", clearFilters);
  document.getElementById("route-btn").addEventListener("click", onRouteClick);

  renderStatusChips();
}

function renderStatusChips() {
  statusChipRow.innerHTML = "";
  STATUSES.forEach((status) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip status-chip";
    btn.style.borderColor = status.color;
    btn.textContent = status.label;
    btn.dataset.status = status.id;
    btn.addEventListener("click", () => toggleStatusChip(status.id));
    statusChipRow.appendChild(btn);
  });
}

function renderPanel() {
  // Start/end mode buttons
  document.querySelectorAll("[data-start-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.startMode === startMode);
  });
  document.querySelectorAll("[data-end-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.endMode === endMode);
  });

  // Status chips active state
  statusChipRow.querySelectorAll(".status-chip").forEach((btn) => {
    const active = selectedStatuses.has(btn.dataset.status);
    btn.classList.toggle("active", active);
    if (active) btn.style.background = btn.style.borderColor;
    else btn.style.background = "";
  });

  // Job pickers
  startSelectEl.classList.toggle("hidden", startMode !== "job");
  endSelectEl.classList.toggle("hidden", endMode !== "job");
  renderJobSelect(startSelectEl, startJobId, endJobId);
  renderJobSelect(endSelectEl, endJobId, startJobId);

  // Stop chips
  const stopIds = computeStopIds();
  stopChipRow.innerHTML = "";
  if (stopIds.size === 0) {
    stopChipRow.innerHTML = `<span class="chip-empty">No stops selected</span>`;
  } else {
    [...stopIds].forEach((id) => {
      const job = allJobs.find((j) => j.id === id);
      if (!job) return;
      const chip = document.createElement("span");
      chip.className = "chip stop-chip";
      chip.innerHTML = `${job.customerName || "Job"} <button type="button" aria-label="Remove">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => removeStopChip(id));
      stopChipRow.appendChild(chip);
    });
  }
}

function renderJobSelect(selectEl, currentId, excludeId) {
  const jobsWithCoords = allJobs.filter((j) => j.coords && j.id !== excludeId);
  selectEl.innerHTML = `<option value="">Choose a job…</option>` +
    jobsWithCoords.map((j) => `<option value="${j.id}">${j.customerName || j.address || "Job"}</option>`).join("");
  selectEl.value = currentId || "";
}

// ---------- Routing ----------

async function onRouteClick() {
  mapStatusEl.textContent = "Calculating route…";
  try {
    const trip = await runRoute();
    const etaMin = Math.round(trip.duration / 60);
    const distanceMi = (trip.distance / 1609.34).toFixed(1);
    mapStatusEl.textContent = `${etaMin} min · ${distanceMi} mi`;
  } catch (err) {
    mapStatusEl.textContent = err.message;
  }
}

async function runRoute() {
  const stopIds = computeStopIds();
  const stops = allJobs.filter((j) => stopIds.has(j.id) && j.coords);

  const startCoords = startMode === "job" ? allJobs.find((j) => j.id === startJobId)?.coords : originCoords;
  if (!startCoords) {
    throw new Error(startMode === "job" ? "Pick a valid start job." : "No location yet.");
  }
  if (!stops.length && endMode !== "job") throw new Error("No stops selected.");

  const coordsList = [startCoords, ...stops.map((j) => j.coords)];
  let params = "source=first";

  if (endMode === "roundtrip") {
    params += "&roundtrip=true";
  } else if (endMode === "job") {
    const endJob = allJobs.find((j) => j.id === endJobId);
    if (!endJob || !endJob.coords) throw new Error("Pick a valid end job.");
    coordsList.push(endJob.coords);
    params += "&destination=last&roundtrip=false";
  } else {
    params += "&roundtrip=false";
  }

  const coordString = coordsList.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordString}?${params}&geometries=geojson&overview=full`;

  const res = await fetch(url);
  const data = await res.json();
  if (!data.trips || !data.trips.length) throw new Error("No route found.");

  drawRoute(data.trips[0]);
  return data.trips[0];
}

function drawRoute(trip) {
  if (routeLine) map.removeLayer(routeLine);
  const latlngs = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  routeLine = L.polyline(latlngs, { color: "#2563eb", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
}