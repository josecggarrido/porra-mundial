// Estructura fija del cuadro de eliminatorias del Mundial 2026 (M73–M104).
// El cuadro no tiene re-sorteos: el ganador de cada partido alimenta de forma
// predeterminada un partido posterior, así que conociendo un resultado sabemos
// inmediatamente quién avanza y contra quién jugará.
//
// Cada lado (home/away) de un partido es uno de:
//   { team }    -> equipo ya conocido (sólo en R32)
//   { win }     -> ganador del partido nº `win`
//   { lose }    -> perdedor del partido nº `lose` (sólo en el 3.er puesto)
//
// Los nombres de equipo usan la grafía canónica de paises.js para que resuelvan
// bandera (p.ej. "EEUU", "Bosnia y Herzegovina", "Rep. Dem. del Congo").

const T = team => ({ team });
const W = win => ({ win });
const L = lose => ({ lose });

export const KO_MATCHES = {
  // ── Ronda de 32 (emparejamientos confirmados) ──
  73: { round: 'R32', home: T('Sudáfrica'),      away: T('Canadá') },
  74: { round: 'R32', home: T('Alemania'),       away: T('Paraguay') },
  75: { round: 'R32', home: T('Países Bajos'),   away: T('Marruecos') },
  76: { round: 'R32', home: T('Brasil'),         away: T('Japón') },
  77: { round: 'R32', home: T('Francia'),        away: T('Suecia') },
  78: { round: 'R32', home: T('Costa de Marfil'), away: T('Noruega') },
  79: { round: 'R32', home: T('México'),         away: T('Ecuador') },
  80: { round: 'R32', home: T('Inglaterra'),     away: T('Rep. Dem. del Congo') },
  81: { round: 'R32', home: T('EEUU'),           away: T('Bosnia y Herzegovina') },
  82: { round: 'R32', home: T('Bélgica'),        away: T('Senegal') },
  83: { round: 'R32', home: T('Portugal'),       away: T('Croacia') },
  84: { round: 'R32', home: T('España'),         away: T('Austria') },
  85: { round: 'R32', home: T('Suiza'),          away: T('Argelia') },
  86: { round: 'R32', home: T('Argentina'),      away: T('Cabo Verde') },
  87: { round: 'R32', home: T('Colombia'),       away: T('Ghana') },
  88: { round: 'R32', home: T('Australia'),      away: T('Egipto') },

  // ── Ronda de 16 ──
  89: { round: 'R16', home: W(74), away: W(77) },
  90: { round: 'R16', home: W(73), away: W(75) },
  91: { round: 'R16', home: W(76), away: W(78) },
  92: { round: 'R16', home: W(79), away: W(80) },
  93: { round: 'R16', home: W(83), away: W(84) },
  94: { round: 'R16', home: W(81), away: W(82) },
  95: { round: 'R16', home: W(86), away: W(88) },
  96: { round: 'R16', home: W(85), away: W(87) },

  // ── Cuartos ──
  97:  { round: 'QF', home: W(89), away: W(90) },
  98:  { round: 'QF', home: W(93), away: W(94) },
  99:  { round: 'QF', home: W(91), away: W(92) },
  100: { round: 'QF', home: W(95), away: W(96) },

  // ── Semifinales ──
  101: { round: 'SF', home: W(97), away: W(98) },
  102: { round: 'SF', home: W(99), away: W(100) },

  // ── 3.er puesto (perdedores de las semis) ──
  103: { round: '3P', home: L(101), away: L(102) },

  // ── Final ──
  104: { round: 'F', home: W(101), away: W(102) },
};

// Columnas del cuadro, de izquierda a derecha. El orden vertical de los `ids`
// está pensado para que cada pareja consecutiva (1.º+2.º, 3.º+4.º, …) alimente
// el mismo partido de la ronda siguiente, de modo que las líneas conectoras
// emparejen correctamente con la técnica CSS de nth-child(odd/even).
export const KO_COLUMNS = [
  { key: 'R32', label: '16avos',  ids: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87] },
  { key: 'R16', label: 'Octavos', ids: [89, 90, 93, 94, 91, 92, 95, 96] },
  { key: 'QF',  label: 'Cuartos', ids: [97, 98, 99, 100] },
  { key: 'SF',  label: 'Semis',   ids: [101, 102] },
  { key: 'F',   label: 'Final',   ids: [104] },
];

export const TERCER_PUESTO_ID = 103;

// Rondas apiladas para la vista móvil (una sección por ronda, en orden
// numérico de partido). Mismo árbol que KO_COLUMNS, sólo cambia la disposición.
export const VERTICAL_ROUNDS = [
  { key: 'R32', label: '16avos',        ids: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
  { key: 'R16', label: 'Octavos',       ids: [89, 90, 91, 92, 93, 94, 95, 96] },
  { key: 'QF',  label: 'Cuartos',       ids: [97, 98, 99, 100] },
  { key: 'SF',  label: 'Semifinales',   ids: [101, 102] },
  { key: '3P',  label: 'Tercer puesto', ids: [103] },
  { key: 'F',   label: 'Final',         ids: [104] },
];

// ── Puente entre la hoja real y el árbol lógico ──────────────────────────
// La hoja (Resultados) no numera los partidos como M73–M104: usa los ids de
// la API (537xxx) y distingue rondas con el campo `round`
// ('group','r32','r16','qf','sf','3rd','final'). Para que el cuadro lea fechas,
// marcadores y estado en directo, mapeamos cada partido real a su id lógico:
//   · 16avos (r32): los equipos ya se conocen → emparejamos por equipos.
//   · resto de rondas: equipos aún vacíos → emparejamos por orden de matchId,
//     que en la hoja coincide con el orden numérico del cuadro.

const ROUND_TO_LOGICAL = {
  r16: [89, 90, 91, 92, 93, 94, 95, 96],
  qf: [97, 98, 99, 100],
  sf: [101, 102],
  '3rd': [103],
  final: [104],
};

const R32_BY_TEAMS = (() => {
  const map = new Map();
  for (const id of KO_COLUMNS[0].ids) {
    const { home, away } = KO_MATCHES[id];
    map.set(`${home.team}|${away.team}`, id);
    map.set(`${away.team}|${home.team}`, id);
  }
  return map;
})();

// Devuelve Map(idLógico -> partido real de la hoja).
export function mapSheetToBracket(resultados) {
  const logicalToReal = new Map();
  const byRound = {};
  for (const m of resultados) {
    const r = String(m.round || '').toLowerCase();
    if (!r || r === 'group') continue;
    (byRound[r] ||= []).push(m);
  }

  for (const m of byRound.r32 || []) {
    const id = R32_BY_TEAMS.get(`${m.homeTeam}|${m.awayTeam}`);
    if (id != null) logicalToReal.set(id, m);
  }

  for (const [round, ids] of Object.entries(ROUND_TO_LOGICAL)) {
    const matches = (byRound[round] || []).slice().sort((a, b) => a.matchId - b.matchId);
    matches.forEach((m, i) => { if (ids[i] != null) logicalToReal.set(ids[i], m); });
  }

  return logicalToReal;
}
