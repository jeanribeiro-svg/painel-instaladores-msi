const CONFIG = {
  // Planilha Google Sheets informada pelo usuário.
  GOOGLE_SHEET_ID: "1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg",
  GOOGLE_SHEET_GID: "474438347",
  REFRESH_INTERVAL_MS: 30000
};

const STATUS = {
  CONSULTA: "Em Consulta",
  SEM_PACOTE: "Sem pacote oficial",
  DISPONIVEL: "Disponível no \\Mídias"
};

let softwares = [];

function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/export?format=csv&gid=${CONFIG.GOOGLE_SHEET_GID}`;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row); }
  return rows;
}

function statusClass(status) {
  const s = normalize(status);
  if (s === normalize(STATUS.CONSULTA)) return "consulta";
  if (s === normalize(STATUS.SEM_PACOTE)) return "sem";
  return "disponivel";
}

function updateDashboard(data) {
  const counts = {
    consulta: data.filter(x => normalize(x.status) === normalize(STATUS.CONSULTA)).length,
    sem: data.filter(x => normalize(x.status) === normalize(STATUS.SEM_PACOTE)).length,
    disponivel: data.filter(x => normalize(x.status) === normalize(STATUS.DISPONIVEL)).length
  };
  const total = data.length;
  const pct = n => total ? Math.round(n / total * 100) : 0;

  document.getElementById("total").textContent = total;
  document.getElementById("consulta").textContent = counts.consulta;
  document.getElementById("semPacote").textContent = counts.sem;
  document.getElementById("disponivel").textContent = counts.disponivel;
  document.getElementById("consultaPct").textContent = `${pct(counts.consulta)}%`;
  document.getElementById("semPacotePct").textContent = `${pct(counts.sem)}%`;
  document.getElementById("disponivelPct").textContent = `${pct(counts.disponivel)}%`;
  document.getElementById("progressPct").textContent = `${pct(counts.disponivel)}%`;
  document.getElementById("progressBar").style.width = `${pct(counts.disponivel)}%`;
  document.getElementById("donutTotal").textContent = total;
  document.getElementById("legendConsulta").textContent = counts.consulta;
  document.getElementById("legendSemPacote").textContent = counts.sem;
  document.getElementById("legendDisponivel").textContent = counts.disponivel;

  const a = total ? counts.consulta / total * 360 : 0;
  const b = total ? (counts.consulta + counts.sem) / total * 360 : 0;
  document.getElementById("donut").style.background =
    `conic-gradient(#e0a400 0deg ${a}deg,#d64545 ${a}deg ${b}deg,#2c9b5a ${b}deg 360deg)`;

  renderTable();
}

function renderTable() {
  const search = normalize(document.getElementById("search").value);
  const filter = normalize(document.getElementById("statusFilter").value);
  const rows = softwares.filter(item =>
    normalize(item.software).includes(search) &&
    (!filter || normalize(item.status) === filter)
  );

  const tbody = document.getElementById("softwareTable");
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="2">Nenhum software encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${escapeHTML(item.software)}</td>
      <td><span class="status ${statusClass(item.status)}">${escapeHTML(item.status)}</span></td>
    </tr>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function loadData() {
  const live = document.getElementById("liveStatus");
  try {
    live.textContent = "● Atualizando";
    const response = await fetch(`${csvUrl()}&cache=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const rows = parseCSV(csv);
    if (!rows.length) throw new Error("Planilha vazia.");

    const headers = rows[0].map(normalize);
    const softwareIndex = headers.findIndex(h => h === "software");
    const statusIndex = headers.findIndex(h => h === "status");
    if (softwareIndex < 0 || statusIndex < 0) throw new Error("Colunas Software e Status não encontradas.");

    softwares = rows.slice(1)
      .map(r => ({ software: r[softwareIndex]?.trim(), status: r[statusIndex]?.trim() }))
      .filter(x => x.software);

    updateDashboard(softwares);
    document.getElementById("lastUpdate").textContent = new Date().toLocaleString("pt-BR");
    live.textContent = "● Conectado";
  } catch (error) {
    console.error(error);
    live.textContent = "● Erro na atualização";
    document.getElementById("softwareTable").innerHTML =
      `<tr><td colspan="2">Não foi possível carregar a planilha. Verifique se a aba Softwares está publicada/acessível.</td></tr>`;
  }
}

document.getElementById("search").addEventListener("input", renderTable);
document.getElementById("statusFilter").addEventListener("change", renderTable);

loadData();
setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
