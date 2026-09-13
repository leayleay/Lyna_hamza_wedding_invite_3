/**
 * Paste into Extensions > Apps Script from the private response spreadsheet.
 * Run setupSongSheet once, then deploy as a Web app:
 * Execute as Me; Who has access: Anyone.
 * Only the web-app URL goes in the public website configuration.
 */
function setupSongSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Ouvrez ce script depuis Extensions > Apps Script dans votre feuille Google.');
  const sheet = spreadsheet.getSheetByName('Chansons') || spreadsheet.insertSheet('Chansons');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 7).setValues([['Date', 'Prénom', 'Chanson', 'Artiste', 'Retenu', 'Envoi', 'Signature']]);
    sheet.getRange(1, 1, 1, 7).setBackground('#292e24').setFontColor('#f6f3ec').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(2, 3, 220);
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.hideColumns(6, 2);
  }
  if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), 5).createFilter();
  PropertiesService.getScriptProperties().setProperty('WEDDING_SHEET_ID', spreadsheet.getId());
  console.log('La feuille Chansons est prête. Déployez le script en application Web.');
}

// Empty checkboxes are not song data. Never use column E to locate new rows.
function lastSongRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if ([0, 1, 2, 3, 5, 6].some(column => row[column] !== '' && row[column] != null)) return index + 2;
  }
  return 1;
}

function doGet() {
  return ContentService.createTextOutput('Suggestions musicales — Lyna & Hamza.');
}

function doPost(event) {
  const parameter = (event && event.parameter) || {};
  const nonce = String(parameter.nonce || '');
  const replyOrigin = String(parameter.replyOrigin || '');
  const allowedOrigins = ['https://leayleay.github.io', 'http://localhost:4174', 'http://127.0.0.1:4174'];
  if (!allowedOrigins.includes(replyOrigin) || !/^[0-9a-f-]{36}$/i.test(nonce)) {
    return HtmlService.createHtmlOutput('Requête non autorisée.');
  }
  let result = { saved: false, count: 0 };
  let requestId = '';
  try {
    if (typeof parameter.payload !== 'string' || parameter.payload.length > 32768) throw new Error('Payload invalide');
    const payload = JSON.parse(parameter.payload);
    requestId = payload.requestId;
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId) || payload.website) throw new Error('Requête invalide');
    const clean = (value, limit) => {
      if (typeof value !== 'string' || value.length > limit) throw new Error('Champ invalide');
      const text = value.trim().replace(/\s+/g, ' ');
      if (!text || /[\x00-\x1f]/.test(text)) throw new Error('Champ vide');
      return text;
    };
    const guestName = clean(payload.guestName, 80);
    if (!Array.isArray(payload.songs) || payload.songs.length < 1 || payload.songs.length > 20) throw new Error('Nombre de chansons invalide');
    const songs = payload.songs.map(song => {
      if (!song || typeof song !== 'object') throw new Error('Chanson invalide');
      return {title:clean(song.title, 120), artist:clean(song.artist, 120)};
    });
    const canonical = JSON.stringify({guestName:guestName, songs:songs});
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8)
      .map(byte => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty('WEDDING_SHEET_ID');
      if (!spreadsheetId) throw new Error('Exécutez setupSongSheet avant le déploiement.');
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Chansons');
      if (!sheet) throw new Error('Feuille introuvable');
      const lastRow = lastSongRow(sheet);
      const previous = lastRow > 1 ? sheet.getRange(2, 6, lastRow - 1, 2).getValues().filter(row => row[0] === requestId) : [];
      if (previous.length) {
        if (previous.length !== songs.length || previous.some(row => row[1] !== signature)) throw new Error('Envoi incohérent');
      } else {
        // Treat every guest value as text, never as a spreadsheet formula.
        const plainText = value => /^[=+\-@]/.test(value) ? "'" + value : value;
        const now = new Date();
        const rows = songs.map(song => [now, plainText(guestName), plainText(song.title), plainText(song.artist), false, requestId, signature]);
        if (lastRow + rows.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length);
        sheet.getRange(lastRow + 1, 5, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
        sheet.getRange(lastRow + 1, 1, rows.length, 7).setValues(rows);
        SpreadsheetApp.flush();
      }
      result = {saved:true, count:songs.length};
    } finally {
      lock.releaseLock();
    }
  } catch (_) {
    // No guest details or internal error messages are returned to the page.
    result = {saved:false, count:0};
  }
  const message = JSON.stringify({type:'wedding-song-result', nonce:nonce, requestId:requestId, saved:result.saved, count:result.count}).replace(/</g, '\\u003c');
  const target = JSON.stringify(replyOrigin).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage(' + message + ',' + target + ');</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
