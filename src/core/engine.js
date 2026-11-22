/**
 * engine.js
 * Renderer, stages (lighting + backdrops), post-processing chain, quality tiers, asset loaders.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const $ = id => document.getElementById(id);
export const URLQ = new URLSearchParams(location.search);
export const say = m => { const e = $('loadmsg'); if (e) e.textContent = m; };

// ---------- seeded RNG + tiny helpers ----------
export function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function canvasTex(c, srgb = true, rep) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t;
}

// ---------- renderer / scene / camera ----------
export const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
export const COARSE = matchMedia('(pointer:coarse)').matches;
export let QL = URLQ.get('q') || (COARSE ? 'med' : 'high');
export const prFor = q => q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'med' ? Math.min(devicePixelRatio, 1.5) : 1;
renderer.setPixelRatio(prFor(QL)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15121c); scene.fog = new THREE.Fog(0x15121c, 7, 16);
export const pm = new THREE.PMREMGenerator(renderer);
export const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .03, 60);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false; controls.minDistance = .35; controls.maxDistance = 9; controls.maxPolarAngle = 1.62;

// lights (shared; re-tuned per stage)
export const key = new THREE.DirectionalLight(0xffe2c0, 2.4); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 4, bottom: -2, near: 1, far: 14 }); key.shadow.bias = -.0005; key.shadow.normalBias = .02; scene.add(key);
export const rim = new THREE.DirectionalLight(0x7f9bff, 2.2); rim.position.set(-3, 3, -4); scene.add(rim);
export const fill = new THREE.DirectionalLight(0xffffff, 0); fill.position.set(-3, 1.5, 3); scene.add(fill);
export const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: .85, metalness: .05 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
export const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.7, 96), new THREE.MeshBasicMaterial({ color: 0x8a5a3a, side: 2 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .003; scene.add(ring);

export const gtex = (() => { const [c, g] = cvs(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(.3, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) })();
export const glow = (c, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.scale.setScalar(s); return m };
export const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: 0, ...o });
export const MP = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .5, metalness: 0, ...o });

// ---------- procedural HDR environments (PMREM) ----------
export function envScene(kind) {
  const s = new THREE.Scene();
  const dome = (top, bot) => s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,bot;varying vec3 p;void main(){float h=normalize(p).y*.5+.5;gl_FragColor=vec4(mix(bot,top,smoothstep(.1,.95,h)),1.);}'
  })));
  const panel = (w, h, pos, col, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: 2 })); m.position.set(...pos); m.lookAt(0, 1.3, 0); s.add(m); };
  if (kind === 'crypt') {
    dome(0x0c1512, 0x010202);
    panel(14, 6, [-9, 10, -12], 0xaec6ff, 7);           // cold moon, back-left
    panel(3, 9, [10, 3, 6], 0x4dff9a, 3.2);             // sickly green strip, front-right
    panel(4, 3, [-7, 1.2, 7], 0xff8a3a, 2.6);           // distant fire, low front-left
    panel(30, 30, [0, -3, 0], 0x1a2a22, .5);
  } else if (kind === 'studio') {
    dome(0x1d222b, 0x07080a);
    panel(8, 6, [-7, 7, 8], 0xfff0dc, 9);               // big warm key softbox
    panel(2.5, 12, [-11, 4, -7], 0x6fa8ff, 12);         // cold rim strips
    panel(2.5, 12, [11, 4, -7], 0x6fa8ff, 12);
    panel(12, 4, [8, 1.5, 9], 0xffd9a0, 2.4);           // gold bounce
    panel(30, 30, [0, -3, 0], 0x23262c, .9);
  } else if (kind === 'portrait') {
    dome(0x2b2d33, 0x0e0f12);
    panel(7, 7, [6, 7, 9], 0xfff4e8, 11);               // big soft key, front-right
    panel(6, 4, [-8, 2, 8], 0xdfe8ff, 3);               // fill
    panel(2, 10, [-8, 5, -10], 0xffffff, 12);           // rim strip
    panel(2, 10, [9, 5, -9], 0xffe0c0, 7);              // warm kicker
    panel(30, 30, [0, -3, 0], 0x2a2724, .8);
  }
  return s;
}
export const ENV = {};
export function getEnv(kind) {
  if (ENV[kind]) return ENV[kind];
  return ENV[kind] = kind === 'room' ? pm.fromScene(new RoomEnvironment(), .04).texture : pm.fromScene(envScene(kind), .02).texture;
}

// ---------- stages ----------
export const STAGES = {
  oni: { acc: '#ffb36b', accT: '#2a1a10', btnT: '#ffd9a8', btn: 'rgba(30,22,28,.78)', bg: 0x15121c, fog: [0x15121c, 7, 16], env: 'room', envI: .35, exposure: 1.05,
    key: { c: 0xffe2c0, i: 2.4, p: [3, 5, 4] }, rim: { c: 0x7f9bff, i: 2.2, p: [-3, 3, -4] }, fill: { c: 0xffffff, i: 0, p: [-3, 1.5, 3] },
    floor: { c: 0x2a2630, r: .85, m: .05 }, ring: 0x8a5a3a, bloom: [.18, .5, .9], grade: { sat: 1, con: 1.02, tint: [1, 1, 1], vig: .25, grain: .018, ca: .0012 } },
  undead: { acc: '#7dff9b', accT: '#06150b', btnT: '#bff5cb', btn: 'rgba(10,18,14,.8)', bg: 0x060908, bgGrad: ['#16251f', '#030504'], fog: [0x070b09, 7, 20], env: 'crypt', envI: 1.1, exposure: 1.3,
    key: { c: 0xbcd0ff, i: 3.6, p: [-2.6, 4.6, 4.2] }, rim: { c: 0x45ff95, i: 2.4, p: [3.5, 2.6, -3.2] }, fill: { c: 0xff9a55, i: .35, p: [-2.5, .9, 3.2] },
    floor: { c: 0x151a18, r: .72, m: .05 }, ring: 0x1f5a35, bloom: [.22, .6, .88], grade: { sat: .85, con: 1.1, tint: [.96, 1.02, .97], vig: .42, grain: .02, ca: .0018 } },
  heroes: { acc: '#6ec3ff', accT: '#041421', btnT: '#cfe9ff', btn: 'rgba(10,16,26,.8)', bg: 0x0a0d13, bgGrad: ['#1c2838', '#05070b'], fog: [0x0a0d13, 8, 20], env: 'studio', envI: .75, exposure: .9,
    key: { c: 0xfff0dc, i: 2.6, p: [-3, 5, 4.5] }, rim: { c: 0x6fa8ff, i: 3.2, p: [3, 3.5, -4] }, fill: { c: 0xffc680, i: .7, p: [3.5, 1.2, 3] },
    floor: { c: 0x14171d, r: .35, m: .45 }, ring: 0x2d6a9a, bloom: [.2, .6, .92], grade: { sat: 1.06, con: 1.08, tint: [1, 1, 1.02], vig: .38, grain: .022, ca: .0015 } },
  humans: { acc: '#f2d7c4', accT: '#241a14', btnT: '#f2e1d3', btn: 'rgba(26,24,24,.8)', bg: 0x16171a, bgGrad: ['#3a3d44', '#0c0d0f'], fog: [0x1a1b1e, 6, 14], env: 'portrait', envI: .95, exposure: 1.0,
    key: { c: 0xfff1e2, i: 2.2, p: [2.5, 3.2, 4] }, rim: { c: 0xffffff, i: 2.8, p: [-3, 3, -3.5] }, fill: { c: 0xdbe6ff, i: .45, p: [-3, 1.2, 3.5] },
    floor: { c: 0x1c1d20, r: .5, m: .1 }, ring: 0x555555, bloom: [.16, .5, .95], grade: { sat: 1.02, con: 1.05, tint: [1, 1, 1], vig: .32, grain: .02, ca: .001 } },
};
export function gradBG(inner, outer) {
  const [c, g] = cvs(512, 512), r = g.createRadialGradient(256, 210, 10, 256, 256, 420); r.addColorStop(0, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export let stageName = 'oni';
export function setStage(n) {
  const S = STAGES[n]; stageName = n;
  if (S.bgGrad) scene.background = gradBG(...S.bgGrad); else scene.background = new THREE.Color(S.bg); scene.fog.color.set(S.fog[0]); scene.fog.near = S.fog[1]; scene.fog.far = S.fog[2];
  scene.environment = getEnv(S.env); scene.environmentIntensity = S.envI; renderer.toneMappingExposure = S.exposure;
  for (const [L, d] of [[key, S.key], [rim, S.rim], [fill, S.fill]]) { L.color.set(d.c); L.intensity = d.i; L.position.set(...d.p); }
  floor.material.color.set(S.floor.c); floor.material.roughness = S.floor.r; floor.material.metalness = S.floor.m; ring.material.color.set(S.ring);
  const st = document.documentElement.style; st.setProperty('--acc', S.acc); st.setProperty('--accT', S.accT); st.setProperty('--btn', S.btn); st.setProperty('--btnT', S.btnT);
  document.body.style.background = '#' + S.bg.toString(16).padStart(6, '0');
  applyPost();
}

// ---------- post-processing ----------
export const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: .3 }, uGrain: { value: .02 }, uCA: { value: .001 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uSat,uCon,uVig,uGrain,uCA,uTime;uniform vec3 uTint;uniform vec2 uRes;varying vec2 vUv;
  float h(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
  void main(){vec2 d=vUv-.5;float r2=dot(d,d);
    vec3 c=vec3(texture2D(tDiffuse,vUv+d*uCA*r2*8.).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*uCA*r2*8.).b);
    float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);c=(c-.18)*uCon+.18;c=max(c,0.)*uTint;
    c*=1.-uVig*smoothstep(.2,.95,length(d)*1.35);
    float g=h(vUv*uRes+fract(uTime)*91.7)-.5;c+=g*uGrain*(.35+.65*(1.-clamp(l,0.,1.)));
    gl_FragColor=vec4(max(c,0.),1.);}`
};
export let composer = null, P = {};
export function buildComposer() {
  if (composer) { composer.dispose?.(); composer = null; P = {} }
  if (QL === 'low') return;
  const pr = renderer.getPixelRatio(), w = innerWidth, h = innerHeight;
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: QL === 'high' ? 4 : 2 });
  composer = new EffectComposer(renderer, rt); composer.setPixelRatio(pr); composer.setSize(w, h);
  P.render = new RenderPass(scene, camera); composer.addPass(P.render);
  if (QL === 'high') {
    P.ao = new GTAOPass(scene, camera, w, h);
    P.ao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 14, distanceFallOff: 1 });
    P.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    P.ao.blendIntensity = .85; composer.addPass(P.ao);
  }
  P.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .25, .6, .85); composer.addPass(P.bloom);
  P.grade = new ShaderPass(GRADE); composer.addPass(P.grade);
  composer.addPass(new OutputPass());
  applyPost();
}
export function applyPost() {
  const S = STAGES[stageName]; if (!composer) return;
  P.bloom.strength = S.bloom[0]; P.bloom.radius = S.bloom[1]; P.bloom.threshold = S.bloom[2];
  const u = P.grade.uniforms, g = S.grade; u.uSat.value = g.sat; u.uCon.value = g.con; u.uTint.value.set(...g.tint); u.uVig.value = g.vig; u.uGrain.value = g.grain; u.uCA.value = g.ca;
}
export function setQuality(q) {
  QL = q; renderer.setPixelRatio(prFor(q)); renderer.setSize(innerWidth, innerHeight); buildComposer();
  $('q').textContent = 'Quality: ' + { low: 'Fast', med: 'Balanced', high: 'Cinematic' }[q];
}

// ---------- asset loading (real files under /public/models; ids kept from the prototype) ----------
export const ASSETS = {
  d_soldier: 'models/soldier.glb', d_xbot: 'models/xbot.glb', d_michelle: 'models/michelle.glb',
  d_head: 'models/head/head.glb', d_head_col: 'models/head/col.jpg', d_head_nrm: 'models/head/nrm.jpg', d_head_spc: 'models/head/spc.jpg',
};
export const assetUrl = id => import.meta.env.BASE_URL + ASSETS[id];
export const loader = new GLTFLoader();
export const bufCache = {};
export async function bufOf(id) { return (bufCache[id] ||= fetch(assetUrl(id)).then(r => { if (!r.ok) throw new Error('missing asset ' + ASSETS[id]); return r.arrayBuffer() })) }
export async function glbOf(id) { return loader.parseAsync((await bufOf(id)).slice(0), '') }
export function imgTex(id, { srgb = true, flipY = true } = {}) {
  return new Promise((res, rej) => { const t = new THREE.TextureLoader().load(assetUrl(id), () => res(t), undefined, rej); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = flipY });
}
