const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  GOOGLE_SHEET_ID: "1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg",
  GOOGLE_SHEET_GID: "474438347",
  MIDIAS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=728409259&single=true&output=csv",
  MIDIAS_GID: "728409259",
  REFRESH_INTERVAL_MS: 30000,
  REQUEST_TIMEOUT_MS: 10000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_PACOTE: "Sem pacote oficial",
  DISPONIVEL: "Disponível no \\Mídias",
  FABRICANTE: "Disponível pelo Fabricante"
};

let allRows = [], mediaRows = [], hasLoadedData = false, mediaLoaded = false;
function $(id) { return document.getElementById(id); }
function normalize(value) { return String(value ?? "").replace(/^\uFEFF/, "").replace(/\u00A0/g, " ").trim(); }
function normalizeStatus(value) { return normalize(value).replace(/\\+/g, "\\").replace(/\s+/g, " ").toLowerCase(); }
function canonicalStatus(value) {
  const raw = normalize(value), key = normalizeStatus(raw);
  if (key === normalizeStatus(STATUS.CONSULTA)) return STATUS.CONSULTA;
  if (key === normalizeStatus(STATUS.SEM_PACOTE)) return STATUS.SEM_PACOTE;
  if (key === normalizeStatus(STATUS.DISPONIVEL)) return STATUS.DISPONIVEL;
  if (key === normalizeStatus(STATUS.FABRICANTE)) return STATUS.FABRICANTE;
  return raw;
}
function isHeaderRow(a,b) { return normalize(a).toLowerCase()==="software" && normalize(b).toLowerCase()==="status"; }
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
  const parsed=parseCSV(text.replace(/^\uFEFF/,""));
  if(!parsed.length)return{rows:[],empty:true};
  const first=parsed[0].map(normalize), lower=first.map(h=>h.toLowerCase());
  const hasHeader=lower.some(h=>h==="software") || lower.some(h=>h==="status");
  let softwareIndex=lower.findIndex(h=>h==="software"), statusIndex=lower.findIndex(h=>h==="status");
  if(softwareIndex<0)softwareIndex=0;
  if(statusIndex<0)statusIndex=1;
  const dataRows=hasHeader?parsed.slice(1):parsed;
  const rows=dataRows.map(r=>({software:normalize(r[softwareIndex]),status:canonicalStatus(r[statusIndex])}))
    .filter(r=>r.software&&!isHeaderRow(r.software,r.status));
  return{rows,empty:rows.length===0};
}

