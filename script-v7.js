const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  GOOGLE_SHEET_ID: "1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg",
  GOOGLE_SHEET_GID: "474438347",
  GOOGLE_SHEET_MIDIAS_GID: "", // opcional: informe o gid da aba Midias se quiser usar o gid diretamente
  GOOGLE_SHEET_MIDIAS_NAME: "Midias",
  REFRESH_INTERVAL_MS: 30000,
  REQUEST_TIMEOUT_MS: 10000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_PACOTE: "Sem pacote oficial",
  DISPONIVEL: "Disponível no \\Mídias"
};

let allRows = [];
let hasLoadedData = false;
let lastSource = "";
let midiasRows = [];
let midiasLoaded = false;

function $(id) { return document.getElementById(id); }
function normalize(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeStatus(value) {
  return normalize(value)
    .replace(/\\+/g, "\\")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalStatus(value) {
  const raw = normalize(value);
  const key = normalizeStatus(raw);
  if (key === normalizeStatus(STATUS.CONSULTA)) return STATUS.CONSULTA;
  if (key === normalizeStatus(STATUS.SEM_PACOTE)) return STATUS.SEM_PACOTE;
  if (key === normalizeStatus(STATUS.DISPONIVEL)) return STATUS.DISPONIVEL;
  return raw;
}

function isHeaderRow(software, status) {
  return normalize(software).toLowerCase() === "software" && normalize(status).toLowerCase() === "status";
}

function setConnection(text, type = "neutral") {
  const el = $("connectionStatus");
  if (!el) return;
  el.textContent = text;
  el.className = `connection ${type}`;
}

function setLastUpdate(text) {
  if ($("lastUpdate")) $("lastUpdate").textContent = text;
}

function showError(message, type = "error") {
  const box = $("errorBox");
  if (!box) return;
  box.className = `notice ${type}`;
  box.textContent = message;
}

function hideError() {
  const box = $("errorBox");
  if (box) box.className = "notice hidden";
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i++;
      row.push(cell); cell = "";
      if (row.some(v => normalize(v))) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => normalize(v))) rows.push(row);
  }
  return rows;
}

function parseSheetData(text) {
  const parsed = parseCSV(text.replace(/^\uFEFF/, ""));
  if (!parsed.length) return { rows: [], empty: true };

  // Publicado via Google Sheets pode chegar com cabeçalhos A, B, C...;
  // neste painel, A=Software e B=Status. Não exigimos que os nomes
  // "Software" e "Status" estejam presentes para aceitar o arquivo.
  const headers = parsed[0].map(normalize);
  const lowerHeaders = headers.map(h => h.toLowerCase());
  let softwareIndex = lowerHeaders.findIndex(h => h === "software");
  let statusIndex = lowerHeaders.findIndex(h => h === "status");

  if (softwareIndex < 0 && statusIndex < 0 && parsed[0].length >= 2) {
    softwareIndex = 0;
    statusIndex = 1;
  } else {
    if (softwareIndex < 0 && lowerHeaders[0] === "a") softwareIndex = 0;
    if (statusIndex < 0 && lowerHeaders[1] === "b") statusIndex = 1;
  }

  if (softwareIndex < 0 || statusIndex < 0) {
    throw new Error(`Não foi possível identificar Software e Status. Cabeçalhos: ${headers.join(" | ")}`);
  }

  const rows = parsed.map(r => ({
    software: normalize(r[softwareIndex]),
    status: canonicalStatus(r[statusIndex])
  })).filter(r => r.software && !isHeaderRow(r.software, r.status));

  return { rows, empty: rows.length === 0 };
}

async function fetchCsv() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const sep = CONFIG.GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?";
    const response = await fetch(CONFIG.GOOGLE_SHEET_CSV_URL + sep + "cache=" + Date.now(), {
      cache: "no-store", mode: "cors", signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseSheetData(await response.text());
  } finally { clearTimeout(timer); }
}

