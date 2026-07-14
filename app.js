const STORAGE_KEY = "panelu_razosana_v1";

const defaultState = {
  workers: ["Jānis", "Pēteris"],
  projects: {
    "Demo projekts": ["1SB-01", "1SB-02", "1SB-03"]
  },
  jobs: [],
  activeJobId: null
};

let state = loadState();
let deferredPrompt = null;
let dialogMode = null;

const el = id => document.getElementById(id);
const workerEl = el("worker");
const projectEl = el("project");
const panelEl = el("panel");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function nowIso() { return new Date().toISOString(); }

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("lv-LV", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

function formatTimeOnly(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("lv-LV", {
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

function secondsToHms(total) {
  total = Math.max(0, Math.floor(total));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function effectiveSeconds(job) {
  let seconds = job.accumulatedSeconds || 0;
  if (job.status === "Procesā" && job.lastResumeAt) {
    seconds += (Date.now() - new Date(job.lastResumeAt).getTime()) / 1000;
  }
  return seconds;
}

function fillSelect(select, values, selected) {
  select.innerHTML = "";
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if (v === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderSelectors() {
  const prevWorker = workerEl.value;
  const prevProject = projectEl.value;
  const prevPanel = panelEl.value;

  fillSelect(workerEl, state.workers, state.workers.includes(prevWorker) ? prevWorker : state.workers[0]);
  const projectNames = Object.keys(state.projects);
  fillSelect(projectEl, projectNames, projectNames.includes(prevProject) ? prevProject : projectNames[0]);

  const panels = state.projects[projectEl.value] || [];
  fillSelect(panelEl, panels, panels.includes(prevPanel) ? prevPanel : panels[0]);

  const hasData = state.workers.length && projectNames.length && panels.length;
  el("startBtn").disabled = !hasData || !!state.activeJobId;
}

function getActiveJob() {
  return state.jobs.find(j => j.id === state.activeJobId) || null;
}

function renderActive() {
  const job = getActiveJob();
  const has = !!job;
  el("activeEmpty").classList.toggle("hidden", has);
  el("activeJob").classList.toggle("hidden", !has);

  if (!job) {
    el("activeStatus").textContent = "Nav aktīvs";
    el("activeStatus").className = "badge muted";
    return;
  }

  el("activeProject").textContent = job.project;
  el("activePanel").textContent = job.panel;
  el("activeWorker").textContent = job.worker;
  el("activeStart").textContent = formatDateTime(job.startAt);
  el("activeStatus").textContent = job.status;
  el("activeStatus").className = "badge " + (job.status === "Pauzē" ? "paused" : "running");
  el("pauseBtn").textContent = job.status === "Pauzē" ? "TURPINĀT" : "PAUZE";
  el("timer").textContent = secondsToHms(effectiveSeconds(job));
}

function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth() === n.getMonth() &&
         d.getDate() === n.getDate();
}

function renderJobs() {
  const body = el("jobsBody");
  body.innerHTML = "";
  const jobs = state.jobs
    .filter(j => isToday(j.startAt))
    .sort((a,b) => new Date(b.startAt) - new Date(a.startAt));

  if (!jobs.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">Šodien ierakstu vēl nav.</td></tr>`;
    return;
  }

  jobs.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(j.panel)}</strong><br><small>${escapeHtml(j.project)}</small></td>
      <td>${escapeHtml(j.worker)}</td>
      <td>${formatTimeOnly(j.startAt)}</td>
      <td>${formatTimeOnly(j.endAt)}</td>
      <td>${secondsToHms(effectiveSeconds(j))}</td>
      <td class="status-cell">${escapeHtml(j.status)}</td>`;
    body.appendChild(tr);
  });
}

function renderAll() {
  renderSelectors();
  renderActive();
  renderJobs();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

el("startBtn").addEventListener("click", () => {
  if (state.activeJobId) return;
  const start = nowIso();
  const job = {
    id: crypto.randomUUID(),
    worker: workerEl.value,
    project: projectEl.value,
    panel: panelEl.value,
    notes: el("notes").value.trim(),
    startAt: start,
    lastResumeAt: start,
    endAt: null,
    accumulatedSeconds: 0,
    status: "Procesā"
  };
  state.jobs.push(job);
  state.activeJobId = job.id;
  el("notes").value = "";
  saveState();
});

el("pauseBtn").addEventListener("click", () => {
  const job = getActiveJob();
  if (!job) return;

  if (job.status === "Procesā") {
    job.accumulatedSeconds = effectiveSeconds(job);
    job.lastResumeAt = null;
    job.status = "Pauzē";
  } else {
    job.lastResumeAt = nowIso();
    job.status = "Procesā";
  }
  saveState();
});

el("finishBtn").addEventListener("click", () => {
  const job = getActiveJob();
  if (!job) return;
  if (!confirm(`Pabeigt paneli ${job.panel}?`)) return;

  job.accumulatedSeconds = effectiveSeconds(job);
  job.lastResumeAt = null;
  job.endAt = nowIso();
  job.status = "Pabeigts";
  state.activeJobId = null;
  saveState();
});

projectEl.addEventListener("change", renderSelectors);

function openPrompt(mode, title) {
  dialogMode = mode;
  el("dialogTitle").textContent = title;
  el("dialogInput").value = "";
  el("promptDialog").showModal();
  setTimeout(() => el("dialogInput").focus(), 50);
}

el("addWorkerBtn").addEventListener("click", () => openPrompt("worker", "Pievienot darbinieku"));
el("addProjectBtn").addEventListener("click", () => openPrompt("project", "Pievienot projektu"));
el("addPanelBtn").addEventListener("click", () => openPrompt("panel", "Pievienot paneli"));

el("promptDialog").addEventListener("close", () => {
  if (el("promptDialog").returnValue !== "default") return;
  const value = el("dialogInput").value.trim();
  if (!value) return;

  if (dialogMode === "worker" && !state.workers.includes(value)) {
    state.workers.push(value);
  }
  if (dialogMode === "project" && !state.projects[value]) {
    state.projects[value] = [];
  }
  if (dialogMode === "panel") {
    const project = projectEl.value;
    if (!state.projects[project].includes(value)) state.projects[project].push(value);
  }
  saveState();
});

el("demoBtn").addEventListener("click", () => {
  state.workers = ["Jānis", "Pēteris", "Andris"];
  state.projects = {
    "Māja Islande 01": ["1SB-01", "1SB-02", "1SB-03", "1R-E01"],
    "Māja Dānija 02": ["2SB-01", "2SB-02", "2J-01"]
  };
  saveState();
});

el("clearBtn").addEventListener("click", () => {
  if (!confirm("Tiešām dzēst visus saglabātos datus?")) return;
  state = structuredClone(defaultState);
  saveState();
});

el("exportBtn").addEventListener("click", () => {
  const rows = [
    ["Projekts","Panelis","Darbinieks","Sākums","Beigas","Ilgums sekundēs","Statuss","Piezīme"]
  ];
  state.jobs.forEach(j => rows.push([
    j.project, j.panel, j.worker, formatDateTime(j.startAt), formatDateTime(j.endAt),
    Math.round(effectiveSeconds(j)), j.status, j.notes || ""
  ]));
  const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(";")).join("\r\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `panelu_razosana_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  el("installBtn").classList.remove("hidden");
});

el("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  el("installBtn").classList.add("hidden");
});

setInterval(() => {
  el("clock").textContent = new Intl.DateTimeFormat("lv-LV", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  }).format(new Date());
  const job = getActiveJob();
  if (job) {
    el("timer").textContent = secondsToHms(effectiveSeconds(job));
    renderJobs();
  }
}, 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(console.error);
}

renderAll();
