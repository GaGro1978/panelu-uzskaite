import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, onSnapshot, serverTimestamp,
  writeBatch, doc, query, where, runTransaction, updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCl6Bwf2oIMnDWKY-cZZUOJtWsJNcWr1nk",
  authDomain: "panelu-uzskaite.firebaseapp.com",
  projectId: "panelu-uzskaite",
  storageBucket: "panelu-uzskaite.firebasestorage.app",
  messagingSenderId: "431301329254",
  appId: "1:431301329254:web:bd3940bfff0c41d4e508a7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

const state = {
  factories: [], workers: [], objects: [], panels: [], jobs: [],
  previewRows: [],
  activeJobId: localStorage.getItem("pps_active_job") || null
};

function byId(list,id){return list.find(x=>x.id===id)}
function toDate(v){if(!v)return null;if(typeof v.toDate==="function")return v.toDate();return new Date(v)}
function formatDate(v){const d=toDate(v);return d?new Intl.DateTimeFormat("lv-LV",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"—"}
function hms(sec){sec=Math.max(0,Math.floor(sec||0));return [Math.floor(sec/3600),Math.floor((sec%3600)/60),sec%60].map(v=>String(v).padStart(2,"0")).join(":")}
function elapsed(job){let t=job?.accumulatedSeconds||0;if(job?.status==="Procesā"&&job.lastResumeAt){const d=toDate(job.lastResumeAt);if(d)t+=(Date.now()-d.getTime())/1000}return t}
function activeJob(){return state.jobs.find(j=>j.id===state.activeJobId)}

function fill(select,items,allLabel=null){
  const old=select.value;select.innerHTML="";
  if(allLabel){const o=document.createElement("option");o.value="";o.textContent=allLabel;select.appendChild(o)}
  items.forEach(i=>{const o=document.createElement("option");o.value=i.id;o.textContent=i.name;select.appendChild(o)});
  if([...select.options].some(o=>o.value===old))select.value=old;
}

function normalizeHeader(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ").replace(/[.]/g,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function parseNumber(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return v;const n=Number(String(v).replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:null}
function findField(row,aliases){const keys=Object.keys(row);for(const alias of aliases){const key=keys.find(k=>normalizeHeader(k)===normalizeHeader(alias));if(key!==undefined)return row[key]}return null}

function mapRow(row,defaultFactoryName){
  const panelName=String(findField(row,["Pan. Nr","Pan Nr","Panelis","Panel Nr"])??"").trim();
  const pcs=parseNumber(findField(row,["PCS","Skaits"]))??1;
  const length=parseNumber(findField(row,["Pan. Lenght","Pan. Length","Garums"]));
  const width=parseNumber(findField(row,["Pan. Width","Platums","Biezums"]));
  const height=parseNumber(findField(row,["Pan. Height","Augstums"]));
  const weight=parseNumber(findField(row,["Weight","Svars"]));
  const grossArea=parseNumber(findField(row,["GrossA","Gross A","Platība","Platiba"]));
  const designation=String(findField(row,["Designation","Tips","Apzīmējums","Apzimejums"])??"").trim();
  const excelFactory=String(findField(row,["Rūpnīca","Rupnica","Factory"])??"").trim();
  const factoryName=excelFactory||defaultFactoryName||"";
  const errors=[];if(!panelName)errors.push("Nav paneļa numura");if(pcs<=0)errors.push("Nederīgs skaits");
  return {panelName,pcs,length,width,height,weight,grossArea,designation,factoryName,status:"Nav sākts",errors,valid:errors.length===0};
}

function renderSelectors(){
  fill($("prodFactory"),state.factories);
  const factoryId=$("prodFactory").value;
  fill($("prodWorker"),state.workers.filter(w=>w.factoryId===factoryId));
  fill($("prodObject"),state.objects);

  const objectId=$("prodObject").value;
  const search=$("panelSearch").value.trim().toLowerCase();
  const panels=state.panels.filter(p=>
    p.objectId===objectId &&
    (!p.factoryId || p.factoryId===factoryId) &&
    p.status!=="Pabeigts" &&
    (!search||String(p.panelName||"").toLowerCase().includes(search))
  );
  fill($("prodPanel"),panels.map(p=>({...p,name:p.panelName})));

  fill($("overviewFactory"),state.factories,"Visas rūpnīcas");
  fill($("overviewObject"),state.objects,"Visi objekti");
  fill($("importObject"),state.objects);
  fill($("defaultFactory"),state.factories,"— nav piešķirta —");
  fill($("newWorkerFactory"),state.factories);

  $("startBtn").disabled=!factoryId||!$("prodWorker").value||!objectId||!$("prodPanel").value||!!state.activeJobId;
}

function renderWorkers(){
  const body=$("workersBody");body.innerHTML="";
  state.workers.forEach(w=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${w.name}</strong></td><td>${byId(state.factories,w.factoryId)?.name||"—"}</td>`;
    body.appendChild(tr);
  });
}

function renderActive(){
  const j=activeJob();
  $("noActive").classList.toggle("hidden",!!j);
  $("activeBlock").classList.toggle("hidden",!j);
  if(!j){$("activeBadge").textContent="Nav aktīvs";$("activeBadge").className="badge muted";return}
  $("activeFactory").textContent=byId(state.factories,j.factoryId)?.name||"—";
  $("activeObject").textContent=byId(state.objects,j.objectId)?.name||"—";
  $("activePanel").textContent=j.panelName||"—";
  $("activeWorker").textContent=j.workerName||"—";
  $("activeBadge").textContent=j.status;
  $("activeBadge").className="badge "+(j.status==="Pauzē"?"paused":"running");
  $("pauseBtn").textContent=j.status==="Pauzē"?"TURPINĀT":"PAUZE";
  $("timer").textContent=hms(elapsed(j));
}

function renderOverview(){
  const ff=$("overviewFactory").value,fo=$("overviewObject").value,s=$("overviewSearch").value.trim().toLowerCase();
  const panels=state.panels.filter(p=>(!ff||p.factoryId===ff)&&(!fo||p.objectId===fo)&&(!s||String(p.panelName||"").toLowerCase().includes(s)));
  const c={n:0,r:0,p:0,d:0};
  panels.forEach(p=>{if(p.status==="Procesā")c.r++;else if(p.status==="Pauzē")c.p++;else if(p.status==="Pabeigts")c.d++;else c.n++});
  $("countNotStarted").textContent=c.n;$("countRunning").textContent=c.r;$("countPaused").textContent=c.p;$("countDone").textContent=c.d;
  const body=$("overviewBody");body.innerHTML="";
  panels.forEach(p=>{
    const job=state.jobs.find(j=>j.panelId===p.id&&j.status!=="Pabeigts")||[...state.jobs].reverse().find(j=>j.panelId===p.id);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${byId(state.factories,p.factoryId)?.name||p.factoryName||"—"}</td><td>${byId(state.objects,p.objectId)?.name||"—"}</td><td><strong>${p.panelName}</strong></td><td>${job?.workerName||"—"}</td><td>${p.status||"Nav sākts"}</td><td>${formatDate(job?.startAt)}</td><td>${formatDate(job?.endAt)}</td><td>${job?hms(elapsed(job)):"—"}</td>`;
    body.appendChild(tr);
  });
}

function renderPreview(){
  const body=$("previewBody");body.innerHTML="";let valid=0,invalid=0;
  state.previewRows.forEach(r=>{r.valid?valid++:invalid++;const tr=document.createElement("tr");tr.innerHTML=`<td class="${r.valid?"status-ok":"status-error"}">${r.valid?"Derīgs":r.errors.join(", ")}</td><td><strong>${r.panelName||"—"}</strong></td><td>${r.pcs??"—"}</td><td>${r.length??"—"}</td><td>${r.width??"—"}</td><td>${r.height??"—"}</td><td>${r.weight??"—"}</td><td>${r.grossArea??"—"}</td><td>${r.designation||"—"}</td><td>${r.factoryName||"—"}</td>`;body.appendChild(tr)});
  $("previewCount").textContent=`${state.previewRows.length} rindas`;
  $("validationSummary").innerHTML=`<strong>Derīgas:</strong> ${valid} &nbsp; | &nbsp; <strong>Kļūdainas:</strong> ${invalid}`;
  $("previewCard").classList.remove("hidden");
  $("importBtn").disabled=valid===0||!$("importObject").value;
}

function renderAll(){renderSelectors();renderWorkers();renderActive();renderOverview()}

function subscribe(name,key){
  onSnapshot(collection(db,name),snap=>{
    state[key]=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||a.panelName||"").localeCompare(b.name||b.panelName||"","lv"));
    $("connectionBadge").textContent="Tiešsaistē";$("connectionBadge").className="badge online";renderAll();
  },err=>{
    $("connectionBadge").textContent="Nav savienojuma";$("connectionBadge").className="badge offline";
    $("adminMessage").textContent=err.message;$("adminMessage").className="message error";
  });
}
subscribe("factories","factories");subscribe("workers","workers");subscribe("objects","objects");subscribe("panels","panels");subscribe("jobs","jobs");

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(b.dataset.view+"View").classList.remove("hidden");
}));

