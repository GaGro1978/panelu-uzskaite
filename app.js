import{initializeApp}from"https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";import{getFirestore,collection,addDoc,getDocs,onSnapshot,serverTimestamp,writeBatch,doc,query,where,runTransaction,updateDoc,deleteDoc}from"https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
const cfg={apiKey:"AIzaSyCl6Bwf2oIMnDWKY-cZZUOJtWsJNcWr1nk",authDomain:"panelu-uzskaite.firebaseapp.com",projectId:"panelu-uzskaite",storageBucket:"panelu-uzskaite.firebasestorage.app",messagingSenderId:"431301329254",appId:"1:431301329254:web:bd3940bfff0c41d4e508a7"};
const db=getFirestore(initializeApp(cfg)),$=id=>document.getElementById(id),S={factories:[],workers:[],objects:[],panels:[],sessions:[],preview:[],workerId:localStorage.getItem("pps_worker_id")||null};
const by=(a,id)=>a.find(x=>x.id===id),date=v=>!v?null:typeof v.toDate==="function"?v.toDate():new Date(v),fmt=v=>{const d=date(v);return d?new Intl.DateTimeFormat("lv-LV",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"—"},hms=s=>{s=Math.max(0,Math.floor(s||0));return[Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(v=>String(v).padStart(2,"0")).join(":")},elapsed=s=>{let t=s?.accumulatedSeconds||0;if(s?.status==="Procesā"&&s.lastResumeAt){const d=date(s.lastResumeAt);if(d)t+=(Date.now()-d.getTime())/1000}return t},worker=()=>by(S.workers,S.workerId),activeForWorker=id=>S.sessions.find(s=>s.workerId===id&&["Procesā","Pauzē"].includes(s.status)),activeForPanel=id=>S.sessions.filter(s=>s.panelId===id&&["Procesā","Pauzē"].includes(s.status));
function fill(el,items,all=null){const old=el.value;el.innerHTML="";if(all){const o=document.createElement("option");o.value="";o.textContent=all;el.appendChild(o)}items.forEach(i=>{const o=document.createElement("option");o.value=i.id;o.textContent=i.name;el.appendChild(o)});if([...el.options].some(o=>o.value===old))el.value=old}
const norm=v=>String(v??"").trim().toLowerCase().replace(/\s+/g," ").replace(/[.]/g,"").normalize("NFD").replace(/[\u0300-\u036f]/g,""),num=v=>{if(v==null||v==="")return null;if(typeof v==="number")return v;const n=Number(String(v).replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:null},field=(r,a)=>{for(const x of a){const k=Object.keys(r).find(k=>norm(k)===norm(x));if(k!==undefined)return r[k]}return null};
function mapRow(r,def){const panelName=String(field(r,["Pan. Nr","Pan Nr","Panelis","Panel Nr"])??"").trim(),pcs=num(field(r,["PCS","Skaits"]))??1,length=num(field(r,["Pan. Lenght","Pan. Length","Garums"])),width=num(field(r,["Pan. Width","Platums","Biezums"])),height=num(field(r,["Pan. Height","Augstums"])),weight=num(field(r,["Weight","Svars"])),grossArea=num(field(r,["GrossA","Gross A","Platība","Platiba"])),designation=String(field(r,["Designation","Tips","Apzīmējums","Apzimejums"])??"").trim(),factoryName=String(field(r,["Rūpnīca","Rupnica","Factory"])??"").trim()||def||"",errors=[];if(!panelName)errors.push("Nav paneļa numura");if(pcs<=0)errors.push("Nederīgs skaits");return{panelName,pcs,length,width,height,weight,grossArea,designation,factoryName,status:"Nav sākts",assignedWorkerIds:[],errors,valid:!errors.length}}
function renderIdentity(){fill($("idFactory"),S.factories);fill($("idWorker"),S.workers.filter(w=>w.factoryId===$("idFactory").value));const w=worker();$("identityCard").classList.toggle("hidden",!!w);$("workerCard").classList.toggle("hidden",!w);$("userBadge").textContent=w?w.name:"Darbinieks nav izvēlēts";$("userBadge").className="badge "+(w?"info":"muted");if(w){$("workerName").textContent=w.name;$("workerFactory").textContent=by(S.factories,w.factoryId)?.name||""}}
function renderWorker(){const w=worker(),box=$("workerPanels");box.innerHTML="";if(!w)return;fill($("workerObject"),S.objects.filter(o=>S.panels.some(p=>p.objectId===o.id&&p.factoryId===w.factoryId)));const act=activeForWorker(w.id);$("noActive").classList.toggle("hidden",!!act);$("activeBlock").classList.toggle("hidden",!act);if(act){const p=by(S.panels,act.panelId);$("activePanel").textContent=p?.panelName||act.panelName;$("activeObject").textContent=by(S.objects,act.objectId)?.name||"";$("timer").textContent=hms(elapsed(act));$("pauseBtn").textContent=act.status==="Pauzē"?"TURPINĀT":"PAUZE";const others=activeForPanel(act.panelId).filter(s=>s.workerId!==w.id);$("otherWorkers").textContent=others.length?"Pie šī paneļa vēl strādā: "+others.map(s=>s.workerName).join(", "):"";return}
const obj=$("workerObject").value,q=$("workerSearch").value.trim().toLowerCase(),panels=S.panels.filter(p=>p.factoryId===w.factoryId&&p.status!=="Pabeigts"&&(!obj||p.objectId===obj)&&(!q||String(p.panelName).toLowerCase().includes(q))&&((p.assignedWorkerIds||[]).length===0||(p.assignedWorkerIds||[]).includes(w.id)));
if(!panels.length){box.innerHTML='<div class="hint">Nav pieejamu paneļu.</div>';return}panels.forEach(p=>{const a=activeForPanel(p.id),assigned=(p.assignedWorkerIds||[]).includes(w.id),type=assigned?"assigned":a.length?"occupied":"free",item=document.createElement("div");item.className="panelChoice "+type;const left=document.createElement("div");left.innerHTML=`<strong>${p.panelName}</strong><small>${by(S.objects,p.objectId)?.name||"—"} · ${a.length?"strādā: "+a.map(s=>s.workerName).join(", "):assigned?"piešķirts tev":"brīvs"}</small>`;const b=document.createElement("button");b.className="primary";b.textContent=a.length?"PIEVIENOTIES":"SĀKT";b.onclick=()=>startSession(p.id);item.append(left,b);box.appendChild(item)})}
async function startSession(panelId){const w=worker();if(!w)return;if(activeForWorker(w.id))return alert("Tev jau ir aktīvs darbs.");const p=by(S.panels,panelId),a=activeForPanel(panelId);if(a.length&&!confirm(`Pie šī paneļa jau strādā ${a.map(s=>s.workerName).join(", ")}. Pievienoties?`))return;try{await runTransaction(db,async tx=>{const pr=doc(db,"panels",panelId),snap=await tx.get(pr),pd=snap.data();if(pd.status==="Pabeigts")throw Error("Panelis jau pabeigts.");const sr=doc(collection(db,"sessions"));tx.set(sr,{panelId,panelName:pd.panelName,objectId:pd.objectId,factoryId:pd.factoryId,workerId:w.id,workerName:w.name,status:"Procesā",startAt:serverTimestamp(),lastResumeAt:serverTimestamp(),accumulatedSeconds:0,endAt:null,createdAt:serverTimestamp()});tx.update(pr,{status:"Procesā"})})}catch(e){alert(e.message)}}
function renderLive(){fill($("liveFactory"),S.factories,"Visas rūpnīcas");fill($("liveObject"),S.objects,"Visi objekti");const ff=$("liveFactory").value,fo=$("liveObject").value,p=S.panels.filter(x=>(!ff||x.factoryId===ff)&&(!fo||x.objectId===fo)),a=S.sessions.filter(x=>["Procesā","Pauzē"].includes(x.status)&&(!ff||x.factoryId===ff)&&(!fo||x.objectId===fo));$("liveSummary").innerHTML=`<div><span>Nav sākts</span><strong>${p.filter(x=>x.status==="Nav sākts").length}</strong></div><div><span>Procesā</span><strong>${p.filter(x=>x.status==="Procesā").length}</strong></div><div><span>Pauzē</span><strong>${p.filter(x=>x.status==="Pauzē").length}</strong></div><div><span>Pabeigts</span><strong>${p.filter(x=>x.status==="Pabeigts").length}</strong></div>`;const g=$("liveCards");g.innerHTML="";a.forEach(s=>{const c=document.createElement("div");c.className="liveCard";c.innerHTML=`<strong>${s.workerName}</strong><div>${s.panelName}</div><small>${by(S.objects,s.objectId)?.name||"—"} · ${s.status}</small><div class="clock">${hms(elapsed(s))}</div>`;g.appendChild(c)});if(!a.length)g.innerHTML='<div class="hint">Nav aktīvu darbu.</div>'}
function range(p){const n=new Date(),s=new Date(n),e=new Date(n);if(p==="today"){s.setHours(0,0,0,0);e.setHours(23,59,59,999)}else if(p==="yesterday"){s.setDate(s.getDate()-1);s.setHours(0,0,0,0);e.setDate(e.getDate()-1);e.setHours(23,59,59,999)}else if(p==="week"){const d=(s.getDay()+6)%7;s.setDate(s.getDate()-d);s.setHours(0,0,0,0);e.setHours(23,59,59,999)}else if(p==="month"){s.setDate(1);s.setHours(0,0,0,0);e.setHours(23,59,59,999)}else return null;return{s,e}}
function filtered(){const ff=$("repFactory").value,fo=$("repObject").value,fw=$("repWorker").value,q=$("repSearch").value.trim().toLowerCase(),r=range($("period").value);return S.sessions.filter(s=>{if(ff&&s.factoryId!==ff||fo&&s.objectId!==fo||fw&&s.workerId!==fw||q&&!String(s.panelName).toLowerCase().includes(q))return false;if(r){const d=date(s.startAt);if(!d||d<r.s||d>r.e)return false}return true})}
function renderReport(){fill($("repFactory"),S.factories,"Visas rūpnīcas");fill($("repObject"),S.objects,"Visi objekti");fill($("repWorker"),S.workers,"Visi darbinieki");const ff=$("repFactory").value,fo=$("repObject").value,p=S.panels.filter(x=>(!ff||x.factoryId===ff)&&(!fo||x.objectId===fo));$("cNew").textContent=p.filter(x=>x.status==="Nav sākts").length;$("cRun").textContent=p.filter(x=>x.status==="Procesā").length;$("cPause").textContent=p.filter(x=>x.status==="Pauzē").length;$("cDone").textContent=p.filter(x=>x.status==="Pabeigts").length;const rows=filtered();$("cTime").textContent=hms(rows.reduce((a,s)=>a+elapsed(s),0));const b=$("reportBody");b.innerHTML="";rows.sort((a,b)=>(date(b.startAt)?.getTime()||0)-(date(a.startAt)?.getTime()||0)).forEach(s=>{const p=by(S.panels,s.panelId),tr=document.createElement("tr");tr.innerHTML=`<td>${by(S.factories,s.factoryId)?.name||"—"}</td><td>${by(S.objects,s.objectId)?.name||"—"}</td><td><strong>${s.panelName}</strong></td><td>${s.workerName}</td><td>${s.status}</td><td>${p?.status||"—"}</td><td>${fmt(s.startAt)}</td><td>${fmt(s.endAt)}</td><td>${hms(elapsed(s))}</td>`;b.appendChild(tr)})}
function panelHasActiveSessions(panelId){return activeForPanel(panelId).length>0}
async function movePanelToFactory(panelId,factoryId){
  const p=by(S.panels,panelId);
  if(!p||!factoryId)return;
  if(panelHasActiveSessions(panelId))return alert("Aktīvu paneli nevar pārcelt uz citu rūpnīcu.");
  const f=by(S.factories,factoryId);
  if(!f)return;
  if(!confirm(`Pārcelt paneli ${p.panelName} uz rūpnīcu ${f.name}? Piešķirtie darbinieki tiks noņemti.`))return;
  await updateDoc(doc(db,"panels",panelId),{
    factoryId,
    factoryName:f.name,
    assignedWorkerIds:[]
  });
}
async function deletePanelWithSessions(panelId){
  const p=by(S.panels,panelId);
  if(!p)return;
  if(panelHasActiveSessions(panelId))return alert("Aktīvu paneli nevar dzēst. Darbiniekiem vispirms jāpabeidz savs darbs.");
  const sessions=S.sessions.filter(s=>s.panelId===panelId);
  if(!confirm(`Neatgriezeniski dzēst paneli ${p.panelName} un ${sessions.length} darba sesijas?`))return;
  for(let i=0;i<sessions.length;i+=450){
    const batch=writeBatch(db);
    sessions.slice(i,i+450).forEach(s=>batch.delete(doc(db,"sessions",s.id)));
    await batch.commit();
  }
  await deleteDoc(doc(db,"panels",panelId));
}
async function deleteWorker(workerId){
  const w=by(S.workers,workerId);
  if(!w)return;
  if(activeForWorker(workerId))return alert("Darbiniekam ir aktīvs darbs. Vispirms tas jāpabeidz.");
  if(!confirm(`Dzēst darbinieku ${w.name}? Viņa vēsturiskās darba sesijas pārskatos paliks.`))return;

  const affected=S.panels.filter(p=>(p.assignedWorkerIds||[]).includes(workerId));
  for(let i=0;i<affected.length;i+=450){
    const batch=writeBatch(db);
    affected.slice(i,i+450).forEach(p=>{
      batch.update(doc(db,"panels",p.id),{
        assignedWorkerIds:(p.assignedWorkerIds||[]).filter(id=>id!==workerId)
      });
    });
    await batch.commit();
  }
  await deleteDoc(doc(db,"workers",workerId));
  if(S.workerId===workerId){
    S.workerId=null;
    localStorage.removeItem("pps_worker_id");
  }
}
async function deleteFactory(factoryId){
  const f=by(S.factories,factoryId);
  if(!f)return;
  const workers=S.workers.filter(w=>w.factoryId===factoryId);
  const panels=S.panels.filter(p=>p.factoryId===factoryId);
  if(workers.length||panels.length){
    return alert(`Rūpnīcu nevar dzēst. Tai vēl piesaistīti ${workers.length} darbinieki un ${panels.length} paneļi. Vispirms izdzēs darbiniekus vai pārcel paneļus.`);
  }
  if(confirm(`Dzēst rūpnīcu ${f.name}?`))await deleteDoc(doc(db,"factories",factoryId));
}
function renderDataManagement(){
  const factoryBox=$("factoryManage");
  if(factoryBox){
    factoryBox.innerHTML="";
    S.factories.forEach(f=>{
      const row=document.createElement("div");row.className="manageRow";
      const info=document.createElement("div");
      const wc=S.workers.filter(w=>w.factoryId===f.id).length;
      const pc=S.panels.filter(p=>p.factoryId===f.id).length;
      info.innerHTML=`<strong>${f.name}</strong><small>${wc} darbinieki · ${pc} paneļi</small>`;
      const spacer=document.createElement("div");
      const buttons=document.createElement("div");buttons.className="manageButtons";
      const del=document.createElement("button");del.className="softDanger";del.textContent="DZĒST RŪPNĪCU";del.onclick=()=>deleteFactory(f.id);
      buttons.appendChild(del);row.append(info,spacer,buttons);factoryBox.appendChild(row);
    });
  }

  const workerBox=$("workerManage");
  if(workerBox){
    workerBox.innerHTML="";
    S.workers.forEach(w=>{
      const row=document.createElement("div");row.className="manageRow";
      const info=document.createElement("div");
      const historical=S.sessions.filter(s=>s.workerId===w.id).length;
      info.innerHTML=`<strong>${w.name}</strong><small>${by(S.factories,w.factoryId)?.name||"—"} · ${historical} darba sesijas</small>`;
      const factorySelect=document.createElement("select");
      S.factories.forEach(f=>{
        const o=document.createElement("option");o.value=f.id;o.textContent=f.name;o.selected=f.id===w.factoryId;factorySelect.appendChild(o);
      });
      factorySelect.onchange=async()=>{
        if(activeForWorker(w.id)){factorySelect.value=w.factoryId;return alert("Aktīvu darbinieku nevar pārcelt uz citu rūpnīcu.");}
        const oldFactory=w.factoryId,newFactory=factorySelect.value;
        if(!confirm(`Pārcelt ${w.name} uz ${by(S.factories,newFactory)?.name}?`)){factorySelect.value=oldFactory;return}
        const affected=S.panels.filter(p=>(p.assignedWorkerIds||[]).includes(w.id));
        for(let i=0;i<affected.length;i+=450){
          const batch=writeBatch(db);
          affected.slice(i,i+450).forEach(p=>batch.update(doc(db,"panels",p.id),{
            assignedWorkerIds:(p.assignedWorkerIds||[]).filter(id=>id!==w.id)
          }));
          await batch.commit();
        }
        await updateDoc(doc(db,"workers",w.id),{factoryId:newFactory});
      };
      const buttons=document.createElement("div");buttons.className="manageButtons";
      const del=document.createElement("button");del.className="softDanger";del.textContent="DZĒST DARBINIEKU";del.onclick=()=>deleteWorker(w.id);
      buttons.appendChild(del);row.append(info,factorySelect,buttons);workerBox.appendChild(row);
    });
  }
}
function renderAssignments(){
  fill($("assignFactory"),S.factories,"Visas rūpnīcas");
  fill($("assignObject"),S.objects,"Visi objekti");
  fill($("transferFactory"),S.factories,"Pārcelt izvēlētos uz rūpnīcu…");

  const ff=$("assignFactory").value,fo=$("assignObject").value,q=$("assignSearch").value.trim().toLowerCase();
  const panels=S.panels.filter(p=>(!ff||p.factoryId===ff)&&(!fo||p.objectId===fo)&&(!q||String(p.panelName).toLowerCase().includes(q)));
  const list=$("assignList");list.innerHTML="";

  panels.slice(0,400).forEach(p=>{
    const item=document.createElement("div");item.className="assignItem";
    const assigned=p.assignedWorkerIds||[],workers=S.workers.filter(w=>w.factoryId===p.factoryId);
    item.innerHTML=`<div class="assignHead"><div><strong>${p.panelName}</strong><div class="hint">${by(S.objects,p.objectId)?.name||"—"} · ${by(S.factories,p.factoryId)?.name||"—"} · ${p.status}</div></div><span class="badge ${assigned.length?"info":"muted"}">${assigned.length?assigned.length+" piešķirti":"Brīvs"}</span></div>`;

    const tools=document.createElement("div");tools.className="panelTools";
    const transferLabel=document.createElement("label");transferLabel.className="transferLabel";
    const bulkCheck=document.createElement("input");bulkCheck.type="checkbox";bulkCheck.className="panelTransferCheck";bulkCheck.dataset.panelId=p.id;bulkCheck.disabled=panelHasActiveSessions(p.id);
    transferLabel.append(bulkCheck,document.createTextNode("Izvēlēties pārcelšanai"));
    const factorySelect=document.createElement("select");
    S.factories.forEach(f=>{const o=document.createElement("option");o.value=f.id;o.textContent=f.name;o.selected=f.id===p.factoryId;factorySelect.appendChild(o)});
    factorySelect.disabled=panelHasActiveSessions(p.id);
    factorySelect.onchange=async()=>{const old=p.factoryId,newId=factorySelect.value;if(newId===old)return;await movePanelToFactory(p.id,newId);factorySelect.value=old};
    tools.append(transferLabel,factorySelect);

    const checks=document.createElement("div");checks.className="checks";
    workers.forEach(w=>{
      const l=document.createElement("label");l.className="check";
      const cb=document.createElement("input");cb.type="checkbox";cb.checked=assigned.includes(w.id);cb.disabled=p.status==="Pabeigts";
      cb.onchange=async()=>{
        const cur=[...(p.assignedWorkerIds||[])],next=cb.checked?[...new Set([...cur,w.id])]:cur.filter(id=>id!==w.id);
        await updateDoc(doc(db,"panels",p.id),{assignedWorkerIds:next});
      };
      l.append(cb,document.createTextNode(w.name));checks.appendChild(l);
    });
    item.append(tools,checks);list.appendChild(item);
  });

  const ad=$("panelAdmin");ad.innerHTML="";
  panels.slice(0,300).forEach(p=>{
    const a=activeForPanel(p.id),done=S.sessions.filter(s=>s.panelId===p.id&&s.status==="Pabeigts"),item=document.createElement("div");
    item.className="assignItem";
    item.innerHTML=`<div class="assignHead"><div><strong>${p.panelName}</strong><div class="hint">${p.status} · aktīvi: ${a.length} · pabeigtas sesijas: ${done.length}</div></div></div>`;
    const acts=document.createElement("div");acts.className="adminActions";
    if(p.status!=="Pabeigts"){
      const b=document.createElement("button");b.className="primary";b.textContent="PANELIS PABEIGTS";b.disabled=a.length>0;
      b.onclick=async()=>{if(confirm(`Atzīmēt ${p.panelName} kā pabeigtu?`))await updateDoc(doc(db,"panels",p.id),{status:"Pabeigts",completedAt:serverTimestamp()})};
      acts.appendChild(b);
    }else{
      const b=document.createElement("button");b.className="secondary";b.textContent="ATVĒRT NO JAUNA";
      b.onclick=async()=>{if(confirm(`Atvērt ${p.panelName} no jauna?`))await updateDoc(doc(db,"panels",p.id),{status:"Nav sākts",completedAt:null})};
      acts.appendChild(b);
    }
    const del=document.createElement("button");del.className="softDanger";del.textContent="DZĒST PANELI UN VĒSTURI";del.disabled=a.length>0;del.onclick=()=>deletePanelWithSessions(p.id);
    acts.appendChild(del);item.appendChild(acts);ad.appendChild(item);
  });
}
function renderPreview(){const b=$("previewBody");b.innerHTML="";let ok=0,bad=0;S.preview.forEach(r=>{r.valid?ok++:bad++;const tr=document.createElement("tr");tr.innerHTML=`<td>${r.valid?"Derīgs":r.errors.join(", ")}</td><td><strong>${r.panelName||"—"}</strong></td><td>${r.pcs??"—"}</td><td>${r.length??"—"}</td><td>${r.width??"—"}</td><td>${r.height??"—"}</td><td>${r.weight??"—"}</td><td>${r.grossArea??"—"}</td><td>${r.designation||"—"}</td><td>${r.factoryName||"—"}</td>`;b.appendChild(tr)});$("previewCount").textContent=S.preview.length+" rindas";$("previewSummary").textContent=`Derīgas: ${ok} | Kļūdainas: ${bad}`;$("previewCard").classList.remove("hidden");$("importBtn").disabled=!ok||!$("importObject").value}
function renderAll(){renderIdentity();renderWorker();renderLive();renderReport();renderDataManagement();renderAssignments();fill($("importObject"),S.objects);fill($("defaultFactory"),S.factories,"— nav piešķirta —");fill($("newWorkerFactory"),S.factories)}
function sub(name,key){onSnapshot(collection(db,name),snap=>{S[key]=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||a.panelName||a.workerName||"").localeCompare(b.name||b.panelName||b.workerName||"","lv"));$("conn").textContent="Tiešsaistē";$("conn").className="badge online";renderAll()},e=>{$("conn").textContent="Nav savienojuma";$("conn").className="badge offline";$("adminMsg").textContent=e.message})}
sub("factories","factories");sub("workers","workers");sub("objects","objects");sub("panels","panels");sub("sessions","sessions");
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(b.dataset.v+"View").classList.remove("hidden")});
$("idFactory").onchange=renderIdentity;$("saveIdentity").onclick=()=>{const id=$("idWorker").value;if(!id)return alert("Izvēlies darbinieku.");S.workerId=id;localStorage.setItem("pps_worker_id",id);renderAll()};$("changeIdentity").onclick=()=>{S.workerId=null;localStorage.removeItem("pps_worker_id");renderAll()};$("workerObject").onchange=renderWorker;$("workerSearch").oninput=renderWorker;
$("pauseBtn").onclick=async()=>{const w=worker(),s=activeForWorker(w?.id);if(!s)return;if(s.status==="Procesā"){await updateDoc(doc(db,"sessions",s.id),{status:"Pauzē",accumulatedSeconds:elapsed(s),lastResumeAt:null});const others=activeForPanel(s.panelId).filter(x=>x.id!==s.id&&x.status==="Procesā");if(!others.length)await updateDoc(doc(db,"panels",s.panelId),{status:"Pauzē"})}else{await updateDoc(doc(db,"sessions",s.id),{status:"Procesā",lastResumeAt:serverTimestamp()});await updateDoc(doc(db,"panels",s.panelId),{status:"Procesā"})}};
$("finishOwnBtn").onclick=async()=>{const w=worker(),s=activeForWorker(w?.id);if(!s)return;if(!confirm(`Pabeigt savu darbu pie ${s.panelName}?`))return;await updateDoc(doc(db,"sessions",s.id),{status:"Pabeigts",accumulatedSeconds:elapsed(s),lastResumeAt:null,endAt:serverTimestamp()});const rem=activeForPanel(s.panelId).filter(x=>x.id!==s.id);await updateDoc(doc(db,"panels",s.panelId),{status:rem.length?"Procesā":"Procesā"})};
["liveFactory","liveObject"].forEach(id=>$(id).onchange=renderLive);["period","repFactory","repObject","repWorker"].forEach(id=>$(id).onchange=renderReport);$("repSearch").oninput=renderReport;["assignFactory","assignObject"].forEach(id=>$(id).onchange=renderAssignments);$("assignSearch").oninput=renderAssignments;
$("transferSelected").onclick=async()=>{
  const factoryId=$("transferFactory").value;
  if(!factoryId)return alert("Izvēlies rūpnīcu, uz kuru pārcelt paneļus.");
  const ids=[...document.querySelectorAll(".panelTransferCheck:checked")].map(cb=>cb.dataset.panelId);
  if(!ids.length)return alert("Nav izvēlēts neviens panelis.");
  const active=ids.filter(id=>panelHasActiveSessions(id));
  if(active.length)return alert("Izvēlēto paneļu vidū ir aktīvi paneļi. Tos pārcelt nevar.");
  const f=by(S.factories,factoryId);
  if(!confirm(`Pārcelt ${ids.length} paneļus uz rūpnīcu ${f?.name}? Visi darbinieku piešķīrumi šiem paneļiem tiks noņemti.`))return;
  for(let i=0;i<ids.length;i+=450){
    const batch=writeBatch(db);
    ids.slice(i,i+450).forEach(id=>batch.update(doc(db,"panels",id),{
      factoryId,
      factoryName:f?.name||"",
      assignedWorkerIds:[]
    }));
    await batch.commit();
  }
};
$("exportCsv").onclick=()=>{const rows=filtered(),head=["Rūpnīca","Objekts","Panelis","Darbinieks","Sesija","Paneļa statuss","Sākums","Beigas","Darba laiks"],data=rows.map(s=>[by(S.factories,s.factoryId)?.name||"",by(S.objects,s.objectId)?.name||"",s.panelName,s.workerName,s.status,by(S.panels,s.panelId)?.status||"",fmt(s.startAt),fmt(s.endAt),hms(elapsed(s))]),csv=[head,...data].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n"),blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`PPS_V1_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)};
$("addFactory").onclick=async()=>{const name=$("newFactory").value.trim();if(!name)return;await addDoc(collection(db,"factories"),{name,createdAt:serverTimestamp()});$("newFactory").value=""};$("addWorker").onclick=async()=>{const name=$("newWorker").value.trim(),factoryId=$("newWorkerFactory").value;if(!name||!factoryId)return;await addDoc(collection(db,"workers"),{name,factoryId,active:true,createdAt:serverTimestamp()});$("newWorker").value=""};$("createObject").onclick=async()=>{const name=$("objectName").value.trim();if(!name)return;await addDoc(collection(db,"objects"),{name,active:true,createdAt:serverTimestamp()});$("objectName").value=""};
$("previewBtn").onclick=async()=>{const f=$("excelFile").files[0];if(!f)return alert("Izvēlies Excel failu.");try{const buf=await f.arrayBuffer(),wb=XLSX.read(buf,{type:"array"}),sheet=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true}),def=by(S.factories,$("defaultFactory").value)?.name||"";S.preview=rows.map(r=>mapRow(r,def)).filter(r=>r.panelName||r.designation||r.errors.length);renderPreview();$("importMsg").textContent="Fails pārbaudīts."}catch(e){$("importMsg").textContent=e.message}};
$("importBtn").onclick=async()=>{const objectId=$("importObject").value,valid=S.preview.filter(r=>r.valid);if(!objectId||!valid.length)return;$("importBtn").disabled=true;try{const ex=await getDocs(query(collection(db,"panels"),where("objectId","==",objectId))),names=new Set(ex.docs.map(d=>String(d.data().panelName||"").toLowerCase())),rows=valid.filter(r=>!names.has(r.panelName.toLowerCase()));let n=0;for(let i=0;i<rows.length;i+=450){const batch=writeBatch(db);rows.slice(i,i+450).forEach(r=>{const f=S.factories.find(x=>x.name.toLowerCase()===r.factoryName.toLowerCase()),ref=doc(collection(db,"panels"));batch.set(ref,{...r,objectId,factoryId:f?.id||null,assignedWorkerIds:[],importedAt:serverTimestamp()})});await batch.commit();n+=Math.min(450,rows.length-i)}$("importMsg").textContent=`Pievienoti ${n}. Dublikāti: ${valid.length-rows.length}.`;S.preview=[];$("previewCard").classList.add("hidden");$("excelFile").value=""}catch(e){$("importMsg").textContent=e.message}finally{$("importBtn").disabled=false}};
$("importObject").onchange=()=>{$("importBtn").disabled=!S.preview.some(r=>r.valid)||!$("importObject").value};setInterval(()=>{renderWorker();renderLive();renderReport()},1000);

function setupAdminTabs(){
  document.querySelectorAll(".adminTab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".adminTab").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".adminPanel").forEach(p=>p.classList.add("hidden"));
      btn.classList.add("active");
      const panel=document.getElementById(btn.dataset.adminTab);
      if(panel)panel.classList.remove("hidden");
    });
  });
}
setupAdminTabs();

const workerManageSearch=document.getElementById("workerManageSearch");
if(workerManageSearch){
  workerManageSearch.addEventListener("input",()=>{
    const query=workerManageSearch.value.trim().toLowerCase();
    document.querySelectorAll("#workerManage .manageRow").forEach(row=>{
      row.style.display=row.textContent.toLowerCase().includes(query)?"":"none";
    });
  });
}