// Fallback sem fetch/CORS: o navegador carrega a resposta do Google como script JSONP.
function fetchGoogleJsonp() {
  return new Promise((resolve, reject) => {
    const callback = `googleSheetCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => cleanup(new Error("Tempo limite do Google Sheets excedido.")), CONFIG.REQUEST_TIMEOUT_MS);

    function cleanup(error, data) {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(data);
    }

    window[callback] = payload => {
      try {
        const table = payload && payload.table;
        if (!table) throw new Error("Resposta do Google Sheets sem dados de tabela.");

        const cols = Array.isArray(table.cols) ? table.cols : [];
        const rows = Array.isArray(table.rows) ? table.rows : [];

        // O Google Visualization pode retornar label vazio e id "A", "B"...
        // ou, dependendo da consulta, apenas os identificadores das colunas.
        // Como a planilha deste painel possui A=Software e B=Status, usamos
        // os nomes quando disponíveis e, como fallback seguro, as posições A/B.
        const labels = cols.map(c => normalize(c?.label));
        const ids = cols.map(c => normalize(c?.id).toLowerCase());

        let softwareIndex = labels.findIndex(h => h.toLowerCase() === "software");
        let statusIndex = labels.findIndex(h => h.toLowerCase() === "status");

        if (softwareIndex < 0) softwareIndex = ids.findIndex(h => h === "a");
        if (statusIndex < 0) statusIndex = ids.findIndex(h => h === "b");

        // Último fallback: a consulta foi limitada a A:B, portanto as duas
        // primeiras posições são necessariamente Software e Status.
        if (softwareIndex < 0 && cols.length >= 2) softwareIndex = 0;
        if (statusIndex < 0 && cols.length >= 2) statusIndex = 1;

        if (softwareIndex < 0 || statusIndex < 0) {
          const encontrados = cols.map((c, i) => normalize(c?.label) || normalize(c?.id) || String.fromCharCode(65 + i));
          return cleanup(new Error(`Colunas encontradas: ${encontrados.join(" | ")}`));
        }

        const data = rows.map(row => {
          const cells = Array.isArray(row?.c) ? row.c : [];
          return {
            software: normalize(cells[softwareIndex]?.v ?? cells[softwareIndex]?.f),
            status: canonicalStatus(cells[statusIndex]?.v ?? cells[statusIndex]?.f)
          };
        }).filter(r => r.software && !isHeaderRow(r.software, r.status));

        cleanup(null, { rows: data, empty: data.length === 0 });
      } catch (e) {
        cleanup(e);
      }
    };

    script.onerror = () => cleanup(new Error("O Google Sheets recusou a consulta alternativa."));

    const query = encodeURIComponent("select A, B");
    const tqx = encodeURIComponent(`out:json;responseHandler:${callback}`);
    script.src = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?gid=${encodeURIComponent(CONFIG.GOOGLE_SHEET_GID)}&tqx=${tqx}&tq=${query}`;
    document.head.appendChild(script);
  });
}


function parseMidiasData(text) {
  const parsed = parseCSV(text.replace(/^\uFEFF/, ""));
  if (!parsed.length) return { rows: [], empty: true };
  const headers = parsed[0].map(normalize).map(h => h.toLowerCase());
  const find = names => headers.findIndex(h => names.includes(h));
  let softwareIndex = find(["software", "a"]);
  let tipoIndex = find(["tipo", "type", "b"]);
  let linkIndex = find(["link", "endereço", "endereco", "url", "c"]);
  let obsIndex = find(["observação", "observacao", "descrição", "descricao", "d"]);
  if (softwareIndex < 0) softwareIndex = 0;
  if (tipoIndex < 0) tipoIndex = 1;
  if (linkIndex < 0) linkIndex = 2;
  if (obsIndex < 0) obsIndex = 3;
  const first = parsed[0];
  const isHeader = normalize(first[softwareIndex]).toLowerCase() === "software";
  const source = isHeader ? parsed.slice(1) : parsed;
  const rows = source.map(r => ({
    software: normalize(r[softwareIndex]),
    tipo: normalize(r[tipoIndex]),
    link: normalize(r[linkIndex]),
    observacao: normalize(r[obsIndex])
  })).filter(r => r.software && r.software.toLowerCase() !== "software");
  return { rows, empty: rows.length === 0 };
}

