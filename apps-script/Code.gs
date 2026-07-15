var TEAM_NAME_MAP = {
  'Brazil': 'Brasil', 'Spain': 'España', 'England': 'Inglaterra',
  'France': 'Francia', 'Netherlands': 'Países Bajos', 'Germany': 'Alemania',
  'Portugal': 'Portugal', 'Argentina': 'Argentina', 'Italy': 'Italia',
  'Norway': 'Noruega', 'Belgium': 'Bélgica', 'Canada': 'Canadá',
  'Switzerland': 'Suiza', 'Mexico': 'México', 'Japan': 'Japón',
  'United States': 'EEUU', 'Turkey': 'Turquía', 'Sweden': 'Suecia',
  'Croatia': 'Croacia', 'Morocco': 'Marruecos', 'South Korea': 'Corea del Sur',
  'Egypt': 'Egipto', 'Algeria': 'Argelia', 'DR Congo': 'Rep. Dem. del Congo',
  'Tunisia': 'Túnez', 'Colombia': 'Colombia', 'Ecuador': 'Ecuador',
  'Senegal': 'Senegal', 'Ghana': 'Ghana', 'Cameroon': 'Camerún',
  'Scotland': 'Escocia', 'Iran': 'Irán', 'Czech Republic': 'Chequia',
  "Côte d'Ivoire": 'Costa de Marfil', "Ivory Coast": 'Costa de Marfil',
  'New Zealand': 'Nueva Zelanda', 'Curaçao': 'Curaçao', 'Jordan': 'Jordania',
  'South Africa': 'Sudáfrica', 'Uzbekistan': 'Uzbekistán', 'Haiti': 'Haití',
  'Qatar': 'Catar', 'Iraq': 'Irak', 'Panama': 'Panamá', 'Cabo Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudí', 'Australia': 'Australia', 'Chile': 'Chile',
  'Venezuela': 'Venezuela', 'Peru': 'Perú', 'Uruguay': 'Uruguay',
  'Costa Rica': 'Costa Rica', 'Honduras': 'Honduras', 'Jamaica': 'Jamaica',
  'Trinidad and Tobago': 'Trinidad y Tobago',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
  // Alias defensivos: la API puede usar estas grafías en lugar de la clave principal.
  'Korea Republic': 'Corea del Sur', 'Korea, Republic of': 'Corea del Sur',
  'Czechia': 'Chequia',
  'Türkiye': 'Turquía', 'Turkiye': 'Turquía',
  'Cape Verde': 'Cabo Verde', 'Cape Verde Islands': 'Cabo Verde',
  'Congo DR': 'Rep. Dem. del Congo', 'Democratic Republic of Congo': 'Rep. Dem. del Congo',
  'IR Iran': 'Irán',
  'USA': 'EEUU',
};

var STAGE_MAP = {
  'GROUP_STAGE': 'group',
  'ROUND_OF_32': 'r32', 'LAST_32': 'r32',
  'ROUND_OF_16': 'r16', 'LAST_16': 'r16',
  'QUARTER_FINALS': 'qf', 'LAST_8': 'qf',
  'SEMI_FINALS': 'sf', 'LAST_4': 'sf',
  'THIRD_PLACE': '3rd',
  'FINAL': 'final',
};

// football-data.org statuses that mean the match is live
var LIVE_API_STATUSES = { 'IN_PLAY': true, 'PAUSED': true, 'EXTRA_TIME': true, 'PENALTY_SHOOTOUT': true };

function normalizeStage(stage) {
  return STAGE_MAP[stage] || (stage ? stage.toLowerCase() : 'group');
}

function normalizeTeam(name) {
  return TEAM_NAME_MAP[name] || name;
}

// Maps football-data.org status + duration to our sheet status
function normalizeMatchStatus(apiStatus, duration) {
  if (apiStatus === 'FINISHED') {
    if (duration === 'EXTRA_TIME') return 'AET';
    if (duration === 'PENALTY_SHOOTOUT') return 'PEN';
    return 'FT';
  }
  if (LIVE_API_STATUSES[apiStatus]) return 'LIVE';
  if (apiStatus === 'SCHEDULED' || apiStatus === 'TIMED') return 'NS';
  if (apiStatus === 'POSTPONED' || apiStatus === 'SUSPENDED') return 'PST';
  if (apiStatus === 'CANCELLED') return 'CANC';
  if (apiStatus === 'AWARDED') return 'AWD';
  return apiStatus;
}

