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
  const hasHeader=lower.some(h=>h==="software") || lower.some(h=>h==="status") || lower.some(h=>h==="link") || lower.some(h=>h.includes("comando") || h.includes("instalação") || h.includes("download") || h.includes("instruções"));
  let softwareIndex=lower.findIndex(h=>h==="software"), statusIndex=lower.findIndex(h=>h==="status"), linkIndex=lower.findIndex(h=>h==="link" || h.includes("link / rede")), commandIndex=lower.findIndex(h=>h.includes("comando") || h.includes("instalação")), downloadIndex=lower.findIndex(h=>h.includes("download")), guideIndex=lower.findIndex(h=>h.includes("instruções") || h.includes("guia"));
  if(softwareIndex<0)softwareIndex=0;
  if(statusIndex<0)statusIndex=1;
  if(linkIndex<0)linkIndex=2;
  if(commandIndex<0)commandIndex=3;
  if(downloadIndex<0)downloadIndex=4;
  if(guideIndex<0)guideIndex=5;
  const dataRows=hasHeader?parsed.slice(1):parsed;
  const rows=dataRows.map(r=>({software:normalize(r[softwareIndex]),status:canonicalStatus(r[statusIndex]),link:normalize(r[linkIndex]),command:normalize(r[commandIndex]),download:normalize(r[downloadIndex]),guide:normalize(r[guideIndex])}))
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

function getDeployInfo(row){
  const source=row.link||"",isWeb=/^https?:\/\//i.test(source),isNetwork=/^\\\\/.test(source);
  const downloadValue=row.download||"",guideValue=row.guide||"";
  const downloadUrl=/^https?:\/\//i.test(downloadValue)?downloadValue:"";
  const guideUrl=/^https?:\/\//i.test(guideValue)?guideValue:"";
  return {
    download:downloadUrl||(isWeb?source:""),
    downloadNote:downloadValue&&!downloadUrl?downloadValue:"",
    network:isNetwork?source:"",
    other:source&&!isWeb&&!isNetwork?source:"",
    guide:guideUrl,
    guideNote:guideValue&&!guideUrl?guideValue:"",
    command:row.command||""
  };
}

function isInstallCommand(value){
  return /^(?:msiexec\b|setup(?:\.exe)?\b|start-process\b|python(?:\.exe)?\b|npm\b|fusion\s+client\s+downloader\.exe\b|pbidesktopsetup(?:_x64)?\.exe\b|(?:"[^"\r\n]+"|[^\s"']+)\.(?:exe|msi|bat|cmd)\b)/i.test(String(value||"").trim());
}

function renderTable(){
  const search=normalize($("search")?.value).toLowerCase(),filter=activeFilter===AVAILABLE_FILTER?AVAILABLE_FILTER:canonicalStatus(activeFilter);
  const rows=allRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||(filter===AVAILABLE_FILTER?isAvailableStatus(r.status):r.status===filter)));
  $("resultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;
  $("softwareTable").innerHTML=rows.length?rows.map(r=>{
    const i=allRows.indexOf(r);
    const info=getDeployInfo(r), link=info.download||info.network||info.other||"—", command=info.command||"—", commandIsInstallCommand=isInstallCommand(info.command);
    const copyButton=(type,label)=>`<button type="button" class="copy-link copy-resource" data-copy-type="${type}" data-row-index="${i}" aria-label="Copiar ${label} de ${escapeHtml(r.software)}">Copiar</button>`;
    const downloadLink=info.download?`<a class="resource-link" href="${escapeHtml(info.download)}" target="_blank" rel="noopener noreferrer">Página oficial / download</a>${copyButton("download","link do download")}`:"";
    const guideLink=info.guide?`<a class="resource-link guide-link" href="${escapeHtml(info.guide)}" target="_blank" rel="noopener noreferrer">Instruções</a>${copyButton("guide","link das instruções")}`:"";
    const instructionNotes=[info.downloadNote,info.guideNote].filter(Boolean).map(note=>`<span class="instruction-note">${escapeHtml(note)}</span>`).join("");
    const networkLink=info.network?`<span class="link-text" title="${escapeHtml(info.network)}">${escapeHtml(info.network)}</span><button type="button" class="copy-link copy-resource" data-copy-type="link" data-row-index="${i}" aria-label="Copiar caminho de rede de ${escapeHtml(r.software)}">Copiar</button>`:"";
    const otherLink=info.other?`<span class="link-text">${escapeHtml(info.other)}</span>${copyButton("other","endereço")}`:"";
    const commandDisplay=commandIsInstallCommand?`<code class="command-text">${escapeHtml(command)}</code>`:info.command?`<span class="instruction-note command-note">${escapeHtml(command)}</span>`:"—";
    const displayedStatus=isAvailableStatus(r.status)?"Disponível":r.status||"Sem status";
    return `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}" title="${escapeHtml(r.status||"")}">${escapeHtml(displayedStatus)}</span></td><td class="link-cell" title="${escapeHtml(link)}">${downloadLink}${networkLink}${otherLink}${guideLink}${instructionNotes}${!info.download&&!info.network&&!info.other&&!instructionNotes?"—":""}</td><td class="command-cell" title="${escapeHtml(command)}">${commandDisplay}${commandIsInstallCommand?`<button type="button" class="copy-link copy-command" data-copy-type="command" data-row-index="${i}" aria-label="Copiar comando de instalação de ${escapeHtml(r.software)}">Copiar</button>`:""}</td></tr>`;
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
  if(copy){const i=Number(copy.dataset.rowIndex);if(Number.isInteger(i)&&allRows[i]){const info=getDeployInfo(allRows[i]),type=copy.dataset.copyType;const value=type==="command"?info.command:type==="guide"?info.guide:type==="download"?info.download:type==="other"?info.other:info.network||info.download||info.other;if(type==="command")copyCommand(value,copy);else copyAddress(value,copy);}}
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
