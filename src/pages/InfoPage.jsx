// Significado de cada abreviatura mostrada en la clasificación / equipos.
// La fuente de verdad es src/lib/scoring.js (calcTeamStats).
const PUNTOS = [
  { abbr: 'V',  nombre: 'Victorias',        valor: '3 pts',        desc: 'Por cada partido que gana tu selección.' },
  { abbr: 'E',  nombre: 'Empates',          valor: '1 pt',         desc: 'Por cada partido que termina en empate.' },
  { abbr: 'PG', nombre: 'Portería a cero',  valor: '1 pt',         desc: 'Cada vez que tu selección termina un partido sin encajar goles.' },
  { abbr: 'G',  nombre: 'Bonus goles',      valor: '1 pt / 3 goles', desc: 'Por cada 3 goles que marca tu selección en un mismo partido (4 goles = 1, 6 goles = 2…).' },
  { abbr: 'F',  nombre: 'Puntos de fase',   valor: 'según ronda',  desc: 'Puntos que se acumulan al alcanzar cada eliminatoria (ver tabla).' },
  { abbr: '🏆', nombre: 'Bonus campeón',    valor: '10 pts',       desc: 'Si tu selección gana el Mundial.' },
];

// PHASE_POINTS de scoring.js. Son acumulativos: una selección que llega a la final
// suma los puntos de TODAS las rondas que ha jugado por el camino.
const FASES = [
  { fase: 'Clasificarse a dieciseisavos (1/16)', pts: 1 },
  { fase: 'Octavos de final (1/8)', pts: 2 },
  { fase: 'Cuartos de final',       pts: 3 },
  { fase: 'Semifinales',            pts: 4 },
  { fase: 'Final',                  pts: 5 },
];

const DESEMPATES = [
  'Mayor número de puntos totales.',
  'Más goles a favor (sumando todas tus selecciones).',
  'Menos goles en contra (sumando todas tus selecciones).',
];

// ⚠️ EDITA AQUÍ si cambia el número de participantes o el precio de la apuesta.
const PARTICIPANTES = 68;
const PRECIO = 5; // € por participante
const BOTE = PARTICIPANTES * PRECIO;

const PREMIOS = [
  { puesto: '🥇 1.º clasificado', pct: 50, nota: '' },
  { puesto: '🥈 2.º clasificado', pct: 25, nota: '' },
  { puesto: '🥉 3.º clasificado', pct: 15, nota: '' },
  { puesto: '🐢 Último (menos puntos)', pct: 5, nota: '¡por aguantar el tirón!' },
  { puesto: '🟥 Más tarjetas rojas', pct: 5, nota: '¡por jugar sucio!' },
];

const euros = n => `${Number.isInteger(n) ? n : n.toFixed(2)} €`;

export default function InfoPage() {
  return (
    <div className="app">
      <main>
        <div className="container">
          <p className="info-intro">
            Cada participante elige <strong>13 selecciones</strong> y va sumando los puntos
            que consiguen durante todo el Mundial. Aquí tienes todo lo que necesitas saber
            sobre cómo se puntúa, cómo se deshacen los empates y qué premios hay en juego.
          </p>

          <section className="info-card">
            <h2 className="info-card-title">📊 Cómo se puntúa</h2>
            <div className="info-puntos">
              {PUNTOS.map(p => (
                <div key={p.abbr} className="info-punto">
                  <span className="info-punto-abbr">{p.abbr}</span>
                  <div className="info-punto-body">
                    <div className="info-punto-head">
                      <span className="info-punto-nombre">{p.nombre}</span>
                      <span className="info-punto-valor">{p.valor}</span>
                    </div>
                    <p className="info-punto-desc">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="info-card">
            <h2 className="info-card-title">🏟️ Puntos por fase (F)</h2>
            <p className="info-card-note">
              Son <strong>acumulativos</strong>: una selección que llega a la final ha sumado
              también los puntos de las rondas anteriores.
            </p>
            <div className="info-fases">
              {FASES.map(f => (
                <div key={f.fase} className="info-fase-row">
                  <span>{f.fase}</span>
                  <span className="info-fase-pts">+{f.pts}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="info-card">
            <h2 className="info-card-title">⚖️ Criterios de desempate</h2>
            <p className="info-card-note">Si dos participantes empatan a puntos, se ordenan así:</p>
            <ol className="info-desempates">
              {DESEMPATES.map((d, i) => <li key={i}>{d}</li>)}
            </ol>
            <p className="info-card-note" style={{ margin: '14px 0 0' }}>
              Si tras todo esto el empate persiste… ¡el premio se reparte! 🤝
            </p>
          </section>

          <section className="info-card">
            <h2 className="info-card-title">🎁 Reparto del bote</h2>
            <div className="info-bote">
              <span className="info-bote-label">Bote total</span>
              <span className="info-bote-valor">{euros(BOTE)}</span>
              <span className="info-bote-calc">{PARTICIPANTES} participantes × {euros(PRECIO)}</span>
            </div>
            <div className="info-premios">
              {PREMIOS.map(p => (
                <div key={p.puesto} className="info-premio-row">
                  <span className="info-premio-puesto">
                    {p.puesto}
                    {p.nota && <span className="info-premio-nota">{p.nota}</span>}
                  </span>
                  <span className="info-premio-valor">
                    {euros(BOTE * p.pct / 100)}
                    <span className="info-premio-pct">{p.pct}%</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