["prodFactory","prodObject"].forEach(id=>$(id).addEventListener("change",renderSelectors));
$("panelSearch").addEventListener("input",renderSelectors);
["overviewFactory","overviewObject"].forEach(id=>$(id).addEventListener("change",renderOverview));
$("overviewSearch").addEventListener("input",renderOverview);

$("addFactoryBtn").addEventListener("click",async()=>{
  const name=$("newFactoryName").value.trim();if(!name)return;
  if(state.factories.some(f=>f.name.toLowerCase()===name.toLowerCase()))return alert("Šāda rūpnīca jau eksistē.");
  await addDoc(collection(db,"factories"),{name,createdAt:serverTimestamp()});$("newFactoryName").value="";
});
$("addWorkerBtn").addEventListener("click",async()=>{
  const name=$("newWorkerName").value.trim(),factoryId=$("newWorkerFactory").value;if(!name||!factoryId)return;
  await addDoc(collection(db,"workers"),{name,factoryId,active:true,createdAt:serverTimestamp()});$("newWorkerName").value="";
});
$("createObjectBtn").addEventListener("click",async()=>{
  const name=$("objectName").value.trim();if(!name)return;
  if(state.objects.some(o=>o.name.toLowerCase()===name.toLowerCase()))return alert("Šāds objekts jau eksistē.");
  await addDoc(collection(db,"objects"),{name,active:true,createdAt:serverTimestamp()});$("objectName").value="";
});

