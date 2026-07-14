import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, onSnapshot,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCl6Bwf2oIMnDWKY-cZZUOJtWsJNcWr1nk",
  authDomain: "panelu-uzskaite.firebaseapp.com",
  projectId: "panelu-uzskaite",
  storageBucket: "panelu-uzskaite.firebasestorage.app",
  messagingSenderId: "431301329254",
  appId: "1:431301329254:web:bd3940bfff0c41d4e508a7"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const $ = id => document.getElementById(id);
const state = {
  factories: [], workers: [], objects: [], panels: [], jobs: [],
  activeJobId: localStorage.getItem("pps_active_job") || null
};

function toDate(value){
  if(!value) return null;
  if(typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}
function hms(seconds){
  seconds = Math.max(0, Math.floor(seconds || 0));
  return [Math.floor(seconds/3600), Math.floor((seconds%3600)/60), seconds%60]
    .map(v => String(v).padStart(2,"0")).join(":");
}
function elapsed(job){
  let total = job.accumulatedSeconds || 0;
  if(job.status === "Procesā" && job.lastResumeAt){
    const d = toDate(job.lastResumeAt);
    if(d) total += (Date.now() - d.getTime()) / 1000;
  }
  return total;
}
function byId(list,id){ return list.find(x => x.id === id); }
function activeJob(){ return state.jobs.find(j => j.id === state.activeJobId); }

function fillSelect(select, items, allLabel=null){
  const previous = select.value;
  select.innerHTML = "";
  if(allLabel){
    const option = document.createElement("option");
    option.value = "";
    option.textContent = allLabel;
    select.appendChild(option);
  }
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if([...select.options].some(o => o.value === previous)) select.value = previous;
}

function renderSelectors(){
  fillSelect($("factorySelect"), state.factories);
  const factoryId = $("factorySelect").value;

  fillSelect($("workerSelect"), state.workers.filter(w => w.factoryId === factoryId));
  fillSelect($("objectSelect"), state.objects);

  const objectId = $("objectSelect").value;
  fillSelect(
    $("panelSelect"),
    state.panels.filter(p =>
      p.factoryId === factoryId &&
      p.objectId === objectId &&
      p.status !== "Pabeigts"
    )
  );

  fillSelect($("filterFactory"), state.factories, "Visas rūpnīcas");
  fillSelect($("filterObject"), state.objects, "Visi objekti");

  fillSelect($("newWorkerFactory"), state.factories);
  fillSelect($("newPanelFactory"), state.factories);
  fillSelect($("newPanelObject"), state.objects);

  $("startBtn").disabled =
    !factoryId ||
    !$("workerSelect").value ||
    !objectId ||
    !$("panelSelect").value ||
    !!state.activeJobId;
}

function renderActive(){
  const job = activeJob();
  $("noActive").classList.toggle("hidden", !!job);
  $("activePanelBlock").classList.toggle("hidden", !job);

  if(!job){
    $("activeBadge").textContent = "Nav aktīvs";
    $("activeBadge").className = "badge muted";
    return;
  }

  $("activeFactory").textContent = byId(state.factories, job.factoryId)?.name || "—";
  $("activeObject").textContent = byId(state.objects, job.objectId)?.name || "—";
  $("activePanel").textContent = job.panelName || "—";
  $("activeWorker").textContent = job.workerName || "—";
  $("activeBadge").textContent = job.status;
  $("activeBadge").className = "badge " + (job.status === "Pauzē" ? "paused" : "running");
  $("pauseBtn").textContent = job.status === "Pauzē" ? "TURPINĀT" : "PAUZE";
  $("timer").textContent = hms(elapsed(job));
}

function renderOverview(){
  const factoryFilter = $("filterFactory").value;
  const objectFilter = $("filterObject").value;

  const panels = state.panels.filter(p =>
    (!factoryFilter || p.factoryId === factoryFilter) &&
    (!objectFilter || p.objectId === objectFilter)
  );

  const count = {notStarted:0,running:0,paused:0,done:0};
  panels.forEach(p => {
    if(p.status === "Procesā") count.running++;
    else if(p.status === "Pauzē") count.paused++;
    else if(p.status === "Pabeigts") count.done++;
    else count.notStarted++;
  });

  $("countNotStarted").textContent = count.notStarted;
  $("countRunning").textContent = count.running;
  $("countPaused").textContent = count.paused;
  $("countDone").textContent = count.done;

  const body = $("overviewBody");
  body.innerHTML = "";

  panels.forEach(panel => {
    const job =
      state.jobs.find(j => j.panelId === panel.id && j.status !== "Pabeigts") ||
      [...state.jobs].reverse().find(j => j.panelId === panel.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${byId(state.factories,panel.factoryId)?.name || "—"}</td>
      <td>${byId(state.objects,panel.objectId)?.name || "—"}</td>
      <td><strong>${panel.name}</strong></td>
      <td>${job?.workerName || "—"}</td>
      <td>${panel.status || "Nav sākts"}</td>
      <td>${job ? hms(elapsed(job)) : "—"}</td>
      <td>${panel.photoCount || 0}</td>`;
    body.appendChild(tr);
  });
}

function renderAll(){
  renderSelectors();
  renderActive();
  renderOverview();
}

function subscribeCollection(collectionName, stateKey){
  onSnapshot(
    collection(db, collectionName),
    snapshot => {
      state[stateKey] = snapshot.docs
        .map(d => ({id:d.id, ...d.data()}))
        .sort((a,b) => (a.name || "").localeCompare(b.name || "", "lv"));

      $("connectionBadge").textContent = "Tiešsaistē";
      $("connectionBadge").className = "badge online";
      $("systemStatus").textContent =
        "Firebase savienojums darbojas.\nDati sinhronizējas reāllaikā.";
      renderAll();
    },
    error => {
      $("connectionBadge").textContent = "Nav savienojuma";
      $("connectionBadge").className = "badge offline";
      $("systemStatus").textContent =
        "Firebase kļūda:\n" + error.message +
        "\n\nPārbaudi Firestore Rules un GitHub failu versiju.";
    }
  );
}

subscribeCollection("factories","factories");
subscribeCollection("workers","workers");
subscribeCollection("objects","objects");
subscribeCollection("panels","panels");
subscribeCollection("jobs","jobs");

$("factorySelect").addEventListener("change", renderSelectors);
$("objectSelect").addEventListener("change", renderSelectors);
$("filterFactory").addEventListener("change", renderOverview);
$("filterObject").addEventListener("change", renderOverview);

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    $(button.dataset.view + "View").classList.remove("hidden");
  });
});

$("addFactoryBtn").addEventListener("click", async () => {
  const name = $("newFactoryName").value.trim();
  if(!name) return;
  await addDoc(collection(db,"factories"), {name, createdAt:serverTimestamp()});
  $("newFactoryName").value = "";
});

$("addWorkerBtn").addEventListener("click", async () => {
  const name = $("newWorkerName").value.trim();
  const factoryId = $("newWorkerFactory").value;
  if(!name || !factoryId) return;
  await addDoc(collection(db,"workers"), {
    name, factoryId, active:true, createdAt:serverTimestamp()
  });
  $("newWorkerName").value = "";
});

$("addObjectBtn").addEventListener("click", async () => {
  const name = $("newObjectName").value.trim();
  if(!name) return;
  await addDoc(collection(db,"objects"), {name, active:true, createdAt:serverTimestamp()});
  $("newObjectName").value = "";
});

$("addPanelBtn").addEventListener("click", async () => {
  const name = $("newPanelName").value.trim();
  const objectId = $("newPanelObject").value;
  const factoryId = $("newPanelFactory").value;
  if(!name || !objectId || !factoryId) return;

  await addDoc(collection(db,"panels"), {
    name, objectId, factoryId,
    status:"Nav sākts",
    photoCount:0,
    createdAt:serverTimestamp()
  });
  $("newPanelName").value = "";
});

$("startBtn").addEventListener("click", async () => {
  const panelId = $("panelSelect").value;
  const workerId = $("workerSelect").value;
  const panel = byId(state.panels,panelId);
  const worker = byId(state.workers,workerId);
  if(!panel || !worker) return;

  try{
    const jobId = await runTransaction(db, async transaction => {
      const panelRef = doc(db,"panels",panelId);
      const panelSnapshot = await transaction.get(panelRef);
      const latestPanel = panelSnapshot.data();

      if(latestPanel.status === "Procesā" || latestPanel.status === "Pauzē"){
        throw new Error("Šis panelis jau tiek ražots.");
      }

      const jobRef = doc(collection(db,"jobs"));
      transaction.set(jobRef,{
        panelId,
        panelName:latestPanel.name,
        objectId:latestPanel.objectId,
        factoryId:latestPanel.factoryId,
        workerId,
        workerName:worker.name,
        note:$("noteInput").value.trim(),
        status:"Procesā",
        startAt:serverTimestamp(),
        lastResumeAt:serverTimestamp(),
        accumulatedSeconds:0,
        endAt:null,
        createdAt:serverTimestamp()
      });
      transaction.update(panelRef,{
        status:"Procesā",
        activeJobId:jobRef.id
      });
      return jobRef.id;
    });

    state.activeJobId = jobId;
    localStorage.setItem("pps_active_job",jobId);
    $("noteInput").value = "";
  }catch(error){
    alert(error.message);
  }
});

$("pauseBtn").addEventListener("click", async () => {
  const job = activeJob();
  if(!job) return;

  const jobRef = doc(db,"jobs",job.id);
  const panelRef = doc(db,"panels",job.panelId);

  if(job.status === "Procesā"){
    await updateDoc(jobRef,{
      status:"Pauzē",
      accumulatedSeconds:elapsed(job),
      lastResumeAt:null
    });
    await updateDoc(panelRef,{status:"Pauzē"});
  }else{
    await updateDoc(jobRef,{
      status:"Procesā",
      lastResumeAt:serverTimestamp()
    });
    await updateDoc(panelRef,{status:"Procesā"});
  }
});

$("finishBtn").addEventListener("click", async () => {
  const job = activeJob();
  if(!job || !confirm(`Pabeigt paneli ${job.panelName}?`)) return;

  await updateDoc(doc(db,"jobs",job.id),{
    status:"Pabeigts",
    accumulatedSeconds:elapsed(job),
    lastResumeAt:null,
    endAt:serverTimestamp()
  });
  await updateDoc(doc(db,"panels",job.panelId),{
    status:"Pabeigts",
    activeJobId:null
  });

  state.activeJobId = null;
  localStorage.removeItem("pps_active_job");
  renderAll();
});

$("uploadPhotoBtn").addEventListener("click", async () => {
  const job = activeJob();
  const file = $("photoInput").files[0];
  if(!job) return alert("Nav aktīva paneļa.");
  if(!file) return alert("Izvēlies foto.");

  $("photoStatus").textContent = "Augšupielādē foto…";

  try{
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const storagePath =
      `photos/${job.objectId}/${job.panelId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage,storagePath);

    await uploadBytes(storageRef,file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db,"photos"),{
      panelId:job.panelId,
      objectId:job.objectId,
      factoryId:job.factoryId,
      jobId:job.id,
      workerId:job.workerId,
      workerName:job.workerName,
      comment:$("photoComment").value.trim(),
      url,
      storagePath,
      createdAt:serverTimestamp()
    });

    const panel = byId(state.panels,job.panelId);
    await updateDoc(doc(db,"panels",job.panelId),{
      photoCount:(panel?.photoCount || 0) + 1
    });

    $("photoInput").value = "";
    $("photoComment").value = "";
    $("photoStatus").textContent = "Foto pievienots.";
  }catch(error){
    $("photoStatus").textContent =
      "Foto kļūda: " + error.message +
      " (pārbaudi Firebase Storage un Storage Rules)";
  }
});

setInterval(() => {
  const job = activeJob();
  if(job) $("timer").textContent = hms(elapsed(job));
  renderOverview();
},1000);

renderAll();
