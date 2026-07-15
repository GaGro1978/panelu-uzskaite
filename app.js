import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, onSnapshot, serverTimestamp,
  writeBatch, doc, query, where, runTransaction, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyCl6Bwf2oIMnDWKY-cZZUOJtWsJNcWr1nk",
  authDomain:"panelu-uzskaite.firebaseapp.com",
  projectId:"panelu-uzskaite",
  storageBucket:"panelu-uzskaite.firebasestorage.app",
  messagingSenderId:"431301329254",
  appId:"1:431301329254:web:bd3940bfff0c41d4e508a7"
};
const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
const S={factories:[],workers:[],objects:[],panels:[],sessions:[],preview:[],workerId:localStorage.getItem("pps_worker_id")||null};

const by=(list,id)=>list.find(x=>x.id===id);
const toDate=v=>!v?null:typeof v.toDate==="function"?v.toDate():new Date(v);
const fmt=v=>{const d=toDate(v);return d?new Intl.DateTimeFormat("lv-LV",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"—"};
const hms=s=>{s=Math.max(0,Math.floor(s||0));return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(v=>String(v).padStart(2,"0")).join(":")};
const elapsed=s=>{let t=s?.accumulatedSeconds||0;if(s?.status==="Procesā"&&s.lastResumeAt){const d=toDate(s.lastResumeAt);if(d)t+=(Date.now()-d.getTime())/1000}return t};
const currentWorker=()=>by(S.workers,S.workerId);
const activeForWorker=id=>S.sessions.find(s=>s.workerId===id&&(s.status==="Procesā"||s.status==="Pauzē"));
const activeForPanel=id=>S.sessions.filter(s=>s.panelId===id&&(s.status==="Procesā"||s.status==="Pauzē"));

function fill(el,items,all=null){
  if(!el)return;
  const old=el.value;el.innerHTML="";
  if(all!==null){const o=document.createElement("option");o.value="";o.textContent=all;el.appendChild(o)}
  items.forEach(i=>{const o=document.createElement("option");o.value=i.id;o.textContent=i.name;el.appendChild(o)});
  if([...el.options].some(o=>o.value===old))el.value=old;
}
function normalize(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ").replace(/[.]/g,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function num(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return v;const n=Number(String(v).replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:null}
function field(row,aliases){const keys=Object.keys(row);for(const a of aliases){const k=keys.find(x=>normalize(x)===normalize(a));if(k!==undefined)return row[k]}return null}
function mapRow(row,defaultFactoryName){
  const panelName=String(field(row,["Pan. Nr","Pan Nr","Panelis","Panel Nr"])??"").trim();
  const pcs=num(field(row,["PCS","Skaits"]))??1;
  const errors=[];if(!panelName)errors.push("Nav paneļa numura");if(pcs<=0)errors.push("Nederīgs skaits");
  return {
    panelName,pcs,
    length:num(field(row,["Pan. Lenght","Pan. Length","Garums"])),
    width:num(field(row,["Pan. Width","Platums","Biezums"])),
    height:num(field(row,["Pan. Height","Augstums"])),
    weight:num(field(row,["Weight","Svars"])),
    grossArea:num(field(row,["GrossA","Gross A","Platība","Platiba"])),
    designation:String(field(row,["Designation","Tips","Apzīmējums","Apzimejums"])??"").trim(),
    factoryName:String(field(row,["Rūpnīca","Rupnica","Factory"])??"").trim()||defaultFactoryName||"",
    status:"Nav sākts",assignedWorkerIds:[],errors,valid:errors.length===0
  };
}

function setupNav(){
  document.querySelectorAll(".main-tab").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".main-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".main-view").forEach(x=>x.classList.add("hidden"));
    b.classList.add("active");$(b.dataset.mainView).classList.remove("hidden");
  });
  document.querySelectorAll(".admin-tab").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(x=>x.classList.add("hidden"));
    b.classList.add("active");$(b.dataset.adminView).classList.remove("hidden");
  });
}

