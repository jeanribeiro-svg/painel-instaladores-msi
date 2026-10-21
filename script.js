const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  REFRESH_INTERVAL_MS: 30000,
  REQUEST_TIMEOUT_MS: 25000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_SOLUCAO: "Sem solução oficial",
  DISPONIVEL: "Disponível no \\Mídias",
  FABRICANTE: "Disponível pelo Fabricante",
  DEPLOY_ORIENTACAO: "Deploy via orientação do fabricante"
};
const AVAILABLE_FILTER = "__disponivel__";
function isAvailableStatus(status) { return status===STATUS.DISPONIVEL||status===STATUS.FABRICANTE; }

let allRows = [], hasLoadedData = false, activeFilter = "", pendingLoad = null;
function $(id) { return document.getElementById(id); }
function normalize(value) { return String(value ?? "").replace(/^\uFEFF/, "").replace(/\u00A0/g, " ").trim(); }
function normalizeHeader(value) { return normalize(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " "); }
function normalizeStatus(value) { return normalize(value).replace(/\\+/g, "\\").replace(/\s+/g, " ").toLowerCase(); }
function canonicalStatus(value) {
  const raw=normalize(value), key=normalizeStatus(raw);
  if (key === normalizeStatus(STATUS.CONSULTA)) return STATUS.CONSULTA;
  if (key === normalizeStatus(STATUS.SEM_SOLUCAO) || key === normalizeStatus("Sem pacote oficial")) return STATUS.SEM_SOLUCAO;
  if (key === normalizeStatus(STATUS.DISPONIVEL) || key === normalizeStatus("Disponível no Mídias")) return STATUS.DISPONIVEL;
  if (key === normalizeStatus(STATUS.FABRICANTE)) return STATUS.FABRICANTE;
  if (key === normalizeStatus(STATUS.DEPLOY_ORIENTACAO) || key === normalizeStatus("Deploy via rede") || key === normalizeStatus("Deploy via rede (manual)") || key === normalizeStatus("Manual de deploy via rede")) return STATUS.DEPLOY_ORIENTACAO;
  return raw;
}
function isHeaderRow(a,b,c,d) {
  const headers=[normalize(a).toLowerCase(),normalize(b).toLowerCase(),normalize(c).toLowerCase(),normalize(d).toLowerCase()];
  return headers[0] === "software" && headers[1] === "status";
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
  const headers=parsed[0].map(normalizeHeader);
  const hasHeader=headers.includes("software")&&headers.includes("status");
  const findHeader=predicate=>headers.findIndex(predicate);
  const softwareIndex=findHeader(h=>h==="software"), statusIndex=findHeader(h=>h==="status");
  const resourceIndex=findHeader(h=>[
    "link download / pasta da rede","link de download / pasta da rede",
    "link download/pasta da rede","link de download/pasta da rede",
    "link / rede","link/rede","caminho de rede","acesso de rede"
  ].includes(h));
  const downloadIndex=findHeader(h=>/download/.test(h));
  const guideIndex=findHeader(h=>/instrucoes|implantacao|deploy/.test(h));
  // Compatibility with the previous six-column sheet: use its official
  // download and instructions columns while the owner migrates the headers.
  const legacyLinkIndex=findHeader(h=>h==="link"||h==="rede");
  const dataRows=hasHeader?parsed.slice(1):parsed;
  const rows=dataRows.map(r=>{
    let resource=normalize(r[hasHeader?resourceIndex:2]);
    let instructions=normalize(r[hasHeader?guideIndex:3]);
    if(hasHeader&&(resourceIndex<0||headers[resourceIndex]==="link / rede"||headers[resourceIndex]==="link/rede")){
      const oldLink=normalize(r[resourceIndex>=0?resourceIndex:legacyLinkIndex]);
      const oldDownload=normalize(r[downloadIndex]);
      // Old Link / rede values were sometimes guidance URLs. Preserve only
      // real UNC paths there; otherwise the official download column is C.
      resource=/^\\\\/.test(oldLink)?oldLink:oldDownload;
    }
    if(hasHeader&&guideIndex>=0&&/comando|exemplo/.test(headers[guideIndex])){
      const oldGuideIndex=findHeader(h=>/instrucoes/.test(h));
      instructions=normalize(r[oldGuideIndex]);
    }
    return {
      software:normalize(r[hasHeader?softwareIndex:0]),
      status:canonicalStatus(r[hasHeader?statusIndex:1]),
      resource,
      instructions
    };
  }).filter(r=>r.software&&!isHeaderRow(r.software,r.status,r.resource,r.instructions));
  return{rows,empty:rows.length===0};
}

