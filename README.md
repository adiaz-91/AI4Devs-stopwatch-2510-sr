# Cronómetro / Cuenta atrás (Web)

Aplicación web ligera de cronómetro y cuenta atrás, con laps, atajos de teclado, persistencia y i18n básica.

## Demo local

Solo abre `index.html` en tu navegador.

## Características
- **Modos**: Cronómetro y Cuenta atrás (configurable hh:mm:ss.ms).
- **Controles**: Start / Pause / Resume / Reset / Lap.
- **Atajos**: `Espacio` (Start/Pause/Resume), `R` (Reset), `L` (Lap).
- **Formato**: `mm:ss.mmm` y añade horas (`hh:mm:ss.mmm`) si procede. Zero‑padding robusto.
- **Laps**: listado con marca absoluta y delta desde el anterior; se pueden borrar individualmente o limpiar todos.
- **Persistencia**: estado, tiempo y laps al recargar (LocalStorage `stopwatch:v1`). Si estaba corriendo, se ajusta el tiempo transcurrido fuera de foco.
- **i18n**: español por defecto; añade idiomas en el objeto `i18n` de `script.js`.
- **Accesibilidad/UX**: diseño responsive, foco visible, botones con estados, números tabulares.
- **Arquitectura**: separación lógica (TimeEngine) vs. presentación, API pública en `window.stopwatch`.

## API pública
Disponible en `window.stopwatch`:
- `start()`
- `pause()`
- `resume()`
- `reset()`
- `lap()`
- `getState()`

## Persistencia (LocalStorage)
Clave: `stopwatch:v1`. Estructura guardada:
```json
{
  "mode": "stopwatch|countdown",
  "running": true,
  "t0": 1712345678910,
  "accumulated": 1234,
  "targetMs": 600000,
  "laps": [
    { "index": 1, "absoluteMs": 1234, "deltaMs": 1234, "timestampISO": "2025-01-01T12:00:00.000Z" }
  ],
  "lastPersistedAt": 1712345678920
}
```
> Al cargar, si `running` era `true`, se recalcula `accumulated` para reflejar el tiempo pasado.

## Suposiciones
- En cuenta atrás, al llegar a 0 el reloj se pausa automáticamente.
- El botón **Lap** queda deshabilitado a 0 en cuenta atrás.
- El render se hace en `requestAnimationFrame` pero solo actualiza el DOM si la cadena visible cambia.

## Estructura
```
.
├─ index.html
├─ styles.css
└─ script.js
```

## Licencia
MIT
