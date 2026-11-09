/**
 * Prepara el modelo 3D para web y RA:  npm run model
 *
 * Fuente: NIH 3D · "Shoulder Fracture - Superior Glenoid Fracture" (3DPX-000338, v3)
 *         https://3d.nih.gov/entries/338 · Licencia CC0 1.0 (dominio público)
 *
 *  1. Une vértices y separa la malla en piezas: húmero | escápula + clavícula (+ fragmentos)
 *  2. Simplifica y recalcula normales suaves (carga rápida en celulares)
 *  3. Coloca el pivote del húmero en el centro de su cabeza (articulación glenohumeral)
 *  4. Añade la animación "luxacion": simulación didáctica de una LUXACIÓN ANTERIOR
 *     (subcoracoidea): la cabeza humeral sale hacia delante, abajo y adentro, con el
 *     brazo en ligera abducción y rotación externa.
 *        t = 0 s luxado · 1 s tracción · 2 s normal · 3 s tracción · 4 s luxado (bucle continuo)
 *     La presentación controla el tramo 0–2 s (luxado ↔ normal).
 *  5. mm → m (RA a escala real), centrado y con la base apoyada en la mesa; material color hueso
 *  6. Cápsula articular: manguito translúcido con skinning (glenoide ↔ húmero) que se estira
 *     con la luxación; y src/js/hombro-data.json con los puntos de las etiquetas
 *
 * Ejes del modelo original: +X lateral · +Y superior · +Z anterior (hombro izquierdo).
 */
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, prune, dedup, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { statSync, writeFileSync } from 'node:fs';

const SRC = 'models-src/hombro-fractura-glenoidea-nih-338.glb';
const OUT = 'src/public/models/hombro.glb';
const RATIO = parseFloat(process.env.RATIO || '0.12');
const ERROR = parseFloat(process.env.ERROR || '0.002');

// Desplazamiento de la luxación (mm) y giros (grados) aplicados a la cabeza del húmero
const LUX = { lateral: -28, superior: -20, anterior: 30, abduccion: 18, rotacionExterna: 25 };
const TRACCION = { lateral: 10, superior: -14, anterior: 12, abduccion: 10, rotacionExterna: 10 };

// ---------- utilidades ----------
const deg = (d) => (d * Math.PI) / 180;
const qAxis = ([x, y, z], a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
const qMul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
// abducción = giro sobre el eje anteroposterior (+Z); rotación externa = giro sobre el eje del húmero (+Y)
const pose = (p, pivot) => ({
  t: [pivot[0] + p.lateral, pivot[1] + p.superior, pivot[2] + p.anterior],
  r: qMul(qAxis([0, 0, 1], deg(p.abduccion)), qAxis([0, 1, 0], deg(p.rotacionExterna))),
});

// ---------- lectura y unión de vértices ----------
const io = new NodeIO();
const doc = await io.read(SRC);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const material = root.listMaterials()[0];

for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
await doc.transform(weld());

const srcPrim = root.listMeshes()[0].listPrimitives()[0];
const pos = srcPrim.getAttribute('POSITION').getArray();
const idx = srcPrim.getIndices().getArray();
const nV = pos.length / 3;

// ---------- componentes conectados (union-find) ----------
const parent = Int32Array.from({ length: nV }, (_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (let i = 0; i < idx.length; i += 3) {
  const a = find(idx[i]);
  parent[find(idx[i + 1])] = a;
  parent[find(idx[i + 2])] = a;
}
const comps = new Map();
for (let v = 0; v < nV; v++) {
  const r = find(v);
  const c = comps.get(r) || { n: 0, minY: Infinity, maxY: -Infinity };
  c.n++; c.minY = Math.min(c.minY, pos[v * 3 + 1]); c.maxY = Math.max(c.maxY, pos[v * 3 + 1]);
  comps.set(r, c);
}
// Húmero = pieza grande que llega más abajo (hueso largo)
const humerusRoot = [...comps.entries()].filter(([, c]) => c.n > 1000).sort((a, b) => a[1].minY - b[1].minY)[0][0];
const humMaxY = comps.get(humerusRoot).maxY;

// Pivote: centro aproximado de la cabeza humeral (vértices en los 45 mm superiores del húmero)
const pivot = [0, 0, 0]; let pc = 0;
for (let v = 0; v < nV; v++) {
  if (find(v) === humerusRoot && pos[v * 3 + 1] > humMaxY - 45) {
    pivot[0] += pos[v * 3]; pivot[1] += pos[v * 3 + 1]; pivot[2] += pos[v * 3 + 2]; pc++;
  }
}
pivot.forEach((_, k) => (pivot[k] /= pc));

// ---------- crear las dos mallas ----------
function subMesh(name, keepTri, offset = [0, 0, 0]) {
  const remap = new Int32Array(nV).fill(-1);
  const P = []; const I = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (!keepTri(idx[i])) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[i + k];
      if (remap[v] < 0) { remap[v] = P.length / 3; P.push(pos[v * 3] - offset[0], pos[v * 3 + 1] - offset[1], pos[v * 3 + 2] - offset[2]); }
      I.push(remap[v]);
    }
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buffer))
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}
const isHum = (v) => find(v) === humerusRoot;
const meshRest = subMesh('escapula_clavicula', (v) => !isHum(v));
const meshHum = subMesh('humero', isHum, pivot);