function renderIdentity(){
  fill($("identityFactory"),S.factories);
  fill($("identityWorker"),S.workers.filter(w=>w.factoryId===$("identityFactory")?.value));
  const w=currentWorker();
  $("identityCard").classList.toggle("hidden",!!w);$("workerCard").classList.toggle("hidden",!w);
  if(w){
    $("workerTitle").textContent=w.name;$("workerFactoryLabel").textContent=by(S.factories,w.factoryId)?.name||"";
    $("currentUserBadge").textContent=w.name;$("currentUserBadge").className="badge info";
  }else{
    $("currentUserBadge").textContent="Darbinieks nav izvēlēts";$("currentUserBadge").className="badge muted";
  }
}

function renderProduction(){
  const w=currentWorker();if(!w)return;
  const objects=S.objects.filter(o=>S.panels.some(p=>p.objectId===o.id&&p.factoryId===w.factoryId));
  fill($("workerObject"),objects,"Visi objekti");
  const active=activeForWorker(w.id);
  $("workerNoActive").classList.toggle("hidden",!!active);$("workerActiveBlock").classList.toggle("hidden",!active);
  if(active){
    $("workerActivePanel").textContent=active.panelName;$("workerActiveObject").textContent=by(S.objects,active.objectId)?.name||"";
    $("workerTimer").textContent=hms(elapsed(active));$("workerPauseBtn").textContent=active.status==="Pauzē"?"TURPINĀT":"PAUZE";
    const others=activeForPanel(active.panelId).filter(s=>s.workerId!==w.id);
    $("otherWorkersActive").textContent=others.length?`Pie paneļa vēl strādā: ${others.map(s=>s.workerName).join(", ")}`:"";
    return;
  }
  const objectId=$("workerObject").value,q=$("workerPanelSearch").value.trim().toLowerCase(),box=$("workerPanelList");box.innerHTML="";
  const panels=S.panels.filter(p=>{
    if(p.factoryId!==w.factoryId||p.status==="Pabeigts")return false;
    if(objectId&&p.objectId!==objectId)return false;
    if(q&&!String(p.panelName).toLowerCase().includes(q))return false;
    const a=p.assignedWorkerIds||[];return a.length===0||a.includes(w.id);
  });
  panels.forEach(p=>{
    const activeSessions=activeForPanel(p.id),row=document.createElement("div");row.className="production-row";
    const left=document.createElement("div");
    left.innerHTML=`<strong>${p.panelName}</strong><small>${by(S.objects,p.objectId)?.name||"—"} · ${activeSessions.length?`strādā: ${activeSessions.map(s=>s.workerName).join(", ")}`:"brīvs"}</small>`;
    const btn=document.createElement("button");btn.className="btn primary";btn.textContent=activeSessions.length?"PIEVIENOTIES":"SĀKT";btn.onclick=()=>startSession(p.id);
    row.append(left,btn);box.appendChild(row);
  });
  if(!panels.length)box.innerHTML='<p>Nav pieejamu paneļu.</p>';
}

async function startSession(panelId){
  const w=currentWorker(),p=by(S.panels,panelId);if(!w||!p)return;
  if(activeForWorker(w.id))return alert("Tev jau ir aktīvs darbs.");
  const others=activeForPanel(panelId);
  if(others.length&&!confirm(`Pie paneļa jau strādā ${others.map(s=>s.workerName).join(", ")}. Pievienoties?`))return;
  await runTransaction(db,async tx=>{
    const pr=doc(db,"panels",panelId),snap=await tx.get(pr),data=snap.data();
    if(data.status==="Pabeigts")throw new Error("Panelis jau pabeigts.");
    const sr=doc(collection(db,"sessions"));
    tx.set(sr,{panelId,panelName:data.panelName,objectId:data.objectId,factoryId:data.factoryId,workerId:w.id,workerName:w.name,status:"Procesā",startAt:serverTimestamp(),lastResumeAt:serverTimestamp(),accumulatedSeconds:0,endAt:null,createdAt:serverTimestamp()});
    tx.update(pr,{status:"Procesā"});
  });
}

