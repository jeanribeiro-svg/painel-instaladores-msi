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
  DISPONIVEL: "Disponível no \\Mídias"
};

let allRows = [];
let hasLoadedData = false;
let loading = false;

function $(id) { return document.getElementById(id); }
function normalize(value) { return String(value ?? "").trim(); }

function setLastUpdate(text, state = "") {
  const el = $("lastUpdate");
  if (!el) return;
  el.textContent = text;
  el.className = state;
}

function showError(message, type = "error") {
  const box = $("errorBox");
  if (!box) return;
  box.textContent = message;
  box.className = `error-box ${type}`;
}

function hideError() {
  const box = $("errorBox");
  if (box) box.className = "error-box hidden";
}

function setLoading(isLoading) {
  loading = isLoading;
  const btn = $("retryButton");
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Atualizando..." : "Atualizar agora";
  }
  document.body.classList.toggle("is-loading", isLoading);
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
      if (row.some(v => normalize(v) !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => normalize(v) !== "")) rows.push(row);
  }
  return rows;
}

function parseSheetData(text) {
  const parsed = parseCSV(text.replace(/^\uFEFF/, ""));
  if (!parsed.length) return { rows: [], empty: true };

  const headers = parsed[0].map(normalize);
  const softwareIndex = headers.findIndex(h => h.toLowerCase() === "software");
  const statusIndex = headers.findIndex(h => h.toLowerCase() === "status");
  if (softwareIndex < 0 || statusIndex < 0) {
    throw new Error(`Cabeçalhos inválidos. Encontrados: ${headers.join(" | ")}`);
  }

  const rows = parsed.slice(1).map(r => ({
    software: normalize(r[softwareIndex]),
    status: normalize(r[statusIndex])
  })).filter(r => r.software);

  return { rows, empty: rows.length === 0 };
}

async function fetchCsv() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const url = CONFIG.GOOGLE_SHEET_CSV_URL + `&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", mode: "cors", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text.trim()) return { rows: [], empty: true, method: "CSV" };
    return { ...parseSheetData(text), method: "CSV" };
  } finally {
    clearTimeout(timer);
  }
}

function fetchGvizJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `__sheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let finished = false;
    const timeout = setTimeout(() => finish(new Error("tempo limite do Google Sheets excedido")), CONFIG.REQUEST_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }
    function finish(error, data) {
      if (finished) return;
      finished = true;
      cleanup();
      error ? reject(error) : resolve(data);
    }

    window[callbackName] = payload => {
      try {
        const table = payload?.table;
        if (!table?.cols) throw new Error("Resposta do Google Sheets sem estrutura de tabela.");
        const headers = table.cols.map(c => normalize(c.label || c.id));
        const softwareIndex = headers.findIndex(h => h.toLowerCase() === "software");
        const statusIndex = headers.findIndex(h => h.toLowerCase() === "status");
        if (softwareIndex < 0 || statusIndex < 0) throw new Error(`Colunas encontradas: ${headers.join(" | ")}`);
        const rows = (table.rows || []).map(r => ({
          software: normalize(r.c?.[softwareIndex]?.v),
          status: normalize(r.c?.[statusIndex]?.v)
        })).filter(r => r.software);
        finish(null, { rows, empty: rows.length === 0, method: "Google Visualization" });
      } catch (e) { finish(e); }
    };

    const params = `gid=${encodeURIComponent(CONFIG.GOOGLE_SHEET_GID)}&tqx=${encodeURIComponent(`out:json;responseHandler:${callbackName}`)}&_=${Date.now()}`;
    script.src = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?${params}`;
    script.onerror = () => finish(new Error("Google Sheets bloqueou ou não disponibilizou a consulta JSONP."));
    document.head.appendChild(script);
  });
}

async function loadData() {
  if (loading) return;
  setLoading(true);
  setLastUpdate("Atualizando...", "loading");

  try {
    let result;
    let firstError = null;
    try {
      result = await fetchCsv();
    } catch (e) {
      firstError = e;
      result = await fetchGvizJsonp();
    }

    allRows = result.rows;
    hasLoadedData = true;
    updateDashboard();
    setLastUpdate(new Date().toLocaleString("pt-BR"), "ok");

    if (result.empty) {
      showError("A planilha está acessível, mas não possui softwares cadastrados no momento.", "warning");
    } else {
      hideError();
    }

    const source = $("sourceStatus");
    if (source) source.textContent = `Fonte: Google Sheets • ${result.method}`;
  } catch (error) {
    console.error("Erro ao carregar a planilha:", error);
    updateDashboard();
    setLastUpdate("Não atualizada", "error");
    const detail = error?.name === "AbortError" ? "tempo limite excedido" : (error?.message || "erro desconhecido");

    if (hasLoadedData) {
      showError(`Falha na atualização. Os dados anteriores continuam sendo exibidos. Detalhe: ${detail}`, "warning");
    } else {
      showError(`Não foi possível carregar os dados da planilha. O painel continuará tentando automaticamente. Detalhe: ${detail}`, "error");
      renderEmptyState("Não foi possível carregar os dados. Verifique a publicação da planilha e tente novamente.");
    }
  } finally {
    setLoading(false);
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
  const donut = $("donut");
  donut.style.background = total
    ? `conic-gradient(#e3a72f 0deg ${a}deg, #d15b5b ${a}deg ${a + b}deg, #1769c2 ${a + b}deg 360deg)`
    : `conic-gradient(#e8edf4 0deg 360deg)`;

  $("legend").innerHTML = `
    <div class="legend-item"><span class="dot consulta-dot"></span><span>Em Consulta</span><strong>${consulta}</strong></div>
    <div class="legend-item"><span class="dot none-dot"></span><span>Sem pacote oficial</span><strong>${semPacote}</strong></div>
    <div class="legend-item"><span class="dot available-dot"></span><span>Disponível no \\Mídias</span><strong>${disponivel}</strong></div>`;

  renderTable();
}

function renderEmptyState(message) {
  const tbody = $("softwareTable");
  if (tbody) tbody.innerHTML = `<tr><td colspan="2" class="empty"><div class="empty-title">${escapeHtml(message)}</div><button id="emptyRetry" class="secondary-button">Tentar novamente</button></td></tr>`;
  if ($("resultCount")) $("resultCount").textContent = "0 registros";
  setTimeout(() => { $("emptyRetry")?.addEventListener("click", loadData); }, 0);
}

function renderTable() {
  const search = normalize($("search")?.value).toLowerCase();
  const filter = normalize($("statusFilter")?.value);
  const rows = allRows.filter(r => (!search || r.software.toLowerCase().includes(search)) && (!filter || r.status === filter));
  $("resultCount").textContent = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  const tbody = $("softwareTable");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">${allRows.length ? "Nenhum software encontrado para os filtros atuais." : "Nenhum software cadastrado."}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr><td>${escapeHtml(r.software)}</td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status || "Sem status")}</span></td></tr>`).join("");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function initDashboard() {
  $("search")?.addEventListener("input", renderTable);
  $("statusFilter")?.addEventListener("change", renderTable);
  $("retryButton")?.addEventListener("click", loadData);
  updateDashboard();
  loadData();
  setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initDashboard) : initDashboard();