// Quitar la malla original
const scene = root.listScenes()[0];
for (const n of scene.listChildren()) { scene.removeChild(n); n.dispose(); }
srcPrim.dispose();

// ---------- jerarquía: hombro (escala mm→m) > [escapula_clavicula, humero] ----------
const luxado = pose(LUX, pivot);
const traccion = pose(TRACCION, pivot);
const normal = { t: [...pivot], r: [0, 0, 0, 1] };

const nodeHum = doc.createNode('humero').setMesh(meshHum).setTranslation(luxado.t).setRotation(luxado.r);
const nodeRest = doc.createNode('escapula_clavicula').setMesh(meshRest);
const nodeRoot = doc.createNode('hombro').setScale([0.001, 0.001, 0.001]).addChild(nodeRest).addChild(nodeHum);
scene.addChild(nodeRoot);

// ---------- animación ----------
const keys = [luxado, traccion, normal, traccion, luxado];
const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1, 2, 3, 4])).setBuffer(buffer);
const sampler = (path) => doc.createAnimationSampler().setInput(times).setInterpolation('LINEAR')
  .setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3')
    .setArray(new Float32Array(keys.flatMap((k) => (path === 'rotation' ? k.r : k.t)))).setBuffer(buffer));
const anim = doc.createAnimation('luxacion');
for (const path of ['translation', 'rotation']) {
  const s = sampler(path);
  anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodeHum).setTargetPath(path).setSampler(s));
}

// ---------- simplificar, normales, centrar ----------
await MeshoptSimplifier.ready;
await doc.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }),
  normals({ overwrite: true }),
  dedup(),
  prune(),
);

// Centrar en X/Z y apoyar la base en y = 0 (pose luxada, la estática del archivo)
const rotate = ([x, y, z], [qx, qy, qz, qw]) => {
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
};
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const [node, xf] of [[nodeRest, (v) => v], [nodeHum, (v) => rotate(v, luxado.r).map((c, k) => c + luxado.t[k])]]) {
  const acc = node.getMesh().listPrimitives()[0].getAttribute('POSITION');
  for (let i = 0, v = []; i < acc.getCount(); i++) {
    const w = xf(acc.getElement(i, v));
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
  }
}
const S = 0.001;
const RT = [-(mn[0] + mx[0]) / 2 * S, -mn[1] * S, -(mn[2] + mx[2]) / 2 * S];
nodeRoot.setTranslation(RT);
const toWorld = (p) => p.map((c, k) => RT[k] + S * c); // mm (espacio del hombro) → m (escena)

