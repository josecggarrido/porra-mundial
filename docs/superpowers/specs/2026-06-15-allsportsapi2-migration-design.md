# Diseño: migración de Code.gs a AllSportsApi2 (RapidAPI)

**Fecha:** 2026-06-15
**Estado:** aprobado, listo para plan de implementación

## Contexto

`apps-script/Code.gs` lee los partidos del Mundial 2026 de **football-data.org** y
escribe el resultado en la pestaña `Resultados` del Google Sheet. La API actual
está dando problemas, así que migramos a **AllSportsApi2** en RapidAPI (publisher
fluis.lacasse), que es un espejo con estructura SofaScore.

Decisión del usuario: **swap limpio** (se elimina football-data.org por completo,
solo se usa AllSportsApi2) **+ se mantiene el seguimiento de tarjetas rojas**.

## Alcance

### NO cambia
- Todo `src/**` (frontend Vite + React).
- El formato del Sheet `Resultados!A:J` (10 columnas), que el frontend lee en
  `src/lib/normalizeSheetData.js` (`parseResultados`) y `src/hooks/useSheetData.js`.
- `src/lib/scoring.js` (lógica de puntuación; las rojas se muestran pero no puntúan).
- La superficie pública de funciones de `Code.gs`: `testAPI`, `preloadFixtures`,
  `fetchResults`, `backfillRedCards`, `setupTrigger`, `setupLiveTrigger`,
  `clearTriggers`, `doGet`. Los triggers existentes siguen funcionando sin tocar.

### Cambia
- Únicamente el interior de `apps-script/Code.gs`: todas las llamadas, headers,
  paginación y mapeo de campos pasan de football-data.org a AllSportsApi2.

## Formato de salida (contrato con el frontend — invariante)

Cada fila de `Resultados!A:J` mantiene exactamente este orden:

| Col | Índice | Campo | Valores |
|-----|--------|-------|---------|
| A | 0 | `id` | id numérico del partido |
| B | 1 | `homeTeam` | nombre en español (vía `normalizeTeam`) |
| C | 2 | `awayTeam` | nombre en español |
| D | 3 | `homeGoals` | número o `''` |
| E | 4 | `awayGoals` | número o `''` |
| F | 5 | `status` | `NS` / `LIVE` / `FT` / `AET` / `PEN` / `PST` / `CANC` |
| G | 6 | `round` (fase) | `group` / `r32` / `r16` / `qf` / `sf` / `3rd` / `final` |
| H | 7 | `date` | fecha ISO 8601 |
| I | 8 | `homeRedCards` | número (default 0) |
| J | 9 | `awayRedCards` | número (default 0) |

## Configuración (Script Properties)

| Propiedad | Uso | Default |
|-----------|-----|---------|
| `RAPIDAPI_KEY` | clave RapidAPI (sustituye a `FOOTBALL_API_KEY`) | — (obligatoria) |
| `SPREADSHEET_ID` | id del Sheet | — (obligatoria) |
| `RESULTS_SHEET_NAME` | pestaña destino | `Resultados` |
| `TOURNAMENT_ID` | unique-tournament del Mundial | `16` |
| `SEASON_ID` | temporada 2026 | `58210` |

Headers comunes en cada `UrlFetchApp.fetch`:
```
x-rapidapi-key: <RAPIDAPI_KEY>
x-rapidapi-host: allsportsapi2.p.rapidapi.com
```

## Endpoints

| Uso | Path | Notas |
|-----|------|-------|
| Listado partidos jugados | `/api/tournament/{TID}/season/{SID}/matches/last/{page}` | paginado (~30/pág) |
| Listado próximos partidos | `/api/tournament/{TID}/season/{SID}/matches/next/{page}` | paginado |
| Incidencias (rojas) | `/api/match/{id}/incidents` | una llamada por partido |

Base: `https://allsportsapi2.p.rapidapi.com`.

### Paginación
`fetchMatchesFromAPI_` recorre `last/{page}` y `next/{page}` empezando en `page=0`,
incrementando hasta recibir un `events` vacío. Tope defensivo `MAX_PAGES = 12` por
dirección. Se combinan ambos listados y se **deduplica por `id`** (un partido podría
aparecer en ambas direcciones en el borde live). Devuelve el array combinado o `null`
si falla la primera petición.

## Mapeo de campos (verificado contra respuestas reales)

La respuesta de listado es `{ "events": [ ... ] }`. Cada evento:

### Equipos
- `event.homeTeam.name`, `event.awayTeam.name` → `normalizeTeam()`.
- Se reutiliza `TEAM_NAME_MAP` actual. Confirmado que la API usa grafías ya
  cubiertas: `"Bosnia & Herzegovina"`, `"Czechia"`, `"USA"`, `"South Korea"`.
  Se añade alias `"Bosnia & Herzegovina"` explícito si no resuelve.

### Goles — `extractGoals(event, status)`
- Si `status === 'NS'` → `['', '']`.
- Si no: `homeScore.current` / `awayScore.current` (con fallback a `display`, luego
  `normaltime`). `current` ya incluye prórroga; la tanda de penaltis va en
  `homeScore.penalties` aparte, por lo que un partido a penaltis queda con marcador
  de empate (mismo comportamiento que la versión football-data.org).
