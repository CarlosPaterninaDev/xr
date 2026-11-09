import { gsap } from 'gsap';

/**
 * Transiciones entre diapositivas — atributo data-transition en la slide DE DESTINO.
 *
 *  Marca Unicorsalud:  (ninguno) = fade · slide · up · zoom · wipe (cortina roja)
 *  Extras GSAP:        cube · flip · blur · reveal · circle · none
 *
 * Guía de marca: `wipe` solo para secciones, cifras y cierre (máx. 1 de cada 4 slides);
 * `slide` / `up` / `zoom` para contenido.
 *
 * Firma: (tl, from, to, dir, ctx) — dir = 1 avanzar / -1 retroceder; from puede ser null.
 */
const D = 0.8;              // --dur-slide
const EASE = 'power3.inOut';

export const TRANSITIONS = {
  none(tl, from, to) {
    tl.set(to, { autoAlpha: 1 });
    if (from) tl.set(from, { autoAlpha: 0 });
  },

  fade(tl, from, to) {
    if (from) tl.to(from, { autoAlpha: 0, duration: D, ease: 'power2.out' }, 0);
    tl.fromTo(to, { autoAlpha: 0 }, { autoAlpha: 1, duration: D, ease: 'power2.out' }, 0);
  },

  slide(tl, from, to, dir) {
    if (from) tl.to(from, { xPercent: -100 * dir, duration: D, ease: EASE }, 0);
    tl.fromTo(to, { xPercent: 100 * dir, autoAlpha: 1 }, { xPercent: 0, duration: D, ease: EASE }, 0);
  },

  up(tl, from, to, dir) {
    if (from) tl.to(from, { yPercent: -100 * dir, duration: D, ease: EASE }, 0);
    tl.fromTo(to, { yPercent: 100 * dir, autoAlpha: 1 }, { yPercent: 0, duration: D, ease: EASE }, 0);
  },

  zoom(tl, from, to) {
    if (from) tl.to(from, { scale: 0.92, autoAlpha: 0, duration: D * 0.8, ease: 'power2.in' }, 0);
    tl.fromTo(to, { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: D, ease: 'power3.out' }, D * 0.3);
  },

  /** Cortina roja de marca: cruza la pantalla y cambia la slide a mitad de camino. */
  wipe(tl, from, to, dir, { wipe }) {
    const x0 = -101 * dir;
    tl.set(to, { autoAlpha: 0 });
    tl.fromTo(wipe, { xPercent: x0 }, { xPercent: 0, duration: 0.45, ease: 'power3.in' });
    tl.set(to, { autoAlpha: 1 });
    if (from) tl.set(from, { autoAlpha: 0 });
    tl.to(wipe, { xPercent: -x0, duration: 0.55, ease: 'power3.out' }, '+=0.08');
  },

  cube(tl, from, to, dir) {
    const ease = 'power2.inOut';
    if (from) {
      tl.fromTo(from, { transformOrigin: dir > 0 ? '100% 50%' : '0% 50%' },
        { xPercent: -100 * dir, rotationY: -90 * dir, duration: D * 1.2, ease }, 0);
    }
    tl.fromTo(to,
      { autoAlpha: 1, xPercent: 100 * dir, rotationY: 90 * dir, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%' },
      { xPercent: 0, rotationY: 0, duration: D * 1.2, ease }, 0);
  },

  flip(tl, from, to, dir) {
    // .slide tiene backface-visibility: hidden → la cara trasera no se ve
    if (from) tl.to(from, { rotationY: -180 * dir, duration: D * 1.2, ease: EASE }, 0);
    tl.fromTo(to, { rotationY: 180 * dir, autoAlpha: 1 }, { rotationY: 0, duration: D * 1.2, ease: EASE }, 0);
  },

  blur(tl, from, to) {
    if (from) tl.to(from, { filter: 'blur(30px)', autoAlpha: 0, duration: D * 0.7, ease: 'power2.in' }, 0);
    tl.fromTo(to, { filter: 'blur(30px)', autoAlpha: 0 }, { filter: 'blur(0px)', autoAlpha: 1, duration: D, ease: 'power2.out' }, D * 0.4);
  },

  reveal(tl, from, to, dir) {
    const start = dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
    tl.fromTo(to, { clipPath: start, autoAlpha: 1 }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D * 1.2, ease: 'power4.inOut' }, 0);
    if (from) tl.to(from, { xPercent: -20 * dir, duration: D * 1.2, ease: 'power4.inOut' }, 0);
  },

  circle(tl, from, to) {
    tl.fromTo(to, { clipPath: 'circle(0% at 50% 50%)', autoAlpha: 1 }, { clipPath: 'circle(75% at 50% 50%)', duration: D * 1.3, ease: 'power3.inOut' }, 0);
    if (from) tl.to(from, { scale: 0.92, duration: D * 1.3, ease: 'power3.inOut' }, 0);
  },
};
TRANSITIONS['slide-up'] = TRANSITIONS.up;

export const RESET_PROPS = 'transform,filter,clipPath,transformOrigin';

export function runTransition(type, from, to, dir, ctx) {
  const tl = gsap.timeline();
  let fn = TRANSITIONS[type];
  if (!fn) { console.warn(`[deck] data-transition desconocido "${type}", usando "fade"`); fn = TRANSITIONS.fade; }
  gsap.set(to, { clearProps: RESET_PROPS, zIndex: 2 });
  if (from) gsap.set(from, { zIndex: 1 });
  fn(tl, from, to, dir, ctx);
  return tl;
}
