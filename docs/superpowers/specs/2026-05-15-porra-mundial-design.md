# Porra Mundial 2026 — Diseño

_Fecha: 2026-05-15_

## Resumen

Rediseño funcional de la web de la Porra del Mundial 2026. Se elimina toda la UI de participación (formulario de apuesta) y se convierte la web en un **panel de visualización de solo lectura**. La participación ocurre exclusivamente a través de un Google Form externo. Los resultados de partidos se obtienen automáticamente de API-Football mediante un Apps Script con trigger horario, que los vuelca en una Google Sheet. La web lee ambas fuentes (participantes + resultados) y calcula la clasificación en el cliente.

---

## Arquitectura

```
Google Forms
    └── Sheet: pestaña "Respuestas"  (solo lectura, gestionada por Forms)
                                          │
API-Football ──► Apps Script (hourly) ──► Sheet: pestaña "Resultados"
                                          │
                                    Sheets API v4 (batchGet)
                                          │
                                    React + Vite (cliente)
                                          │
                              Clasificación / Equipos / Partidos
```

Un único Google Spreadsheet con dos pestañas. La web usa una sola llamada `batchGet` para leer ambas.

---

## Datos

### Pestaña `Respuestas` (Google Forms, solo lectura)

Columnas tal como las crea el Forms (en este orden):

| Col | Nombre |
|-----|--------|
| A | Marca temporal |
| B | Nombre completo |
| C | Usuario de Telegram |
| D | Grupo 1 — Elección 1 |
| E | Grupo 2 — Elección 1 |
| F | Grupo 2 — Elección 2 |
| G | Grupo 3 — Elección 1 |
| H | Grupo 3 — Elección 2 |
| I | Grupo 3 — Elección 3 |
| J | Grupo 3 — Elección 4 |
| K | Grupo 4 — Elección 1 |
| L | Grupo 4 — Elección 2 |
| M | Grupo 4 — Elección 3 |
| N | Grupo 5 — Elección 1 |
| O | Grupo 5 — Elección 2 |
| P | Grupo 5 — Elección 3 |

Los valores de las columnas D–P son cadenas con el nombre del equipo tal como lo devuelve el Forms (ej. `"1-Brasil"` o simplemente `"Brasil"` — se normalizará al cargar).

En caso de respuestas duplicadas (mismo nombre o alias), se conserva la más reciente por marca temporal.

### Pestaña `Resultados` (Apps Script, escritura)

Una fila por partido. El Apps Script sobreescribe si el `match_id` ya existe o añade una nueva fila.

| Col | Campo | Tipo |
|-----|-------|------|
| A | `match_id` | número (ID de API-Football) |
| B | `home_team` | string (nombre normalizado) |
| C | `away_team` | string |
| D | `home_goals` | número |
| E | `away_goals` | número |
| F | `status` | `NS` / `LIVE` / `FT` |
| G | `round` | ver normalización abajo |
| H | `date` | ISO 8601 |

**Normalización de `round`:**

| Valor API-Football | Valor normalizado |
|---|---|
| `Group Stage - *` | `group` |
| `Round of 32` | `r32` |
| `Round of 16` | `r16` |
| `Quarter-finals` | `qf` |
| `Semi-finals` | `sf` |
| `3rd Place Final` | `3rd` |
| `Final` | `final` |

---

## Motor de puntuación (cliente)

Para cada participante, se suman los puntos de cada uno de sus 13 equipos elegidos.

### Por partido (solo partidos con `status = "FT"`)

Para cada partido en que juega el equipo elegido:

- Victoria: **+3 pts**
- Empate: **+1 pt**
- Derrota: **+0 pts**
- Portería a cero (0 goles recibidos): **+1 pt adicional**
- Bonus goles: `floor(goles_marcados / 3)` pts (ej: 6 goles = +2, 9 = +3)

### Por fase alcanzada (una vez por equipo, acumulativo)

Un equipo "alcanza" una fase cuando tiene al menos un partido con ese `round` en la Sheet.

| Fase (`round`) | Puntos |
|---|---|
| `r32` (Round of 32 / 1/16) | +1 |
| `r16` (octavos / Round of 16) | +2 |
| `qf` (cuartos) | +3 |
| `sf` (semis) | +4 |
| `3rd` (partido 3er puesto) | +0 (no da puntos de fase; solo los puntos propios del partido) |
| `final` (la final) | +5 |
| Campeón (ganador de `final`) | +10 adicionales |

El campeón se detecta como el equipo con más goles en el partido con `round = "final"`.

### Desempate

En caso de igualdad de puntos:
1. Mayor suma de goles marcados por todos sus equipos
2. Menor suma de goles recibidos por todos sus equipos
3. Reparto del premio a partes iguales

---

## Frontend

### Stack

- React + Vite (configuración existente, sin cambios)
- CSS existente (`global.css`) sin modificaciones salvo añadir clases nuevas donde sea necesario
- Sin dependencias nuevas (se elimina `papaparse` si no se usa)

