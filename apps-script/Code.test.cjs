// Unit tests for the pure mapping helpers in Code.gs (AllSportsApi2 format).
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

// --- countRedCards: AllSportsApi2 /incidents format -----------------------
// Spec example: México–Sudáfrica, 3 rojas → 1 local / 2 visitante.
test('countRedCards counts red + yellowRed by isHome, ignores yellows', () => {
  const incidents = [
    { incidentType: 'card', incidentClass: 'red', isHome: true },        // local
    { incidentType: 'card', incidentClass: 'yellow', isHome: true },     // ignorar
    { incidentType: 'card', incidentClass: 'red', isHome: false },       // visitante
    { incidentType: 'card', incidentClass: 'yellowRed', isHome: false }, // visitante (2ª amarilla)
    { incidentType: 'goal', isHome: true },                              // ignorar
  ];
  assert.deepStrictEqual(api.countRedCards(incidents), [1, 2]);
});

test('countRedCards returns [0,0] for non-array', () => {
  assert.deepStrictEqual(api.countRedCards(null), [0, 0]);
  assert.deepStrictEqual(api.countRedCards(undefined), [0, 0]);
});

test('countRedCards returns [0,0] when no red cards', () => {
  const incidents = [{ incidentType: 'card', incidentClass: 'yellow', isHome: true }];
  assert.deepStrictEqual(api.countRedCards(incidents), [0, 0]);
});

// --- normalizeStage: by roundInfo.slug ------------------------------------
test('normalizeStage maps knockout slugs', () => {
  assert.strictEqual(api.normalizeStage({ slug: 'round-of-32' }), 'r32');
  assert.strictEqual(api.normalizeStage({ slug: 'round-of-16' }), 'r16');
  assert.strictEqual(api.normalizeStage({ slug: 'quarterfinals' }), 'qf');
  assert.strictEqual(api.normalizeStage({ slug: 'semifinals' }), 'sf');
  assert.strictEqual(api.normalizeStage({ slug: 'match-for-3rd-place' }), '3rd');
  assert.strictEqual(api.normalizeStage({ slug: 'final' }), 'final');
});

test('normalizeStage falls back to group for group rounds / unknown', () => {
  assert.strictEqual(api.normalizeStage({ round: 2 }), 'group');
  assert.strictEqual(api.normalizeStage({ slug: 'something-else' }), 'group');
  assert.strictEqual(api.normalizeStage(undefined), 'group');
});

// --- normalizeMatchStatus: by status.type + score -------------------------
test('normalizeMatchStatus maps basic types', () => {
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'notstarted' } }), 'NS');
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'inprogress' } }), 'LIVE');
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'postponed' } }), 'PST');
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'canceled' } }), 'CANC');
});

test('normalizeMatchStatus derives FT/AET/PEN when finished', () => {
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'finished' }, homeScore: { current: 1 } }), 'FT');
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'finished' }, homeScore: { current: 1, overtime: 1 } }), 'AET');
  assert.strictEqual(api.normalizeMatchStatus({ status: { type: 'finished' }, homeScore: { current: 1, penalties: 4 } }), 'PEN');
});

// --- extractGoals ---------------------------------------------------------
test('extractGoals returns empty strings for NS', () => {
  assert.deepStrictEqual(api.extractGoals({ homeScore: { current: 0 }, awayScore: { current: 0 } }, 'NS'), ['', '']);
});

test('extractGoals reads homeScore.current', () => {
  assert.deepStrictEqual(
    api.extractGoals({ homeScore: { current: 2 }, awayScore: { current: 1 } }, 'FT'),
    [2, 1]
  );
});

console.log('\n' + passed + ' passed');