function renderLive(){
  fill($("liveFactory"),S.factories,"Visas rūpnīcas");fill($("liveObject"),S.objects,"Visi objekti");
  const ff=$("liveFactory").value,fo=$("liveObject").value,panels=S.panels.filter(p=>(!ff||p.factoryId===ff)&&(!fo||p.objectId===fo));
  $("liveSummary").innerHTML=`<div><span>Nav sākts</span><strong>${panels.filter(p=>p.status==="Nav sākts").length}</strong></div><div><span>Procesā</span><strong>${panels.filter(p=>p.status==="Procesā").length}</strong></div><div><span>Pauzē</span><strong>${panels.filter(p=>p.status==="Pauzē").length}</strong></div><div><span>Pabeigts</span><strong>${panels.filter(p=>p.status==="Pabeigts").length}</strong></div>`;
  const sessions=S.sessions.filter(s=>(s.status==="Procesā"||s.status==="Pauzē")&&(!ff||s.factoryId===ff)&&(!fo||s.objectId===fo)),box=$("liveSessions");box.innerHTML="";
  sessions.forEach(s=>{const c=document.createElement("div");c.className="live-card";c.innerHTML=`<strong>${s.workerName}</strong><div>${s.panelName}</div><small>${by(S.objects,s.objectId)?.name||"—"} · ${s.status}</small><div class="live-time">${hms(elapsed(s))}</div>`;box.appendChild(c)});
  if(!sessions.length)box.innerHTML="<p>Nav aktīvu darbu.</p>";
}