// Counts red cards per side from a bookings array.
// football-data.org v4 uses `card` ("RED_CARD" / "YELLOW_RED_CARD" / "YELLOW_CARD").
// We tolerate the older `type` field too and count anything containing "RED"
// (direct red or second yellow).
function countRedCards(bookings, homeId) {
  if (!Array.isArray(bookings)) return [0, 0];
  var homeRed = 0, awayRed = 0;
  for (var i = 0; i < bookings.length; i++) {
    var b = bookings[i];
    var card = String(b.card || b.type || '').toUpperCase();
    if (card.indexOf('RED') === -1) continue;
    if (b.team && b.team.id === homeId) homeRed++;
    else awayRed++;
  }
  return [homeRed, awayRed];
}

// Fetches a single match's full detail. The matches LIST endpoint omits the
// `bookings` array — only /v4/matches/{id} includes it. Returns the match
// object (with bookings) or null on error.
function fetchMatchDetail_(matchId, apiKey) {
  var url = 'https://api.football-data.org/v4/matches/' + matchId;
  try {
    var res = UrlFetchApp.fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('detail ' + matchId + ' HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
      return null;
    }
    return JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log('ERROR detail ' + matchId + ': ' + e.message);
    return null;
  }
}

// Red cards already stored in a sheet row (cols I/J = indices 8/9), or [0,0].
function storedRedCards_(prevRow) {
  if (!prevRow) return [0, 0];
  return [Number(prevRow[8]) || 0, Number(prevRow[9]) || 0];
}

function isFinishedStatus_(status) {
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

function hasGoals_(homeGoals, awayGoals) {
  return homeGoals !== '' && homeGoals !== null && homeGoals !== undefined &&
         awayGoals !== '' && awayGoals !== null && awayGoals !== undefined;
}

// Guards against a finished match regressing because of a transient API
// response. The API occasionally returns a match that is already FT/AET/PEN
// with null goals, or momentarily reports it as non-finished (NS/LIVE). Since
// the frontend recomputes the standings live from the sheet, overwriting a good
// result with an empty/non-finished one made points flap ("a veces unos puntos,
// otras otros"). Rule: if the stored row is finished with real goals and the
// fresh row isn't (finished with goals), keep the stored goals + status.
// A legit finished->finished update (score correction, FT->AET) is accepted.
function reconcileFinishedRow_(newRow, prevRow) {
  if (!prevRow) return newRow;
  var prevStatus = String(prevRow[5]);
  if (!isFinishedStatus_(prevStatus) || !hasGoals_(prevRow[3], prevRow[4])) return newRow;

  var newStatus = String(newRow[5]);
  if (isFinishedStatus_(newStatus) && hasGoals_(newRow[3], newRow[4])) return newRow;

  var merged = newRow.slice();
  merged[3] = prevRow[3];
  merged[4] = prevRow[4];
  merged[5] = prevRow[5];
  // Conserva también el marcador de la tanda ya guardado (cols K/L): si el
  // resultado bueno es el previo, sus penaltis también lo son.
  if (prevRow[10] !== '' && prevRow[10] !== null && prevRow[10] !== undefined) {
    merged[10] = prevRow[10];
    merged[11] = prevRow[11];
  }
  return merged;
}

// Ensures every row has exactly `width` cells so setValues gets a rectangular
// array (filas antiguas de la hoja pueden tener menos columnas que las nuevas).
function padRows_(rows, width) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    while (r.length < width) r.push('');
  }
  return rows;
}

// Returns [homeGoals, awayGoals] from a match object given the normalized status
function extractGoals(match, normalizedStatus) {
  if (normalizedStatus === 'NS') return ['', ''];
  var score = match.score;
  if (!score || !score.fullTime || score.fullTime.home === null || score.fullTime.home === undefined) {
    return ['', ''];
  }
  var home = score.fullTime.home;
  var away = score.fullTime.away;
  // CUIDADO: en football-data.org v4 score.fullTime INCLUYE la tanda de penaltis.
  // Para un partido decidido en penaltis fullTime es, p.ej., 7-6 (1-1 al final de
  // la prórroga + 6-5 en la tanda). El marcador que debe contar es el del partido
  // (el empate al final de la prórroga), NO el de la tanda. score.penalties aísla
  // solo los goles de la tanda, así que se los restamos a fullTime para recuperar
  // el resultado reglamentario/prórroga (regularTime + extraTime), que es un empate.
  // Para FT y AET no hay tanda (score.penalties ausente o null) y fullTime ya es el
  // resultado correcto.
  if (normalizedStatus === 'PEN' && score.penalties && score.penalties.home !== null) {
    home = home - score.penalties.home;
    away = away - score.penalties.away;
  }
  return [home, away];
}

