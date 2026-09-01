import { getJob, createJob, updateJob, deleteJob, STATUSES } from "./state.js";
import { getOrigin } from "./map.js";

const overlay = document.getElementById("job-modal-overlay");
const form = document.getElementById("job-form");
let currentId = null;
let selectedCoords = null;

export function initJobDetail() {
  document.getElementById("job-modal-close").addEventListener("click", closeJobDetail);
  document.getElementById("job-delete-btn").addEventListener("click", () => {
    if (currentId && confirm("Delete this job?")) {
      deleteJob(currentId);
      closeJobDetail();
    }
  });
  form.addEventListener("submit", onSubmit);

  document.getElementById("job-status").innerHTML = STATUSES.map(
    (s) => `<option value="${s.id}">${s.label}</option>`
  ).join("");

  attachAutocomplete(
    document.getElementById("job-address"),
    document.getElementById("job-address-suggestions")
  );
}

export function openJobDetail(id) {
  currentId = id;
  const job = id ? getJob(id) : null;
  selectedCoords = job ? job.coords : null;

  document.getElementById("job-modal-title").textContent = job ? "Edit job" : "New job";
  document.getElementById("job-delete-btn").classList.toggle("hidden", !job);

  form.customerName.value = job?.customerName || "";
  form.phone.value = job?.phone || "";
  form.address.value = job?.address || "";
  form.notes.value = job?.notes || "";
  form.status.value = job?.status || "walkdown";
  form.scheduledStart.value = job?.scheduledStart ? toLocalInput(job.scheduledStart) : "";
  form.scheduledEnd.value = job?.scheduledEnd ? toLocalInput(job.scheduledEnd) : "";
  form.walkdownDate.value = job?.walkdownDate ? job.walkdownDate.slice(0, 10) : "";

  overlay.classList.remove("hidden");
}

export function closeJobDetail() {
  overlay.classList.add("hidden");
  currentId = null;
}

function onSubmit(e) {
  e.preventDefault();
  const data = {
    customerName: form.customerName.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    coords: selectedCoords,
    notes: form.notes.value.trim(),
    status: form.status.value,
    scheduledStart: form.scheduledStart.value ? new Date(form.scheduledStart.value).toISOString() : null,
    scheduledEnd: form.scheduledEnd.value ? new Date(form.scheduledEnd.value).toISOString() : null,
    walkdownDate: form.walkdownDate.value || null,
  };

  if (currentId) updateJob(currentId, data);
  else createJob(data);
  closeJobDetail();
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Address autocomplete (Photon) — only used here, so it lives here ----------

function attachAutocomplete(input, suggestionsEl) {
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) {
      suggestionsEl.innerHTML = "";
      return;
    }
    timer = setTimeout(async () => {
      const features = await fetchSuggestions(q, getOrigin()).catch(() => []);
      renderSuggestions(features, input, suggestionsEl);
    }, 400);
  });

  document.addEventListener("click", (e) => {
    if (!suggestionsEl.contains(e.target) && e.target !== input) suggestionsEl.innerHTML = "";
  });
}

async function fetchSuggestions(query, originCoords) {
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  if (originCoords) url += `&lat=${originCoords[0]}&lon=${originCoords[1]}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.features || [];
}

function formatLabel(props) {
  return [props.name, props.street, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");
}

function renderSuggestions(features, input, suggestionsEl) {
  suggestionsEl.innerHTML = "";
  const rect = input.getBoundingClientRect();
  suggestionsEl.style.top = `${rect.bottom + 4}px`;
  suggestionsEl.style.left = `${rect.left}px`;
  suggestionsEl.style.width = `${rect.width}px`;

  features.forEach((feature) => {
    const label = formatLabel(feature.properties);
    const li = document.createElement("li");
    li.textContent = label;
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      input.value = label;
      suggestionsEl.innerHTML = "";
      const [lng, lat] = feature.geometry.coordinates;
      selectedCoords = [lat, lng];
    });
    suggestionsEl.appendChild(li);
  });
}