async function fetchOneCsv(url) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const sep=url.includes("?")?"&":"?";
    const response=await fetch(url+sep+"cache="+Date.now(),{cache:"no-store",mode:"cors",signal:controller.signal});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const text=await response.text();
    if(!text.trim() || /<html|<!doctype/i.test(text.slice(0,300))) throw new Error("A resposta não contém CSV");
    return text;
  } finally { clearTimeout(timer); }
}
async function fetchCsv(url) {
  // Use sempre o CSV publicado da planilha compartilhada. Consultar outra rota
  // do Google Sheets pode retornar uma versão/formatação diferente dos dados.
  return fetchOneCsv(url);
}

function loadData(){
  // O botão de atualização e o temporizador podem disparar juntos. Compartilhe
  // a mesma requisição para impedir respostas concorrentes de sobrescreverem a tela.
  if(pendingLoad)return pendingLoad;
  setConnection("Consultando Google Sheets...","loading");
  pendingLoad=fetchCsv(CONFIG.GOOGLE_SHEET_CSV_URL).then(text=>{
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
  }).finally(()=>{pendingLoad=null;});
  return pendingLoad;
}

function statusClass(status){
  if(isAvailableStatus(status))return"available";
  if(status===STATUS.CONSULTA)return"consulta";
  if(status===STATUS.SEM_SOLUCAO)return"none";
  if(status===STATUS.DEPLOY_ORIENTACAO)return"deploy";
  return"unknown";
}

function updateDashboard(){
  const total=allRows.length,
    consulta=allRows.filter(r=>r.status===STATUS.CONSULTA).length,
    semSolucao=allRows.filter(r=>r.status===STATUS.SEM_SOLUCAO).length,
    disponivel=allRows.filter(r=>r.status===STATUS.DISPONIVEL).length,
    fabricante=allRows.filter(r=>r.status===STATUS.FABRICANTE).length,
    deployOrientacao=allRows.filter(r=>r.status===STATUS.DEPLOY_ORIENTACAO).length,
    disponivelTotal=disponivel+fabricante,
    acompanhado=disponivelTotal+semSolucao+deployOrientacao,
    progressPercent=total?acompanhado/total*100:0,
    disponivelPercent=total?disponivelTotal/total*100:0,
    semSolucaoPercent=total?semSolucao/total*100:0,
    deployOrientacaoPercent=total?deployOrientacao/total*100:0,
    consultaPercent=total?consulta/total*100:0;

  $("total").textContent=total;
  $("emConsulta").textContent=consulta;
  $("semSolucao").textContent=semSolucao;
  $("disponivel").textContent=disponivelTotal;
  $("deployOrientacao").textContent=deployOrientacao;

  $("progressPercent").textContent=`${progressPercent.toFixed(1)}%`;
  $("progressAvailable").style.width=`${disponivelPercent}%`;
  $("progressNoSolution").style.width=`${semSolucaoPercent}%`;
  $("progressDeployOrientacao").style.width=`${deployOrientacaoPercent}%`;
  $("progressConsulta").style.width=`${consultaPercent}%`;
  updateProgressHighlight();

  if($("progressAvailableCount")) $("progressAvailableCount").textContent=disponivelTotal;
  if($("progressAvailablePercent")) $("progressAvailablePercent").textContent=`${disponivelPercent.toFixed(1)}%`;
  if($("progressNoSolutionCount")) $("progressNoSolutionCount").textContent=semSolucao;
  if($("progressNoSolutionPercent")) $("progressNoSolutionPercent").textContent=`${semSolucaoPercent.toFixed(1)}%`;
  if($("progressDeployOrientacaoCount")) $("progressDeployOrientacaoCount").textContent=deployOrientacao;
  if($("progressDeployOrientacaoPercent")) $("progressDeployOrientacaoPercent").textContent=`${deployOrientacaoPercent.toFixed(1)}%`;
  if($("progressConsultaCount")) $("progressConsultaCount").textContent=consulta;
  if($("progressConsultaPercent")) $("progressConsultaPercent").textContent=`${consultaPercent.toFixed(1)}%`;
  $("progressDetail").textContent=`Disponível: ${disponivelTotal}. Deploy via orientação do fabricante: ${deployOrientacao}. Sem solução oficial: ${semSolucao}. Total definido: ${acompanhado} de ${total}.`;

  renderTable();
}

