# Porra Mundial 2026 · Abogacía General del Estado 

Aplicación de porra del Mundial 2026 para la Abogacía General del Estado. Cada participante elige 13 selecciones al inicio del torneo y acumula puntos automáticamente según los resultados.

## Stack

- Vite + React (JSX)
- React Router DOM v7
- PapaParse (lectura de Google Sheets como CSV)
- Google Apps Script (escritura en Google Sheets)
- Cloudflare Pages (hosting)

## Configuración

### 1. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```bash
cp .env.example .env.local
```

### 2. Google Sheets

Crea una hoja con tres pestañas:

**`apuestas`** — cabeceras en fila 1:
```
token | nombre | apellido | alias | paises | creado_en | pagado
```

**`partidos`** — cabeceras en fila 1:
```
id | local_n | visitante_n | fase | goles_local | goles_visitante | tarjetas_rojas | fecha
```

**`config`** — cabeceras en fila 1:
```
clave | valor
```
Añade la fila: `fecha_cierre | 2026-06-11T14:00:00-05:00`

Para las URLs CSV: **Archivo > Publicar en la web > pestaña concreta > Valores separados por comas**.

### 3. Google Apps Script

1. En la hoja, abre **Extensiones > Apps Script**.
2. Pega el contenido de `apps-script/Code.gs`.
3. En **Propiedades del script** añade:
   - `SS_ID` = ID de tu hoja (está en la URL)
   - `ADMIN_PASSWORD` = contraseña del admin
4. **Implementar > Nueva implementación**:
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Acceso: Cualquier usuario
5. Copia la URL resultante en `VITE_APPS_SCRIPT_URL`.

### 4. Desarrollo local

```bash
npm install
npm run dev
```

### 5. Deploy en Cloudflare Pages

```bash
npm run build
# Sube la carpeta dist/ a Cloudflare Pages
# O conecta el repo y configura: build command = npm run build, output = dist
```

En Cloudflare Pages > Settings > Environment variables, añade las mismas variables de `.env.local`.

## Fases del proyecto

- **Fase 1** ✅ — Formulario de apuesta
- **Fase 2** — Ranking y calendario con puntuación automática
- **Fase 3** — Panel de administración
