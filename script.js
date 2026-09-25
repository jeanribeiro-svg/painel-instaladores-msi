const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  GOOGLE_SHEET_ID: "1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg",
  GOOGLE_SHEET_GID: "474438347",
  REFRESH_INTERVAL_MS: 30000,
  REQUEST_TIMEOUT_MS: 10000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_PACOTE: "Sem pacote oficial",
  DISPONIVEL: "Disponível no \\Mídias",
  FABRICANTE: "Disponível pelo Fabricante"
};

let allRows = [], hasLoadedData = false, activeFilter = "";
function $(id) { return document.getElementById(id); }
function normalize(value) { return String(value ?? "").replace(/^\uFEFF/, "").replace(/\u00A0/g, " ").trim(); }
function normalizeStatus(value) { return normalize(value).replace(/\\+/g, "\\").replace(/\s+/g, " ").toLowerCase(); }
function canonicalStatus(value) {
  const raw = normalize(value), key = normalizeStatus(raw);
  if (key === normalizeStatus(STATUS.CONSULTA)) return STATUS.CONSULTA;
  if (key === normalizeStatus(STATUS.SEM_PACOTE)) return STATUS.SEM_PACOTE;
  if (key === normalizeStatus(STATUS.DISPONIVEL) || key === normalizeStatus("Disponível no Mídias")) return STATUS.DISPONIVEL;
  if (key === normalizeStatus(STATUS.FABRICANTE)) return STATUS.FABRICANTE;
  return raw;
}
function isHeaderRow(a,b,c) {
  return normalize(a).toLowerCase() === "software" && normalize(b).toLowerCase() === "status" && (!c || normalize(c).toLowerCase() === "link");
}
function setConnection(text,type="neutral") { const el=$("connectionStatus"); if(el){el.textContent=text;el.className=`connection ${type}`;} }
function setLastUpdate(text) { if($("lastUpdate")) $("lastUpdate").textContent=text; }
function showError(message,type="error") { const box=$("errorBox"); if(box){box.className=`notice ${type}`;box.textContent=message;} }
function hideError() { if($("errorBox")) $("errorBox").className="notice hidden"; }

function parseCSV(text) {
  const rows=[]; let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],next=text[i+1];
    if(c==='"'){ if(quoted&&next==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell="";}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell);cell="";if(row.some(v=>normalize(v)))rows.push(row);row=[];}
    else cell+=c;
  }
  if(cell.length||row.length){row.push(cell);if(row.some(v=>normalize(v)))rows.push(row);}
  return rows;
}

function parseSheetData(text) {
  const parsed=parseCSV(text.replace(/^\uFEFF/, ""));
  if(!parsed.length)return{rows:[],empty:true};
  const first=parsed[0].map(normalize), lower=first.map(h=>h.toLowerCase());
  const hasHeader=lower.some(h=>h==="software") || lower.some(h=>h==="status") || lower.some(h=>h==="link");
  let softwareIndex=lower.findIndex(h=>h==="software"), statusIndex=lower.findIndex(h=>h==="status"), linkIndex=lower.findIndex(h=>h==="link");
  if(softwareIndex<0)softwareIndex=0;
  if(statusIndex<0)statusIndex=1;
  if(linkIndex<0)linkIndex=2;
  const dataRows=hasHeader?parsed.slice(1):parsed;
  const rows=dataRows.map(r=>({software:normalize(r[softwareIndex]),status:canonicalStatus(r[statusIndex]),link:normalize(r[linkIndex])}))
    .filter(r=>r.software&&!isHeaderRow(r.software,r.status,r.link));
  return{rows,empty:rows.length===0};
}

