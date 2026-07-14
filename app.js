import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, onSnapshot,
  serverTimestamp, writeBatch, doc, query, where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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
const $ = id => document.getElementById(id);

const state = {
  objects: [],
  panels: [],
  previewRows: []
};

function normalizeHeader(value){
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ")
    .replace(/[.]/g,"")
    .replace(/[ā]/g,"a")
    .replace(/[ē]/g,"e")
    .replace(/[ī]/g,"i")
    .replace(/[ū]/g,"u")
    .replace(/[ģ]/g,"g")
    .replace(/[ķ]/g,"k")
    .replace(/[ļ]/g,"l")
    .replace(/[ņ]/g,"n")
    .replace(/[š]/g,"s")
    .replace(/[ž]/g,"z")
    .replace(/[č]/g,"c");
}

function parseNumber(value){
  if(value === null || value === undefined || value === "") return null;
  if(typeof value === "number") return value;
  const cleaned = String(value)
    .replace(/\s/g,"")
    .replace(",",".")
    .replace(/[^\d.-]/g,"");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function factoryName(value, fallback){
  const raw = String(value ?? "").trim();
  if(raw) return raw;
  return fallback || "";
}

function findField(row, aliases){
  const keys = Object.keys(row);
  for(const alias of aliases){
    const match = keys.find(k => normalizeHeader(k) === normalizeHeader(alias));
    if(match !== undefined) return row[match];
  }
  return null;
}

function mapRow(row, defaultFactory){
  const panelName = String(findField(row, ["Pan. Nr","Pan Nr","Panelis","Panel Nr"]) ?? "").trim();
  const pcs = parseNumber(findField(row, ["PCS","Skaits"])) ?? 1;
  const length = parseNumber(findField(row, ["Pan. Lenght","Pan. Length","Garums"]));
  const width = parseNumber(findField(row, ["Pan. Width","Platums","Biezums"]));
  const height = parseNumber(findField(row, ["Pan. Height","Augstums"]));
  const weightRaw = parseNumber(findField(row, ["Weight","Svars"]));
  const grossArea = parseNumber(findField(row, ["GrossA","Gross A","Platiba","Platība"]));
  const designation = String(findField(row, ["Designation","Tips","Apzimejums","Apzīmējums"]) ?? "").trim();
  const factory = factoryName(findField(row, ["Rūpnīca","Rupnica","Factory"]), defaultFactory);

  const errors = [];
  if(!panelName) errors.push("Nav paneļa numura");
  if(pcs <= 0) errors.push("Nederīgs skaits");

  return {
    panelName,
    pcs,
    length,
    width,
    height,
    weight: weightRaw,
    grossArea,
    designation,
    factory,
    status:"Nav sākts",
    errors,
    valid: errors.length === 0
  };
}

function fillObjectSelects(){
  const selects = [$("objectSelect"), $("panelObjectFilter")];
  selects.forEach((select,index)=>{
    const old = select.value;
    select.innerHTML = "";
    if(index === 1){
      const all = document.createElement("option");
      all.value = "";
      all.textContent = "Visi objekti";
      select.appendChild(all);
    }
    state.objects.forEach(object=>{
      const option = document.createElement("option");
      option.value = object.id;
      option.textContent = object.name;
      select.appendChild(option);
    });
    if([...select.options].some(o=>o.value===old)) select.value=old;
  });
}

function renderPreview(){
  const body = $("previewBody");
  body.innerHTML = "";
  let valid = 0;
  let invalid = 0;

  state.previewRows.forEach(row=>{
    row.valid ? valid++ : invalid++;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${row.valid?"status-ok":"status-error"}">${row.valid?"Derīgs":row.errors.join(", ")}</td>
      <td><strong>${row.panelName || "—"}</strong></td>
      <td>${row.pcs ?? "—"}</td>
      <td>${row.length ?? "—"}</td>
      <td>${row.width ?? "—"}</td>
      <td>${row.height ?? "—"}</td>
      <td>${row.weight ?? "—"}</td>
      <td>${row.grossArea ?? "—"}</td>
      <td>${row.designation || "—"}</td>
      <td>${row.factory || "—"}</td>`;
    body.appendChild(tr);
  });

  $("previewCount").textContent = `${state.previewRows.length} rindas`;
  $("validationSummary").innerHTML =
    `<strong>Derīgas:</strong> ${valid} &nbsp; | &nbsp; <strong>Kļūdainas:</strong> ${invalid}`;
  $("previewCard").classList.remove("hidden");
  $("importBtn").disabled = valid === 0 || !$("objectSelect").value;
}

function renderPanels(){
  const objectFilter = $("panelObjectFilter").value;
  const search = $("panelSearch").value.trim().toLowerCase();

  const filtered = state.panels.filter(panel =>
    (!objectFilter || panel.objectId === objectFilter) &&
    (!search || String(panel.panelName || "").toLowerCase().includes(search))
  );

  $("totalPanels").textContent = filtered.length;
  $("ventsCount").textContent = filtered.filter(p=>p.factory==="Ventspils").length;
  $("jekCount").textContent = filtered.filter(p=>p.factory==="Jēkabpils").length;
  $("balviCount").textContent = filtered.filter(p=>p.factory==="Balvi").length;

  const body = $("panelsBody");
  body.innerHTML = "";
  filtered.forEach(panel=>{
    const object = state.objects.find(o=>o.id===panel.objectId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${object?.name || "—"}</td>
      <td><strong>${panel.panelName || "—"}</strong></td>
      <td>${panel.pcs ?? "—"}</td>
      <td>${panel.length ?? "—"}</td>
      <td>${panel.width ?? "—"}</td>
      <td>${panel.height ?? "—"}</td>
      <td>${panel.weight ?? "—"}</td>
      <td>${panel.grossArea ?? "—"}</td>
      <td>${panel.designation || "—"}</td>
      <td>${panel.factory || "—"}</td>
      <td>${panel.status || "Nav sākts"}</td>`;
    body.appendChild(tr);
  });
}

onSnapshot(collection(db,"objects"), snapshot=>{
  state.objects = snapshot.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"","lv"));
  fillObjectSelects();
  $("connectionBadge").textContent = "Tiešsaistē";
  $("connectionBadge").className = "badge online";
}, error=>{
  $("connectionBadge").textContent = "Nav savienojuma";
  $("connectionBadge").className = "badge offline";
  $("objectMessage").textContent = error.message;
  $("objectMessage").className = "message error";
});

