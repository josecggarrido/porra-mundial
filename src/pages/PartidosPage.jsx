import { useSheetData } from '../hooks/useSheetData';
import { GRUPOS, isoToFlagUrl } from '../data/paises';
import {
  KO_MATCHES, KO_COLUMNS, TERCER_PUESTO_ID, VERTICAL_ROUNDS, mapSheetToBracket,
} from '../data/bracket';

const TODOS_LOS_PAISES = GRUPOS.flatMap(g => g.paises);
const teamToIso = new Map(TODOS_LOS_PAISES.map(p => [p.nombre, p.iso]));

function flag(team) {
  if (!team) return null;
  const iso = teamToIso.get(team);
  return iso
    ? <img className="partido-flag" src={isoToFlagUrl(iso)} alt="" width={20} height={15} />
    : <span className="partido-flag partido-flag--none">🏳</span>;
}

const STATUS_BADGE = { AET: 'AET', PEN: 'PEN', LIVE: 'en vivo' };
const FINISHED = new Set(['FT', 'AET', 'PEN', 'FINISHED', 'AWARDED']);

function isFinished(m) {
  return m && FINISHED.has(String(m.status).toUpperCase());
}
function isLiveStatus(s) {
  const u = String(s).toUpperCase();
  return u === 'LIVE' || u === 'IN_PLAY' || u === 'HT' || u === 'PAUSED';
}
function isPendingStatus(s) {
  const u = String(s).toUpperCase();
  return u === 'NS' || u === 'TBD' || u === 'TIMED' || u === 'SCHEDULED' || u === '';
}

function formatTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit',
  });
}
function formatDay(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short',
  });
}
function dayKey(iso) {
  if (!iso) return '';
  // sv-SE locale returns YYYY-MM-DD consistently — used only as a grouping key
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
function formatDayTime(iso) {
  if (!iso) return 'Por jugar';
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

// Build the resolver that knows, given the sheet's knockout matches mapped to
// logical bracket ids, who plays each match. A side resolves to { name, real }
// where `real` means we know the concrete team (so we can show its flag);
// otherwise it's "por jugar" and the node shows the match date instead.
function makeKnockout(logicalToReal) {
  // winner/loser of a match, only resolvable from a decisive finished result
  function decisive(id) {
    const m = logicalToReal.get(id);
    if (!isFinished(m) || m.homeGoals == null || m.awayGoals == null) return null;
    if (m.homeGoals === m.awayGoals) return null; // PEN/draw: can't tell from goals
    const homeWon = m.homeGoals > m.awayGoals;
    return {
      winner: homeWon ? m.homeTeam : m.awayTeam,
      loser: homeWon ? m.awayTeam : m.homeTeam,
    };
  }

  function resolveSide(side) {
    if (side.team) return { name: side.team, real: true };
    if (side.win != null) {
      const d = decisive(side.win);
      if (d) return { name: d.winner, real: true };
    }
    if (side.lose != null) {
      const d = decisive(side.lose);
      if (d) return { name: d.loser, real: true };
    }
    return { name: '—', real: false };
  }

  function resolveMatch(id) {
    const def = KO_MATCHES[id];
    const r = logicalToReal.get(id) || null;
    // Prefer the teams the sheet reports (most accurate, handles PEN); fall
    // back to the structural resolution from the bracket tree.
    const home = r && r.homeTeam ? { name: r.homeTeam, real: true } : resolveSide(def.home);
    const away = r && r.awayTeam ? { name: r.awayTeam, real: true } : resolveSide(def.away);
    return { id, def, result: r, home, away };
  }

  return { resolveMatch };
}

// One match inside the bracket (or 3rd-place / final blocks). When neither team
// is known yet we drop the "por jugar" rows and just show the match date.
function MatchNode({ node }) {
  const { result: m, home, away } = node;
  const live = m && isLiveStatus(m.status);
  const finished = isFinished(m);
  const pending = !m || isPendingStatus(m.status);
  const decisive = finished && m.homeGoals != null && m.awayGoals != null && m.homeGoals !== m.awayGoals;
  const homeWon = decisive && m.homeGoals > m.awayGoals;
  const awayWon = decisive && m.awayGoals > m.homeGoals;
  const badge = m && STATUS_BADGE[String(m.status).toUpperCase()];
  const bothUnknown = !home.real && !away.real;

  const score = side => (m && m[side] != null ? m[side] : '');

  if (pending && bothUnknown) {
    return (
      <div className="bk-match bk-match--date">
        <span className="bk-date-line">{m && m.date ? formatDay(m.date) : 'Por jugar'}</span>
        {m && m.date && <span className="bk-date-time">{formatTime(m.date)}</span>}
      </div>
    );
  }

  return (
    <div className={`bk-match${live ? ' bk-match--live' : ''}`}>
      <Side team={home} won={homeWon} goals={score('homeGoals')} pending={pending} />
      <Side team={away} won={awayWon} goals={score('awayGoals')} pending={pending} />
      <div className="bk-meta">
        {pending
          ? <span className="bk-time">{formatDayTime(m && m.date)}</span>
          : badge && <span className={`bk-badge${live ? ' bk-badge--live' : ''}`}>{badge}</span>}
      </div>
    </div>
  );
}

function Side({ team, won, goals, pending }) {
  return (
    <div className={`bk-side${won ? ' bk-side--won' : ''}${team.real ? '' : ' bk-side--tbd'}`}>
      <span className="bk-team">
        {team.real ? flag(team.name) : <span className="partido-flag partido-flag--none">·</span>}
        <span className="bk-name">{team.name}</span>
      </span>
      <span className="bk-goals">{pending ? '' : goals}</span>
    </div>
  );
}

// A group-stage match shown as a card.
function GroupCard({ m }) {
  const live = isLiveStatus(m.status);
  const finished = isFinished(m);
  const pending = isPendingStatus(m.status);
  const decisive = finished && m.homeGoals != null && m.awayGoals != null && m.homeGoals !== m.awayGoals;
  const homeWon = decisive && m.homeGoals > m.awayGoals;
  const awayWon = decisive && m.awayGoals > m.homeGoals;
  const badge = STATUS_BADGE[String(m.status).toUpperCase()];

  return (
    <div className={`gc${live ? ' gc--live' : ''}`}>
      <div className={`gc-team gc-team--home${homeWon ? ' gc-team--won' : ''}`}>
        <span className="gc-name">{m.homeTeam || 'Por determinar'}</span>
        {flag(m.homeTeam)}
      </div>
      <div className={`gc-score${live ? ' gc-score--live' : ''}${pending ? ' gc-score--ns' : ''}`}>
        {pending
          ? formatTime(m.date)
          : m.homeGoals != null ? `${m.homeGoals}–${m.awayGoals}` : '–'}
        {badge && <span className={`gc-badge${live ? ' gc-badge--live' : ''}`}>{badge}</span>}
      </div>
      <div className={`gc-team gc-team--away${awayWon ? ' gc-team--won' : ''}`}>
        {flag(m.awayTeam)}
        <span className="gc-name">{m.awayTeam || 'Por determinar'}</span>
      </div>
    </div>
  );
}

export default function PartidosPage() {
  const { resultados, loading, error } = useSheetData();

  if (loading) return <div className="app"><main><div className="container"><p className="empty">Cargando partidos…</p></div></main></div>;
  if (error) return <div className="app"><main><div className="container"><p className="empty" style={{ color: 'var(--c-red)' }}>{error}</p></div></main></div>;

  if (resultados.length === 0) {
    return (
      <div className="app"><main><div className="container">
        <div className="empty"><div className="empty-icon">📅</div><p>Aún no hay partidos cargados.</p></div>
      </div></main></div>
    );
  }

  const logicalToReal = mapSheetToBracket(resultados);
  const { resolveMatch } = makeKnockout(logicalToReal);

  // Group-stage matches = solo los partidos cuya ronda es 'group'. El resto
  // (r32, r16, qf, sf, 3rd, final) son eliminatorias y van en el cuadro.
  const groupMatches = resultados
    .filter(m => String(m.round || '').toLowerCase() === 'group')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const groupDays = [];
  let curKey = null;
  for (const m of groupMatches) {
    const k = dayKey(m.date);
    if (k !== curKey) {
      curKey = k;
      groupDays.push({ label: formatDay(m.date), matches: [] });
    }
    groupDays[groupDays.length - 1].matches.push(m);
  }

  const tercer = resolveMatch(TERCER_PUESTO_ID);
  const final = resolveMatch(104);

  return (
    <div className="app">
      <main>
        <div className="container">
          {/* ── Cuadro de eliminatorias ── */}
          <section className="bk-section">
            <h2 className="bk-section-title">Cuadro de eliminatorias</h2>

            {/* Escritorio: cuadro clásico horizontal con líneas conectoras */}
            <div className="bk-desktop">
              <p className="bk-section-hint">Desliza el cuadro para ver todas las rondas →</p>
              <div className="bk-scroll">
                <div className="bk-grid">
                  {KO_COLUMNS.map(col => (
                    <div key={col.key} className="bk-col" data-round={col.key}>
                      <div className="bk-col-label">{col.label}</div>
                      <div className="bk-col-body">
                        {col.ids.map(id => (
                          <div key={id} className="bk-cell">
                            <MatchNode node={resolveMatch(id)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tercer puesto, aparte del árbol principal */}
              <div className="bk-extra">
                <div className="bk-extra-item">
                  <div className="bk-col-label bk-col-label--center">Tercer puesto</div>
                  <MatchNode node={tercer} />
                </div>
                <div className="bk-extra-item bk-extra-item--final">
                  <div className="bk-col-label bk-col-label--center">🏆 Final</div>
                  <MatchNode node={final} />
                </div>
              </div>
            </div>

            {/* Móvil: una sección apilada por ronda, sin scroll horizontal */}
            <div className="bk-vertical">
              {VERTICAL_ROUNDS.map(round => {
                const nodes = round.ids
                  .map(resolveMatch)
                  .sort((a, b) => {
                    const da = a.result && a.result.date;
                    const db = b.result && b.result.date;
                    if (da && db) return da.localeCompare(db);
                    if (da) return -1;
                    if (db) return 1;
                    return a.id - b.id;
                  });
                return (
                  <div key={round.key} className="bkv-round">
                    <div className="bkv-round-label">{round.label}</div>
                    <div className="bkv-list">
                      {nodes.map(node => (
                        <MatchNode key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Fase de grupos ── */}
          {groupDays.length > 0 && (
            <section className="gc-section">
              <h2 className="bk-section-title">Fase de grupos</h2>
              {groupDays.map(({ label, matches }) => (
                <div key={label || 'nodate'} className="gc-day">
                  {label && <div className="gc-day-label">{label}</div>}
                  <div className="gc-list">
                    {matches.map(m => <GroupCard key={m.matchId} m={m} />)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
