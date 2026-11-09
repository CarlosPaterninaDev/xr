# Presentación web · Unicorsalud

Presentación tipo PowerPoint en HTML, CSS y JS con la identidad visual de **Unicorsalud** (skill `style-guide-unicorsalud`). Las animaciones usan **GSAP** y el empaquetado **Vite**.

## Comandos

```bash
npm install            # solo la primera vez
npm run dev            # servidor de desarrollo con recarga en caliente
npm run build          # dist/ → subir a cualquier hosting estático (rutas relativas)
npm run build:single   # dist-single/index.html → un único archivo autocontenido (offline, por correo, USB)
npm run preview        # sirve dist/ localmente
npm run model          # regenera src/public/models/hombro.glb desde models-src/ (opcional)
```

## Estructura

```
src/
  index.html          ← las slides (<section class="slide"> dentro de .deck__stage)
  main.js             ← entrada: fuentes, estilos y motor
  styles/tokens.css   ← design tokens de marca (colores, tipografía, espacios)
  styles/deck.css     ← temas, layouts y componentes uc-*
  js/deck.js          ← motor: escalado 1920×1080, navegación, pasos, notas, URL
  js/animations.js    ← presets data-anim, data-split, data-step, data-count
  js/transitions.js   ← transiciones entre slides (data-transition)
  js/slides.js        ← lógica JS a medida por id de slide
  assets/brand/       ← logos oficiales y lema
  assets/img/         ← fotos (referenciar como ./assets/img/foto.jpg)
```

## Controles

| Entrada | Acción |
|---|---|
| → ↓ Espacio PgDn Enter · clic en los 2/3 derechos · swipe ← | siguiente (paso o slide) |
| ← ↑ PgUp · clic en el 1/3 izquierdo · swipe → | anterior |
| Inicio / Fin | primera / última |
| número + Enter | ir a esa slide |
| F | pantalla completa |
| N | notas del orador (`<aside class="notes">` dentro de la slide) |
| B | pantalla en negro |
| Cmd/Ctrl + P | PDF: una slide por página, todo visible (márgenes "Ninguno", activar "Gráficos de fondo") |

URL: `#5` = slide 5 · `#5.2` = slide 5, paso 2.

## Referencia rápida

Los componentes de marca son los de la skill (`uc-title`, `uc-overline`, `uc-divider`, `uc-card`, `uc-stat`, `uc-list`, `uc-bars`, `uc-timeline`, `uc-quote`, `l-split`, `l-grid-3`, temas `is-red` / `is-dark` / `is-cream`, `slide--cover` / `--section` / `--hero`…). Detalle completo en `.claude/skills/style-guide-unicorsalud/references/components.md`.

### Transiciones · `data-transition` en la slide de destino
| Valor | Uso |
|---|---|
| (ninguno) / `fade` | por defecto |
| `slide`, `up`, `zoom` | contenido |
| `wipe` | cortina roja de marca: secciones, cifras y cierre (máx. 1 de cada 4) |
| `cube`, `flip`, `blur`, `reveal`, `circle`, `none` | extras GSAP, con moderación |

### Animaciones de entrada · `data-anim`
`fade` `fade-up` (defecto) `fade-down` `slide-left` `slide-right` `zoom` `pop` `blur` `mask` `mask-up` `grow-x` `grow-y` `kenburns` `float` `pulse` `spin-slow` + extras `zoom-out` `rotate-in` `flip-up` `flip-left`.

Cascada automática según el orden en el DOM (110 ms entre elementos). Modificadores en **milisegundos**: `data-delay="300"`, `data-duration="1200"`, `data-order="0"`, y `data-ease="elastic.out"` (cualquier ease de GSAP).

### Texto · `data-split`
`data-split` (palabras) · `data-split="chars"` · `data-split="lines"`. Conserva `<em>`. No combinar con `data-anim`.

