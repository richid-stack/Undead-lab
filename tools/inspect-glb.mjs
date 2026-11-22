// Print animations, skins, meshes, materials and textures of one or more GLB files.
//   npm run inspect -- public/models/Soldier.glb
// Handles Draco- and Meshopt-compressed files.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: npm run inspect -- <file.glb> [more.glb]'); process.exit(1); }

for (const f of files) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  console.log('\n=====', f);
  console.log('anims:', root.listAnimations().map(a => a.getName()).join(', ') || 'none',
    '| skins:', root.listSkins().length, '| joints:', root.listSkins()[0]?.listJoints().length ?? 0);
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    console.log(' mesh', m.getName().padEnd(26), 'verts', String(p.getAttribute('POSITION').getCount()).padStart(6),
      'mat', (p.getMaterial()?.getName() || '-').padEnd(22), 'morphs', p.listTargets().length);
  }
  for (const m of root.listMaterials()) {
    const t = (n, x) => (x ? `${n}[${x.getName() || x.getURI() || 'img'}]` : '');
    console.log(' material', m.getName().padEnd(22), 'base', m.getBaseColorFactor().map(v => +v.toFixed(2)).join(','),
      t('map', m.getBaseColorTexture()), t('nrm', m.getNormalTexture()), t('mr', m.getMetallicRoughnessTexture()),
      t('em', m.getEmissiveTexture()), 'alpha', m.getAlphaMode());
  }
  for (const t of root.listTextures()) {
    const img = t.getImage(); let res = '?';
    try { const md = await sharp(Buffer.from(img)).metadata(); res = `${md.width}x${md.height}`; } catch { /* ignore */ }
    console.log(' tex', (t.getName() || t.getURI() || '').padEnd(30), t.getMimeType(), res, `${(img.byteLength / 1024) | 0}KB`);
  }
}
