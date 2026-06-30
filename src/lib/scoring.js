const PHASE_POINTS = { r32: 1, last_32: 1, r16: 2, last_16: 2, qf: 3, sf: 4, '3rd': 5, final: 5 };
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
// Partidos en vivo puntúan de forma PROVISIONAL: cuentan igual que un finalizado
// para que la clasificación se mueva en directo, pero se marcan aparte (livePts)
// para poder mostrarlos como provisionales en la UI.
const SCORING_STATUSES = new Set([...FINISHED_STATUSES, 'LIVE']);
const PHASE_ORDER = ['final', '3rd', 'sf', 'qf', 'r16', 'last_16', 'r32', 'last_32', 'group'];
const PHASE_INDEX = Object.fromEntries(PHASE_ORDER.map((p, i) => [p, i]));
// Eliminatorias cuyo ganador avanza a otra ronda que la hoja sí registra
// (16avos→octavos, octavos→cuartos, cuartos→semis). Las semis ya se excluyen
// aparte (su perdedor juega el 3er puesto) y final/3er puesto no tienen ronda
// posterior, así que un empate por penaltis ahí no se puede inferir por avance.
const ADVANCE_ROUNDS = new Set(['r32', 'last_32', 'r16', 'last_16', 'qf']);
const PHASE_LABELS = {
  group: 'Grupos', r32: '1/16', last_32: '1/16', r16: 'Octavos', last_16: 'Octavos',
  qf: 'Cuartos', sf: 'Semis', '3rd': '3er puesto', final: 'Final',
};

export function calcTeamStats(team, resultados) {
  let matchPts = 0, phasePts = 0;
  let winPts = 0, drawPts = 0, cleanSheetPts = 0, goalBonusPts = 0;
  let pj = 0, v = 0, e = 0, d = 0, gf = 0, gc = 0, redCards = 0;
  let livePts = 0, liveMatches = 0;
  // Para detectar si el equipo está eliminado (no sumará más puntos):
  //  - hasUpcoming: tiene algún partido por jugar (NS) o en directo (LIVE)
  //  - playedKnockout: ha aparecido en alguna eliminatoria (clasificó de la fase de grupos)
  //  - lostKnockout: perdió una eliminatoria que le deja fuera (todas menos semis, que da paso al 3er puesto)
  let hasUpcoming = false, playedKnockout = false, lostKnockout = false, finishedCount = 0;
  const phasesReached = new Set();
  // Empates por penaltis en eliminatorias de avance: el marcador refleja el
  // resultado real al final de la prórroga (un empate, p.ej. 1-1; la tanda no se
  // suma a los goles), así que no se puede saber quién pasó mirando los goles.
  // Apuntamos el rival y la fase para resolver luego, por avance, quién ganó la tanda.
  const drewAdvance = [];

  for (const m of resultados) {
    const isHome = m.homeTeam === team;
    const isAway = m.awayTeam === team;
    if (!isHome && !isAway) continue;

    if (m.round) phasesReached.add(m.round);

    const isKnockout = m.round && m.round !== 'group';
    if (isKnockout) playedKnockout = true;
    if (m.status === 'NS' || m.status === 'LIVE') hasUpcoming = true;
    if (FINISHED_STATUSES.has(m.status)) {
      finishedCount++;
      if (isKnockout && m.round !== 'sf' && m.homeGoals !== null && m.awayGoals !== null) {
        const myG = isHome ? m.homeGoals : m.awayGoals;
        const thG = isHome ? m.awayGoals : m.homeGoals;
        if (myG < thG) lostKnockout = true;
        else if (myG === thG && ADVANCE_ROUNDS.has(m.round)) {
          // Empate (tanda de penaltis): perderé si mi rival aparece en una
          // ronda más avanzada (avanzó él) — se resuelve tras el bucle.
          drewAdvance.push({ phaseIdx: PHASE_INDEX[m.round] ?? 99, opponent: isHome ? m.awayTeam : m.homeTeam });
        }
      }
    }

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

  // Resolver tandas de penaltis: si en una eliminatoria de avance empaté y mi
  // rival ya figura en una ronda más avanzada, gané él la tanda y quedo fuera.
  // Si todavía no avanzó nadie (la ronda siguiente aún no existe), no marco a
  // ninguno como eliminado para no descartar al ganador por error.
  for (const { phaseIdx, opponent } of drewAdvance) {
    const oppAdvanced = resultados.some(x =>
      (x.homeTeam === opponent || x.awayTeam === opponent) && (PHASE_INDEX[x.round] ?? 99) < phaseIdx,
    );
    if (oppAdvanced) lostKnockout = true;
  }

  const faseAlcanzada = getFaseLabel(phasesReached);
  // Eliminado = ya no jugará más (no suma más puntos): no le quedan partidos y, o bien
  // perdió una eliminatoria, o bien cayó en la fase de grupos (nunca llegó a una eliminatoria).
  // Si ganó su última eliminatoria y aún no hay rival del siguiente cruce, NO se marca.
  const eliminated = !hasUpcoming && finishedCount > 0 && (lostKnockout || !playedKnockout);
  return { matchPts, phasePts, winPts, drawPts, cleanSheetPts, goalBonusPts, pj, v, e, d, gf, gc, redCards, livePts, liveMatches, phasesReached, faseAlcanzada, eliminated };
}

function getFaseLabel(phasesReached) {
  for (const phase of PHASE_ORDER) {
    if (phasesReached.has(phase)) return PHASE_LABELS[phase] || phase;
  }
  return '—';
}

export function detectChampion(resultados) {
  // Acepta final resuelta en tiempo reglamentario o en la prórroga (AET). Una
  // final decidida en penaltis queda como empate por marcador (p.ej. 1-1): el
  // ganador no es inferible por goles y la final no alimenta ninguna ronda
  // posterior, así que ese caso no se resuelve aquí (requeriría guardar el
  // ganador de la tanda).
  const f = resultados.find(m => m.round === 'final' && FINISHED_STATUSES.has(m.status));
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
      return { equipo: rawEquipo, matchPts: s.matchPts, phasePts: s.phasePts, winPts: s.winPts, drawPts: s.drawPts, cleanSheetPts: s.cleanSheetPts, goalBonusPts: s.goalBonusPts, pj: s.pj, v: s.v, e: s.e, d: s.d, gf: s.gf, gc: s.gc, redCards: s.redCards, livePts: s.livePts, liveMatches: s.liveMatches, faseAlcanzada: s.faseAlcanzada, eliminated: s.eliminated, championBonus: bonus, pts: s.matchPts + s.phasePts + bonus };
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
      eliminated: s.eliminated,
    };
  });

  stats.sort((a, b) => b.pts - a.pts || b.gf - a.gf || a.gc - b.gc);
  return stats;
}
