const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  GOOGLE_SHEET_ID: "1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg",
  GOOGLE_SHEET_GID: "474438347",
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

let allRows = [], hasLoadedData = false, activeFilter = "";
function $(id) { return document.getElementById(id); }
function normalize(value) { return String(value ?? "").replace(/^\uFEFF/, "").replace(/\u00A0/g, " ").trim(); }
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
  const first=parsed[0].map(normalize), lower=first.map(h=>h.toLowerCase());
  const hasHeader=lower.some(h=>h==="software") || lower.some(h=>h==="status") || lower.some(h=>h==="link") || lower.some(h=>h.includes("comando") || h.includes("instalação"));
  let softwareIndex=lower.findIndex(h=>h==="software"), statusIndex=lower.findIndex(h=>h==="status"), linkIndex=lower.findIndex(h=>h==="link"), commandIndex=lower.findIndex(h=>h.includes("comando") || h.includes("instalação"));
  if(softwareIndex<0)softwareIndex=0;
  if(statusIndex<0)statusIndex=1;
  if(linkIndex<0)linkIndex=2;
  if(commandIndex<0)commandIndex=3;
  const dataRows=hasHeader?parsed.slice(1):parsed;
  const rows=dataRows.map(r=>({software:normalize(r[softwareIndex]),status:canonicalStatus(r[statusIndex]),link:normalize(r[linkIndex]),command:normalize(r[commandIndex])}))
    .map(r=>DEPLOY_GUIDES[normalize(r.software).toLowerCase()]&&r.status===STATUS.CONSULTA?{...r,status:STATUS.DEPLOY_ORIENTACAO}:r)
    .filter(r=>r.software&&!isHeaderRow(r.software,r.status,r.link,r.command));
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
  const alternatives=[
    url,
    `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CONFIG.GOOGLE_SHEET_GID}`
  ];
  let lastError;
  for(const candidate of alternatives) {
    try { return await fetchOneCsv(candidate); }
    catch(error) { lastError=error; console.warn("Falha ao consultar fonte da planilha:",candidate,error); }
  }
  throw lastError || new Error("Não foi possível acessar a planilha");
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
  $("disponivel").textContent=disponivel;
  $("fabricante").textContent=fabricante;
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
  $("progressDetail").textContent=`Disponível: ${disponivel} no Mídias + ${fabricante} pelo fabricante. Deploy via orientação do fabricante: ${deployOrientacao}. Sem solução oficial: ${semSolucao}. Total definido: ${acompanhado} de ${total}.`;

  renderTable();
}

function renderEmptyState(message){
  $("softwareTable").innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(message)}</td></tr>`;
  $("resultCount").textContent="0 registros";
}

// Referências oficiais verificadas para softwares sem dados completos na planilha.
// Os endereços são páginas de download/documentação; versões e licenças podem variar.
const DEPLOY_GUIDES = {
  "microsoft power bi desktop": { download:"https://www.microsoft.com/download/details.aspx?id=58494", guide:"https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-get-the-desktop", command:'PBIDesktopSetup_x64.exe -quiet ACCEPT_EULA=1 -norestart' },
  "power bi": { download:"https://www.microsoft.com/download/details.aspx?id=58494", guide:"https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-get-the-desktop", command:'PBIDesktopSetup_x64.exe -quiet ACCEPT_EULA=1 -norestart' },
  "visual studio code": { download:"https://code.visualstudio.com/Download", guide:"https://code.visualstudio.com/docs/setup/windows", command:'VSCodeSetup-x64.exe /VERYSILENT /NORESTART /MERGETASKS=!runcode' },
  "visual studio 2022": { download:"https://visualstudio.microsoft.com/downloads/", guide:"https://learn.microsoft.com/en-us/visualstudio/install/create-a-network-installation-of-visual-studio", command:'\\\\servidor\\compartilhamento\\VS\\vs_*.exe --quiet --wait' },
  "docker desktop": { download:"https://www.docker.com/products/docker-desktop/", guide:"https://docs.docker.com/desktop/enterprise/enterprise-deployment/msi-install-and-configure/", command:'msiexec /i "DockerDesktop.msi" /quiet /norestart' },
  "office 2024": { download:"https://www.microsoft.com/download/details.aspx?id=49117", guide:"https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/overview-office-deployment-tool", command:'setup.exe /configure configuration.xml' },
  "microsoft visio professional": { download:"https://www.microsoft.com/download/details.aspx?id=49117", guide:"https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/overview-office-deployment-tool", command:'setup.exe /configure configuration.xml (defina o Product ID/licença do Visio no XML)' },
  "visio": { download:"https://www.microsoft.com/download/details.aspx?id=49117", guide:"https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/overview-office-deployment-tool", command:'setup.exe /configure configuration.xml (defina o Product ID/licença do Visio no XML)' },
  "microsoft project": { download:"https://www.microsoft.com/download/details.aspx?id=49117", guide:"https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/overview-office-deployment-tool", command:'setup.exe /configure configuration.xml (defina o Product ID/licença do Project no XML)' },
  "virtual box": { download:"https://www.virtualbox.org/wiki/Downloads", guide:"https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html", command:'VirtualBox-<versao>-Win.exe -extract; msiexec /i VirtualBox-<versao>-Win.msi /qn /norestart' },
  "wireshark": { download:"https://www.wireshark.org/download.html", guide:"https://www.wireshark.org/docs/wsug_html_chunked/ChBuildInstallWinInstall.html", command:'Wireshark-<versao>-x64.exe /S' },
  "python": { download:"https://www.python.org/downloads/windows/", guide:"https://docs.python.org/3/using/windows.html", command:'python-<versao>-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0' },
  "putty": { download:"https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html", guide:"https://the.earth.li/~sgtatham/putty/0.83/htmldoc/Chapter2.html", command:'msiexec /i putty-64bit-<versao>-installer.msi /qn /norestart' },
  "gimp": { download:"https://www.gimp.org/downloads/", guide:"https://www.gimp.org/downloads/" },
  "inkscape": { download:"https://inkscape.org/release/", guide:"https://inkscape.org/release/", command:'msiexec /i inkscape-<versao>.msi /qn /norestart (se MSI; confirme o pacote da versão)' }
};

function getDeployInfo(row){
  const curated=DEPLOY_GUIDES[normalize(row.software).toLowerCase()]||{};
  return {link:row.link||curated.download||"",guide:curated.guide||"",command:curated.command||row.command||""};
}

function renderTable(){
  const search=normalize($("search")?.value).toLowerCase(),filter=canonicalStatus(activeFilter);
  const rows=allRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||r.status===filter));
  $("resultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;
  $("softwareTable").innerHTML=rows.length?rows.map(r=>{
    const i=allRows.indexOf(r);
    const info=getDeployInfo(r), link=info.link||"—", command=info.command||"—";
    const downloadLink=/^https:\/\//i.test(info.link)?`<a class="resource-link" href="${escapeHtml(info.link)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`:"";
    const guideLink=info.guide?`<a class="resource-link guide-link" href="${escapeHtml(info.guide)}" target="_blank" rel="noopener noreferrer">Instruções</a>`:"";
    return `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status||"Sem status")}</span></td><td class="link-cell" title="${escapeHtml(link)}">${downloadLink||`<span class="link-text">${escapeHtml(link)}</span>`}${guideLink}${info.link&&!downloadLink?`<button type="button" class="copy-link" data-copy-type="link" data-row-index="${i}">Copiar endereço</button>`:""}</td><td class="command-cell" title="${escapeHtml(command)}"><code class="command-text">${escapeHtml(command)}</code>${info.command?`<button type="button" class="copy-link copy-command" data-copy-type="command" data-row-index="${i}">Copiar comando</button>`:""}</td></tr>`;
  }).join(""):`<tr><td colspan="4" class="empty">${allRows.length?"Nenhum software encontrado para os filtros atuais.":"Nenhum software cadastrado."}</td></tr>`;
}

