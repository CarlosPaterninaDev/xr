import { gsap } from 'gsap';
import {
  REDUCED, collectSteps, prepareSlide, playEntrance, revealStep, hideStep, showStepInstant, stopLoops,
} from './animations.js';
import { runTransition, RESET_PROPS } from './transitions.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const pad = (n) => String(n).padStart(2, '0');

/**
 * Motor de presentación (GSAP).
 *  Teclas: → ↓ Espacio PgDn = siguiente · ← ↑ PgUp = anterior · Inicio/Fin
 *          F = pantalla completa · N = notas (con cronómetro, T lo reinicia) · B = negro · número + Enter = ir a
 *  Clic: 2/3 derechos avanzan, 1/3 izquierdo retrocede (enlaces y botones no navegan)
 *  Swipe táctil · URL #5 (slide 5) o #5.2 (slide 5, paso 2)
 *  Hooks por id de slide: { enter(slide, deck), leave(slide, deck) }
 */
export class Deck {
  constructor({ root = document.querySelector('.deck'), width = 1920, height = 1080, hooks = {} } = {}) {
    this.root = root;
    this.stage = root.querySelector('.deck__stage');
    this.width = width;
    this.height = height;
    this.hooks = hooks;
    this.defaultTransition = root.dataset.transition || 'fade';
    this.slides = [...this.stage.querySelectorAll(':scope > .slide')];
    this.index = -1;
    this.step = 0;
    this.tl = null;
  }

  get current() { return this.slides[this.index]; }
  get total() { return this.slides.length; }

  init() {
    this.slides.forEach((s, i) => {
      s.__steps = collectSteps(s);
      s.dataset.index = i + 1;
      prepareSlide(s, { keepCounters: true });
      gsap.set(s, { autoAlpha: 0 });
    });
    this.#buildChrome();
    this.#bindEvents();
    this.#fit();
    const { index, step } = this.#readHash();
    this.goTo(index, { step, transition: 'none' });
    this.root.classList.add('is-ready');
    return this;
  }

  next() {
    const steps = this.current.__steps;
    if (this.step < steps.length) {
      revealStep(steps[this.step]);
      this.step++;
      this.#sync();
    } else if (this.index < this.total - 1) {
      this.goTo(this.index + 1);
    }
  }

  prev() {
    if (this.step > 0) {
      this.step--;
      hideStep(this.current.__steps[this.step]);
      this.#sync();
    } else if (this.index > 0) {
      this.goTo(this.index - 1, { step: 'end' }); // al retroceder se ven todos los pasos
    }
  }

  /** Ir a una slide (base 0). step: número o 'end'. */
  goTo(target, { step = 0, transition } = {}) {
    target = clamp(target, 0, this.total - 1);
    if (this.tl) { this.tl.progress(1); this.tl = null; }

    const from = this.current || null;
    const to = this.slides[target];
    const steps = to.__steps;
    const stepCount = step === 'end' ? steps.length : clamp(step, 0, steps.length);

    if (from === to) {
      while (this.step < stepCount) this.next();
      while (this.step > stepCount) this.prev();
      return;
    }

    const dir = target > this.index ? 1 : -1;
    if (from) { this.#hook(from, 'leave'); stopLoops(from); }

    prepareSlide(to);
    for (let k = 0; k < stepCount; k++) showStepInstant(steps[k]);

    this.index = target;
    this.step = stepCount;
    from?.classList.remove('is-active');
    to.classList.add('is-active');

    let type = transition || to.dataset.transition || this.defaultTransition;
    if (REDUCED && type !== 'none') type = 'fade';

    const tl = gsap.timeline({
      onComplete: () => {
        if (from) gsap.set(from, { autoAlpha: 0, zIndex: 0, clearProps: RESET_PROPS });
        if (this.tl === tl) this.tl = null;
      },
    });
    tl.add(runTransition(type, from, to, dir, { wipe: this.wipe }));
    tl.add(playEntrance(to), Math.max(0, tl.duration() - 0.35));
    this.tl = tl;

    this.#hook(to, 'enter');
    this.#sync();
  }

  #hook(slide, name) {
    this.hooks[slide.id]?.[name]?.(slide, this);
    this.root.dispatchEvent(new CustomEvent(`slide:${name}`, { detail: { slide, deck: this } }));
  }

