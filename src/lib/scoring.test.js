// Unit tests for scoring.js live (provisional) scoring.
// Run: node src/lib/scoring.test.js
import assert from 'node:assert';
import { calcTeamStats, calcClasificacion, detectChampion } from './scoring.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   - ' + name);
  } catch (e) {
    console.error('FAIL - ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

const live = (over) => ({
  homeTeam: 'A', awayTeam: 'B', homeGoals: 0, awayGoals: 0,
  status: 'LIVE', round: 'group', date: '', homeRedCards: 0, awayRedCards: 0,
  ...over,
});

// --- LIVE matches count provisionally toward match points ----------------
test('LIVE win + clean sheet counts toward matchPts and livePts', () => {
  const m = live({ homeGoals: 1, awayGoals: 0 });
  const s = calcTeamStats('A', [m]);
  assert.strictEqual(s.matchPts, 4, 'win(3)+cleanSheet(1)');
  assert.strictEqual(s.livePts, 4, 'all 4 pts come from a live match');
  assert.strictEqual(s.liveMatches, 1);
  assert.strictEqual(s.pj, 1);
  assert.strictEqual(s.gf, 1);
  assert.strictEqual(s.gc, 0);
});

test('LIVE goal bonus (3 goles) counts provisionally', () => {
  const s = calcTeamStats('A', [live({ homeGoals: 3, awayGoals: 1 })]);
  // win(3) + goalBonus floor(3/3)=1 = 4; no clean sheet (concedió 1)
  assert.strictEqual(s.matchPts, 4);
  assert.strictEqual(s.livePts, 4);
});

test('team LOSING live contributes 0 livePts but liveMatches=1', () => {
  const s = calcTeamStats('B', [live({ homeGoals: 1, awayGoals: 0 })]);
  assert.strictEqual(s.matchPts, 0);
  assert.strictEqual(s.livePts, 0);
  assert.strictEqual(s.liveMatches, 1, 'still involved in a live match');
});

test('finished match is NOT counted as live', () => {
  const m = live({ status: 'FT', homeGoals: 2, awayGoals: 0 });
  const s = calcTeamStats('A', [m]);
  assert.strictEqual(s.matchPts, 4, 'win(3)+cleanSheet(1) still scored');
  assert.strictEqual(s.livePts, 0, 'FT is not provisional');
  assert.strictEqual(s.liveMatches, 0);
});

test('no live matches -> livePts 0, liveMatches 0', () => {
  const s = calcTeamStats('A', [live({ status: 'NS', homeGoals: null, awayGoals: null })]);
  assert.strictEqual(s.livePts, 0);
  assert.strictEqual(s.liveMatches, 0);
});

// --- calcClasificacion surfaces provisional totals -----------------------
test('calcClasificacion exposes totalLivePts and liveMatches', () => {
  const participantes = [{ nombre: 'Ana', telegram: 'ana', equipos: ['A'] }];
  const resultados = [live({ homeGoals: 1, awayGoals: 0 })];
  const [row] = calcClasificacion(participantes, resultados);
  assert.strictEqual(row.total, 4, 'matchPts(4) + phasePts group(0)');
  assert.strictEqual(row.totalLivePts, 4);
  assert.strictEqual(row.liveMatches, 1);
});

// --- Penalty shootout (PEN): el partido sigue contando como empate, pero el
//     perdedor de la tanda queda eliminado y el ganador avanza ----------------
// Marcador real de un partido de penaltis: empate al final de la prórroga
// (1-1), NO 0-0. La tanda no se suma a los goles.
const koDraw = (over) => ({
  homeTeam: 'Alemania', awayTeam: 'Paraguay', homeGoals: 1, awayGoals: 1,
  status: 'PEN', round: 'r32', date: '', homeRedCards: 0, awayRedCards: 0, ...over,
});

test('PEN: el partido cuenta como empate (1 pt cada uno), sin portería a cero', () => {
  const al = calcTeamStats('Alemania', [koDraw()]);
  assert.strictEqual(al.drawPts, 1, 'empate = 1 pt');
  assert.strictEqual(al.e, 1);
  assert.strictEqual(al.v, 0);
  assert.strictEqual(al.cleanSheetPts, 0, '1-1 no da portería a cero');
});

test('PEN: el perdedor de la tanda (no avanza) queda eliminado', () => {
  const resultados = [
    koDraw(),
    { matchId: 2, homeTeam: 'Paraguay', awayTeam: '', homeGoals: null, awayGoals: null, status: 'NS', round: 'r16', date: '', homeRedCards: 0, awayRedCards: 0 },
  ];
  assert.strictEqual(calcTeamStats('Alemania', resultados).eliminated, true, 'Alemania perdió la tanda');
  assert.strictEqual(calcTeamStats('Paraguay', resultados).eliminated, false, 'Paraguay avanzó a octavos');
});

test('PEN: sin partido siguiente todavía, NINGÚN equipo se da por eliminado', () => {
  const resultados = [koDraw()];
  assert.strictEqual(calcTeamStats('Alemania', resultados).eliminated, false);
  assert.strictEqual(calcTeamStats('Paraguay', resultados).eliminated, false);
});

// --- Prórroga (AET): marcador decisivo (p.ej. 2-1) pero cuenta como empate;
//     el ganador de la prórroga avanza y el perdedor queda eliminado ------------
const koAet = (over) => ({
  homeTeam: 'Alemania', awayTeam: 'Paraguay', homeGoals: 2, awayGoals: 1,
  status: 'AET', round: 'r32', date: '', homeRedCards: 0, awayRedCards: 0, ...over,
});

test('AET: el partido cuenta como empate (1 pt cada uno), no victoria', () => {
  const al = calcTeamStats('Alemania', [koAet()]);
  assert.strictEqual(al.drawPts, 1, 'ganador en prórroga: empate = 1 pt');
  assert.strictEqual(al.e, 1);
  assert.strictEqual(al.v, 0, 'no cuenta como victoria');
  const pa = calcTeamStats('Paraguay', [koAet()]);
  assert.strictEqual(pa.drawPts, 1, 'perdedor en prórroga: empate = 1 pt');
  assert.strictEqual(pa.e, 1);
  assert.strictEqual(pa.d, 0, 'no cuenta como derrota');
});

test('AET: el ganador de la prórroga avanza y el perdedor queda eliminado', () => {
  const resultados = [
    koAet(),
    { matchId: 2, homeTeam: 'Alemania', awayTeam: '', homeGoals: null, awayGoals: null, status: 'NS', round: 'r16', date: '', homeRedCards: 0, awayRedCards: 0 },
  ];
  assert.strictEqual(calcTeamStats('Alemania', resultados).eliminated, false, 'Alemania ganó la prórroga');
  assert.strictEqual(calcTeamStats('Paraguay', resultados).eliminated, true, 'Paraguay perdió la prórroga');
});

// --- Puntos de fase: semis, 3er puesto y final -----------------------------
// El semifinalista perdedor pasa al 3er puesto, que NO da puntos de fase extra
// (solo los puntos propios del partido). El finalista sí suma la fase `final`.
const sfMatch = (over) => ({
  homeTeam: 'España', awayTeam: 'Francia', homeGoals: 2, awayGoals: 1,
  status: 'FT', round: 'sf', date: '', homeRedCards: 0, awayRedCards: 0, ...over,
});

test('3er puesto NO da puntos de fase (solo los de semis)', () => {
  const resultados = [
    sfMatch(),
    // Francia perdió la semi y juega el partido por el 3er puesto
    { homeTeam: 'Francia', awayTeam: 'Portugal', homeGoals: 1, awayGoals: 0,
      status: 'FT', round: '3rd', date: '', homeRedCards: 0, awayRedCards: 0 },
  ];
  const fra = calcTeamStats('Francia', resultados);
  // Fase: solo sf(4). El 3er puesto no suma nada extra por fase.
  assert.strictEqual(fra.phasePts, 4, 'sf(4) + 3rd(0)');
  // Los puntos del propio partido del 3er puesto sí cuentan (victoria + portería).
  // sf: derrota 0. 3rd: victoria(3)+portería(1) = 4.
  assert.strictEqual(fra.matchPts, 4, '3er puesto: victoria(3)+portería(1)');
});

test('finalista suma la fase final (sf + final)', () => {
  const resultados = [
    sfMatch(),
    { homeTeam: 'España', awayTeam: 'Portugal', homeGoals: 0, awayGoals: 0,
      status: 'NS', round: 'final', date: '', homeRedCards: 0, awayRedCards: 0 },
  ];
  const esp = calcTeamStats('España', resultados);
  assert.strictEqual(esp.phasePts, 9, 'sf(4) + final(5)');
});

test('campeón: el ganador de la final suma exactamente +10', () => {
  const participantes = [{ nombre: 'Ana', telegram: 'ana', equipos: ['España'] }];
  const resultados = [
    { homeTeam: 'España', awayTeam: 'Portugal', homeGoals: 2, awayGoals: 1,
      status: 'FT', round: 'final', date: '', homeRedCards: 0, awayRedCards: 0 },
  ];
  const [row] = calcClasificacion(participantes, resultados);
  const esp = row.equipoScores[0];
  assert.strictEqual(esp.championBonus, 10, 'campeón +10');
  // final: fase(5) + victoria(3)+portería? no (concedió 1) + campeón(10) = 5+3+10 = 18
  assert.strictEqual(esp.pts, 18, 'fase final(5) + victoria(3) + campeón(10)');
});

// --- Final por penaltis: el marcador del partido es empate, pero el ganador de
//     la tanda (score.penalties, guardado en la hoja) es el campeón y suma +10 ---
test('detectChampion: final por penaltis usa el marcador de la tanda', () => {
  const resultados = [
    { homeTeam: 'España', awayTeam: 'Portugal', homeGoals: 1, awayGoals: 1,
      status: 'PEN', round: 'final', date: '', homeRedCards: 0, awayRedCards: 0,
      homePen: 4, awayPen: 3 },
  ];
  assert.strictEqual(detectChampion(resultados), 'España', 'gana la tanda 4-3');
});

test('detectChampion: final por penaltis sin tanda registrada -> sin campeón', () => {
  const resultados = [
    { homeTeam: 'España', awayTeam: 'Portugal', homeGoals: 1, awayGoals: 1,
      status: 'PEN', round: 'final', date: '', homeRedCards: 0, awayRedCards: 0,
      homePen: null, awayPen: null },
  ];
  assert.strictEqual(detectChampion(resultados), null, 'sin tanda no se puede saber');
});

test('campeón por penaltis: el ganador de la tanda suma +10', () => {
  const participantes = [{ nombre: 'Ana', telegram: 'ana', equipos: ['Portugal'] }];
  const resultados = [
    { homeTeam: 'España', awayTeam: 'Portugal', homeGoals: 1, awayGoals: 1,
      status: 'PEN', round: 'final', date: '', homeRedCards: 0, awayRedCards: 0,
      homePen: 3, awayPen: 5 },
  ];
  const [row] = calcClasificacion(participantes, resultados);
  const por = row.equipoScores[0];
  assert.strictEqual(por.championBonus, 10, 'Portugal gana la tanda 5-3: campeón +10');
  // final: fase(5) + empate(1) + campeón(10) = 16 (empate en penaltis no da victoria ni portería)
  assert.strictEqual(por.pts, 16, 'fase final(5) + empate(1) + campeón(10)');
});

console.log('\n' + passed + ' passed');
