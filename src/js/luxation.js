import { gsap } from 'gsap';
import DATA from './hombro-data.json';

/**
 * Controles del modelo del hombro (ver scripts/prepare-model.mjs):
 *  - animación "luxacion": tramo t = 0 s luxado → 2 s normal
 *  - etiquetas de los huesos (hotspots de <model-viewer>); la del húmero y la de la
 *    cápsula siguen al hueso mientras se luxa
 *  - cápsula articular: translúcida en posición normal, roja al luxarse
 *
 * Marcado esperado:
 *   <model-viewer> … <button slot="hotspot-escapula" class="bone-tag" data-tag="escapula">Escápula</button> … </model-viewer>
 *   <div class="lux"> <button data-lux="0">Normal</button> <input type="range"> <button data-lux="1">Luxación</button>
 *                     <button data-tags>Etiquetas</button> </div>
 */
const T_NORMAL = 2;
const CAPS_NORMAL = [0.97, 0.86, 0.78, 0.42]; // translúcida, color tejido
const CAPS_LUX = [0.88, 0.05, 0.08, 0.9];     // rojo: cápsula distendida / lesionada

// ---------- pose del húmero en un instante (misma interpolación que glTF: lerp + slerp) ----------
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? b.map((x) => -x) : b;
  d = Math.abs(d);
  if (d > 0.9995) return lerp(a, bb, t);
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((x, i) => wa * x + wb * bb[i]);
}
function rotate([x, y, z], [qx, qy, qz, qw]) {
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
}
function humerusToWorld(local, time) {
  const { times, t, r } = DATA.keys;
  const i = Math.min(times.length - 2, Math.max(0, Math.floor(time)));
  const f = Math.min(1, Math.max(0, (time - times[i]) / (times[i + 1] - times[i])));
  const T = lerp(t[i], t[i + 1], f), R = slerp(r[i], r[i + 1], f);
  const p = rotate(local, R).map((c, k) => c + T[k]);
  return p.map((c, k) => DATA.root.t[k] + DATA.root.s * c);
}
const posAttr = (p) => p.map((c) => `${c.toFixed(4)}m`).join(' ');

// ---------------------------------------------------------------------------------------------
export function setupLuxation(viewer, container, { initial = 1 } = {}) {
  const buttons = [...container.querySelectorAll('[data-lux]')];
  const range = container.querySelector('input[type="range"]');
  const tagsBtn = container.querySelector('[data-tags]');
  const capsTag = viewer.querySelector('[data-tag="capsula"]');
  const state = { v: initial }; // 0 = normal · 1 = luxado
  let capsMat = null;

  const L = DATA.labels;
  const placeStaticTags = () => {
    for (const name of ['escapula', 'clavicula', 'glenoide']) viewer.updateHotspot?.({ name: `hotspot-${name}`, position: posAttr(L[name]) });
  };

  const apply = () => {
    const time = T_NORMAL * (1 - state.v);
    if (viewer.loaded) {
      viewer.currentTime = time;
      viewer.updateHotspot?.({ name: 'hotspot-humero', position: posAttr(humerusToWorld(L.humeroLocal, time)) });
      const hum = humerusToWorld(L.capsulaHumeroLocal, time);
      viewer.updateHotspot?.({ name: 'hotspot-capsula', position: posAttr(lerp(L.capsulaFija, hum, 0.5)) });
      capsMat?.pbrMetallicRoughness.setBaseColorFactor(lerp(CAPS_NORMAL, CAPS_LUX, state.v));
    }
    if (range) range.value = Math.round(state.v * 100);
    buttons.forEach((b) => b.classList.toggle('is-active', Math.round(state.v) === +b.dataset.lux));
    const lux = state.v > 0.5;
    container.dataset.state = lux ? 'luxado' : 'normal';
    if (capsTag) {
      capsTag.classList.toggle('is-alert', lux);
      capsTag.textContent = lux ? 'Cápsula articular distendida' : 'Cápsula articular';
    }
  };

  const ready = () => {
    viewer.animationName = 'luxacion';
    viewer.pause();
    capsMat = viewer.model?.materials.find((m) => m.name === 'capsula') || null;
    placeStaticTags();
    apply();
  };
  if (viewer.loaded) ready(); else viewer.addEventListener('load', ready, { once: true });

  const goTo = (v) => gsap.to(state, { v, duration: 1.6 * Math.abs(state.v - v) + 0.2, ease: 'power2.inOut', onUpdate: apply, overwrite: true });

  buttons.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.lux)));
  range?.addEventListener('input', () => { gsap.killTweensOf(state); state.v = range.value / 100; apply(); });
  range?.addEventListener('change', () => range.blur()); // devolver las flechas del teclado a la presentación

  const toggleTags = (force) => {
    const on = viewer.classList.toggle('tags-off', force === undefined ? undefined : !force) === false;
    tagsBtn?.classList.toggle('is-active', on);
    tagsBtn?.setAttribute('aria-pressed', on);
  };
  tagsBtn?.addEventListener('click', () => toggleTags());
  toggleTags(true);

  return { goTo, toggle: () => goTo(state.v > 0.5 ? 0 : 1), toggleTags, get value() { return state.v; } };
}