// Returns [homePenalties, awayPenalties] for a penalty shootout, or ['', ''].
// El marcador del partido decidido en penaltis queda en empate (ver extractGoals),
// así que el ganador de la tanda es el único dato que permite saber quién ganó.
// Se guarda aparte (cols K/L) para poder resolver el campeón de una final por
// penaltis en el cliente.
function extractPenalties(match, normalizedStatus) {
  if (normalizedStatus !== 'PEN') return ['', ''];
  var score = match.score;
  if (score && score.penalties && score.penalties.home !== null && score.penalties.home !== undefined) {
    return [score.penalties.home, score.penalties.away];
  }
  return ['', ''];
}

// Diagnostic: run first to verify configuration and API connectivity
function testAPI() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('FOOTBALL_API_KEY');
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('RESULTS_SHEET_NAME') || 'Resultados';

  Logger.log('=== testAPI diagnostic ===');
  Logger.log('FOOTBALL_API_KEY set: ' + (apiKey ? 'YES (length=' + apiKey.length + ')' : 'NO — añádela en Configuración del proyecto > Propiedades del script'));
  Logger.log('SPREADSHEET_ID set: ' + (spreadsheetId ? 'YES (' + spreadsheetId + ')' : 'NO'));
  Logger.log('RESULTS_SHEET_NAME: ' + sheetName);

  if (!apiKey) { Logger.log('STOP: falta FOOTBALL_API_KEY'); return; }
  if (!spreadsheetId) { Logger.log('STOP: falta SPREADSHEET_ID'); return; }

  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('Hoja de cálculo accesible: "' + ss.getName() + '"');
    var sheet = ss.getSheetByName(sheetName);
    Logger.log('Pestaña "' + sheetName + '" existe: ' + (sheet ? 'SÍ (filas=' + sheet.getLastRow() + ')' : 'NO — se creará en el primer run'));
  } catch (e) {
    Logger.log('ERROR accediendo a la hoja: ' + e.message);
    return;
  }

  // Check API key validity
  try {
    var compRes = UrlFetchApp.fetch('https://api.football-data.org/v4/competitions/WC', {
      headers: { 'X-Auth-Token': apiKey },
      muteHttpExceptions: true,
    });
    Logger.log('GET /competitions/WC — HTTP ' + compRes.getResponseCode());
    if (compRes.getResponseCode() !== 200) {
      Logger.log('Respuesta: ' + compRes.getContentText());
      Logger.log('STOP: revisa que la API key sea correcta en football-data.org');
      return;
    }
    var compJson = JSON.parse(compRes.getContentText());
    Logger.log('Competición: ' + compJson.name + ' (id=' + compJson.id + ')');
  } catch (e) {
    Logger.log('ERROR llamando a /competitions/WC: ' + e.message);
    return;
  }

  // Fetch matches
  try {
    var url = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
    Logger.log('Llamando: ' + url);
    var res = UrlFetchApp.fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      muteHttpExceptions: true,
    });
    Logger.log('GET /matches — HTTP ' + res.getResponseCode());
    var body = res.getContentText();
    var json = JSON.parse(body);
    var matches = json.matches || [];
    Logger.log('Partidos devueltos: ' + matches.length);
    if (matches.length > 0) {
      var m = matches[0];
      Logger.log('Ejemplo: id=' + m.id + ' | ' + m.homeTeam.name + ' vs ' + m.awayTeam.name + ' | estado=' + m.status + ' | fecha=' + m.utcDate);
    } else {
      Logger.log('Sin partidos — respuesta (500 chars): ' + body.substring(0, 500));
    }
  } catch (e) {
    Logger.log('ERROR llamando a /matches: ' + e.message);
  }

  Logger.log('=== fin testAPI ===');
}