async function fetchCsv(url) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),CONFIG.REQUEST_TIMEOUT_MS);
  try{const sep=url.includes("?")?"&":"?";const response=await fetch(url+sep+"cache="+Date.now(),{cache:"no-store",mode:"cors",signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.text();}
  finally{clearTimeout(timer);}
}

function loadData(){
  setConnection("Consultando Google Sheets...","loading");
  return fetchCsv(CONFIG.GOOGLE_SHEET_CSV_URL).then(text=>{
    const parsed=parseSheetData(text);
    allRows=parsed.rows;
    hasLoadedData=true;
    updateDashboard();
    setLastUpdate(new Date().toLocaleString("pt-BR"));
    setConnection(`Conectado • ${allRows.length} registros`,"ok");
    if(parsed.empty)showError("A planilha foi acessada, mas ainda não há softwares cadastrados.","warning");
    else hideError();
  }).catch(error=>{
    console.error("Falha ao carregar dados:",error);
    setConnection("Sem conexão com a planilha","error");
    setLastUpdate("Não atualizada");
    updateDashboard();
    if(hasLoadedData)showError("Não foi possível atualizar os dados agora. Os dados anteriores continuam sendo exibidos.","warning");
    else{showError("Não foi possível obter os dados da planilha. Verifique se a publicação do Google Sheets está ativa e tente novamente.","error");renderEmptyState("Não foi possível carregar os dados.");}
  });
}

function statusClass(status){
  if(status===STATUS.DISPONIVEL||status===STATUS.FABRICANTE)return"available";
  if(status===STATUS.CONSULTA)return"consulta";
  if(status===STATUS.SEM_PACOTE)return"none";
  return"unknown";
}

function updateDashboard(){
  const total=allRows.length,
    consulta=allRows.filter(r=>r.status===STATUS.CONSULTA).length,
    semPacote=allRows.filter(r=>r.status===STATUS.SEM_PACOTE).length,
    disponivel=allRows.filter(r=>r.status===STATUS.DISPONIVEL).length,
    fabricante=allRows.filter(r=>r.status===STATUS.FABRICANTE).length,
    percent=total?disponivel/total*100:0;
  $("total").textContent=total;
  $("emConsulta").textContent=consulta;
  $("semPacote").textContent=semPacote;
  $("disponivel").textContent=disponivel;
  $("fabricante").textContent=fabricante;
  $("progressPercent").textContent=`${percent.toFixed(1)}%`;
  $("progressBar").style.width=`${percent}%`;

  const a=total?consulta/total*360:0,b=total?semPacote/total*360:0,c=total?disponivel/total*360:0,d=total?fabricante/total*360:0;
  $("donut").style.background=`conic-gradient(#d99a20 0deg ${a}deg,#d15b5b ${a}deg ${a+b}deg,#1769c2 ${a+b}deg ${a+b+c}deg,#1769c2 ${a+b+c}deg ${a+b+c+d}deg)`;
  $("legend").innerHTML=`<div><span class="dot consulta-dot"></span>Em Consulta <b>${consulta}</b></div><div><span class="dot none-dot"></span>Sem pacote oficial <b>${semPacote}</b></div><div><span class="dot available-dot"></span>Disponível no Mídias <b>${disponivel}</b></div><div><span class="dot available-dot"></span>Disponível pelo Fabricante <b>${fabricante}</b></div>`;
  renderTable();
}

function renderEmptyState(message){
  $("softwareTable").innerHTML=`<tr><td colspan="3" class="empty">${escapeHtml(message)}</td></tr>`;
  $("resultCount").textContent="0 registros";
}

function renderTable(){
  const search=normalize($("search")?.value).toLowerCase(),filter=canonicalStatus(activeFilter);
  const rows=allRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||r.status===filter));
  $("resultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;
  $("softwareTable").innerHTML=rows.length?rows.map(r=>{
    const i=allRows.indexOf(r);
    const link=r.link||"—";
    return `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status||"Sem status")}</span></td><td class="link-cell" title="${escapeHtml(link)}"><span class="link-text">${escapeHtml(link)}</span>${r.link?`<button type="button" class="copy-link" data-row-index="${i}">Copiar endereço</button>`:""}</td></tr>`;
  }).join(""):`<tr><td colspan="3" class="empty">${allRows.length?"Nenhum software encontrado para os filtros atuais.":"Nenhum software cadastrado."}</td></tr>`;
}

function updateFilterCards(){
  document.querySelectorAll(".filter-card").forEach(card=>{
    const active=canonicalStatus(card.dataset.filter||"")===canonicalStatus(activeFilter);
    card.classList.toggle("active-filter",!!activeFilter&&active);
    card.setAttribute("aria-pressed",activeFilter&&active?"true":"false");
  });
}

function setActiveFilter(filter){
  activeFilter=canonicalStatus(filter||"");
  updateFilterCards();
  renderTable();
}

function copyAddress(link,button){
  const x=String(link??"").replace(/^\uFEFF/,"").replace(/\u00A0/g," ").trim();
  if(!x)return;
  try{
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(x).then(()=>copiedFeedback(button)).catch(()=>fallbackCopy(x,button));
    else fallbackCopy(x,button);
  }catch(e){fallbackCopy(x,button);}
}
function fallbackCopy(x,button){
  const ta=document.createElement("textarea");ta.value=x;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.focus();ta.select();
  try{if(!document.execCommand("copy"))throw new Error("copy failed");copiedFeedback(button);}catch(e){alert("Não foi possível copiar o endereço.\n\n"+x);}finally{ta.remove();}
}
function copiedFeedback(button){if(!button)return;const original=button.textContent;button.textContent="✓ Copiado!";button.classList.add("copied");setTimeout(()=>{button.textContent=original;button.classList.remove("copied");},1600);}
function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

document.addEventListener("click",e=>{
  const copy=e.target.closest(".copy-link");
  if(copy){const i=Number(copy.dataset.rowIndex);if(Number.isInteger(i)&&allRows[i])copyAddress(allRows[i].link,copy);}
});

function init(){
  $("search").addEventListener("input",renderTable);
  $("refreshButton").addEventListener("click",loadData);
  document.querySelectorAll(".filter-card").forEach(card=>{
    const activate=()=>setActiveFilter(card.dataset.filter||"");
    card.addEventListener("click",activate);
    card.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();activate();}
    });
  });
  updateFilterCards();
  loadData();
  setInterval(loadData,CONFIG.REFRESH_INTERVAL_MS);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
