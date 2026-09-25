/*
 * PAINEL DE INSTALADORES MSI
 * Fonte: Google Sheets publicado na web como CSV.
 *
 * 1. Abra sua Google Planilha.
 * 2. Vá em Arquivo > Compartilhar > Publicar na web.
 * 3. Selecione a aba usada pelo painel e formato CSV.
 * 4. Copie a URL gerada e cole em GOOGLE_SHEET_CSV_URL abaixo.
 *
 * Estrutura esperada da primeira linha:
 * Software | Regional | Status
 *
 * Status aceitos:
 * Em Consulta
 * Sem pacote oficial
 * Disponível no \Mídias
 */

const CONFIG = {
  GOOGLE_SHEET_CSV_URL: "COLE_AQUI_A_URL_CSV_DA_GOOGLE_PLANILHA",
  REFRESH_INTERVAL_MS: 30000
};

let allRows = [];
let refreshTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  bindFilters();

  if (!CONFIG.GOOGLE_SHEET_CSV_URL || CONFIG.GOOGLE_SHEET_CSV_URL.includes("COLE_AQUI")) {
    showConfigurationMessage();
    return;
  }

  loadData();
  refreshTimer = setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
});

function bindFilters() {
  ["searchInput", "regionalFilter", "statusFilter"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderTable);
    document.getElementById(id).addEventListener("change", renderTable);
  });
}

async function loadData() {
  const statusEl = document.getElementById("connectionStatus");

  try {
    statusEl.textContent = "Atualizando...";
    const separator = CONFIG.GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?";
    const url = `${CONFIG.GOOGLE_SHEET_CSV_URL}${separator}_=${Date.now()}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csvText = await response.text();
    const parsed = parseCSV(csvText);

    allRows = normalizeRows(parsed);
    renderDashboard();
    populateRegionalFilter();
    renderTable();

    const now = new Date();
    document.getElementById("lastUpdate").textContent =
      now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
    statusEl.textContent = "Atualização automática ativa";
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Erro ao atualizar";
    showError(`Não foi possível carregar a Google Planilha. Verifique se ela está publicada como CSV e se a URL está correta. (${error.message})`);
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = (values[index] || "").trim());
    return obj;
  });
}

function normalizeHeader(value) {
  return removeAccents(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRows(rows) {
  return rows
    .map(row => {
      const software = firstValue(row, ["software", "nome", "nomedosoftware"]);
      const regional = firstValue(row, ["regional", "regiao", "regionaldeuso"]);
      const status = normalizeStatus(firstValue(row, ["status", "situacao"]));

      return {
        software: software.trim(),
        regional: regional.trim() || "Não informado",
        status
      };
    })
    .filter(row => row.software);
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return "";
}

function normalizeStatus(value) {
  const normalized = removeAccents(value).toLowerCase().replace(/\s+/g, " ").trim();

  if (normalized.includes("disponivel") && (normalized.includes("midia") || normalized.includes("midias"))) {
    return "Disponível no \\Mídias";
  }
  if (normalized.includes("sem pacote")) return "Sem pacote oficial";
  if (normalized.includes("consulta")) return "Em Consulta";

  return value || "Em Consulta";
}

function removeAccents(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function renderDashboard() {
  const counts = {
    consulta: allRows.filter(r => r.status === "Em Consulta").length,
    semPacote: allRows.filter(r => r.status === "Sem pacote oficial").length,
    midia: allRows.filter(r => r.status === "Disponível no \\Mídias").length
  };
  const total = allRows.length;

  setText("totalCount", total);
  setText("consultaCount", counts.consulta);
  setText("semPacoteCount", counts.semPacote);
  setText("midiaCount", counts.midia);
  setText("consultaPercent", `${percent(counts.consulta, total)}% do total`);
  setText("semPacotePercent", `${percent(counts.semPacote, total)}% do total`);
  setText("midiaPercent", `${percent(counts.midia, total)}% do total`);
  setText("legendConsulta", counts.consulta);
  setText("legendSemPacote", counts.semPacote);
  setText("legendMidia", counts.midia);
  setText("donutTotal", total);

  const midiaPercent = percent(counts.midia, total);
  setText("progressText", `${midiaPercent}%`);
  document.getElementById("progressBar").style.width = `${midiaPercent}%`;

  const p1 = total ? counts.consulta / total * 100 : 0;
  const p2 = total ? counts.semPacote / total * 100 : 0;
  const p3 = total ? counts.midia / total * 100 : 0;
  document.getElementById("donutChart").style.background =
    `conic-gradient(#d99a00 0 ${p1}%, #c0392b ${p1}% ${p1 + p2}%, #168a4a ${p1 + p2}% 100%)`;

  renderRegionalSummary();
  setText("recordInfo", `${total} software(s) carregado(s)`);
}

function renderRegionalSummary() {
  const counts = {};
  allRows.forEach(row => {
    counts[row.regional] = (counts[row.regional] || 0) + 1;
  });

  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = items[0]?.[1] || 1;
  const container = document.getElementById("regionalList");

  if (!items.length) {
    container.innerHTML = `<div class="empty">Nenhum dado disponível.</div>`;
    return;
  }

  container.innerHTML = items.map(([regional, count]) => `
    <div class="regional-row">
      <div class="regional-name" title="${escapeHTML(regional)}">${escapeHTML(regional)}</div>
      <div class="regional-count">${count}</div>
      <div class="regional-bar-track">
        <div class="regional-bar" style="width:${(count / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function populateRegionalFilter() {
  const select = document.getElementById("regionalFilter");
  const current = select.value;
  const regionals = [...new Set(allRows.map(r => r.regional))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = `<option value="">Todas as regionais</option>` +
    regionals.map(r => `<option value="${escapeAttribute(r)}">${escapeHTML(r)}</option>`).join("");

  if (regionals.includes(current)) select.value = current;
}

function renderTable() {
  const search = removeAccents(document.getElementById("searchInput").value).toLowerCase().trim();
  const regional = document.getElementById("regionalFilter").value;
  const status = document.getElementById("statusFilter").value;

  const filtered = allRows.filter(row => {
    const text = removeAccents(`${row.software} ${row.regional}`).toLowerCase();
    return (!search || text.includes(search)) &&
      (!regional || row.regional === regional) &&
      (!status || row.status === status);
  });

  const tbody = document.getElementById("softwareTableBody");
  setText("tableSummary", `${filtered.length} de ${allRows.length} registro(s)`);

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(row => `
    <tr>
      <td><strong>${escapeHTML(row.software)}</strong></td>
      <td>${escapeHTML(row.regional)}</td>
      <td><span class="status ${statusClass(row.status)}">${escapeHTML(row.status)}</span></td>
    </tr>
  `).join("");
}

function statusClass(status) {
  if (status === "Em Consulta") return "status-consulta";
  if (status === "Sem pacote oficial") return "status-sem-pacote";
  if (status === "Disponível no \\Mídias") return "status-midia";
  return "status-consulta";
}

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function showConfigurationMessage() {
  document.getElementById("connectionStatus").textContent = "Configuração pendente";
  document.getElementById("softwareTableBody").innerHTML = `
    <tr><td colspan="3">
      <div class="error">
        <strong>Configure a fonte de dados.</strong><br>
        Abra o arquivo <code>script.js</code> e informe a URL CSV da Google Planilha em
        <code>GOOGLE_SHEET_CSV_URL</code>.
      </div>
    </td></tr>`;
}

function showError(message) {
  document.getElementById("softwareTableBody").innerHTML = `
    <tr><td colspan="3"><div class="error">${escapeHTML(message)}</div></td></tr>`;
}
