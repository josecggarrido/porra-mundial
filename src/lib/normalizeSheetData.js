const NUM_PREFIX_RE = /^\d+\s*-\s*/;
// Banderas a quitar de los nombres:
//  - pares de "regional indicators" (países, p.ej. 🇧🇦)
//  - banderas de subdivisión tipo "tag sequence" (🏴 + tag chars): Escocia, Inglaterra, Gales
const FLAG_RE = /[\u{1F1E0}-\u{1F1FF}]|\u{1F3F4}[\u{E0020}-\u{E007F}]*/gu;

function normalizeName(raw) {
  return (raw || '').replace(FLAG_RE, '').trim().replace(NUM_PREFIX_RE, '').trim();
}

export function parseParticipantes(rows) {
  if (!rows || rows.length < 2) return [];

  const raw = rows.slice(1).map(row => ({
    timestamp: row[0] || '',
    nombre: (row[2] || '').trim(),
    telegram: (row[3] || '').replace(/^@/, '').toLowerCase().trim(),
    equipos: row.slice(4, 17)
      .flatMap(cell => (cell || '').split(','))
      .map(normalizeName)
      .filter(s => s && s.toUpperCase() !== 'FALSE' && s.toUpperCase() !== 'TRUE'),
  })).filter(e => e.nombre);

  raw.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));

  const seenNombres = new Set();
  const seenTelegrams = new Set();
  const result = [];

  for (const entry of raw) {
    const nombreKey = entry.nombre.toLowerCase();
    if (seenNombres.has(nombreKey)) continue;
    if (entry.telegram && seenTelegrams.has(entry.telegram)) continue;
    seenNombres.add(nombreKey);
    if (entry.telegram) seenTelegrams.add(entry.telegram);
    result.push({ nombre: entry.nombre, telegram: entry.telegram, equipos: entry.equipos });
  }

  return result;
}

export function parseResultados(rows) {
  if (!rows || rows.length === 0) return [];

  return rows
    .filter(row => row[0] !== undefined && row[0] !== '')
    .map(row => ({
      matchId: Number(row[0]),
      homeTeam: String(row[1] || '').trim(),
      awayTeam: String(row[2] || '').trim(),
      homeGoals: row[3] !== '' && row[3] !== undefined ? Number(row[3]) : null,
      awayGoals: row[4] !== '' && row[4] !== undefined ? Number(row[4]) : null,
      status: String(row[5] || 'NS').trim(),
      round: String(row[6] || ''),
      date: String(row[7] || ''),
      homeRedCards: row[8] !== '' && row[8] !== undefined ? Number(row[8]) : 0,
      awayRedCards: row[9] !== '' && row[9] !== undefined ? Number(row[9]) : 0,
    }));
}