// One-time pre-load of all WC 2026 fixtures with empty results (safe to re-run)
function preloadFixtures() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('FOOTBALL_API_KEY');
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('RESULTS_SHEET_NAME') || 'Resultados';

  if (!apiKey || !spreadsheetId) {
    Logger.log('ERROR: faltan FOOTBALL_API_KEY o SPREADSHEET_ID en Script Properties');
    return;
  }

  var matches = fetchMatchesFromAPI_(apiKey);
  if (!matches) return;
  if (matches.length === 0) {
    Logger.log('La API no devolvió partidos para WC season=2026');
    return;
  }

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var existingIds = {};
  var existingData = sheet.getDataRange().getValues();
  for (var i = 0; i < existingData.length; i++) {
    if (existingData[i][0]) existingIds[String(existingData[i][0])] = true;
  }

  // Sort by date ascending
  matches.sort(function(a, b) {
    return (a.utcDate || '').localeCompare(b.utcDate || '');
  });

  var newRows = [];
  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];
    if (existingIds[String(m.id)]) continue;
    newRows.push([
      m.id,
      normalizeTeam(m.homeTeam.name),
      normalizeTeam(m.awayTeam.name),
      '', '',
      'NS',
      normalizeStage(m.stage),
      m.utcDate || '',
      0, 0,
      '', '',
    ]);
  }

  if (newRows.length === 0) {
    Logger.log('Todos los ' + matches.length + ' partidos ya están en la hoja — nada que añadir');
    return;
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, 12).setValues(newRows);
  Logger.log('preloadFixtures: añadidas ' + newRows.length + ' filas (total API: ' + matches.length + ')');
}

// Fetches latest results and updates changed rows; also appends any missing fixtures
function fetchResults() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('FOOTBALL_API_KEY');
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('RESULTS_SHEET_NAME') || 'Resultados';

  if (!apiKey || !spreadsheetId) {
    Logger.log('ERROR: faltan FOOTBALL_API_KEY o SPREADSHEET_ID en Script Properties');
    return;
  }

  var matches = fetchMatchesFromAPI_(apiKey);
  if (!matches) return;

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var existingData = sheet.getDataRange().getValues();
  var idToRow = {};
  for (var i = 0; i < existingData.length; i++) {
    if (existingData[i][0]) idToRow[String(existingData[i][0])] = i;
  }

  var changed = false;
  // Detail calls cost an API request each; cap per run to respect the
  // free-tier rate limit (10 req/min). Live + newly-finished matches only.
  var detailBudget = 8;

  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];
    var status = normalizeMatchStatus(m.status, m.score && m.score.duration);
    var goals = extractGoals(m, status);
    var key = String(m.id);
    var prevRow = idToRow.hasOwnProperty(key) ? existingData[idToRow[key]] : null;
    var prevStatus = prevRow ? String(prevRow[5]) : '';

    // Red cards come from the match-detail endpoint (the list omits bookings).
    // Fetch detail when the match is live, or the first time we see it finished;
    // otherwise reuse the value already stored to avoid redundant API calls.
    var reds;
    if (status === 'LIVE' && detailBudget > 0) {
      detailBudget--;
      var liveDet = fetchMatchDetail_(m.id, apiKey);
      reds = liveDet ? countRedCards(liveDet.bookings, m.homeTeam.id) : storedRedCards_(prevRow);
    } else if (isFinishedStatus_(status) && !isFinishedStatus_(prevStatus) && detailBudget > 0) {
      detailBudget--;
      var finDet = fetchMatchDetail_(m.id, apiKey);
      reds = finDet ? countRedCards(finDet.bookings, m.homeTeam.id) : storedRedCards_(prevRow);
    } else if (status === 'LIVE' || isFinishedStatus_(status)) {
      reds = storedRedCards_(prevRow); // over budget or already captured — keep
    } else {
      reds = [0, 0]; // NS / PST / etc.
    }

    var pens = extractPenalties(m, status);
    var row = [
      m.id,
      normalizeTeam(m.homeTeam.name),
      normalizeTeam(m.awayTeam.name),
      goals[0], goals[1],
      status,
      normalizeStage(m.stage),
      m.utcDate || '',
      reds[0], reds[1],
      pens[0], pens[1],
    ];

    // Never let a transient API response un-finish a match or blank its score.
    row = reconcileFinishedRow_(row, prevRow);

    if (idToRow.hasOwnProperty(key)) {
      var rowIdx = idToRow[key];
      var existing = existingData[rowIdx];
      var rowChanged = false;
      for (var c = 0; c < row.length; c++) {
        if (String(existing[c]) !== String(row[c])) { rowChanged = true; break; }
      }
      if (rowChanged) {
        existingData[rowIdx] = row;
        changed = true;
      }
    } else {
      idToRow[key] = existingData.length;
      existingData.push(row);
      changed = true;
    }
  }

  if (!changed) {
    Logger.log('fetchResults: sin cambios');
    return;
  }

  try {
    sheet.clearContents();
    // Las filas viejas de la hoja pueden tener 10 columnas y las nuevas 12;
    // igualamos el ancho para que setValues reciba una matriz rectangular.
    padRows_(existingData, 12);
    sheet.getRange(1, 1, existingData.length, 12).setValues(existingData);
    Logger.log('fetchResults: hoja actualizada (' + existingData.length + ' filas)');
  } catch (e) {
    Logger.log('ERROR escribiendo en la hoja: ' + e.message);
  }
}

