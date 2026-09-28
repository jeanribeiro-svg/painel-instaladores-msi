const CONFIG = {
  SPREADSHEET_ID: '1-ZQQLvMGEDSwDRiigtNo2vvCZhoS3OUdgK0423gW-Jg',
  SHEET_GID: 474438347,
  SHEET_NAME: 'Softwares'
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Painel de Instaladores MSI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSoftwares() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = findSheet_(ss);
  if (!sheet) {
    throw new Error('A aba Softwares não foi encontrada. Verifique o nome da aba ou o GID configurado.');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    return { rows: [], updatedAt: formatDate_(ss), sheetName: sheet.getName() };
  }

  const headers = values[0].map(normalize_);
  const headerKeys = headers.map(h => h.toLowerCase());
  const softwareIndex = findHeader_(headerKeys, ['software']);
  const statusIndex = findHeader_(headerKeys, ['status']);
  const linkIndex = findHeader_(headerKeys, ['link', 'local de obtenção', 'local de obtencao']);

  const sIndex = softwareIndex >= 0 ? softwareIndex : 0;
  const stIndex = statusIndex >= 0 ? statusIndex : 1;
  const lIndex = linkIndex >= 0 ? linkIndex : 2;

  const rows = values.slice(1)
    .map(row => ({
      software: normalize_(row[sIndex]),
      status: canonicalStatus_(row[stIndex]),
      link: normalize_(row[lIndex])
    }))
    .filter(row => row.software && !isHeaderRow_(row));

  return {
    rows,
    updatedAt: formatDate_(ss),
    sheetName: sheet.getName()
  };
}

function findSheet_(ss) {
  const byGid = ss.getSheets().find(sheet => sheet.getSheetId() === CONFIG.SHEET_GID);
  return byGid || ss.getSheetByName(CONFIG.SHEET_NAME);
}

function findHeader_(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function normalize_(value) {
  return String(value == null ? '' : value)
    .replace(/^\uFEFF/, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function normalizeStatus_(value) {
  return normalize_(value)
    .replace(/\\+/g, '\\')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function canonicalStatus_(value) {
  const raw = normalize_(value);
  const key = normalizeStatus_(raw);
  const statuses = {
    consulta: 'Em Consulta',
    semPacote: 'Sem pacote oficial',
    disponivel: 'Disponível no \\Mídias',
    fabricante: 'Disponível pelo Fabricante'
  };
  if (key === normalizeStatus_(statuses.consulta)) return statuses.consulta;
  if (key === normalizeStatus_(statuses.semPacote)) return statuses.semPacote;
  if (key === normalizeStatus_(statuses.disponivel) || key === normalizeStatus_('Disponível no Mídias')) return statuses.disponivel;
  if (key === normalizeStatus_(statuses.fabricante)) return statuses.fabricante;
  return raw;
}

function isHeaderRow_(row) {
  return normalize_(row.software).toLowerCase() === 'software' &&
         normalize_(row.status).toLowerCase() === 'status';
}

function formatDate_(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}
