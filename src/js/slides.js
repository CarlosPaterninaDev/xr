import { gsap } from 'gsap';
import QRCode from 'qrcode';
import { setupLuxation } from './luxation.js';

/**
 * Lógica a medida por diapositiva, indexada por el `id` del <section>.
 *   enter(slide, deck) → al entrar · leave(slide, deck) → al salir
 */

// ---------- Slide "caso": votación por tecnología + cronómetro de debate ----------
function updateVotes(slide) {
  const opts = [...slide.querySelectorAll('.xr-option')];
  const total = opts.reduce((s, o) => s + (+o.dataset.votes || 0), 0);
  opts.forEach((o) => {
    const v = +o.dataset.votes || 0;
    o.querySelector('.xr-option__votes').textContent = v;
    o.style.setProperty('--share', total ? v / total : 0);
  });
}

function bindCase(slide) {
  // Clic = +1 voto · Shift/Alt + clic = −1
  slide.querySelectorAll('.xr-option').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const d = e.shiftKey || e.altKey ? -1 : 1;
      btn.dataset.votes = Math.max(0, (+btn.dataset.votes || 0) + d);
      updateVotes(slide);
      gsap.fromTo(btn.querySelector('.xr-option__votes'), { scale: 1.5 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    });
  });

  // Cronómetro: clic inicia / pausa · doble clic reinicia
  const timer = slide.querySelector('.xr-timer');
  const label = timer.querySelector('span');
  const total = parseInt(timer.dataset.seconds, 10);
  let left = total;
  const paint = () => (label.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  const stop = () => { clearInterval(slide.__timer); slide.__timer = null; timer.classList.remove('is-running'); };
  timer.addEventListener('click', () => {
    if (slide.__timer) return stop();
    if (left === 0) left = total;
    timer.classList.remove('is-done');
    timer.classList.add('is-running');
    slide.__timer = setInterval(() => {
      left--;
      paint();
      if (left <= 0) {
        stop();
        timer.classList.add('is-done');
        gsap.fromTo(timer, { scale: 1 }, { scale: 1.08, duration: 0.25, repeat: 5, yoyo: true, ease: 'sine.inOut' });
      }
    }, 1000);
  });
  timer.addEventListener('dblclick', () => { stop(); left = total; timer.classList.remove('is-done'); paint(); });
  slide.__stopTimer = stop;
  paint();
}

// ---------- Slide "demo-ra": QR hacia ar.html + modelo 3D en vivo ----------
// URL del QR: ?ar=https://… en la URL de la presentación, o data-ar-url en la slide;
// por defecto, ar.html junto a esta página (funciona en cualquier hosting).
function arUrl(slide) {
  const fromQuery = new URLSearchParams(location.search).get('ar');
  return fromQuery || slide.dataset.arUrl || new URL('ar.html', location.href.split('#')[0]).href;
}

const isLocal = () => location.protocol === 'file:' || /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname);

async function buildQr(slide) {
  const url = arUrl(slide);
  slide.querySelector('.xr-qr__code').innerHTML = await QRCode.toString(url, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1A1A1AFF', light: '#FFFFFFFF' },
  });
  slide.querySelector('.xr-qr__url').textContent = url.replace(/^https?:\/\//, '');
  slide.querySelector('.xr-qr__warn').hidden = !(isLocal() && !new URLSearchParams(location.search).get('ar'));
}

/** Carga model-viewer y el modelo en segundo plano para que la demo esté lista al llegar. */
let modelReady;
export function preload() {
  modelReady ||= import('@google/model-viewer').then(() => {
    document.querySelectorAll('model-viewer[data-src]').forEach((mv) => { mv.src = mv.dataset.src; });
  });
  return modelReady;
}

export default {
  'demo-ra': {
    async enter(slide) {
      if (!slide.__qr) { slide.__qr = true; buildQr(slide); }
      await preload();
      if (!slide.__lux) {
        slide.__lux = setupLuxation(slide.querySelector('model-viewer'), slide.querySelector('.lux'));
        // Tecla L: alternar normal / luxación mientras esta slide está activa
        addEventListener('keydown', (e) => {
          if ((e.key === 'l' || e.key === 'L') && slide.classList.contains('is-active')) slide.__lux.toggle();
          if ((e.key === 'e' || e.key === 'E') && slide.classList.contains('is-active')) slide.__lux.toggleTags();
        });
      }
    },
  },

  caso: {
    enter(slide) {
      if (!slide.__bound) { bindCase(slide); slide.__bound = true; }
      updateVotes(slide);
    },
    leave(slide) {
      slide.__stopTimer?.();
    },
  },
};