$("previewBtn").addEventListener("click",async()=>{
  const file=$("excelFile").files[0];if(!file)return alert("Izvēlies Excel failu.");
  try{
    const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:"array"}),sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true});
    const factory=byId(state.factories,$("defaultFactory").value);
    state.previewRows=rows.map(r=>mapRow(r,factory?.name||"")).filter(r=>r.panelName||r.designation||r.errors.length);
    renderPreview();$("importStatus").textContent="Fails pārbaudīts.";$("importStatus").className="message success";
  }catch(e){$("importStatus").textContent=e.message;$("importStatus").className="message error"}
});

$("importBtn").addEventListener("click",async()=>{
  const objectId=$("importObject").value;if(!objectId)return;
  const valid=state.previewRows.filter(r=>r.valid);if(!valid.length)return;
  $("importBtn").disabled=true;$("importStatus").textContent="Importē...";
  try{
    const existing=await getDocs(query(collection(db,"panels"),where("objectId","==",objectId)));
    const names=new Set(existing.docs.map(d=>String(d.data().panelName||"").toLowerCase()));
    const rows=valid.filter(r=>!names.has(r.panelName.toLowerCase()));let imported=0;
    for(let i=0;i<rows.length;i+=450){
      const batch=writeBatch(db);
      rows.slice(i,i+450).forEach(r=>{
        const factory=state.factories.find(f=>f.name.toLowerCase()===r.factoryName.toLowerCase());
        const ref=doc(collection(db,"panels"));
        batch.set(ref,{...r,objectId,factoryId:factory?.id||null,importedAt:serverTimestamp()});
      });
      await batch.commit();imported+=Math.min(450,rows.length-i);
    }
    $("importStatus").textContent=`Pievienoti ${imported} paneļi. Dublikāti izlaisti: ${valid.length-rows.length}.`;$("importStatus").className="message success";
    state.previewRows=[];$("previewCard").classList.add("hidden");$("excelFile").value="";
  }catch(e){$("importStatus").textContent=e.message;$("importStatus").className="message error"}finally{$("importBtn").disabled=false}
});