### Páginas y rutas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `ClasificacionPage` | Tabla de ranking. Botón "Actualizar". Clic en fila abre modal de detalle. |
| `/equipos` | `EquiposPage` | Tabla de 48 equipos con puntos acumulados y fase alcanzada. |
| `/partidos` | `PartidosPage` | Partidos jugados agrupados por fase, con resultado. |

La ruta `/admin` y la `ApuestaPage` se eliminan. La ruta `/calendario` se reutiliza como `/partidos`.

### Navegación (Header)

Tabs actualizadas:

```
🏆 Clasificación  |  🌍 Equipos  |  📅 Partidos
```

El resto del Header (logo, hero con countdown, estilos) permanece intacto.

### ClasificacionPage

- Tabla con columnas: Pos | Nombre | @Telegram | Pts | Equipos (banderas)
- Filas top-3 con estilos especiales (ya existen en `global.css`: `.rank-row.top1/2/3`)
- Clic en fila abre modal con los 13 equipos del participante, cada uno con sus puntos desglosados
- Botón "Actualizar" en la cabecera de la tabla que fuerza un re-fetch a Sheets API
- Estado de carga y error manejados con mensajes inline

### EquiposPage

- Tabla de 48 equipos ordenada por puntos descendente
- Columnas: Equipo (bandera + nombre) | Pts | PJ | V | E | D | GF | GC | Fase alcanzada
- Datos calculados a partir de la pestaña `Resultados`

### PartidosPage

- Partidos agrupados por fase (group → r32 → r16 → qf → sf → 3rd → final)
- Dentro de cada fase, ordenados por fecha
- Solo muestra partidos con `status = "FT"` o `"LIVE"`
- Cada partido: bandera local — resultado — bandera visitante

### Carga de datos

Un hook `useSheetData()` centraliza la llamada a Sheets API:

```
GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values:batchGet
  ?ranges=Respuestas!A:P
  &ranges=Resultados!A:H
  &key={API_KEY}
```

`SPREADSHEET_ID` y `API_KEY` se configuran en `.env` como `VITE_SPREADSHEET_ID` y `VITE_SHEETS_API_KEY`. Un fichero `.env.example` documenta las variables necesarias.

El hook expone `{ participantes, resultados, loading, error, refresh }`. El estado se guarda en React state; no hay caché persistente.

---

## Apps Script (`apps-script/Code.gs`)

Reemplaza el `Code.gs` existente (que manejaba envío de apuestas).

### Variables de entorno (Script Properties)

- `FOOTBALL_API_KEY` — API key de API-Football (v3.football.api-sports.io)
- `SPREADSHEET_ID` — ID del Google Spreadsheet
- `RESULTS_SHEET_NAME` — nombre de la pestaña de resultados (default: `"Resultados"`)

### Funciones

**`fetchResults()`**

1. Abre la Sheet y carga todos los `match_id` existentes en `Resultados` para indexarlos.
2. Llama a `https://v3.football.api-sports.io/fixtures?league=1&season=2026` con header `x-apisports-key`.
3. Para cada fixture con `fixture.status.short` en `["FT", "NS", "LIVE"]`:
   - Normaliza el `round`.
   - Si el `match_id` ya existe en la Sheet, actualiza la fila. Si no, la añade al final.
4. Escribe todos los cambios en batch (`setValues`).

**`setupTrigger()`**

Crea un trigger `ScriptApp.newTrigger("fetchResults").timeBased().everyHours(1)`. Se llama una sola vez manualmente desde el editor.

**`clearTriggers()`**

Elimina todos los triggers existentes. Utilidad para resetear.

### Límites API-Football

El plan gratuito permite 100 peticiones/día. Una llamada a `/fixtures?league=1&season=2026` devuelve todos los partidos del torneo en una sola respuesta, por lo que 1 petición/hora = 24/día — dentro del límite gratuito.

---

## Ficheros afectados

### Eliminar
- `src/pages/ApuestaPage.jsx`
- `src/lib/appsScript.js`

### Modificar
- `src/App.jsx` — nuevas rutas, eliminar rutas antiguas
- `src/components/Header.jsx` — actualizar tabs
- `apps-script/Code.gs` — reemplazar lógica de apuestas por fetch de API-Football

### Crear
- `src/pages/ClasificacionPage.jsx`
- `src/pages/EquiposPage.jsx`
- `src/pages/PartidosPage.jsx`
- `src/hooks/useSheetData.js`
- `src/lib/scoring.js` — motor de puntuación puro (sin efectos, fácil de testear)
- `src/lib/normalizeSheetData.js` — parseo de filas crudas de Sheets API
- `.env.example`

### No modificar
- `src/styles/global.css` (salvo clases nuevas mínimas)
- `src/data/paises.js`
- `src/main.jsx`
- `vite.config.js`
- `package.json` (sin dependencias nuevas)
