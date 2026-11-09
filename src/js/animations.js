import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Presets de animación (vocabulario de la skill Unicorsalud + extras GSAP).
 * `from` = estado inicial. El estado final se calcula con los valores neutros.
 * `loop` = animación infinita que arranca al terminar la entrada (se detiene al salir).
 *
 * HTML: <h2 data-anim="fade-up" data-delay="300" data-duration="900">  (ms)
 */
export const PRESETS = {
  // --- Skill Unicorsalud ---
  'fade':        { from: { opacity: 0 } },
  'fade-up':     { from: { opacity: 0, y: 60 } },                 // por defecto (fadeInUp de la web)
  'fade-down':   { from: { opacity: 0, y: -60 } },
  'slide-left':  { from: { opacity: 0, x: 120 } },                // entra desde la derecha
  'slide-right': { from: { opacity: 0, x: -120 } },               // entra desde la izquierda
  'zoom':        { from: { opacity: 0, scale: 0.85 } },
  'pop':         { from: { opacity: 0, scale: 0.6 }, ease: 'back.out(2)' },
  'blur':        { from: { opacity: 0, filter: 'blur(18px)' } },
  'mask':        { from: { clipPath: 'inset(0% 100% 0% 0%)' }, duration: 0.9, ease: 'power3.inOut' },
  'mask-up':     { from: { clipPath: 'inset(100% 0% 0% 0%)' }, duration: 0.9, ease: 'power3.inOut' },
  'grow-x':      { from: { scaleX: 0 }, ease: 'power3.inOut' },
  'grow-y':      { from: { scaleY: 0 }, ease: 'power3.inOut' },
  'kenburns':    { from: { opacity: 0 }, duration: 0.9,
                   loop: (el) => gsap.fromTo(el, { scale: 1 }, { scale: 1.12, xPercent: -1.5, yPercent: -1, duration: 14, ease: 'none' }) },
  'float':       { from: { opacity: 0 }, duration: 0.8,
                   loop: (el) => gsap.to(el, { y: -14, duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true }) },
  'pulse':       { from: { opacity: 0 },
                   loop: (el) => gsap.to(el, { scale: 1.05, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true }) },
  'spin-slow':   { from: { opacity: 0 }, duration: 0.8,
                   loop: (el) => gsap.to(el, { rotation: '+=360', duration: 40, ease: 'none', repeat: -1 }) },
  // --- Extras GSAP ---
  'zoom-out':    { from: { opacity: 0, scale: 1.3 } },
  'rotate-in':   { from: { opacity: 0, rotation: -10, y: 40 } },
  'flip-up':     { from: { opacity: 0, rotationX: -90, transformOrigin: '50% 100%', transformPerspective: 900 } },
  'flip-left':   { from: { opacity: 0, rotationY: 90, transformOrigin: '0% 50%', transformPerspective: 900 } },
  // --- Internos ---
  'rise':        { from: { yPercent: 110 } },                     // usado por data-split
  'step':        { from: { opacity: 0, y: 30 } },                 // usado por data-step
};

const NEUTRAL = {
  opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, scaleX: 1, scaleY: 1,
  rotation: 0, rotationX: 0, rotationY: 0, filter: 'blur(0px)', clipPath: 'inset(0% 0% 0% 0%)',
};
const NOT_ANIMATED = ['transformOrigin', 'transformPerspective'];

const BASE_DUR = 0.6;          // --dur-base
const STAGGER = 0.11;          // --stagger (110 ms)
const EASE = 'power4.out';     // ≈ --ease-out cubic-bezier(.22,1,.36,1)
const ms = (v, d = 0) => (v === undefined || v === '' ? d : parseFloat(v) / 1000);

function presetOf(el, fallback) {
  const name = el.dataset.anim || fallback;
  if (!PRESETS[name]) console.warn(`[deck] data-anim desconocido "${name}", usando "${fallback}"`);
  return PRESETS[name] || PRESETS[fallback];
}

function toState(from) {
  const to = {};
  for (const k of Object.keys(from)) if (!NOT_ANIMATED.includes(k)) to[k] = NEUTRAL[k] ?? 0;
  return to;
}

/** Nodos que realmente se animan: el elemento o sus palabras/letras/líneas. */
function targets(el) {
  if (el.__targets) return el.__targets;
  if (el.hasAttribute('data-split')) {
    const kind = ['chars', 'lines'].includes(el.dataset.split) ? el.dataset.split : 'words';
    const type = kind === 'chars' ? 'words,chars' : kind;
    const split = SplitText.create(el, { type, mask: kind, maskClass: 'split-mask', aria: 'auto' });
    el.__targets = split[kind];
    el.__stagger = { chars: 0.025, words: 0.06, lines: 0.1 }[kind];
  } else {
    el.__targets = [el];
  }
  return el.__targets;
}

function vars(el, fallback) {
  const p = presetOf(el, fallback);
  return {
    preset: p,
    from: p.from,
    to: {
      ...toState(p.from),
      duration: ms(el.dataset.duration, p.duration ?? BASE_DUR),
      ease: el.dataset.ease || p.ease || EASE,
      stagger: el.__stagger || 0,
    },
  };
}