// ---------- utilidades vectoriales ----------
const sub = (a, b) => a.map((c, k) => c - b[k]);
const add = (a, b) => a.map((c, k) => c + b[k]);
const mul = (a, s) => a.map((c) => c * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const vtx = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];

// ---------- piezas: escápula (mayor no-húmero) y clavícula (siguiente) ----------
const bySize = [...comps.entries()].filter(([r]) => r !== humerusRoot).sort((a, b) => b[1].n - a[1].n);
const [scapRoot, clavRoot] = [bySize[0][0], bySize[1][0]];
const centroid = (r) => { const c = [0, 0, 0]; let n = 0; for (let v = 0; v < nV; v++) if (find(v) === r) { c[0] += pos[v * 3]; c[1] += pos[v * 3 + 1]; c[2] += pos[v * 3 + 2]; n++; } return mul(c, 1 / n); };
const nearestVertex = (r, p) => { let best = -1, bd = Infinity; for (let v = 0; v < nV; v++) if (find(v) === r) { const d = Math.hypot(...sub(vtx(v), p)); if (d < bd) { bd = d; best = v; } } return vtx(best); };

// ---------- glenoide: zona de la escápula en contacto con la cabeza humeral (pose normal) ----------
const headVerts = [], nearScap = [];
for (let v = 0; v < nV; v++) {
  const d = Math.hypot(...sub(vtx(v), pivot));
  if (find(v) === humerusRoot && pos[v * 3 + 1] > humMaxY - 45) headVerts.push(v);
  else if (find(v) === scapRoot && d < 45) nearScap.push(v);
}
let contact = [];
for (let th = 4; contact.length < 40 && th <= 20; th += 2) {
  contact = nearScap.filter((s) => headVerts.some((h) => Math.hypot(...sub(vtx(s), vtx(h))) < th));
}
const glen = mul(contact.reduce((a, v) => add(a, vtx(v)), [0, 0, 0]), 1 / contact.length);
const nAx = norm(sub(pivot, glen));                     // eje glenoide → cabeza (lateral)
const uAx = norm(sub([0, 1, 0], mul(nAx, nAx[1])));      // superior, en el plano glenoideo
const wAx = cross(nAx, uAx);
const dHead = Math.hypot(...sub(pivot, glen));

// ---------- cápsula articular: manguito con skinning (escápula ↔ húmero) ----------
// anillos: [distancia desde la glenoide (mm), radio sup-inf, radio ant-post, peso húmero]
const RINGS = [
  [-1, 21, 16, 0],
  [dHead * 0.45, 30, 27, 0.35],
  [dHead, 34, 31, 0.8],
  [dHead + 16, 28, 26, 1],
];
const SEG = 56;
const cP = [], cJ = [], cW = [], cI = [];
const ringPts = [];
for (const [d, ru, rw, wh] of RINGS) {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const p = add(add(glen, mul(nAx, d)), add(mul(uAx, Math.cos(a) * ru), mul(wAx, Math.sin(a) * rw)));
    pts.push(p);
    cP.push(...toWorld(p));
    cJ.push(0, 1, 0, 0);
    cW.push(1 - wh, wh, 0, 0);
  }
  ringPts.push(pts);
}
for (let r = 0; r < RINGS.length - 1; r++) {
  for (let i = 0; i < SEG; i++) {
    const a = r * SEG + i, b = r * SEG + ((i + 1) % SEG), c = a + SEG, d = b + SEG;
    cI.push(a, c, b, b, c, d);
  }
}
const capsMat = doc.createMaterial('capsula')
  .setBaseColorFactor([0.86, 0.1, 0.12, 0.62]) // color del archivo = estado luxado (visores sin JS)
  .setAlphaMode('BLEND').setDoubleSided(true).setRoughnessFactor(0.55).setMetallicFactor(0);