async function fetchCsv(url) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),CONFIG.REQUEST_TIMEOUT_MS);
  try{const sep=url.includes("?")?"&":"?";const response=await fetch(url+sep+"cache="+Date.now(),{cache:"no-store",mode:"cors",signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.text();}
  finally{clearTimeout(timer);}
}

function fetchGoogleJsonp() {
  return new Promise((resolve,reject)=>{
    const callback=`googleSheetCallback_${Date.now()}_${Math.floor(Math.random()*10000)}`,script=document.createElement("script");
    const timer=setTimeout(()=>cleanup(new Error("Tempo limite do Google Sheets excedido.")),CONFIG.REQUEST_TIMEOUT_MS);
    function cleanup(error,data){clearTimeout(timer);delete window[callback];script.remove();error?reject(error):resolve(data);}
    window[callback]=payload=>{try{
      const table=payload&&payload.table;if(!table)throw new Error("Resposta do Google Sheets sem dados de tabela.");
      const cols=Array.isArray(table.cols)?table.cols:[],rows=Array.isArray(table.rows)?table.rows:[];
      const labels=cols.map(c=>normalize(c?.label)),ids=cols.map(c=>normalize(c?.id).toLowerCase());
      let softwareIndex=labels.findIndex(h=>h.toLowerCase()==="software"),statusIndex=labels.findIndex(h=>h.toLowerCase()==="status");
      if(softwareIndex<0)softwareIndex=ids.findIndex(h=>h==="a");if(statusIndex<0)statusIndex=ids.findIndex(h=>h==="b");
      if(softwareIndex<0&&cols.length>=2)softwareIndex=0;if(statusIndex<0&&cols.length>=2)statusIndex=1;
      if(softwareIndex<0||statusIndex<0)throw new Error("Não foi possível identificar as colunas Software e Status.");
      const data=rows.map(row=>{const cells=Array.isArray(row?.c)?row.c:[];return{software:normalize(cells[softwareIndex]?.v??cells[softwareIndex]?.f),status:canonicalStatus(cells[statusIndex]?.v??cells[statusIndex]?.f)}}).filter(r=>r.software&&!isHeaderRow(r.software,r.status));
      cleanup(null,{rows:data,empty:data.length===0});
    }catch(e){cleanup(e);}};
    script.onerror=()=>cleanup(new Error("O Google Sheets recusou a consulta alternativa."));
    const query=encodeURIComponent("select A, B"),tqx=encodeURIComponent(`out:json;responseHandler:${callback}`);
    script.src=`https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?gid=${encodeURIComponent(CONFIG.GOOGLE_SHEET_GID)}&tqx=${tqx}&tq=${query}`;
    document.head.appendChild(script);
  });
}

async function loadData(){
  setConnection("Consultando planilha...","loading");setLastUpdate("Atualizando...");
  try{
    const results=await Promise.allSettled([
      fetchCsv(CONFIG.GOOGLE_SHEET_CSV_URL).then(parseSheetData),
      fetchGoogleJsonp()
    ]);
    const valid=results.filter(r=>r.status==="fulfilled"&&r.value&&Array.isArray(r.value.rows));
    if(!valid.length)throw new Error("Nenhuma fonte do Google Sheets retornou dados.");
    // Usa a resposta que contém mais registros. Isso evita perder linhas quando a
    // publicação CSV estiver defasada/incompleta em relação à consulta GViz.
    // Une as duas fontes por software, em vez de descartar uma delas. Assim,
    // uma publicação parcial do CSV não faz linhas desaparecerem.
    const merged=new Map();
    valid.forEach(source=>source.value.rows.forEach(r=>{
      const software=normalize(r.software), key=software.toLocaleLowerCase("pt-BR");
      if(!software)return;
      const status=canonicalStatus(r.status);
      if(!merged.has(key)) merged.set(key,{software,status});
      else if(!merged.get(key).status && status) merged.get(key).status=status;
      else if(merged.get(key).status!==STATUS.DISPONIVEL && status===STATUS.DISPONIVEL) merged.get(key).status=status;
    }));
    allRows=[...merged.values()].filter(r=>r.software&&!isHeaderRow(r.software,r.status));
    hasLoadedData=true;updateDashboard();setLastUpdate(new Date().toLocaleString("pt-BR"));setConnection("Conectado","ok");
    if(result.value.empty)showError("A planilha foi acessada, mas ainda não há softwares cadastrados.","warning");else hideError();
    if(valid.length>1&&valid.some(r=>r.value.rows.length!==result.value.rows.length))console.info("Google Sheets: foi utilizada a fonte com maior quantidade de registros.");
  }catch(error){console.error("Falha ao carregar dados:",error);setConnection("Sem conexão com a planilha","error");setLastUpdate("Não atualizada");updateDashboard();if(hasLoadedData)showError("Não foi possível atualizar os dados agora. Os dados anteriores continuam sendo exibidos.","warning");else{showError("Não foi possível obter os dados da planilha. Verifique se a publicação do Google Sheets está ativa e tente novamente.","error");renderEmptyState("Não foi possível carregar os dados.");}}
}

function loadMedia(){
  if($("mediaResultCount"))$("mediaResultCount").textContent="Consultando mídias...";
  return fetchCsv(CONFIG.MIDIAS_CSV_URL).then(text=>{const parsed=parseCSV(text.replace(/^\uFEFF/,""));if(!parsed.length)throw new Error("CSV vazio");const headers=parsed[0].map(normalize).map(x=>x.toLowerCase());let idx=headers.indexOf("software"),tipo=headers.indexOf("tipo"),link=headers.indexOf("link"),obs=headers.indexOf("observação");if(obs<0)obs=headers.indexOf("observacao");if(idx<0)idx=0;if(tipo<0)tipo=1;if(link<0)link=2;if(obs<0)obs=3;mediaRows=parsed.slice(1).map(r=>({software:normalize(r[idx]),tipo:normalize(r[tipo]),link:normalize(r[link]),observacao:normalize(r[obs])})).filter(r=>r.software||r.link);mediaLoaded=true;populateTypes();renderMedia();$("mediaResultCount").textContent=`${mediaRows.length} registro${mediaRows.length===1?'':'s'}`;if(hasLoadedData)hideError();}).catch(e=>{console.error(e);mediaLoaded=false;renderMediaError("Não foi possível carregar os dados da aba Midias. Verifique a publicação da planilha.");});
}

function statusClass(status){if(status===STATUS.DISPONIVEL)return"available";if(status===STATUS.CONSULTA)return"consulta";if(status===STATUS.SEM_PACOTE)return"none";return"unknown";}
function updateDashboard(){const total=allRows.length,consulta=allRows.filter(r=>r.status===STATUS.CONSULTA).length,semPacote=allRows.filter(r=>r.status===STATUS.SEM_PACOTE).length,disponivel=allRows.filter(r=>r.status===STATUS.DISPONIVEL).length,percent=total?disponivel/total*100:0;$("total").textContent=total;$("emConsulta").textContent=consulta;$("semPacote").textContent=semPacote;$("disponivel").textContent=disponivel;$("progressPercent").textContent=`${percent.toFixed(1)}%`;$("progressBar").style.width=`${percent}%`;const a=total?consulta/total*360:0,b=total?semPacote/total*360:0;$("donut").style.background=`conic-gradient(#d99a20 0deg ${a}deg,#d15b5b ${a}deg ${a+b}deg,#1769c2 ${a+b}deg 360deg)`;$("legend").innerHTML=`<div><span class="dot consulta-dot"></span>Em Consulta <b>${consulta}</b></div><div><span class="dot none-dot"></span>Sem pacote oficial <b>${semPacote}</b></div><div><span class="dot available-dot"></span>Disponível no \\Mídias <b>${disponivel}</b></div>`;renderTable();}
function renderEmptyState(message){$("softwareTable").innerHTML=`<tr><td colspan="2" class="empty">${escapeHtml(message)}</td></tr>`;$("resultCount").textContent="0 registros";}
function renderTable(){const search=normalize($("search")?.value).toLowerCase(),filter=canonicalStatus($("statusFilter")?.value);const rows=allRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||r.status===filter));$("resultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;$("softwareTable").innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status||"Sem status")}</span></td></tr>`).join(""):`<tr><td colspan="2" class="empty">${allRows.length?"Nenhum software encontrado para os filtros atuais.":"Nenhum software cadastrado."}</td></tr>`;}
function updateStatusFilterStyle(){const sel=$("statusFilter");if(!sel)return;sel.classList.remove("status-filter-consulta","status-filter-none","status-filter-available");const v=canonicalStatus(sel.value);if(v===STATUS.CONSULTA)sel.classList.add("status-filter-consulta");else if(v===STATUS.SEM_PACOTE)sel.classList.add("status-filter-none");else if(v===STATUS.DISPONIVEL)sel.classList.add("status-filter-available");}
function populateTypes(){const sel=$("mediaTypeFilter");if(!sel)return;const current=sel.value,types=[...new Set(mediaRows.map(r=>r.tipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));sel.innerHTML='<option value="">Todos os tipos</option>'+types.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");if(types.includes(current))sel.value=current;}
function copyAddress(link,button){const x=String(link??"").replace(/^\uFEFF/,"").replace(/\u00A0/g," ").trim();if(!x)return;try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(x).then(()=>copiedFeedback(button)).catch(()=>fallbackCopy(x,button));}else fallbackCopy(x,button);}catch(e){fallbackCopy(x,button);}}
function fallbackCopy(x,button){const ta=document.createElement("textarea");ta.value=x;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.focus();ta.select();try{if(!document.execCommand("copy"))throw new Error("copy failed");copiedFeedback(button);}catch(e){alert("Não foi possível copiar o endereço.\n\n"+x);}finally{ta.remove();}}
function copiedFeedback(button){if(!button)return;const original=button.textContent;button.textContent="✓ Copiado!";button.classList.add("copied");setTimeout(()=>{button.textContent=original;button.classList.remove("copied");},1600);}
function openAddressInBrowser(link){const x=String(link??"").replace(/^\uFEFF/,"").replace(/\u00A0/g," ").trim();if(!x)return;window.open(x,"_blank","noopener,noreferrer");}
function renderMedia(){const search=normalize($("mediaSearch")?.value).toLowerCase(),filter=normalize($("mediaTypeFilter")?.value),rows=mediaRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||r.tipo===filter));$("mediaResultCount").textContent=`${rows.length} registro${rows.length===1?'':'s'}`;$("mediaTable").innerHTML=rows.length?rows.map(r=>{const link=r.link||"—",i=mediaRows.indexOf(r);return`<tr><td>${escapeHtml(r.software)}</td><td>${escapeHtml(r.tipo||"—")}</td><td class="link-cell" title="${escapeHtml(link)}"><span class="media-link-text">${escapeHtml(link)}</span>${r.link?`<button type="button" class="open-link copy-link" data-media-index="${i}">Copiar endereço</button>`:""}</td><td>${escapeHtml(r.observacao||"—")}</td></tr>`;}).join(""):`<tr><td colspan="4" class="empty">${mediaRows.length?"Nenhuma mídia encontrada para os filtros atuais.":"Nenhuma mídia cadastrada."}</td></tr>`;}
function renderMediaError(message){$("mediaTable").innerHTML=`<tr><td colspan="5" class="empty">${escapeHtml(message)}</td></tr>`;$("mediaResultCount").textContent="0 registros";}
function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

