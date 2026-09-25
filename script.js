const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
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

function $(id) {
  return document.getElementById(id);
}

function showError(message) {
  const box = $("errorBox");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  const box = $("errorBox");
  if (box) box.classList.add("hidden");
}

function setLastUpdate(text) {
  if ($("lastUpdate")) $("lastUpdate").textContent = text;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  return rows;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function isHeaderRow(headers) {
  const normalized = headers.map(h => normalize(h).toLowerCase());
  return normalized.includes("software") && normalized.includes("status");
}

function parseSheetData(text) {
  const parsed = parseCSV(text);

  // A completely empty publication is a valid "empty sheet" state.
  if (!parsed.length) {
    return { rows: [], empty: true };
  }

  const headers = parsed[0].map(normalize);
  const softwareIndex = headers.findIndex(h => h.toLowerCase() === "software");
  const statusIndex = headers.findIndex(h => h.toLowerCase() === "status");

  if (!isHeaderRow(headers) || softwareIndex === -1 || statusIndex === -1) {
    throw new Error(
      `Cabeçalhos inválidos. Encontrados: ${headers.join(" | ")}. ` +
      'A primeira linha deve conter "Software" e "Status".'
    );
  }

  const rows = parsed.slice(1)
    .map(r => ({
      software: normalize(r[softwareIndex]),
      status: normalize(r[statusIndex])
    }))
    .filter(r => r.software);

  return { rows, empty: rows.length === 0 };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "no-store",
      mode: "cors",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function loadData() {
  try {
    const separator = CONFIG.GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?";
    const url = CONFIG.GOOGLE_SHEET_CSV_URL + separator + "_=" + Date.now();

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const result = parseSheetData(text);

    // Only replace current data after a successful parse.
    // Thus, a temporary network failure won't erase already loaded data.
    allRows = result.rows;
    hasLoadedData = true;

    updateDashboard();
    setLastUpdate(new Date().toLocaleString("pt-BR"));

    if (result.empty) {
      showError("A planilha está acessível, mas não possui softwares cadastrados no momento.");
    } else {
      hideError();
    }
  } catch (error) {
    console.error("Erro ao carregar a planilha:", error);

    // Keep the dashboard usable even if the refresh fails.
    updateDashboard();

    let detail = error?.message || "Erro desconhecido";
    if (error?.name === "AbortError") {
      detail = "tempo limite de 10 segundos excedido";
    }

    if (hasLoadedData) {
      showError(
        "Não foi possível atualizar a planilha agora. " +
        "Os dados carregados anteriormente continuam sendo exibidos. " +
        `Detalhe: ${detail}`
      );
    } else {
      showError(
        "A página foi carregada, mas a planilha não está disponível no momento. " +
        "O painel continuará tentando novamente automaticamente. " +
        `Detalhe: ${detail}`
      );
      renderEmptyState("Aguardando dados da planilha...");
    }
  }
}

function statusClass(status) {
  if (status === STATUS.DISPONIVEL) return "available";
  if (status === STATUS.CONSULTA) return "consulta";
  if (status === STATUS.SEM_PACOTE) return "none";
  return "";
}

function updateDashboard() {
  const total = allRows.length;
  const consulta = allRows.filter(r => r.status === STATUS.CONSULTA).length;
  const semPacote = allRows.filter(r => r.status === STATUS.SEM_PACOTE).length;
  const disponivel = allRows.filter(r => r.status === STATUS.DISPONIVEL).length;
  const percent = total ? (disponivel / total) * 100 : 0;

  if ($("total")) $("total").textContent = total;
  if ($("emConsulta")) $("emConsulta").textContent = consulta;
  if ($("semPacote")) $("semPacote").textContent = semPacote;
  if ($("disponivel")) $("disponivel").textContent = disponivel;
  if ($("progressPercent")) $("progressPercent").textContent = percent.toFixed(1) + "%";
  if ($("progressBar")) $("progressBar").style.width = percent + "%";

  const a = total ? (consulta / total) * 360 : 0;
  const b = total ? (semPacote / total) * 360 : 0;

  if ($("donut")) {
    $("donut").style.background =
      `conic-gradient(#e3a72f 0deg ${a}deg, #d15b5b ${a}deg ${a + b}deg, #1769c2 ${a + b}deg 360deg)`;
  }

  if ($("legend")) {
    $("legend").innerHTML = `
      <div class="legend-item"><span class="dot" style="background:#e3a72f"></span>Em Consulta: ${consulta}</div>
      <div class="legend-item"><span class="dot" style="background:#d15b5b"></span>Sem pacote oficial: ${semPacote}</div>
      <div class="legend-item"><span class="dot" style="background:#1769c2"></span>Disponível no \\Mídias: ${disponivel}</div>
    `;
  }

  renderTable();
}

function renderEmptyState(message) {
  const tbody = $("softwareTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">${escapeHtml(message)}</td></tr>`;
  }
  if ($("resultCount")) $("resultCount").textContent = "0 registros";
}

function renderTable() {
  const searchElement = $("search");
  const filterElement = $("statusFilter");

  const search = normalize(searchElement?.value).toLowerCase();
  const filter = normalize(filterElement?.value);

  const rows = allRows.filter(r => {
    const matchSearch = !search || r.software.toLowerCase().includes(search);
    const matchStatus = !filter || r.status === filter;
    return matchSearch && matchStatus;
  });

  if ($("resultCount")) {
    $("resultCount").textContent =
      `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  }

  const tbody = $("softwareTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">${
      allRows.length ? "Nenhum software encontrado para os filtros atuais." : "Nenhum software cadastrado."
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.software)}</td>
      <td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status || "Sem status")}</span></td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initDashboard() {
  // The HTML remains usable even if JavaScript fails later.
  if ($("search")) $("search").addEventListener("input", renderTable);
  if ($("statusFilter")) $("statusFilter").addEventListener("change", renderTable);

  // Establish a valid visual state before the first network request.
  updateDashboard();
  loadData();
  setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