### Pasos por clic · `data-step`
`data-step` = siguiente paso; `data-step="2"` en varios elementos = aparecen juntos. Opcional `data-anim` para cambiar la animación del paso. Los pasos revelados reciben `.is-shown`.

### Contadores · `data-count`
`<span data-count="1250" data-prefix="+" data-suffix="%" data-decimals="0" data-delay="300">1.250</span>` — formato es-CO. Escribe el valor final como contenido (sale así en el PDF).

### Lógica a medida
En `src/js/slides.js`, por `id` de slide: `{ enter(slide, deck) {}, leave(slide, deck) {} }`. También se emiten `slide:enter` / `slide:leave` sobre `.deck`, y `window.deck` expone `next()`, `prev()`, `goTo(i)`.

Para crear presets o transiciones nuevas, añádelos a `PRESETS` (animations.js) o `TRANSITIONS` (transitions.js).

## Notas de marca

- Rojo `#D71920` protagonista; amarillo `#FBAF17` solo para un CTA por slide.
- Ritmo de color por deck: ~60 % claras, ~25 % rojas, ~15 % oscuras/foto.
- Firma: overline rojo → titular con una palabra en `<em>` → divisor de 5 px.
- Gotham se usa si está instalada en el equipo; si no, Montserrat (empaquetada). Para incrustar Gotham ver el comentario en `styles/tokens.css`.
- No inventar cifras institucionales: marcar como "Datos de ejemplo".

## Demo de realidad aumentada (slide 6 + `ar.html`)

- **Modelo:** base *Shoulder Fracture – Superior Glenoid Fracture*, NIH 3D [3DPX-000338](https://3d.nih.gov/entries/338), dominio público (CC0). Original en `models-src/`. `npm run model` genera `src/public/models/hombro.glb`: separa el húmero de la escápula y la clavícula, añade la animación `luxacion` (luxación anterior subcoracoidea **simulada con fines didácticos**: 0 s luxado → 1 s tracción → 2 s normal → … bucle de 4 s), lo pasa a metros, lo centra y lo colorea como hueso. Los desplazamientos se ajustan en `LUX` dentro de `scripts/prepare-model.mjs`.
- **Control normal / luxación:** botones y deslizador en la slide 6 y en `ar.html`; en la slide, tecla **L** (luxación) y **E** (etiquetas).
- **Etiquetas y cápsula:** `npm run model` también genera la cápsula articular (manguito translúcido con *skinning* que se estira con el húmero) y `src/js/hombro-data.json` con los puntos de las etiquetas. `src/js/luxation.js` mueve las etiquetas del húmero y la cápsula durante la animación y pinta la cápsula de rojo al luxarse.
- **Slide 6:** QR + modelo girando en vivo (arrastrar para girar). El QR apunta a `ar.html` junto a la presentación, así que se ajusta solo al dominio donde la publiques.
- **`ar.html`:** página para celular con `<model-viewer>`: botón "Ver en mi mesa" (Android → WebXR/Scene Viewer, iPhone → Quick Look, sin instalar apps). Si el equipo no soporta RA, el modelo se puede girar en pantalla.
- **Requisito:** la RA en celulares exige **HTTPS** → hay que publicar la carpeta `dist/`. En local el QR muestra un aviso.
- Para forzar otra URL en el QR: `index.html?ar=https://mi-sitio/ar.html#6`.

## Publicar (HTTPS)

**Netlify (lo más rápido):** `npm run build` y arrastra la carpeta `dist/` a <https://app.netlify.com/drop> (con cuenta, el sitio queda permanente). Con repositorio, `netlify.toml` ya trae la configuración.

**GitHub Pages:** sube el proyecto a un repositorio, en *Settings → Pages* elige *GitHub Actions*; `.github/workflows/deploy.yml` publica en cada push a `main`.

**Probar en el celular sin publicar:** `npm run dev` muestra una URL de red (`http://192.168.x.x:5173`) para ver la página en el celular, pero la RA no se activa sin HTTPS.
# xr