function updateFilterCards(){
  document.querySelectorAll(".filter-card").forEach(card=>{
    const cardFilter=card.dataset.filter||"";
    const active=cardFilter==="" ? activeFilter==="" : canonicalStatus(cardFilter)===canonicalStatus(activeFilter);
    card.classList.toggle("active-filter",active);
    card.setAttribute("aria-pressed",active?"true":"false");
  });
}

function updateProgressHighlight(){
  const selected=canonicalStatus(activeFilter);
  const map={
    available:["progressAvailable","available"],
    none:["progressNoSolution","none"],
    deploy:["progressDeployOrientacao","deploy"],
    consulta:["progressConsulta","consulta"]
  };
  const allSegments=["progressAvailable","progressNoSolution","progressDeployOrientacao","progressConsulta"];
  const allItems=[...document.querySelectorAll(".progress-item[data-progress-filter]")];
  const key=selected===STATUS.DISPONIVEL||selected===STATUS.FABRICANTE?"available":
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

function copyValue(value,button,label="Copiar"){
  const x=String(value??"").replace(/^\uFEFF/,"").replace(/\u00A0/g," ").trim();
  if(!x)return;
  try{
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(x).then(()=>copiedFeedback(button)).catch(()=>fallbackCopy(x,button));
    else fallbackCopy(x,button);
  }catch(e){fallbackCopy(x,button);}
}
function copyAddress(link,button){copyValue(link,button,"Copiar endereço");}
function copyCommand(command,button){copyValue(command,button,"Copiar comando");}
function fallbackCopy(x,button){
  const ta=document.createElement("textarea");ta.value=x;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.focus();ta.select();
  try{if(!document.execCommand("copy"))throw new Error("copy failed");copiedFeedback(button);}catch(e){alert("Não foi possível copiar o endereço.\n\n"+x);}finally{ta.remove();}
}
function copiedFeedback(button){if(!button)return;const original=button.textContent;button.textContent="✓ Copiado!";button.classList.add("copied");setTimeout(()=>{button.textContent=original;button.classList.remove("copied");},1600);}
function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

document.addEventListener("click",e=>{
  const copy=e.target.closest(".copy-link");
  if(copy){const i=Number(copy.dataset.rowIndex);if(Number.isInteger(i)&&allRows[i]){const info=getDeployInfo(allRows[i]);if(copy.dataset.copyType==="command")copyCommand(info.command,copy);else copyAddress(info.link,copy);}}
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
  updateProgressHighlight();
  loadData();
  setInterval(loadData,CONFIG.REFRESH_INTERVAL_MS);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