function periodRange(v){
  const now=new Date(),a=new Date(now),b=new Date(now);
  if(v==="today"){a.setHours(0,0,0,0);b.setHours(23,59,59,999)}
  else if(v==="yesterday"){a.setDate(a.getDate()-1);a.setHours(0,0,0,0);b.setDate(b.getDate()-1);b.setHours(23,59,59,999)}
  else if(v==="week"){const day=(a.getDay()+6)%7;a.setDate(a.getDate()-day);a.setHours(0,0,0,0)}
  else if(v==="month"){a.setDate(1);a.setHours(0,0,0,0)}
  else return null;
  return {a,b};
}
function filteredSessions(){
  const ff=$("overviewFactory").value,fo=$("overviewObject").value,fw=$("overviewWorker").value,q=$("overviewSearch").value.trim().toLowerCase(),r=periodRange($("datePreset").value);
  return S.sessions.filter(s=>{
    if(ff&&s.factoryId!==ff||fo&&s.objectId!==fo||fw&&s.workerId!==fw||q&&!String(s.panelName).toLowerCase().includes(q))return false;
    if(r){const d=toDate(s.startAt);if(!d||d<r.a||d>r.b)return false}
    return true;
  });
}
function renderReport(){
  fill($("overviewFactory"),S.factories,"Visas rūpnīcas");fill($("overviewObject"),S.objects,"Visi objekti");fill($("overviewWorker"),S.workers,"Visi darbinieki");
  const ff=$("overviewFactory").value,fo=$("overviewObject").value,panels=S.panels.filter(p=>(!ff||p.factoryId===ff)&&(!fo||p.objectId===fo)),sessions=filteredSessions();
  $("countNotStarted").textContent=panels.filter(p=>p.status==="Nav sākts").length;$("countRunning").textContent=panels.filter(p=>p.status==="Procesā").length;$("countPaused").textContent=panels.filter(p=>p.status==="Pauzē").length;$("countDone").textContent=panels.filter(p=>p.status==="Pabeigts").length;$("totalTime").textContent=hms(sessions.reduce((a,s)=>a+elapsed(s),0));
  const body=$("overviewBody");body.innerHTML="";
  sessions.sort((a,b)=>(toDate(b.startAt)?.getTime()||0)-(toDate(a.startAt)?.getTime()||0)).forEach(s=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${by(S.factories,s.factoryId)?.name||"—"}</td><td>${by(S.objects,s.objectId)?.name||"—"}</td><td><strong>${s.panelName}</strong></td><td>${s.workerName}</td><td>${s.status}</td><td>${by(S.panels,s.panelId)?.status||"—"}</td><td>${fmt(s.startAt)}</td><td>${fmt(s.endAt)}</td><td>${hms(elapsed(s))}</td>`;body.appendChild(tr)});
}

function statusLabel(p){
  if(p.status==="Pabeigts")return {text:"Pabeigts",cls:"done"};
  if(activeForPanel(p.id).length)return {text:"Procesā",cls:"running"};
  return {text:"Brīvs",cls:""};
}
function renderPanels(){
  fill($("assignFactory"),S.factories,"Visas rūpnīcas");
  fill($("assignObject"),S.objects,"Visi objekti");

  const ff=$("assignFactory").value;
  const fo=$("assignObject").value;
  const q=$("assignSearch").value.trim().toLowerCase();
  const box=$("assignList");
  const header=$("panelTableHeader");
  box.innerHTML="";
  header.innerHTML="";

  const filteredPanels=S.panels
    .filter(p=>(!ff||p.factoryId===ff)&&(!fo||p.objectId===fo)&&(!q||String(p.panelName).toLowerCase().includes(q)))
    .slice(0,500);

  const visibleFactoryIds=[...new Set(filteredPanels.map(p=>p.factoryId).filter(Boolean))];
  const visibleWorkers=S.workers.filter(w=>!ff || w.factoryId===ff || visibleFactoryIds.includes(w.factoryId));

  const columns=[
    "minmax(150px,1.15fr)",
    "minmax(105px,.8fr)",
    ...visibleWorkers.map(()=> "minmax(90px,.65fr)"),
    "minmax(145px,1fr)",
    "74px"
  ];
  const template=columns.join(" ");

  header.style.gridTemplateColumns=template;
  const headers=[
    "Objekts / statuss",
    "Paneļa Nr.",
    ...visibleWorkers.map(w=>w.name),
    "Rūpnīca",
    "Darbība"
  ];
  headers.forEach(text=>{
    const cell=document.createElement("div");
    cell.className="panel-th";
    cell.textContent=text;
    header.appendChild(cell);
  });

  filteredPanels.forEach(p=>{
    const row=document.createElement("div");
    row.className="panel-table-row";
    row.style.gridTemplateColumns=template;

    const st=statusLabel(p);

    const meta=document.createElement("div");
    meta.className="panel-td panel-meta";
    meta.innerHTML=`<strong>${by(S.objects,p.objectId)?.name||"—"}</strong><span>${st.text}</span>`;

    const panelNo=document.createElement("div");
    panelNo.className="panel-td panel-number";
    panelNo.textContent=p.panelName;

    row.append(meta,panelNo);

    visibleWorkers.forEach(w=>{
      const cell=document.createElement("div");
      cell.className="panel-td worker-cell";

      if(w.factoryId!==p.factoryId){
        cell.innerHTML='<span class="not-applicable">—</span>';
      }else{
        const chip=document.createElement("button");
        chip.className=`worker-table-chip ${(p.assignedWorkerIds||[]).includes(w.id)?"active":""}`;
        chip.textContent=`👷 ${w.name}`;
        chip.title=(p.assignedWorkerIds||[]).includes(w.id)?"Noņemt piešķīrumu":"Piešķirt darbinieku";
        chip.onclick=async()=>{
          const cur=[...(p.assignedWorkerIds||[])];
          const next=cur.includes(w.id)?cur.filter(id=>id!==w.id):[...cur,w.id];
          await updateDoc(doc(db,"panels",p.id),{assignedWorkerIds:next});
        };
        cell.appendChild(chip);
      }
      row.appendChild(cell);
    });

    const factoryCell=document.createElement("div");
    factoryCell.className="panel-td";
    const fs=document.createElement("select");
    fs.className="factory-table-select";
    S.factories.forEach(f=>{
      const o=document.createElement("option");
      o.value=f.id;
      o.textContent=f.name;
      o.selected=f.id===p.factoryId;
      fs.appendChild(o);
    });
    fs.onchange=async()=>{
      const old=p.factoryId,newId=fs.value;
      if(activeForPanel(p.id).length){
        alert("Aktīvu paneli nevar pārcelt.");
        fs.value=old;
        return;
      }
      const f=by(S.factories,newId);
      if(!confirm(`Pārcelt ${p.panelName} uz ${f.name}?`)){
        fs.value=old;
        return;
      }
      await updateDoc(doc(db,"panels",p.id),{
        factoryId:newId,
        factoryName:f.name,
        assignedWorkerIds:[]
      });
    };
    factoryCell.appendChild(fs);

    const actionCell=document.createElement("div");
    actionCell.className="panel-td action-cell";
    const del=document.createElement("button");
    del.className="panel-delete";
    del.textContent="Dzēst";
    del.onclick=()=>deletePanel(p.id);
    actionCell.appendChild(del);

    row.append(factoryCell,actionCell);
    box.appendChild(row);
  });

  if(!filteredPanels.length){
    box.innerHTML='<div class="empty-table">Nav atrastu paneļu.</div>';
  }
}

async function deletePanel(id){
  const p=by(S.panels,id);if(!p)return;if(activeForPanel(id).length)return alert("Aktīvu paneli nevar dzēst.");
  const sessions=S.sessions.filter(s=>s.panelId===id);if(!confirm(`Dzēst ${p.panelName} un ${sessions.length} darba sesijas?`))return;
  for(let i=0;i<sessions.length;i+=450){const b=writeBatch(db);sessions.slice(i,i+450).forEach(s=>b.delete(doc(db,"sessions",s.id)));await b.commit()}
  await deleteDoc(doc(db,"panels",id));
}

function renderWorkers(){
  fill($("newWorkerFactory"),S.factories);
  const box=$("workerManage"),q=$("workerManageSearch").value.trim().toLowerCase();box.innerHTML="";
  S.workers.filter(w=>!q||w.name.toLowerCase().includes(q)).forEach(w=>{
    const row=document.createElement("div");row.className="manage-row";
    const info=document.createElement("div");info.innerHTML=`<strong>${w.name}</strong><small>${by(S.factories,w.factoryId)?.name||"—"} · ${S.sessions.filter(s=>s.workerId===w.id).length} sesijas</small>`;
    const fs=document.createElement("select");S.factories.forEach(f=>{const o=document.createElement("option");o.value=f.id;o.textContent=f.name;o.selected=f.id===w.factoryId;fs.appendChild(o)});
    fs.onchange=async()=>{if(activeForWorker(w.id)){alert("Aktīvu darbinieku nevar pārcelt.");fs.value=w.factoryId;return}await updateDoc(doc(db,"workers",w.id),{factoryId:fs.value})};
    const del=document.createElement("button");del.className="btn danger small";del.textContent="DZĒST";del.onclick=()=>deleteWorker(w.id);
    row.append(info,fs,del);box.appendChild(row);
  });
}
async function deleteWorker(id){
  const w=by(S.workers,id);if(activeForWorker(id))return alert("Darbiniekam ir aktīvs darbs.");
  if(!confirm(`Dzēst darbinieku ${w.name}?`))return;
  for(const p of S.panels.filter(p=>(p.assignedWorkerIds||[]).includes(id)))await updateDoc(doc(db,"panels",p.id),{assignedWorkerIds:(p.assignedWorkerIds||[]).filter(x=>x!==id)});
  await deleteDoc(doc(db,"workers",id));if(S.workerId===id){S.workerId=null;localStorage.removeItem("pps_worker_id")}
}
function renderFactories(){
  const box=$("factoryManage");box.innerHTML="";
  S.factories.forEach(f=>{const wc=S.workers.filter(w=>w.factoryId===f.id).length,pc=S.panels.filter(p=>p.factoryId===f.id).length,row=document.createElement("div");row.className="manage-row";const info=document.createElement("div");info.innerHTML=`<strong>${f.name}</strong><small>${wc} darbinieki · ${pc} paneļi</small>`;const spacer=document.createElement("div");const del=document.createElement("button");del.className="btn danger small";del.textContent="DZĒST";del.onclick=async()=>{if(wc||pc)return alert("Rūpnīca nav tukša.");if(confirm(`Dzēst ${f.name}?`))await deleteDoc(doc(db,"factories",f.id))};row.append(info,spacer,del);box.appendChild(row)});
}

function renderImport(){
  fill($("importObject"),S.objects);fill($("defaultFactory"),S.factories,"— nav piešķirta —");
}
function renderPreview(){
  const body=$("previewBody");body.innerHTML="";let ok=0,bad=0;
  S.preview.forEach(r=>{r.valid?ok++:bad++;const tr=document.createElement("tr");tr.innerHTML=`<td>${r.valid?"Derīgs":r.errors.join(", ")}</td><td><strong>${r.panelName||"—"}</strong></td><td>${r.pcs??"—"}</td><td>${r.length??"—"}</td><td>${r.width??"—"}</td><td>${r.height??"—"}</td><td>${r.weight??"—"}</td><td>${r.grossArea??"—"}</td><td>${r.designation||"—"}</td><td>${r.factoryName||"—"}</td>`;body.appendChild(tr)});
  $("previewCount").textContent=`${S.preview.length} rindas`;$("validationSummary").textContent=`Derīgas: ${ok} | Kļūdainas: ${bad}`;$("previewCard").classList.remove("hidden");$("importBtn").disabled=!ok||!$("importObject").value;
}

function renderDanger(){
  fill($("deleteObjectSelect"),S.objects,"Izvēlies objektu…");
  const o=by(S.objects,$("deleteObjectSelect").value),summary=$("deleteObjectSummary"),btn=$("deleteAllObjectPanelsBtn");
  if(!o){summary.textContent="Izvēlies objektu.";btn.disabled=true;return}
  const panels=S.panels.filter(p=>p.objectId===o.id),active=panels.filter(p=>activeForPanel(p.id).length),ids=new Set(panels.map(p=>p.id)),sessions=S.sessions.filter(s=>ids.has(s.panelId));
  summary.innerHTML=`Objektā <strong>${o.name}</strong>: ${panels.length} paneļi, ${sessions.length} sesijas, aktīvi ${active.length}.`;
  btn.disabled=!panels.length||active.length||$("deleteObjectConfirm").value.trim()!==o.name;
}

function exportCsv(){
  const rows=filteredSessions(),header=["Rūpnīca","Objekts","Panelis","Darbinieks","Sesijas statuss","Paneļa statuss","Sākums","Beigas","Laiks"];
  const data=rows.map(s=>[by(S.factories,s.factoryId)?.name||"",by(S.objects,s.objectId)?.name||"",s.panelName,s.workerName,s.status,by(S.panels,s.panelId)?.status||"",fmt(s.startAt),fmt(s.endAt),hms(elapsed(s))]);
  const csv=[header,...data].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n"),blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`PPS_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}

function renderAll(){renderIdentity();renderProduction();renderLive();renderReport();renderPanels();renderWorkers();renderFactories();renderImport();renderDanger()}
function subscribe(name,key){onSnapshot(collection(db,name),snap=>{S[key]=snap.docs.map(d=>({id:d.id,...d.data()}));$("connectionBadge").textContent="Tiešsaistē";$("connectionBadge").className="badge info";renderAll()},e=>{$("connectionBadge").textContent="Nav savienojuma";$("connectionBadge").className="badge muted";console.error(e)})}

setupNav();
subscribe("factories","factories");subscribe("workers","workers");subscribe("objects","objects");subscribe("panels","panels");subscribe("sessions","sessions");

$("identityFactory").onchange=renderIdentity;$("saveIdentityBtn").onclick=()=>{if(!$("identityWorker").value)return alert("Izvēlies darbinieku.");S.workerId=$("identityWorker").value;localStorage.setItem("pps_worker_id",S.workerId);renderAll()};$("changeIdentityBtn").onclick=()=>{S.workerId=null;localStorage.removeItem("pps_worker_id");renderAll()};
$("workerObject").onchange=renderProduction;$("workerPanelSearch").oninput=renderProduction;
$("workerPauseBtn").onclick=async()=>{const s=activeForWorker(S.workerId);if(!s)return;if(s.status==="Procesā"){await updateDoc(doc(db,"sessions",s.id),{status:"Pauzē",accumulatedSeconds:elapsed(s),lastResumeAt:null})}else await updateDoc(doc(db,"sessions",s.id),{status:"Procesā",lastResumeAt:serverTimestamp()})};
$("workerFinishBtn").onclick=async()=>{const s=activeForWorker(S.workerId);if(!s||!confirm(`Pabeigt savu darbu pie ${s.panelName}?`))return;await updateDoc(doc(db,"sessions",s.id),{status:"Pabeigts",accumulatedSeconds:elapsed(s),lastResumeAt:null,endAt:serverTimestamp()})};
["liveFactory","liveObject"].forEach(id=>$(id).onchange=renderLive);["datePreset","overviewFactory","overviewObject","overviewWorker"].forEach(id=>$(id).onchange=renderReport);$("overviewSearch").oninput=renderReport;$("exportCsvBtn").onclick=exportCsv;
["assignFactory","assignObject"].forEach(id=>$(id).onchange=renderPanels);$("assignSearch").oninput=renderPanels;$("workerManageSearch").oninput=renderWorkers;
$("addFactory").onclick=async()=>{const n=$("newFactory").value.trim();if(n){await addDoc(collection(db,"factories"),{name:n,createdAt:serverTimestamp()});$("newFactory").value=""}};
$("addWorker").onclick=async()=>{const n=$("newWorker").value.trim(),f=$("newWorkerFactory").value;if(n&&f){await addDoc(collection(db,"workers"),{name:n,factoryId:f,active:true,createdAt:serverTimestamp()});$("newWorker").value=""}};
$("createObjectBtn").onclick=async()=>{const n=$("objectName").value.trim();if(n){await addDoc(collection(db,"objects"),{name:n,active:true,createdAt:serverTimestamp()});$("objectName").value="";$("objectMessage").textContent="Objekts izveidots."}};
$("previewBtn").onclick=async()=>{const file=$("excelFile").files[0];if(!file)return alert("Izvēlies Excel failu.");const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:null,raw:true}),f=by(S.factories,$("defaultFactory").value);S.preview=rows.map(r=>mapRow(r,f?.name||"")).filter(r=>r.panelName||r.designation||r.errors.length);renderPreview()};
$("importObject").onchange=()=>{$("importBtn").disabled=!S.preview.some(r=>r.valid)||!$("importObject").value};
$("importBtn").onclick=async()=>{const objectId=$("importObject").value,valid=S.preview.filter(r=>r.valid),existing=await getDocs(query(collection(db,"panels"),where("objectId","==",objectId))),names=new Set(existing.docs.map(d=>String(d.data().panelName||"").toLowerCase())),rows=valid.filter(r=>!names.has(r.panelName.toLowerCase()));for(let i=0;i<rows.length;i+=450){const b=writeBatch(db);rows.slice(i,i+450).forEach(r=>{const f=S.factories.find(x=>x.name.toLowerCase()===r.factoryName.toLowerCase()),ref=doc(collection(db,"panels"));b.set(ref,{...r,objectId,factoryId:f?.id||null,assignedWorkerIds:[],importedAt:serverTimestamp()})});await b.commit()}$("importStatus").textContent=`Importēti ${rows.length} paneļi.`;S.preview=[];$("previewCard").classList.add("hidden")};
$("deleteObjectSelect").onchange=()=>{$("deleteObjectConfirm").value="";renderDanger()};$("deleteObjectConfirm").oninput=renderDanger;
$("deleteAllObjectPanelsBtn").onclick=async()=>{const o=by(S.objects,$("deleteObjectSelect").value),panels=S.panels.filter(p=>p.objectId===o.id),ids=new Set(panels.map(p=>p.id)),sessions=S.sessions.filter(s=>ids.has(s.panelId));if(!confirm(`Dzēst visus ${panels.length} objekta ${o.name} paneļus?`))return;for(let i=0;i<sessions.length;i+=450){const b=writeBatch(db);sessions.slice(i,i+450).forEach(s=>b.delete(doc(db,"sessions",s.id)));await b.commit()}for(let i=0;i<panels.length;i+=450){const b=writeBatch(db);panels.slice(i,i+450).forEach(p=>b.delete(doc(db,"panels",p.id)));await b.commit()}$("deleteObjectConfirm").value=""};
setInterval(()=>{renderProduction();renderLive();renderReport()},1000);
