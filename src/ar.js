import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/900.css';
import './styles/tokens.css';
import './styles/ar.css';
import '@google/model-viewer';
import { setupLuxation } from './js/luxation.js';

const viewer = document.getElementById('viewer');
const status = document.getElementById('status');
const bar = viewer.querySelector('.ar-progress span');

setupLuxation(viewer, document.querySelector('.ar-main'));

const say = (msg) => { status.textContent = msg; status.hidden = !msg; };

viewer.addEventListener('progress', (e) => {
  const p = e.detail.totalProgress;
  bar.style.transform = `scaleX(${p})`;
  bar.parentElement.classList.toggle('is-done', p >= 1);
});

viewer.addEventListener('load', () => {
  if (!viewer.canActivateAR) {
    say('Tu dispositivo no admite realidad aumentada en el navegador. Puedes girar y ampliar el modelo aquí mismo con los dedos.');
  }
});

viewer.addEventListener('error', () => say('No se pudo cargar el modelo. Revisa tu conexión e inténtalo de nuevo.'));

viewer.addEventListener('ar-status', (e) => {
  if (e.detail.status === 'failed') say('No se pudo iniciar la RA. Prueba con más luz y apunta a una superficie con textura.');
  if (e.detail.status === 'session-started') say('');
});