const capsPrim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(cP)).setBuffer(buffer))
  .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(cJ)).setBuffer(buffer))
  .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(cW)).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(cI)).setBuffer(buffer))
  .setMaterial(capsMat);
const jointGlen = doc.createNode('glenoide_joint');
nodeRoot.addChild(jointGlen);
// Matrices de enlace inversas (pose normal): inv(T(RT)·S(s)) y inv(T(RT)·S(s)·T(pivote))
const ibm = (p) => [1 / S, 0, 0, 0, 0, 1 / S, 0, 0, 0, 0, 1 / S, 0, -RT[0] / S - p[0], -RT[1] / S - p[1], -RT[2] / S - p[2], 1];
const skin = doc.createSkin('capsula_skin').addJoint(jointGlen).addJoint(nodeHum).setSkeleton(nodeRoot)
  .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(new Float32Array([...ibm([0, 0, 0]), ...ibm(pivot)])).setBuffer(buffer));
const capsNode = doc.createNode('capsula').setMesh(doc.createMesh('capsula').addPrimitive(capsPrim)).setSkin(skin);
scene.addChild(capsNode);
await doc.transform(normals({ overwrite: true }));

// ---------- etiquetas: datos para la página (src/js/hombro-data.json) ----------
const scapC = centroid(scapRoot);
const humShaft = []; // punto en la diáfisis del húmero (coordenadas locales del húmero, mm)
{
  const { minY, maxY } = comps.get(humerusRoot);
  const midY = minY + (maxY - minY) * 0.42;
  const c = [0, 0, 0]; let n = 0;
  for (let v = 0; v < nV; v++) if (find(v) === humerusRoot && Math.abs(pos[v * 3 + 1] - midY) < 4) { c[0] += pos[v * 3]; c[2] += pos[v * 3 + 2]; n++; }
  humShaft.push(...sub(nearestVertex(humerusRoot, [c[0] / n, midY, c[2] / n + 30]), pivot));
}
const mostAnterior = (pts) => pts.reduce((a, b) => (b[2] > a[2] ? b : a));
const data = {
  root: { t: RT, s: S },
  keys: { times: [0, 1, 2], t: [luxado.t, traccion.t, normal.t], r: [luxado.r, traccion.r, normal.r] },
  labels: {
    escapula: toWorld(nearestVertex(scapRoot, add(scapC, [-25, -65, 30]))),
    clavicula: toWorld(nearestVertex(clavRoot, add(centroid(clavRoot), [-45, 10, 25]))),
    glenoide: toWorld(glen),
    humeroLocal: humShaft,
    capsulaFija: toWorld(mostAnterior(ringPts[0])),
    capsulaHumeroLocal: sub(mostAnterior(ringPts[3]), pivot),
  },
};
writeFileSync('src/js/hombro-data.json', JSON.stringify(data, (k, v) => (typeof v === 'number' ? +v.toFixed(5) : v), 1));

material.setName('hueso').setBaseColorFactor([0.89, 0.85, 0.76, 1]).setRoughnessFactor(0.65).setMetallicFactor(0);

root.getAsset().generator = 'prepare-model.mjs (glTF-Transform)';
root.getAsset().copyright = 'NIH 3D 3DPX-000338 · CC0 1.0 · luxación simulada con fines didácticos';
await io.write(OUT, doc);

const verts = root.listAccessors().filter((a) => a.getType() === 'VEC3').reduce((s, a) => s + a.getCount(), 0);
console.log(`✓ ${OUT}  ${(statSync(OUT).size / 1e6).toFixed(2)} MB · ~${verts.toLocaleString()} valores VEC3`);
console.log(`  pivote cabeza humeral (mm): ${pivot.map((x) => x.toFixed(1)).join(', ')} · ${comps.size} piezas`);
