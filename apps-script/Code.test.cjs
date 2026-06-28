// Unit tests for the pure mapping helpers in Code.gs (football-data.org format).
// Run: node apps-script/Code.test.cjs
const assert = require('assert');
const api = require('./Code.gs');

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

// --- countRedCards: football-data.org bookings format ---------------------
test('countRedCards counts RED_CARD + YELLOW_RED_CARD by team id, ignores yellows', () => {
  const bookings = [
    { card: 'RED_CARD', team: { id: 1 } },         // local
    { card: 'YELLOW_CARD', team: { id: 1 } },      // ignorar
    { card: 'YELLOW_RED_CARD', team: { id: 2 } },  // visitante (2ª amarilla)
    { card: 'RED_CARD', team: { id: 2 } },         // visitante
  ];
  assert.deepStrictEqual(api.countRedCards(bookings, 1), [1, 2]);
});

test('countRedCards returns [0,0] for non-array', () => {
  assert.deepStrictEqual(api.countRedCards(null, 1), [0, 0]);
  assert.deepStrictEqual(api.countRedCards(undefined, 1), [0, 0]);
});

test('countRedCards returns [0,0] when no red cards', () => {
  const bookings = [{ card: 'YELLOW_CARD', team: { id: 1 } }];
  assert.deepStrictEqual(api.countRedCards(bookings, 1), [0, 0]);
});

// --- normalizeStage -------------------------------------------------------
test('normalizeStage maps WC stage names', () => {
  assert.strictEqual(api.normalizeStage('GROUP_STAGE'), 'group');
  assert.strictEqual(api.normalizeStage('ROUND_OF_32'), 'r32');
  assert.strictEqual(api.normalizeStage('LAST_32'), 'r32');
  assert.strictEqual(api.normalizeStage('ROUND_OF_16'), 'r16');
  assert.strictEqual(api.normalizeStage('LAST_16'), 'r16');
  assert.strictEqual(api.normalizeStage('QUARTER_FINALS'), 'qf');
  assert.strictEqual(api.normalizeStage('SEMI_FINALS'), 'sf');
  assert.strictEqual(api.normalizeStage('THIRD_PLACE'), '3rd');
  assert.strictEqual(api.normalizeStage('FINAL'), 'final');
});

// --- normalizeMatchStatus: apiStatus + duration ---------------------------
test('normalizeMatchStatus maps basic statuses', () => {
  assert.strictEqual(api.normalizeMatchStatus('TIMED'), 'NS');
  assert.strictEqual(api.normalizeMatchStatus('SCHEDULED'), 'NS');
  assert.strictEqual(api.normalizeMatchStatus('IN_PLAY'), 'LIVE');
  assert.strictEqual(api.normalizeMatchStatus('PAUSED'), 'LIVE');
  assert.strictEqual(api.normalizeMatchStatus('POSTPONED'), 'PST');
  assert.strictEqual(api.normalizeMatchStatus('CANCELLED'), 'CANC');
});

test('normalizeMatchStatus derives FT/AET/PEN when finished', () => {
  assert.strictEqual(api.normalizeMatchStatus('FINISHED', 'REGULAR'), 'FT');
  assert.strictEqual(api.normalizeMatchStatus('FINISHED', 'EXTRA_TIME'), 'AET');
  assert.strictEqual(api.normalizeMatchStatus('FINISHED', 'PENALTY_SHOOTOUT'), 'PEN');
});

// --- extractGoals ---------------------------------------------------------
test('extractGoals returns empty strings for NS', () => {
  assert.deepStrictEqual(
    api.extractGoals({ score: { fullTime: { home: null, away: null } } }, 'NS'),
    ['', '']
  );
});

test('extractGoals reads score.fullTime for FT', () => {
  assert.deepStrictEqual(
    api.extractGoals({ score: { fullTime: { home: 2, away: 1 } } }, 'FT'),
    [2, 1]
  );
});

test('extractGoals returns empty when fullTime null (transient finished response)', () => {
  assert.deepStrictEqual(
    api.extractGoals({ score: { fullTime: { home: null, away: null } } }, 'FT'),
    ['', '']
  );
});

// --- reconcileFinishedRow_: sticky finished results -----------------------
// Bug: la API espejo a veces devuelve un partido ya finalizado con marcador
// nulo o un estado momentáneamente no-finalizado. fetchResults reescribía la
// fila y el frontend perdía/recuperaba puntos ("a veces unos puntos, otras
// otros"). Un partido finalizado con marcador válido no debe regresar.
const ROW = (id, hg, ag, status) => [id, 'España', 'Brasil', hg, ag, status, 'group', '2026-06-20T18:00:00Z', 0, 0];

test('reconcileFinishedRow_ keeps stored result when API regresses goals to empty', () => {
  const prev = ROW(1, 2, 0, 'FT');
  const fresh = ROW(1, '', '', 'FT'); // transient: finished but goals dropped
  const merged = api.reconcileFinishedRow_(fresh, prev);
  assert.strictEqual(merged[3], 2);
  assert.strictEqual(merged[4], 0);
  assert.strictEqual(merged[5], 'FT');
});

test('reconcileFinishedRow_ keeps stored result when API regresses status to NS', () => {
  const prev = ROW(1, 2, 0, 'FT');
  const fresh = ROW(1, '', '', 'NS'); // transient: match "un-finished"
  const merged = api.reconcileFinishedRow_(fresh, prev);
  assert.strictEqual(merged[3], 2);
  assert.strictEqual(merged[4], 0);
  assert.strictEqual(merged[5], 'FT');
});

test('reconcileFinishedRow_ accepts a legit finished-to-finished score update', () => {
  const prev = ROW(1, 2, 0, 'FT');
  const fresh = ROW(1, 2, 1, 'FT'); // real correction, still finished with goals
  const merged = api.reconcileFinishedRow_(fresh, prev);
  assert.strictEqual(merged[3], 2);
  assert.strictEqual(merged[4], 1);
  assert.strictEqual(merged[5], 'FT');
});

test('reconcileFinishedRow_ accepts FT->AET upgrade with goals', () => {
  const prev = ROW(1, 2, 2, 'FT');
  const fresh = ROW(1, 3, 2, 'AET');
  const merged = api.reconcileFinishedRow_(fresh, prev);
  assert.strictEqual(merged[3], 3);
  assert.strictEqual(merged[4], 2);
  assert.strictEqual(merged[5], 'AET');
});

test('reconcileFinishedRow_ passes through when there is no previous row', () => {
  const fresh = ROW(1, '', '', 'NS');
  assert.deepStrictEqual(api.reconcileFinishedRow_(fresh, null), fresh);
});

test('reconcileFinishedRow_ passes through when previous row is not finished', () => {
  const prev = ROW(1, '', '', 'NS');
  const fresh = ROW(1, 1, 0, 'LIVE');
  assert.deepStrictEqual(api.reconcileFinishedRow_(fresh, prev), fresh);
});

console.log('\n' + passed + ' passed');
