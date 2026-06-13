export const GRUPOS = [
  {
    id: 'g1',
    nombre: 'Grupo 1',
    elegir: 1,
    color: 'var(--c-g1)',
    paises: [
      { n: 1,  nombre: 'Brasil',          iso: 'BR' },
      { n: 2,  nombre: 'España',          iso: 'ES' },
      { n: 3,  nombre: 'Argentina',       iso: 'AR' },
      { n: 4,  nombre: 'Inglaterra',      iso: 'GB-ENG' },
      { n: 5,  nombre: 'Francia',         iso: 'FR' },
      { n: 6,  nombre: 'Países Bajos',    iso: 'NL' },
      { n: 7,  nombre: 'Alemania',        iso: 'DE' },
      { n: 8,  nombre: 'Portugal',        iso: 'PT' },
    ],
  },
  {
    id: 'g2',
    nombre: 'Grupo 2',
    elegir: 2,
    color: 'var(--c-g2)',
    paises: [
      { n: 9,  nombre: 'Noruega',         iso: 'NO' },
      { n: 10, nombre: 'Bélgica',         iso: 'BE' },
      { n: 11, nombre: 'Colombia',        iso: 'CO' },
      { n: 12, nombre: 'Ecuador',         iso: 'EC' },
      { n: 13, nombre: 'Canadá',          iso: 'CA' },
      { n: 14, nombre: 'Suiza',           iso: 'CH' },
      { n: 15, nombre: 'Austria',         iso: 'AT' },
      { n: 16, nombre: 'México',          iso: 'MX' },
    ],
  },
  {
    id: 'g3',
    nombre: 'Grupo 3',
    elegir: 4,
    color: 'var(--c-g3)',
    paises: [
      { n: 17, nombre: 'Senegal',         iso: 'SN' },
      { n: 18, nombre: 'Japón',           iso: 'JP' },
      { n: 19, nombre: 'Paraguay',        iso: 'PY' },
      { n: 20, nombre: 'EEUU',            iso: 'US' },
      { n: 21, nombre: 'Turquía',         iso: 'TR' },
      { n: 22, nombre: 'Suecia',          iso: 'SE' },
      { n: 23, nombre: 'Croacia',         iso: 'HR' },
      { n: 24, nombre: 'Uruguay',         iso: 'UY' },
      { n: 25, nombre: 'Marruecos',       iso: 'MA' },
      { n: 26, nombre: 'Corea del Sur',   iso: 'KR' },
      { n: 27, nombre: 'Egipto',          iso: 'EG' },
      { n: 28, nombre: 'Australia',       iso: 'AU' },
    ],
  },
  {
    id: 'g4',
    nombre: 'Grupo 4',
    elegir: 3,
    color: 'var(--c-g4)',
    paises: [
      { n: 29, nombre: 'Bosnia y Herzegovina', iso: 'BA' },
      { n: 30, nombre: 'Argelia',         iso: 'DZ' },
      { n: 31, nombre: 'Rep. Dem. del Congo', iso: 'CD' },
      { n: 32, nombre: 'Túnez',           iso: 'TN' },
      { n: 33, nombre: 'Escocia',         iso: 'GB-SCT' },
      { n: 34, nombre: 'Ghana',           iso: 'GH' },
      { n: 35, nombre: 'Irán',            iso: 'IR' },
      { n: 36, nombre: 'Chequia',         iso: 'CZ' },
      { n: 37, nombre: 'Costa de Marfil', iso: 'CI' },
      { n: 38, nombre: 'Nueva Zelanda',   iso: 'NZ' },
    ],
  },
  {
    id: 'g5',
    nombre: 'Grupo 5',
    elegir: 3,
    color: 'var(--c-g5)',
    paises: [
      { n: 39, nombre: 'Curaçao',         iso: 'CW' },
      { n: 40, nombre: 'Jordania',        iso: 'JO' },
      { n: 41, nombre: 'Sudáfrica',       iso: 'ZA' },
      { n: 42, nombre: 'Uzbekistán',      iso: 'UZ' },
      { n: 43, nombre: 'Haití',           iso: 'HT' },
      { n: 44, nombre: 'Catar',           iso: 'QA' },
      { n: 45, nombre: 'Irak',            iso: 'IQ' },
      { n: 46, nombre: 'Panamá',          iso: 'PA' },
      { n: 47, nombre: 'Cabo Verde',      iso: 'CV' },
      { n: 48, nombre: 'Arabia Saudí',    iso: 'SA' },
    ],
  },
];

export const TODOS_LOS_PAISES = GRUPOS.flatMap(g =>
  g.paises.map(p => ({ ...p, grupo: g.id, color: g.color }))
);

export function getPais(n) {
  return TODOS_LOS_PAISES.find(p => p.n === n);
}

export function isoToFlag(iso) {
  if (iso === 'GB-ENG') return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (iso === 'GB-SCT') return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
  if (iso === 'GB-WLS') return '🏴󠁧󠁢󠁷󠁬󠁳󠁿';
  return iso.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

export function isoToFlagUrl(iso) {
  if (!iso) return null;
  return `https://flagcdn.com/20x15/${iso.toLowerCase()}.png`;
}
