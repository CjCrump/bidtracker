import { statusMeta } from "./state.js";

let map, originCoords = null, originMarker = null, routeLine = null;
let jobMarkers = [];

export function initMap() {
  map = L.map("map", { zoomControl: false }).setView([39.8, -89.6], 12);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onLocation, onLocationError);
  }
  return map;
}

function onLocation(pos) {
  originCoords = [pos.coords.latitude, pos.coords.longitude];
  map.setView(originCoords, 13);
  originMarker = L.marker(originCoords).addTo(map).bindPopup("Start");
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

export function clearJobMarkers() {
  jobMarkers.forEach((m) => map.removeLayer(m));
  jobMarkers = [];
}

export function plotJobs(jobs) {
  clearJobMarkers();
  jobs
    .filter((j) => j.coords)
    .forEach((job) => {
      const meta = statusMeta(job.status);
      const marker = L.circleMarker(job.coords, {
        radius: 8,
        color: meta ? meta.color : "#333",
        fillColor: meta ? meta.color : "#333",
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(`${job.customerName || "Job"} — ${job.address}`);
      jobMarkers.push(marker);
    });

  if (jobMarkers.length) {
    map.invalidateSize();
    const group = L.featureGroup(jobMarkers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

export async function routeJobs(jobs) {
  if (!originCoords) throw new Error("No origin location yet.");
  const stops = jobs.filter((j) => j.coords);
  if (!stops.length) throw new Error("No jobs with a resolved address.");

  const coordsList = [originCoords, ...stops.map((j) => j.coords)];
  const coordString = coordsList.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&roundtrip=false&geometries=geojson&overview=full`;

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