  // ---------- Chrome ----------
  #buildChrome() {
    const make = (cls, parent) => parent.appendChild(Object.assign(document.createElement('div'), { className: cls }));
    this.wipe = make('deck__wipe', this.stage);
    gsap.set(this.wipe, { xPercent: -101, autoAlpha: 1 });
    this.progress = make('deck__progress', this.stage);
    this.counter = make('deck__counter', this.stage);
    this.notes = make('deck__notes', document.body);
    this.notes.innerHTML = '<div class="deck__notes-meta"><span></span><span class="deck__clock" title="T reinicia">⏱ 00:00</span></div><div></div>';
    this.notesMeta = this.notes.firstChild;
    this.notesBody = this.notes.lastChild;
    // Cronómetro de la clase (tecla T lo reinicia)
    const clock = this.notes.querySelector('.deck__clock');
    this.clockStart = Date.now();
    setInterval(() => {
      const s = Math.floor((Date.now() - this.clockStart) / 1000);
      clock.textContent = `⏱ ${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    }, 1000);
  }

  #sync() {
    const slide = this.current;
    const totalSteps = slide.__steps.length;
    const frac = (this.index + (totalSteps ? this.step / (totalSteps + 1) : 0)) / Math.max(1, this.total - 1);
    gsap.to(this.progress, { scaleX: clamp(frac, 0, 1), duration: 0.6, ease: 'power3.out' });

    this.counter.innerHTML = `<b>${pad(this.index + 1)}</b> / ${pad(this.total)}`;
    this.counter.style.display = slide.hasAttribute('data-no-chrome') ? 'none' : '';
    const dark = slide.matches('.is-dark, .is-red, .slide--hero');
    this.root.dataset.themeCurrent = dark ? 'dark' : 'light';

    const n = slide.querySelector('.notes');
    this.notesBody.innerHTML = n ? n.innerHTML : '<em>Sin notas para esta diapositiva.</em>';
    this.notesMeta.firstChild.textContent = `Diapositiva ${this.index + 1} / ${this.total}${totalSteps ? ` · paso ${this.step}/${totalSteps}` : ''}`;

    const hash = `#${this.index + 1}${this.step ? `.${this.step}` : ''}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  #readHash() {
    const m = location.hash.match(/^#\/?(\d+)(?:[./](\d+))?/);
    return { index: m ? parseInt(m[1], 10) - 1 : 0, step: m?.[2] ? parseInt(m[2], 10) : 0 };
  }

  #fit() {
    const scale = Math.min(innerWidth / this.width, innerHeight / this.height);
    this.stage.style.setProperty('--scale', scale);
  }

  // ---------- Eventos ----------
  #bindEvents() {
    addEventListener('resize', () => this.#fit());
    addEventListener('hashchange', () => {
      const { index, step } = this.#readHash();
      if (index !== this.index || step !== this.step) this.goTo(index, { step });
    });

    let jump = '', jumpTimer;
    addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
          e.preventDefault(); this.next(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          e.preventDefault(); this.prev(); break;
        case 'Home': this.goTo(0); break;
        case 'End': this.goTo(this.total - 1, { step: 'end' }); break;
        case 'f': case 'F': this.toggleFullscreen(); break;
        case 'n': case 'N': this.notes.classList.toggle('is-open'); break;
        case 't': case 'T': this.clockStart = Date.now(); break;
        case 'b': case 'B': case '.': this.root.classList.toggle('is-blackout'); break;
        case 'Enter':
          e.preventDefault();
          if (jump) { this.goTo(parseInt(jump, 10) - 1); jump = ''; } else this.next();
          break;
        default:
          if (/^\d$/.test(e.key)) {
            jump += e.key;
            clearTimeout(jumpTimer);
            jumpTimer = setTimeout(() => (jump = ''), 1500);
          }
      }
    });

    // Clic: 2/3 derechos = siguiente, 1/3 izquierdo = anterior
    let swiped = false;
    this.root.addEventListener('click', (e) => {
      if (swiped) { swiped = false; return; }
      if (e.target.closest('a, button, input, select, textarea, video, [data-no-nav]')) return;
      (e.clientX > innerWidth / 3 ? this.next() : this.prev());
    });

    // Swipe táctil
    let tx = null;
    this.root.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
    this.root.addEventListener('touchend', (e) => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx;
      tx = null;
      if (Math.abs(dx) > 50) { swiped = true; dx < 0 ? this.next() : this.prev(); }
    });

    // Ocultar cursor tras inactividad
    let idle;
    addEventListener('pointermove', () => {
      this.root.classList.remove('is-idle');
      clearTimeout(idle);
      idle = setTimeout(() => this.root.classList.add('is-idle'), 2500);
    });
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
}