async function fetchMidiasCsv() {
  const base = CONFIG.GOOGLE_SHEET_CSV_URL.replace(/gid=[^&]+/i, "gid=" + encodeURIComponent(CONFIG.GOOGLE_SHEET_MIDIAS_GID || CONFIG.GOOGLE_SHEET_GID));
  const url = CONFIG.GOOGLE_SHEET_MIDIAS_GID ? base : CONFIG.GOOGLE_SHEET_CSV_URL.replace(/\?[^#]*/, "?sheet=" + encodeURIComponent(CONFIG.GOOGLE_SHEET_MIDIAS_NAME) + "&single=true&output=csv");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const sep = url.includes("?") ? "&" : "?";
    const response = await fetch(url + sep + "cache=" + Date.now(), { cache:"no-store", mode:"cors", signal:controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseMidiasData(await response.text());
  } finally { clearTimeout(timer); }
}

function fetchMidiasGoogleJsonp() {
  return new Promise((resolve, reject) => {
    const callback = `googleMidiasCallback_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => cleanup(new Error("Tempo limite da aba Midias excedido.")), CONFIG.REQUEST_TIMEOUT_MS);
    function cleanup(error, data){ clearTimeout(timer); delete window[callback]; script.remove(); error ? reject(error) : resolve(data); }
    window[callback] = payload => {
      try {
        const table = payload && payload.table;
        if (!table) throw new Error("Resposta da aba Midias sem dados de tabela.");
        const cols = Array.isArray(table.cols) ? table.cols : [];
        const rows = Array.isArray(table.rows) ? table.rows : [];
        const labels = cols.map(c => normalize(c?.label).toLowerCase());
        const ids = cols.map(c => normalize(c?.id).toLowerCase());
        const find = names => { const a=labels.findIndex(x=>names.includes(x)); if(a>=0)return a; return ids.findIndex(x=>names.includes(x)); };
        let si=find(["software","a"]), ti=find(["tipo","type","b"]), li=find(["link","endereço","endereco","url","c"]), oi=find(["observação","observacao","descrição","descricao","d"]);
        if(si<0)si=0;if(ti<0)ti=1;if(li<0)li=2;if(oi<0)oi=3;
        const data=rows.map(row=>{const c=Array.isArray(row?.c)?row.c:[];return {software:normalize(c[si]?.v??c[si]?.f),tipo:normalize(c[ti]?.v??c[ti]?.f),link:normalize(c[li]?.v??c[li]?.f),observacao:normalize(c[oi]?.v??c[oi]?.f)}}).filter(r=>r.software&&r.software.toLowerCase()!=="software");
        cleanup(null,{rows:data,empty:data.length===0});
      }catch(e){cleanup(e)}
    };
    script.onerror=()=>cleanup(new Error("O Google Sheets recusou a consulta da aba Midias."));
    const query=encodeURIComponent("select A,B,C,D");
    const tqx=encodeURIComponent(`out:json;responseHandler:${callback}`);
    const sheetParam=CONFIG.GOOGLE_SHEET_MIDIAS_GID ? `gid=${encodeURIComponent(CONFIG.GOOGLE_SHEET_MIDIAS_GID)}` : `sheet=${encodeURIComponent(CONFIG.GOOGLE_SHEET_MIDIAS_NAME)}`;
    script.src=`https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?${sheetParam}&tqx=${tqx}&tq=${query}`;
    document.head.appendChild(script);
  });
}

async function loadMidias() {
  try {
    let result;
    // Se o GID da aba Midias for informado, usa CSV publicado.
    // Caso contrário, usa Google Visualization por nome da aba, que é mais confiável
    // para uma aba adicional dentro da mesma planilha publicada.
    if (CONFIG.GOOGLE_SHEET_MIDIAS_GID) {
      try { result = await fetchMidiasCsv(); }
      catch (e) { console.warn("CSV da aba Midias não carregou; tentando Google Sheets.", e); result = await fetchMidiasGoogleJsonp(); }
    } else {
      result = await fetchMidiasGoogleJsonp();
    }
    midiasRows = result.rows;
    midiasLoaded = true;
    renderMidias();
    populateMidiasTypes();
  } catch(e) {
    console.error("Falha ao carregar Midias:",e);
    if(!midiasLoaded) renderMidiasEmpty("Não foi possível carregar a aba Midias. Verifique se a aba se chama exatamente Midias e se a planilha está publicada.");
  }
}

function populateMidiasTypes(){
  const select=$("midiasTypeFilter"); if(!select)return;
  const current=select.value;
  const types=[...new Set(midiasRows.map(r=>r.tipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  select.innerHTML='<option value="">Todos os tipos</option>'+types.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  if(types.includes(current)) select.value=current;
}

function renderMidiasEmpty(message){
  if($("midiasTable"))$("midiasTable").innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(message)}</td></tr>`;
  if($("midiasResultCount"))$("midiasResultCount").textContent="0 registros";
}

function renderMidias(){
  const search=normalize($("midiasSearch")?.value).toLowerCase();
  const filter=normalize($("midiasTypeFilter")?.value);
  const rows=midiasRows.filter(r=>(!search||r.software.toLowerCase().includes(search))&&(!filter||r.tipo===filter));
  $("midiasResultCount").textContent=`${rows.length} registro${rows.length===1?"":"s"}`;
  if(!rows.length){renderMidiasEmpty(midiasRows.length?"Nenhuma mídia encontrada para os filtros atuais.":"Nenhuma mídia cadastrada.");return;}
  $("midiasTable").innerHTML=rows.map(r=>{
    const link=r.link;
    const isUrl=/^https?:\/\//i.test(link);
    const href=isUrl?link:(/^\\\\/.test(link)?`file://${link.replace(/\\/g,"/")}`:link);
    const action=link?(isUrl?`<a class="link-button" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Abrir</a>`:`<a class="link-button" href="${escapeHtml(href)}">Abrir</a>`):"—";
    return `<tr><td>${escapeHtml(r.software)}</td><td><span class="midias-type">${escapeHtml(r.tipo||"Não informado")}</span></td><td><div class="link-text">${escapeHtml(link||"Sem endereço")}</div><div style="margin-top:6px">${action}</div></td><td>${escapeHtml(r.observacao||"—")}</td></tr>`;
  }).join("");
}

function showPage(page){
  if (page !== "midias") location.hash = "#dashboard";
  else location.hash = "#midias";
  const dash=$("page-dashboard");
  const mid=$("page-midias");
  if(dash)dash.classList.toggle("hidden-page",page!=="dashboard");
  if(mid)mid.classList.toggle("hidden-page",page!=="midias");
  document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
  if(page==="midias" && !midiasLoaded)loadMidias();
}

async function loadData() {
  setConnection("Consultando planilha...", "loading");
  setLastUpdate("Atualizando...");

  let result;
  let source;
  try {
    try {
      result = await fetchCsv();
      source = "CSV publicado";
    } catch (csvError) {
      console.warn("CSV não carregou; tentando Google Sheets JSONP.", csvError);
      result = await fetchGoogleJsonp();
      source = "Google Sheets";
    }

    allRows = result.rows
      .map(r => ({ software: normalize(r.software), status: canonicalStatus(r.status) }))
      .filter(r => r.software && !isHeaderRow(r.software, r.status));
    hasLoadedData = true;
    lastSource = source;
    updateDashboard();
    setLastUpdate(new Date().toLocaleString("pt-BR"));
    setConnection(`Conectado • ${source}`, "ok");

    if (result.empty) {
      showError("A planilha foi acessada, mas ainda não há softwares cadastrados.", "warning");
    } else {
      hideError();
    }
  } catch (error) {
    console.error("Falha ao carregar dados:", error);
    setConnection("Sem conexão com a planilha", "error");
    setLastUpdate("Não atualizada");
    updateDashboard();

    if (hasLoadedData) {
      showError("Não foi possível atualizar os dados agora. Os dados anteriores continuam sendo exibidos.", "warning");
    } else {
      showError("Não foi possível obter os dados da planilha. Verifique se a publicação do Google Sheets está ativa e tente novamente.", "error");
      renderEmptyState("Não foi possível carregar os dados.");
    }
  }
}

function statusClass(status) {
  if (status === STATUS.DISPONIVEL) return "available";
  if (status === STATUS.CONSULTA) return "consulta";
  if (status === STATUS.SEM_PACOTE) return "none";
  return "unknown";
}

function updateDashboard() {
  const total = allRows.length;
  const consulta = allRows.filter(r => r.status === STATUS.CONSULTA).length;
  const semPacote = allRows.filter(r => r.status === STATUS.SEM_PACOTE).length;
  const disponivel = allRows.filter(r => r.status === STATUS.DISPONIVEL).length;
  const percent = total ? (disponivel / total) * 100 : 0;

  $("total").textContent = total;
  $("emConsulta").textContent = consulta;
  $("semPacote").textContent = semPacote;
  $("disponivel").textContent = disponivel;
  $("progressPercent").textContent = `${percent.toFixed(1)}%`;
  $("progressBar").style.width = `${percent}%`;

  const a = total ? consulta / total * 360 : 0;
  const b = total ? semPacote / total * 360 : 0;
  $("donut").style.background = `conic-gradient(#d99a20 0deg ${a}deg, #d15b5b ${a}deg ${a + b}deg, #1769c2 ${a + b}deg 360deg)`;
  $("legend").innerHTML = `
    <div><span class="dot consulta-dot"></span>Em Consulta <b>${consulta}</b></div>
    <div><span class="dot none-dot"></span>Sem pacote oficial <b>${semPacote}</b></div>
    <div><span class="dot available-dot"></span>Disponível no \\Mídias <b>${disponivel}</b></div>`;
  renderTable();
}

function renderEmptyState(message) {
  $("softwareTable").innerHTML = `<tr><td colspan="2" class="empty">${escapeHtml(message)}</td></tr>`;
  $("resultCount").textContent = "0 registros";
}

function renderTable() {
  const search = normalize($("search")?.value).toLowerCase();
  const filter = normalize($("statusFilter")?.value);
  const rows = allRows.filter(r => (!search || r.software.toLowerCase().includes(search)) && (!filter || r.status === filter));
  $("resultCount").textContent = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  if (!rows.length) {
    $("softwareTable").innerHTML = `<tr><td colspan="2" class="empty">${allRows.length ? "Nenhum software encontrado para os filtros atuais." : "Nenhum software cadastrado."}</td></tr>`;
    return;
  }
  $("softwareTable").innerHTML = rows.map(r => `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status || "Sem status")}</span></td></tr>`).join("");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function initDashboard() {
  $("search").addEventListener("input", renderTable);
  $("statusFilter").addEventListener("change", renderTable);
  $("refreshButton").addEventListener("click", loadData);
  $("refreshMidiasButton")?.addEventListener("click", loadMidias);
  $("midiasSearch")?.addEventListener("input", renderMidias);
  $("midiasTypeFilter")?.addEventListener("change", renderMidias);
  document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", () => showPage(a.dataset.page)));
  $("openMidiasFromCard")?.addEventListener("click", () => { location.hash = "#midias"; showPage("midias"); });
  showPage(location.hash === "#midias" ? "midias" : "dashboard");
  updateDashboard();
  loadData();
  setInterval(() => { loadData(); if (midiasLoaded) loadMidias(); }, CONFIG.REFRESH_INTERVAL_MS);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDashboard);
else initDashboard();
