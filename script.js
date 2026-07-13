const map = L.map("map", { zoomControl: false }).setView([39.8, -89.6], 12); // fallback center (IL)
L.control.zoom({ position: "topright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

let originCoords = null;
let originMarker = null;
let routeLine = null;

// stops: [{ id, coords: [lat, lng] | null, marker }]
let stops = [];
let stopIdCounter = 0;

const stopsListEl = document.getElementById("stops-list");
const stopRowTemplate = document.getElementById("stop-row-template");
const addStopBtn = document.getElementById("add-stop-btn");
const findRouteBtn = document.getElementById("find-route-btn");
const originStatusEl = document.getElementById("origin-status");
const routePanel = document.getElementById("route-panel");
const etaValueEl = document.getElementById("eta-value");
const distanceValueEl = document.getElementById("distance-value");

init();

function init() {
  if (!navigator.geolocation) {
    originStatusEl.textContent = "Geolocation not supported.";
  } else {
    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError);
  }

  addStopBtn.addEventListener("click", () => addStopRow());
  findRouteBtn.addEventListener("click", findRoute);

  addStopRow(); // start with one stop input

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".suggestions").forEach((ul) => {
      const row = ul.closest(".stop-row");
      if (!row.contains(e.target)) ul.innerHTML = "";
    });
  });
}

function onLocationSuccess(pos) {
  originCoords = [pos.coords.latitude, pos.coords.longitude];
  map.setView(originCoords, 13);
  originMarker = L.marker(originCoords).addTo(map).bindPopup("Start");
  originStatusEl.textContent = "Location found.";
}

function onLocationError() {
  originStatusEl.textContent = "Couldn't get your location. Enable location access and reload.";
}

function addStopRow() {
  const id = ++stopIdCounter;
  const fragment = stopRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".stop-row");
  row.dataset.id = id;

  const input = row.querySelector(".stop-input");
  const suggestionsEl = row.querySelector(".suggestions");
  const removeBtn = row.querySelector(".remove-stop-btn");

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < 3) {
      suggestionsEl.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(() => fetchSuggestions(query, suggestionsEl, id, input), 400);
  });

  removeBtn.addEventListener("click", () => removeStop(id, row));

  stopsListEl.appendChild(row);
  stops.push({ id, coords: null, marker: null });
}

function removeStop(id, row) {
  const stop = stops.find((s) => s.id === id);
  if (stop && stop.marker) map.removeLayer(stop.marker);
  stops = stops.filter((s) => s.id !== id);
  row.remove();
}

async function fetchSuggestions(query, suggestionsEl, stopId, input) {
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  if (originCoords) {
    url += `&lat=${originCoords[0]}&lon=${originCoords[1]}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderSuggestions(data.features || [], suggestionsEl, stopId, input);
  } catch (err) {
    console.error("Geocoding error:", err);
  }
}

function renderSuggestions(features, suggestionsEl, stopId, input) {
  suggestionsEl.innerHTML = "";
  const rect = input.getBoundingClientRect();
  suggestionsEl.style.top = `${rect.bottom + 4}px`;
  suggestionsEl.style.left = `${rect.left}px`;
  suggestionsEl.style.width = `${rect.width}px`;
  features.forEach((feature) => {
    const label = formatPhotonLabel(feature.properties);
    const li = document.createElement("li");
    li.textContent = label;
    li.tabIndex = 0;
    li.addEventListener("click", () => selectStop(feature, label, stopId, input, suggestionsEl));
    suggestionsEl.appendChild(li);
  });
}

function formatPhotonLabel(props) {
  return [props.name, props.street, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");
}

function selectStop(feature, label, stopId, input, suggestionsEl) {
  input.value = label;
  suggestionsEl.innerHTML = "";
  const [lng, lat] = feature.geometry.coordinates;

  const stop = stops.find((s) => s.id === stopId);
  if (stop.marker) map.removeLayer(stop.marker);
  stop.marker = L.marker([lat, lng]).addTo(map).bindPopup(label);
  stop.coords = [lat, lng];
}

async function findRoute() {
  if (!originCoords) {
    originStatusEl.textContent = "Waiting on your location to build a route.";
    return;
  }
  const resolvedStops = stops.filter((s) => s.coords);
  if (resolvedStops.length < 1) {
    originStatusEl.textContent = "Add at least one stop with a selected address.";
    return;
  }

  const allCoords = [originCoords, ...resolvedStops.map((s) => s.coords)];
  const coordString = allCoords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&roundtrip=false&geometries=geojson&overview=full`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.trips || !data.trips.length) {
      originStatusEl.textContent = "No route found.";
      return;
    }
    drawRoute(data.trips[0]);
  } catch (err) {
    console.error("Trip error:", err);
    originStatusEl.textContent = "Couldn't calculate route.";
  }
}

function drawRoute(trip) {
  if (routeLine) map.removeLayer(routeLine);

  const latlngs = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  routeLine = L.polyline(latlngs, { color: "#2563eb", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

  const etaMin = Math.round(trip.duration / 60);
  const distanceMi = (trip.distance / 1609.34).toFixed(1);

  etaValueEl.textContent = etaMin;
  distanceValueEl.textContent = distanceMi;
  routePanel.classList.remove("hidden");
}