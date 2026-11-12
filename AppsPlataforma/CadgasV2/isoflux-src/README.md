# Taller de Isoflux (Entalpía Lab · Hub de Ingeniería Pioneer's)

Este es el **código fuente respaldado** del modelador Isoflux. Está aquí para que el
trabajo nunca se pierda si el entorno temporal de desarrollo se reinicia: todo lo que
importa vive en **tu repositorio de GitHub**, no en una carpeta temporal.

## Qué hay aquí

| Archivo / carpeta | Qué es |
|---|---|
| `iso_base.html` | **Base congelada**: la aplicación completa hasta la **V33.23** (tanque 3D, VaporGLP, conversor, luz, normativa, etc.). Es un archivo HTML autónomo que ya funciona por sí solo. |
| `modules/` | Carpeta para **nuevas funciones** que se agreguen de aquí en adelante, una por archivo `.js`. Se cargan en **orden alfabético** del nombre. |
| `build.py` | Arma el archivo publicado: toma `iso_base.html` y le agrega cada módulo de `modules/`. |
| `README.md` | Este documento. |

## Por qué la base está "congelada"

Antes, Isoflux se armaba a partir de muchas piezas pequeñas (un módulo por función).
Esas piezas vivían en una carpeta temporal del entorno de desarrollo en la nube, que
**se recicla cuando la sesión queda inactiva** — y en uno de esos reinicios se borraron.
La aplicación publicada nunca estuvo en riesgo (siempre estuvo en este repositorio), pero
las piezas sueltas sí se perdieron. Como ya estaban todas "pegadas" dentro del archivo
publicado, aquí lo conservamos entero como base. **Nada de la aplicación se perdió.**

## Cómo compilar

```bash
python3 build.py
```

Escribe el resultado en el archivo publicado del repo
`../Isoflux_V18_Entalpia_Lab (1).html` (el que sirve GitHub Pages).
Con `modules/` vacía, el resultado es **idéntico** a `iso_base.html`.

Para compilar a otra ruta (por ejemplo, para probar sin tocar el publicado):

```bash
python3 build.py /ruta/prueba.html
```

## Cómo agregar una función nueva (módulo)

1. Crea un archivo en `modules/`, por ejemplo `modules/v141_minuevafuncion.js`.
   (El prefijo `v141`, `v142`, … sirve para fijar el orden de carga.)
2. Escribe el código **envuelto en una función anónima** para no chocar con el resto:

   ```js
   /* ===== V33.24 · Breve descripción de la función ===== */
   (function(){
     // Aquí va el código. Tiene acceso a lo global de Isoflux:
     // S (escena), N(id), P(x,y,z), draw(), CF, etc.
   })();
   ```
3. Compila: `python3 build.py`
4. Publica (ver abajo).

Para **cambiar algo que ya existe** (que está dentro de `iso_base.html`), hay dos caminos:
- Editar `iso_base.html` directamente (busca la función por su nombre), o
- Sobrescribir ese comportamiento desde un módulo nuevo (por ejemplo, reemplazando una
  función global al final de la carga). La primera opción es la más simple.

## Cómo publicar (dejarlo en vivo)

Después de compilar, el archivo publicado ya quedó actualizado. Solo falta subirlo:

```bash
cd ..                      # carpeta CadgasV2
git add "Isoflux_V18_Entalpia_Lab (1).html" isoflux-src
git commit -m "Isoflux: <qué cambió>"
git push origin main
```

GitHub Pages sirve ese archivo; recarga con **Ctrl+F5** para ver los cambios.

## Nota sobre la versión

El número de versión y el historial de cambios están **dentro de `iso_base.html`**
(en `window.ISO_VER`). Al editar directamente la base, ese número no se actualiza solo;
si quieres reflejar una versión nueva, cámbialo a mano en esa variable.
