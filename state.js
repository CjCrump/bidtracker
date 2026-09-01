const STORAGE_KEY = "bidtracker.jobs.v1";

export const STATUSES = [
  { id: "walkdown", label: "Walk-down", color: "#e53e3e" },
  { id: "estimate", label: "Estimate", color: "#805ad5" },
  { id: "sent", label: "Sent", color: "#1f2937" },
  { id: "scheduled", label: "Scheduled", color: "#2563eb" },
  { id: "done", label: "Done", color: "#16a34a" },
  { id: "lost", label: "Lost", color: "#ca8a04" },
];

let jobs = load();
let listeners = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("State load error", e);
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  notify();
}

function notify() {
  listeners.forEach((fn) => fn(jobs));
}

export function subscribe(fn) {
  listeners.push(fn);
  fn(jobs);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getJobs() {
  return jobs;
}

export function getJobsByStatus(status) {
  return jobs.filter((j) => j.status === status);
}

export function getJob(id) {
  return jobs.find((j) => j.id === id) || null;
}

export function createJob(data) {
  const job = {
    id: crypto.randomUUID(),
    customerName: "",
    phone: "",
    address: "",
    coords: null,
    notes: "",
    status: "walkdown",
    walkdownDate: null,
    scheduledStart: null,
    scheduledEnd: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  };
  jobs.push(job);
  persist();
  return job;
}

export function updateJob(id, patch) {
  const job = getJob(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persist();
  return job;
}

export function deleteJob(id) {
  jobs = jobs.filter((j) => j.id !== id);
  persist();
}

export function statusMeta(id) {
  return STATUSES.find((s) => s.id === id);
}