// Manual one-off: re-reads red cards for every finished match via the detail
// endpoint and writes cols I/J. Run once after deploying this fix to backfill
// matches that finished earlier, or any time a match slipped past fetchResults.
// Throttled and capped so it stays within rate limits and the 6-min runtime.
function backfillRedCards() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('FOOTBALL_API_KEY');
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('RESULTS_SHEET_NAME') || 'Resultados';

  if (!apiKey || !spreadsheetId) {
    Logger.log('ERROR: faltan FOOTBALL_API_KEY o SPREADSHEET_ID en Script Properties');
    return;
  }

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('No existe la pestaña ' + sheetName); return; }

  var data = sheet.getDataRange().getValues();
  var idToRow = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) idToRow[String(data[i][0])] = i;
  }

  var matches = fetchMatchesFromAPI_(apiKey);
  if (!matches) return;

  var CAP = 45;          // max detail calls this run (stay under runtime limit)
  var processed = 0, updated = 0, remaining = 0;

  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];
    var status = normalizeMatchStatus(m.status, m.score && m.score.duration);
    if (!isFinishedStatus_(status)) continue;
    var key = String(m.id);
    if (!idToRow.hasOwnProperty(key)) continue;

    if (processed >= CAP) { remaining++; continue; }
    processed++;

    var det = fetchMatchDetail_(m.id, apiKey);
    Utilities.sleep(1200); // gentle throttle vs. rate limit
    if (!det) continue;

    var reds = countRedCards(det.bookings, m.homeTeam.id);
    var rowIdx = idToRow[key];
    if (Number(data[rowIdx][8]) !== reds[0] || Number(data[rowIdx][9]) !== reds[1]) {
      sheet.getRange(rowIdx + 1, 9, 1, 2).setValues([[reds[0], reds[1]]]);
      updated++;
    }
  }

  Logger.log('backfillRedCards: ' + processed + ' partidos revisados, ' + updated +
    ' actualizados' + (remaining ? ', ' + remaining + ' pendientes (vuelve a ejecutar)' : ''));
}

// Shared helper — calls football-data.org and returns matches array, or null on error
function fetchMatchesFromAPI_(apiKey) {
  var url = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
  try {
    var response = UrlFetchApp.fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      Logger.log('API error (' + response.getResponseCode() + '): ' + response.getContentText());
      return null;
    }
    var json = JSON.parse(response.getContentText());
    var matches = json.matches || [];
    Logger.log('fetchMatchesFromAPI_: ' + matches.length + ' partidos');
    return matches;
  } catch (e) {
    Logger.log('ERROR llamando a la API: ' + e.message);
    return null;
  }
}

// Hourly trigger — use before/after the tournament
function setupTrigger() {
  clearTriggers();
  ScriptApp.newTrigger('fetchResults')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Trigger horario creado para fetchResults');
}

// 15-minute trigger — activate on June 11 2026 when the World Cup starts
function setupLiveTrigger() {
  clearTriggers();
  ScriptApp.newTrigger('fetchResults')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger de 15 min creado para fetchResults');
}

function clearTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('Todos los triggers eliminados');
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Node-only export for unit tests (apps-script/Code.test.cjs). Apps Script has no
// `module`, so this block is skipped at runtime there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeStage: normalizeStage,
    normalizeTeam: normalizeTeam,
    normalizeMatchStatus: normalizeMatchStatus,
    countRedCards: countRedCards,
    extractGoals: extractGoals,
    isFinishedStatus_: isFinishedStatus_,
    storedRedCards_: storedRedCards_,
    hasGoals_: hasGoals_,
    reconcileFinishedRow_: reconcileFinishedRow_,
  };
}
