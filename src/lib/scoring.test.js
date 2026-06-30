// Unit tests for scoring.js live (provisional) scoring.
// Run: node src/lib/scoring.test.js
import assert from 'node:assert';
import { calcTeamStats, calcClasificacion } from './scoring.js';

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
const koDraw = (over) => ({
  homeTeam: 'Alemania', awayTeam: 'Paraguay', homeGoals: 0, awayGoals: 0,
  status: 'PEN', round: 'r32', date: '', homeRedCards: 0, awayRedCards: 0, ...over,
});

test('PEN: el partido cuenta como empate (1 pt cada uno)', () => {
  const al = calcTeamStats('Alemania', [koDraw()]);
  assert.strictEqual(al.drawPts, 1, 'empate = 1 pt');
  assert.strictEqual(al.e, 1);
  assert.strictEqual(al.v, 0);
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

console.log('\n' + passed + ' passed');
