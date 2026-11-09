// Montserrat = respaldo de Gotham · Allison = script del lema (empaquetadas, funcionan offline)
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/allison/400.css';

import './styles/tokens.css';
import './styles/deck.css';
import './styles/xr.css';

import { Deck } from './js/deck.js';
import hooks, { preload } from './js/slides.js';

// Esperar fuentes para que SplitText mida bien las palabras
const fonts = ['300 30px Montserrat', '400 30px Montserrat', '700 30px Montserrat', '900 30px Montserrat', '400 30px Allison'];
Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => {}).then(() => document.fonts.ready).then(() => {
  window.deck = new Deck({ hooks }).init();
  // Precarga el modelo 3D de la demo cuando el navegador esté libre
  (window.requestIdleCallback || setTimeout)(() => preload(), { timeout: 3000 });
});