function renderEmptyState(message){
  $("softwareTable").innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(message)}</td></tr>`;
  $("resultCount").textContent="0 registros";
}

function renderTable(){
  const search=normalize($("search")?.value).toLowerCase(),filter=activeFilter===AVAILABLE_FILTER?AVAILABLE_FILTER:canonicalStatus(activeFilter);
  const rows=allRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||(filter===AVAILABLE_FILTER?isAvailableStatus(r.status):r.status===filter)));
  $("resultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;
  $("softwareTable").innerHTML=rows.length?rows.map(r=>{
    const resource=normalize(r.resource),instructions=normalize(r.instructions);
    const isUrl=/^https?:\/\//i.test(resource),isNetwork=/^\\\\/.test(resource);
    const resourceContent=isUrl?`<a class="resource-link" href="${escapeHtml(resource)}" target="_blank" rel="noopener noreferrer">Acessar download</a>`:
      isNetwork?`<span class="link-text" title="${escapeHtml(resource)}">${escapeHtml(resource)}</span>`:"—";
    const instructionsContent=/^https?:\/\//i.test(instructions)?`<a class="resource-link guide-link" href="${escapeHtml(instructions)}" target="_blank" rel="noopener noreferrer">Abrir instruções</a>`:"—";
    const displayedStatus=isAvailableStatus(r.status)?"Disponível":r.status||"Sem status";
    return `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}" title="${escapeHtml(r.status||"")}">${escapeHtml(displayedStatus)}</span></td><td class="link-cell" title="${escapeHtml(resource)}">${resourceContent}</td><td class="link-cell" title="${escapeHtml(instructions)}">${instructionsContent}</td></tr>`;
  }).join(""):`<tr><td colspan="4" class="empty">${allRows.length?"Nenhum software encontrado para os filtros atuais.":"Nenhum software cadastrado."}</td></tr>`;
}

function updateFilterCards(){
  document.querySelectorAll(".filter-card").forEach(card=>{
    const cardFilter=card.dataset.filter||"";
    const active=cardFilter==="" ? activeFilter==="" : cardFilter===AVAILABLE_FILTER?activeFilter===AVAILABLE_FILTER:canonicalStatus(cardFilter)===canonicalStatus(activeFilter);
    card.classList.toggle("active-filter",active);
    card.setAttribute("aria-pressed",active?"true":"false");
  });
}

function updateProgressHighlight(){
  const selected=activeFilter===AVAILABLE_FILTER?AVAILABLE_FILTER:canonicalStatus(activeFilter);
  const map={
    available:["progressAvailable","available"],
    none:["progressNoSolution","none"],
    deploy:["progressDeployOrientacao","deploy"],
    consulta:["progressConsulta","consulta"]
  };
  const allSegments=["progressAvailable","progressNoSolution","progressDeployOrientacao","progressConsulta"];
  const allItems=[...document.querySelectorAll(".progress-item[data-progress-filter]")];
  const key=selected===AVAILABLE_FILTER||selected===STATUS.DISPONIVEL||selected===STATUS.FABRICANTE?"available":
    selected===STATUS.SEM_SOLUCAO?"none":
    selected===STATUS.DEPLOY_ORIENTACAO?"deploy":
    selected===STATUS.CONSULTA?"consulta":"";

  allSegments.forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.classList.toggle("graph-active",!!key && map[key]?.[0]===id);
    el.classList.toggle("graph-dimmed",!!key && map[key]?.[0]!==id);
  });
  allItems.forEach(item=>{
    const active=!!key && item.dataset.progressFilter===key;
    item.classList.toggle("graph-active",active);
    item.classList.toggle("graph-dimmed",!!key && !active);
  });
}

function setActiveFilter(filter){
  activeFilter=canonicalStatus(filter||"");
  updateFilterCards();
  updateProgressHighlight();
  renderTable();
}

function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

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
  updateProgressHighlight();
  loadData();
  setInterval(loadData,CONFIG.REFRESH_INTERVAL_MS);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
