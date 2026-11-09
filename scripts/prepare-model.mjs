/**
 * Prepara el modelo 3D para web y RA:  npm run model
 *
 * Fuente: NIH 3D · "Shoulder Fracture - Superior Glenoid Fracture" (3DPX-000338, v3)
 *         https://3d.nih.gov/entries/338 · Licencia CC0 1.0 (dominio público)
 *
 *  1. Une vértices, simplifica la malla y recalcula normales suaves (carga rápida en celulares)
 *  2. Convierte milímetros → metros (en RA aparece a escala real, ~29 cm)
 *  3. Lo apoya sobre el suelo/mesa (base en y = 0) y lo centra
 *  4. Material color hueso
 */
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, center, prune, dedup, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const SRC = 'models-src/hombro-fractura-glenoidea-nih-338.glb';
const OUT = 'src/public/models/hombro.glb';
const RATIO = parseFloat(process.env.RATIO || '0.12'); // fracción de vértices a conservar

const io = new NodeIO();
const doc = await io.read(SRC);
const root = doc.getRoot();

// Las normales vienen por cara: se eliminan para poder unir vértices y se recalculan al final
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);

await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: parseFloat(process.env.ERROR || '0.002') }),
  normals({ overwrite: true }),
  dedup(),
  prune(),
);

// mm → m
for (const node of root.listScenes()[0].listChildren()) {
  const s = node.getScale();
  node.setScale([s[0] * 0.001, s[1] * 0.001, s[2] * 0.001]);
}
await doc.transform(center({ pivot: 'below' }));

// Material color hueso
for (const mat of root.listMaterials()) {
  mat.setName('hueso');
  mat.setBaseColorFactor([0.89, 0.85, 0.76, 1]);
  mat.setRoughnessFactor(0.65);
  mat.setMetallicFactor(0);
}

root.getAsset().generator = 'prepare-model.mjs (glTF-Transform)';
root.getAsset().copyright = 'NIH 3D 3DPX-000338 · CC0 1.0';
await io.write(OUT, doc);

const verts = root.listAccessors().filter((a) => a.getType() === 'VEC3').reduce((m, a) => Math.max(m, a.getCount()), 0);
console.log(`✓ ${OUT}  ${(statSync(OUT).size / 1e6).toFixed(2)} MB · ~${verts.toLocaleString()} vértices`);