document.addEventListener("click",e=>{const copy=e.target.closest(".copy-link");if(copy){const i=Number(copy.dataset.mediaIndex);if(Number.isInteger(i)&&mediaRows[i])copyAddress(mediaRows[i].link,copy);return;}const open=e.target.closest(".browser-link");if(open){const i=Number(open.dataset.mediaIndex);if(Number.isInteger(i)&&mediaRows[i])openAddressInBrowser(mediaRows[i].link);}});
function showPage(page,writeHash=true){const media=page==="midias";$("page-dashboard").classList.toggle("hidden-page",media);$("page-midias").classList.toggle("hidden-page",!media);document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));if(writeHash)history.pushState(null,"",`#${page}`);if(media&&!mediaLoaded)loadMedia();}
function init(){
  $("search").addEventListener("input",renderTable);$("statusFilter").addEventListener("change",()=>{updateStatusFilterStyle();renderTable();});$("refreshButton").addEventListener("click",loadData);$("mediaButton").addEventListener("click",()=>showPage("midias"));$("mediaSearch").addEventListener("input",renderMedia);$("mediaTypeFilter").addEventListener("change",renderMedia);$("mediaRefreshButton").addEventListener("click",loadMedia);$("mediaBackButton").addEventListener("click",()=>showPage("dashboard"));document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));window.addEventListener("popstate",()=>showPage(location.hash==="#midias"?"midias":"dashboard",false));showPage(location.hash==="#midias"?"midias":"dashboard",false);updateStatusFilterStyle();loadData();setInterval(()=>{loadData();if(mediaLoaded)loadMedia();},CONFIG.REFRESH_INTERVAL_MS);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