onSnapshot(collection(db,"panels"), snapshot=>{
  state.panels = snapshot.docs.map(d=>({id:d.id,...d.data()}));
  renderPanels();
});

$("createObjectBtn").addEventListener("click", async ()=>{
  const name = $("objectName").value.trim();
  if(!name) return;

  const duplicate = state.objects.some(o=>String(o.name).toLowerCase()===name.toLowerCase());
  if(duplicate){
    $("objectMessage").textContent = "Objekts ar šādu nosaukumu jau eksistē.";
    $("objectMessage").className = "message error";
    return;
  }

  await addDoc(collection(db,"objects"),{
    name,
    active:true,
    createdAt:serverTimestamp()
  });

  $("objectName").value = "";
  $("objectMessage").textContent = "Objekts izveidots.";
  $("objectMessage").className = "message success";
});

$("previewBtn").addEventListener("click", async ()=>{
  const file = $("excelFile").files[0];
  if(!file){
    $("importStatus").textContent = "Izvēlies Excel failu.";
    $("importStatus").className = "message error";
    return;
  }

  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer,{type:"array"});
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet,{defval:null,raw:true});
    const fallbackFactory = $("defaultFactory").value;

    state.previewRows = rows
      .map(row=>mapRow(row,fallbackFactory))
      .filter(row=>row.panelName || row.designation || row.errors.length);

    renderPreview();
    $("importStatus").textContent = "Fails pārbaudīts. Pārskati priekšskatījumu.";
    $("importStatus").className = "message success";
  }catch(error){
    $("importStatus").textContent = "Neizdevās nolasīt failu: " + error.message;
    $("importStatus").className = "message error";
  }
});

$("importBtn").addEventListener("click", async ()=>{
  const objectId = $("objectSelect").value;
  if(!objectId) return;

  const validRows = state.previewRows.filter(r=>r.valid);
  if(!validRows.length) return;

  $("importBtn").disabled = true;
  $("importStatus").textContent = "Importē paneļus…";
  $("importStatus").className = "message";

  try{
    const existingSnapshot = await getDocs(query(collection(db,"panels"),where("objectId","==",objectId)));
    const existingNames = new Set(
      existingSnapshot.docs.map(d=>String(d.data().panelName||"").toLowerCase())
    );

    const rowsToImport = validRows.filter(r=>!existingNames.has(r.panelName.toLowerCase()));
    const duplicates = validRows.length - rowsToImport.length;

    let imported = 0;
    for(let start=0; start<rowsToImport.length; start+=450){
      const batch = writeBatch(db);
      const part = rowsToImport.slice(start,start+450);
      part.forEach(row=>{
        const panelRef = doc(collection(db,"panels"));
        batch.set(panelRef,{
          ...row,
          objectId,
          importSource:"Excel",
          importedAt:serverTimestamp()
        });
      });
      await batch.commit();
      imported += part.length;
    }

    $("importStatus").textContent =
      `Imports pabeigts. Pievienoti ${imported} paneļi. Izlaisti dublikāti: ${duplicates}.`;
    $("importStatus").className = "message success";
    state.previewRows = [];
    $("previewCard").classList.add("hidden");
    $("excelFile").value = "";
  }catch(error){
    $("importStatus").textContent = "Importa kļūda: " + error.message;
    $("importStatus").className = "message error";
  }finally{
    $("importBtn").disabled = false;
  }
});

$("panelObjectFilter").addEventListener("change",renderPanels);
$("panelSearch").addEventListener("input",renderPanels);
$("objectSelect").addEventListener("change",()=>{
  $("importBtn").disabled = !state.previewRows.some(r=>r.valid) || !$("objectSelect").value;
});

document.querySelectorAll(".tab").forEach(button=>{
  button.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
    $(button.dataset.view+"View").classList.remove("hidden");
  });
});
