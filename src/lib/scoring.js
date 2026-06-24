const PHASE_POINTS = { r32: 1, last_32: 1, r16: 2, last_16: 2, qf: 3, sf: 4, '3rd': 5, final: 5 };
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
// Partidos en vivo puntúan de forma PROVISIONAL: cuentan igual que un finalizado
// para que la clasificación se mueva en directo, pero se marcan aparte (livePts)
// para poder mostrarlos como provisionales en la UI.
const SCORING_STATUSES = new Set([...FINISHED_STATUSES, 'LIVE']);
const PHASE_ORDER = ['final', '3rd', 'sf', 'qf', 'r16', 'last_16', 'r32', 'last_32', 'group'];
const PHASE_LABELS = {
  group: 'Grupos', r32: '1/16', last_32: '1/16', r16: 'Octavos', last_16: 'Octavos',
  qf: 'Cuartos', sf: 'Semis', '3rd': '3er puesto', final: 'Final',
};

export function calcTeamStats(team, resultados) {
  let matchPts = 0, phasePts = 0;
  let winPts = 0, drawPts = 0, cleanSheetPts = 0, goalBonusPts = 0;
  let pj = 0, v = 0, e = 0, d = 0, gf = 0, gc = 0, redCards = 0;
  let livePts = 0, liveMatches = 0;
  const phasesReached = new Set();

  for (const m of resultados) {
    const isHome = m.homeTeam === team;
    const isAway = m.awayTeam === team;
    if (!isHome && !isAway) continue;

    if (m.round) phasesReached.add(m.round);

    const myRedCards = isHome ? (m.homeRedCards || 0) : (m.awayRedCards || 0);
    redCards += myRedCards;

    if (!SCORING_STATUSES.has(m.status) || m.homeGoals === null || m.awayGoals === null) continue;

    const isLive = m.status === 'LIVE';
    if (isLive) liveMatches++;

    pj++;
    const myGoals = isHome ? m.homeGoals : m.awayGoals;
    const theirGoals = isHome ? m.awayGoals : m.homeGoals;
    gf += myGoals;
    gc += theirGoals;

    let mp = 0;
    if (myGoals > theirGoals) { winPts += 3; mp += 3; v++; }
    else if (myGoals === theirGoals) { drawPts += 1; mp += 1; e++; }
    else { d++; }

    if (theirGoals === 0) { cleanSheetPts += 1; mp += 1; }
    const gb = Math.floor(myGoals / 3);
    goalBonusPts += gb;
    mp += gb;

    matchPts += mp;
    if (isLive) livePts += mp;
  }

  for (const phase of phasesReached) {
    phasePts += PHASE_POINTS[phase] || 0;
  }

  const faseAlcanzada = getFaseLabel(phasesReached);
  return { matchPts, phasePts, winPts, drawPts, cleanSheetPts, goalBonusPts, pj, v, e, d, gf, gc, redCards, livePts, liveMatches, phasesReached, faseAlcanzada };
}

function getFaseLabel(phasesReached) {
  for (const phase of PHASE_ORDER) {
    if (phasesReached.has(phase)) return PHASE_LABELS[phase] || phase;
  }
  return '—';
}

export function detectChampion(resultados) {
  const f = resultados.find(m => m.round === 'final' && m.status === 'FT');
  if (!f || f.homeGoals === null || f.awayGoals === null || f.homeGoals === f.awayGoals) return null;
  return f.homeGoals > f.awayGoals ? f.homeTeam : f.awayTeam;
}

// Different spellings of the same country that accent/separator normalization
// can't bridge (distinct words, not just punctuation). Keys and values must be
// in already-normalized form (lowercase, no accents, single spaces).
const TEAM_SYNONYMS = {
  'cape verde': 'cabo verde',
  'cape verde islands': 'cabo verde',
};

function normKey(s) {
  const key = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Treat separators "y" / "and" / "&" / "-" as equivalent so
    // "Bosnia y Herzegovina" matches the API's "Bosnia-Herzegovina".
    .replace(/\s*(?:&|-|\by\b|\band\b)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return TEAM_SYNONYMS[key] || key;
}

export function calcClasificacion(participantes, resultados) {
  const champion = detectChampion(resultados);

  const resultadosTeams = new Set();
  for (const m of resultados) {
    if (m.homeTeam) resultadosTeams.add(m.homeTeam);
    if (m.awayTeam) resultadosTeams.add(m.awayTeam);
  }
  const normToCanonical = new Map(Array.from(resultadosTeams).map(t => [normKey(t), t]));
  function resolveTeam(raw) {
    return normToCanonical.get(normKey(raw)) ?? raw;
  }

  const scored = participantes.map(p => {
    let totalGF = 0, totalGC = 0, totalMatchPts = 0, totalPhasePts = 0, championBonus = 0, totalRedCards = 0;
    let totalLivePts = 0, liveMatches = 0;

    const equipoScores = p.equipos.map(rawEquipo => {
      const equipo = resolveTeam(rawEquipo);
      const s = calcTeamStats(equipo, resultados);
      const bonus = champion && equipo === champion ? 10 : 0;
      totalMatchPts += s.matchPts;
      totalPhasePts += s.phasePts;
      championBonus += bonus;
      totalGF += s.gf;
      totalGC += s.gc;
      totalRedCards += s.redCards;
      totalLivePts += s.livePts;
      liveMatches += s.liveMatches;
      return { equipo: rawEquipo, matchPts: s.matchPts, phasePts: s.phasePts, winPts: s.winPts, drawPts: s.drawPts, cleanSheetPts: s.cleanSheetPts, goalBonusPts: s.goalBonusPts, pj: s.pj, v: s.v, e: s.e, d: s.d, gf: s.gf, gc: s.gc, redCards: s.redCards, livePts: s.livePts, liveMatches: s.liveMatches, faseAlcanzada: s.faseAlcanzada, championBonus: bonus, pts: s.matchPts + s.phasePts + bonus };
    });

    const total = totalMatchPts + totalPhasePts + championBonus;
    return { ...p, total, totalGF, totalGC, totalRedCards, totalLivePts, liveMatches, equipoScores };
  });

  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.totalGF !== a.totalGF) return b.totalGF - a.totalGF;
    return a.totalGC - b.totalGC;
  });

  return scored;
}

export function calcEquiposStats(resultados) {
  const teams = new Set();
  for (const m of resultados) {
    if (m.homeTeam) teams.add(m.homeTeam);
    if (m.awayTeam) teams.add(m.awayTeam);
  }

  const stats = Array.from(teams).map(team => {
    const s = calcTeamStats(team, resultados);
    return {
      team,
      pts: s.matchPts + s.phasePts,
      matchPts: s.matchPts,
      phasePts: s.phasePts,
      winPts: s.winPts,
      drawPts: s.drawPts,
      cleanSheetPts: s.cleanSheetPts,
      goalBonusPts: s.goalBonusPts,
      pj: s.pj,
      v: s.v,
      e: s.e,
      d: s.d,
      gf: s.gf,
      gc: s.gc,
      redCards: s.redCards,
      faseAlcanzada: s.faseAlcanzada,
    };
  });

  stats.sort((a, b) => b.pts - a.pts || b.gf - a.gf || a.gc - b.gc);
  return stats;
}
