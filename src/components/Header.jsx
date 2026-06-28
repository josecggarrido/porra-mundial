import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const TOURNAMENT_START = new Date('2026-06-11T15:00:00-04:00'); // 11 jun 2026 15:00 ET

function useCountdown(target) {
  const [diff, setDiff] = useState(() => target - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const s = Math.max(0, Math.floor(diff / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

const TABS = [
  { to: '/',         label: 'Clasificación', icon: '🏆' },
  { to: '/equipos',  label: 'Equipos',       icon: '🌍' },
  { to: '/partidos', label: 'Partidos',       icon: '📅' },
  { to: '/info',     label: 'Info',           icon: 'ℹ️' },
];

export default function Header() {
  const location = useLocation();
  const cd = useCountdown(TOURNAMENT_START.getTime());
  const started = Date.now() >= TOURNAMENT_START.getTime();

  return (
    <>
      <header className="hero">
        <div className="hero-inner container">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <div className="brand-text">
              <span className="kicker">{import.meta.env.VITE_GROUP_NAME}</span>
              <span className="name">Porra Mundial 2026</span>
            </div>
          </div>

          <h1 className="hero-title">
            El Mundial<br /><em>es nuestro.</em>
          </h1>

          <div className="hero-meta">
            <p className="hero-sub">
              Elige tus 13 selecciones antes del 11 de junio y sigue la clasificación en directo.
            </p>
            {!started && (
              <div className="countdown" aria-label="Cuenta atrás para el inicio">
                <span className="cd-label">Empieza en</span>
                <div className="cd-units">
                  {[
                    { n: cd.days, label: 'días' },
                    { n: cd.hours, label: 'horas' },
                    { n: cd.mins, label: 'min' },
                    { n: cd.secs, label: 'seg' },
                  ].map(({ n, label }) => (
                    <div key={label} className="cd-unit">
                      <div className="cd-num">{pad(n)}</div>
                      <div className="cd-name">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones">
        <div className="tabs-inner container">
          {TABS.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              role="tab"
              aria-selected={location.pathname === to}
              className="tab"
            >
              {icon} {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