const fallbackFor = (el) => (el.hasAttribute('data-split') ? 'rise' : 'fade-up');

/** Elementos de entrada: [data-anim] y [data-split] que no son pasos. */
const entranceEls = (slide) =>
  [...slide.querySelectorAll('[data-anim]:not([data-step]), [data-split]:not([data-step])')];

// ---------------------------------------------------------------------------

/** Deja la diapositiva lista para entrar: todo en su estado inicial. */
export function prepareSlide(slide, { keepCounters = false } = {}) {
  stopLoops(slide);
  for (const el of entranceEls(slide)) {
    const t = targets(el);
    gsap.killTweensOf(t);
    gsap.set(t, vars(el, fallbackFor(el)).from);
  }
  const fills = slide.querySelectorAll('.uc-bar__fill');
  gsap.killTweensOf(fills);
  gsap.set(fills, { scaleX: 0 });
  for (const group of slide.__steps || []) hideStep(group, true);
  if (!keepCounters) resetCounters(slide); // en el HTML queda el valor final (útil para PDF)
}

/** Timeline de entrada: cascada overline → titular → divisor → contenido. */
export function playEntrance(slide) {
  const tl = gsap.timeline();
  if (REDUCED) {
    for (const el of entranceEls(slide)) tl.set(targets(el), toState(vars(el, fallbackFor(el)).from), 0);
    tl.set(slide.querySelectorAll('.uc-bar__fill'), { scaleX: 1 }, 0);
    tl.call(() => runCounters(slide), null, 0);
    return tl;
  }
  entranceEls(slide).forEach((el, i) => {
    const order = el.dataset.order !== undefined ? parseInt(el.dataset.order, 10) : i;
    const at = order * STAGGER + ms(el.dataset.delay);
    const { to, preset } = vars(el, fallbackFor(el));
    tl.to(targets(el), to, at);
    if (preset.loop && !REDUCED) tl.call(() => startLoop(slide, preset.loop(el)), null, at + to.duration);
  });
  // Barras de gráfico
  const fills = slide.querySelectorAll('.uc-bar__fill');
  if (fills.length) tl.to(fills, { scaleX: 1, duration: 1.2, ease: EASE, stagger: 0.15 }, 0.4);
  tl.call(() => runCounters(slide), null, 0);
  return tl;
}

// --- Animaciones infinitas (float, pulse, spin-slow, kenburns) --------------
function startLoop(slide, tween) {
  (slide.__loops ||= []).push(tween);
}
export function stopLoops(slide) {
  slide.__loops?.forEach((t) => t.progress(0).kill()); // vuelve al estado base
  slide.__loops = [];
}

// --- Pasos (data-step) ------------------------------------------------------
export function revealStep(group) {
  const tl = gsap.timeline();
  group.forEach((el) => {
    const { to } = vars(el, 'step');
    const t = targets(el);
    gsap.killTweensOf(t);
    tl.to(t, REDUCED ? { ...to, duration: 0 } : to, ms(el.dataset.delay));
    el.classList.add('is-shown');
  });
  return tl;
}

export function hideStep(group, instant = false) {
  group.forEach((el) => {
    const { from } = vars(el, 'step');
    const t = targets(el);
    gsap.killTweensOf(t);
    if (instant || REDUCED) gsap.set(t, from);
    else gsap.to(t, { ...from, duration: 0.3, ease: 'power2.in' });
    el.classList.remove('is-shown');
  });
}

export function showStepInstant(group) {
  group.forEach((el) => {
    gsap.set(targets(el), toState(vars(el, 'step').from));
    el.classList.add('is-shown');
  });
}

/** Agrupa [data-step] por número (vacío = siguiente número; igual número = juntos). */
export function collectSteps(slide) {
  const groups = new Map();
  let auto = 0;
  for (const el of slide.querySelectorAll('[data-step]')) {
    const v = el.dataset.step;
    const n = v === '' ? ++auto : parseInt(v, 10);
    auto = Math.max(auto, n);
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(el);
  }
  return [...groups.keys()].sort((a, b) => a - b).map((k) => groups.get(k));
}

// --- Contadores (data-count) ------------------------------------------------
// <span data-count="1250" data-prefix="+" data-suffix="%" data-decimals="0"
//       data-delay="300" data-duration="1800">1.250</span>
function fmt(el, v) {
  const dec = parseInt(el.dataset.decimals || '0', 10);
  const n = v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (el.dataset.prefix || '') + n + (el.dataset.suffix || '');
}

function resetCounters(slide) {
  slide.querySelectorAll('[data-count]').forEach((el) => {
    el.__countTween?.kill();
    el.textContent = fmt(el, 0);
  });
}

function runCounters(slide) {
  slide.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    if (REDUCED) { el.textContent = fmt(el, end); return; }
    const o = { v: 0 };
    el.__countTween = gsap.to(o, {
      v: end,
      duration: ms(el.dataset.duration, 1.8),
      delay: ms(el.dataset.delay, 0.3),
      ease: 'power4.out',
      onUpdate: () => (el.textContent = fmt(el, o.v)),
    });
  });
}
