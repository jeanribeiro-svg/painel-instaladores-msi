const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkjRpZsinwht385Qhwt5-vK-Lvmf5QN88ttP07XzvX6tvNOrLwkr8NaSTHpFGfo1NiwuoR0oUP22I_/pub?gid=474438347&single=true&output=csv",
  REFRESH_INTERVAL_MS: 30000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_PACOTE: "Sem pacote oficial",
  DISPONIVEL: "Disponível no \\Mídias"
};

let allRows = [];

function showError(message) {
  const box = document.getElementById("errorBox");
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  document.getElementById("errorBox").classList.add("hidden");
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => v.trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalize(value) {
  return String(value ?? "").trim();
}

async function loadData() {
  try {
    hideError();

    const separator = CONFIG.GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?";
    const url = CONFIG.GOOGLE_SHEET_CSV_URL + separator + "_=" + Date.now();

    const response = await fetch(url, {
      cache: "no-store",
      mode: "cors"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = parseCSV(text);

    if (!parsed.length) {
      throw new Error("A planilha publicada retornou um CSV vazio.");
    }

    const headers = parsed[0].map(normalize);
    const softwareIndex = headers.findIndex(h => h.toLowerCase() === "software");
    const statusIndex = headers.findIndex(h => h.toLowerCase() === "status");

    if (softwareIndex === -1 || statusIndex === -1) {
      throw new Error(`Cabeçalhos encontrados: ${headers.join(" | ")}. O dashboard espera "Software" e "Status".`);
    }

    allRows = parsed.slice(1)
      .map(r => ({
        software: normalize(r[softwareIndex]),
        status: normalize(r[statusIndex])
      }))
      .filter(r => r.software);

    updateDashboard();
    document.getElementById("lastUpdate").textContent =
      new Date().toLocaleString("pt-BR");

  } catch (error) {
    console.error(error);
    showError(
      "Não foi possível carregar os dados da planilha. " +
      "Verifique se a aba Softwares está publicada como CSV e acessível publicamente. " +
      `Detalhe: ${error.message}`
    );
    document.getElementById("softwareTable").innerHTML =
      '<tr><td colspan="2" class="empty">Não foi possível carregar os dados.</td></tr>';
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

  document.getElementById("total").textContent = total;
  document.getElementById("emConsulta").textContent = consulta;
  document.getElementById("semPacote").textContent = semPacote;
  document.getElementById("disponivel").textContent = disponivel;
  document.getElementById("progressPercent").textContent = percent.toFixed(1) + "%";
  document.getElementById("progressBar").style.width = percent + "%";

  const a = total ? consulta / total * 360 : 0;
  const b = total ? semPacote / total * 360 : 0;
  const donut = document.getElementById("donut");
  donut.style.background =
    `conic-gradient(#e3a72f 0deg ${a}deg, #d15b5b ${a}deg ${a+b}deg, #1769c2 ${a+b}deg 360deg)`;

  document.getElementById("legend").innerHTML = `
    <div class="legend-item"><span class="dot" style="background:#e3a72f"></span>Em Consulta: ${consulta}</div>
    <div class="legend-item"><span class="dot" style="background:#d15b5b"></span>Sem pacote oficial: ${semPacote}</div>
    <div class="legend-item"><span class="dot" style="background:#1769c2"></span>Disponível no \\Mídias: ${disponivel}</div>
  `;

  renderTable();
}

function renderTable() {
  const search = normalize(document.getElementById("search").value).toLowerCase();
  const filter = document.getElementById("statusFilter").value;

  const rows = allRows.filter(r => {
    const matchSearch = !search || r.software.toLowerCase().includes(search);
    const matchStatus = !filter || r.status === filter;
    return matchSearch && matchStatus;
  });

  document.getElementById("resultCount").textContent =
    `${rows.length} registro${rows.length === 1 ? "" : "s"}`;

  const tbody = document.getElementById("softwareTable");

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty">Nenhum software encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.software)}</td>
      <td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
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

document.getElementById("search").addEventListener("input", renderTable);
document.getElementById("statusFilter").addEventListener("change", renderTable);

loadData();
setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