$("startBtn").addEventListener("click",async()=>{
  const panelId=$("prodPanel").value,workerId=$("prodWorker").value,factoryId=$("prodFactory").value;
  const panel=byId(state.panels,panelId),worker=byId(state.workers,workerId);if(!panel||!worker)return;
  try{
    const jobId=await runTransaction(db,async tx=>{
      const pr=doc(db,"panels",panelId),snap=await tx.get(pr),p=snap.data();
      if(p.status==="Procesā"||p.status==="Pauzē")throw new Error("Šis panelis jau tiek ražots.");
      const jr=doc(collection(db,"jobs"));
      tx.set(jr,{panelId,panelName:p.panelName,objectId:p.objectId,factoryId,workerId,workerName:worker.name,note:$("prodNote").value.trim(),status:"Procesā",startAt:serverTimestamp(),lastResumeAt:serverTimestamp(),accumulatedSeconds:0,endAt:null,createdAt:serverTimestamp()});
      tx.update(pr,{status:"Procesā",factoryId,activeJobId:jr.id});
      return jr.id;
    });
    state.activeJobId=jobId;localStorage.setItem("pps_active_job",jobId);$("prodNote").value="";$("startMessage").textContent="Darbs sākts.";$("startMessage").className="message success";
  }catch(e){$("startMessage").textContent=e.message;$("startMessage").className="message error"}
});

$("pauseBtn").addEventListener("click",async()=>{
  const j=activeJob();if(!j)return;
  if(j.status==="Procesā"){
    await updateDoc(doc(db,"jobs",j.id),{status:"Pauzē",accumulatedSeconds:elapsed(j),lastResumeAt:null});
    await updateDoc(doc(db,"panels",j.panelId),{status:"Pauzē"});
  }else{
    await updateDoc(doc(db,"jobs",j.id),{status:"Procesā",lastResumeAt:serverTimestamp()});
    await updateDoc(doc(db,"panels",j.panelId),{status:"Procesā"});
  }
});

$("finishBtn").addEventListener("click",async()=>{
  const j=activeJob();if(!j||!confirm(`Pabeigt paneli ${j.panelName}?`))return;
  await updateDoc(doc(db,"jobs",j.id),{status:"Pabeigts",accumulatedSeconds:elapsed(j),lastResumeAt:null,endAt:serverTimestamp()});
  await updateDoc(doc(db,"panels",j.panelId),{status:"Pabeigts",activeJobId:null,completedAt:serverTimestamp()});
  state.activeJobId=null;localStorage.removeItem("pps_active_job");renderAll();
});

$("importObject").addEventListener("change",()=>{$("importBtn").disabled=!state.previewRows.some(r=>r.valid)||!$("importObject").value});
setInterval(()=>{const j=activeJob();if(j)$("timer").textContent=hms(elapsed(j));renderOverview()},1000);