- Si no hay marcador numérico → `['', '']`.

### Estado — `normalizeMatchStatus(status, score)`
Entrada: objeto `event.status` (`{type, code, description}`) y `event.score`.

| `status.type` | Resultado |
|---------------|-----------|
| `notstarted` | `NS` |
| `inprogress` | `LIVE` |
| `finished` | `FT` / `AET` / `PEN` (ver derivación) |
| `postponed` | `PST` |
| `canceled` / `cancelled` | `CANC` |
| otro | `NS` (fallback seguro) |

Derivación AET/PEN cuando `finished`:
1. Si `homeScore.penalties != null` (hubo tanda) → `PEN`.
2. Si no, si `homeScore.overtime != null` o `status.code` ∈ {110,120,130} o
   `status.description` contiene "extra"/"AET" → `AET`.
3. Si no → `FT`.

### Fase — `normalizeStage(roundInfo)`
Entrada: `event.roundInfo`. Mapeo por `roundInfo.slug`:

| slug | fase |
|------|------|
| (sin slug; `round` ∈ {1,2,3}) | `group` |
| `round-of-32` | `r32` |
| `round-of-16` | `r16` |
| `quarterfinals` | `qf` |
| `semifinals` | `sf` |
| `match-for-3rd-place` | `3rd` |
| `final` | `final` |
| otro desconocido | `group` (fallback) |

### Fecha
`event.startTimestamp` (Unix segundos) → `new Date(ts * 1000).toISOString()`.
Si falta → `''`.

### Tarjetas rojas — `countRedCards(incidents)`
La respuesta de `/incidents` es `{ "incidents": [ ... ] }`. Cada tarjeta:
`{ incidentType: "card", incidentClass: "red"|"yellowRed"|"yellow", isHome: bool }`.

- Se cuentan solo `incidentType === "card"` con `incidentClass ∈ {"red","yellowRed"}`.
- `isHome === true` → local; `false` → visitante.
- Devuelve `[homeRed, awayRed]`. Ya no se necesita `homeTeam.id` (la versión anterior
  lo usaba para football-data.org).

`fetchMatchDetail_(matchId)` pasa a llamar a `/api/match/{id}/incidents` y devuelve
el array `incidents` (o `null` si falla).

## Control de rate-limit

Se mantiene el patrón actual:
- `fetchResults`: `detailBudget = 8` llamadas a `/incidents` por ejecución
  (solo partidos en vivo o recién finalizados; el resto reutiliza rojas guardadas
  vía `storedRedCards_`).
- `backfillRedCards`: `CAP = 45`, con `Utilities.sleep(1200)` entre llamadas.
- Listado: tope `MAX_PAGES = 12` por dirección.

## Funciones — superficie y cambios internos

| Función | Cambio |
|---------|--------|
| `TEAM_NAME_MAP` | sin cambios (revisar alias Bosnia/Czechia/USA) |
| `STAGE_MAP` / `normalizeStage` | reescrito: mapea por `roundInfo.slug` en vez de claves football-data.org |
| `LIVE_API_STATUSES` | eliminado (lógica ahora por `status.type`) |
| `normalizeMatchStatus` | reescrito para `status.type`/`code` + score |
| `extractGoals` | reescrito para `homeScore.current` |
| `countRedCards` | reescrito para `incidents`/`isHome` |
| `fetchMatchDetail_` | apunta a `/api/match/{id}/incidents` |
| `storedRedCards_`, `isFinishedStatus_` | sin cambios |
| `fetchMatchesFromAPI_` | reescrito: paginación last+next, dedupe, headers RapidAPI |
| `testAPI` | reescrito: verifica `RAPIDAPI_KEY`, llama a `matches/next/0`, muestra ejemplo |
| `preloadFixtures`, `fetchResults`, `backfillRedCards` | misma lógica de hoja; usan los helpers nuevos |
| `setupTrigger`, `setupLiveTrigger`, `clearTriggers`, `doGet` | sin cambios |

## Verificación

- `testAPI`: tras configurar `RAPIDAPI_KEY`, debe loguear HTTP 200, número de
  partidos y un ejemplo legible.
- `preloadFixtures`: precarga las 104 fixtures con resultado vacío y fase correcta.
- `fetchResults`: actualiza solo filas cambiadas; rojas correctas en partidos
  finalizados (validado contra `incidents` reales, p.ej. México–Sudáfrica con
  3 rojas: 1 local / 2 visitante).
- Frontend sin cambios debe seguir leyendo y puntuando igual.

## Notas / riesgos

- AllSportsApi2 pagina, a diferencia de football-data.org (una sola llamada). Un run
  completo de `fetchResults` hace ~8-10 llamadas de listado + incidents. Aceptable en
  trigger horario; vigilar la cuota mensual de RapidAPI en el trigger de 15 min.
- No hay muestra real de un partido AET/PEN (los finalizados disponibles son de fase
  de grupos). La derivación AET/PEN es defensiva por varios campos; revisar con el
  primer partido de eliminatorias real.
- El nombre de campo de prórroga en `score` se asume `overtime`; si la API usa otro
  (`extra`, `extratime`), ajustar en implementación.
