/**
 * materials.js
 * Physically based gun materials made without image files:
 *  - steel(): parkerized / blued / bare steel. A shader patch finds edges from how fast the surface normal turns per
 *    metre (so bevels and corners wear through to bare metal), adds patchy wear, oily grime and micro-grain roughness.
 *  - polymer(): stippled plastic / bakelite using a canvas bump map.
 *  - wood(): grained, varnished or raw wood from a canvas texture.
 *  - brass(), cloth(), matte().
 * Every texture is generated here, so the models stay under 100 kB of code and download nothing.
 */
import * as THREE from 'three';
import { cvs, rng } from '../core/engine.js';

const NOISE = `
float gh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625;}
`;

/**
 * Steel with edge wear. opts: color (finish colour), rough, wear 0..1 (how much bare metal shows on edges),
 * grime 0..1 (oil / dirt in the open areas), seed (moves the noise so parts do not all wear identically), bare (colour of worn metal).
 */
export function steel({ color = 0x25282c, rough = .45, wear = .5, grime = .25, seed = 1, metal = .92, bare = 0xd2d4d8, env = 1.25 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: metal, roughness: rough, envMapIntensity: env, clearcoat: 0 });
  const bareC = new THREE.Color(bare);
  m.onBeforeCompile = sh => {
    sh.uniforms.uWear = { value: wear }; sh.uniforms.uGrime = { value: grime }; sh.uniforms.uSeed = { value: seed * 7.31 }; sh.uniforms.uBare = { value: new THREE.Vector3(bareC.r, bareC.g, bareC.b) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uWear,uGrime,uSeed;uniform vec3 uBare;varying vec3 vGP;\n${NOISE}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      {
        vec3 gp=vGP+uSeed;
        float grain=fbm(gp*240.);
        float curv=length(fwidth(normalize(vNormal)))/(length(fwidth(vGP))+1e-7);
        float edge=smoothstep(110.,420.,curv);
        float blotch=smoothstep(.30,.72,fbm(gp*34.+3.7));
        float w=clamp(edge*(.28+1.15*blotch)*uWear+uWear*.10*smoothstep(.72,.92,fbm(gp*95.)),0.,1.);
        float dirt=smoothstep(.42,.82,fbm(gp*21.+9.1))*uGrime;
        float scratch=smoothstep(.86,.97,fbm(vec3(gp.x*480.,gp.y*14.,gp.z*14.)))*uWear*.7;
        diffuseColor.rgb=mix(diffuseColor.rgb,uBare,clamp(w+scratch*.5,0.,1.));
        roughnessFactor=mix(roughnessFactor+(grain-.5)*.2,.3,clamp(w+scratch*.5,0.,1.));
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.55,.5,.42),dirt*(1.-w));
        roughnessFactor=clamp(mix(roughnessFactor,.88,dirt*(1.-w)*.55),.18,1.);
      }`);
  };
  m.customProgramCacheKey = () => 'gunsteel';
  return m;
}

/** a coarse speckle used as a bump map (stipple) or roughness break-up */
function speckle(size, n, seed, dots = true) {
  const R = rng(seed), [c, g] = cvs(size, size); g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { const v = R() < .5 ? 20 + R() * 60 : 190 + R() * 60; g.fillStyle = `rgb(${v},${v},${v})`; const r = dots ? .6 + R() * 1.1 : .5; g.beginPath(); g.arc(R() * size, R() * size, r, 0, 6.283); g.fill() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
let _stip = null;
export function polymer({ color = 0x1b1c1f, rough = .62, bump = 1.6 } = {}) {
  _stip ||= speckle(256, 2600, 5);
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: .02, bumpMap: _stip, bumpScale: bump, clearcoat: .08, clearcoatRoughness: .5, envMapIntensity: .9 });
}

/** wood texture: grain runs along the u axis. tone = base colour, dark = grain colour, figure 0..1 = how wavy */
export function woodTexture(tone = '#8a4b22', dark = '#3a1b0a', seed = 3, figure = .5) {
  const R = rng(seed), W = 512, H = 256, [c, g] = cvs(W, H);
  g.fillStyle = tone; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,220,170,${R() * .05})`; g.fillRect(0, R() * H, W, 2 + R() * 10) }
  for (let i = 0; i < 300; i++) {
    const y0 = R() * H, a = .04 + R() * .13, amp = figure * (2 + R() * 9), fr = .005 + R() * .02, ph = R() * 6.28;
    g.strokeStyle = dark; g.globalAlpha = a; g.lineWidth = .4 + R() * 1.4; g.beginPath();
    for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * fr + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y) }
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let k = 0; k < 2; k++) { const kx = R() * W, ky = R() * H; for (let r = 4; r < 26; r += 3) { g.globalAlpha = .08; g.strokeStyle = dark; g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, r * 2.3, r * .8, 0, 0, 6.283); g.stroke() } }
  g.globalAlpha = 1;
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(20,8,0,${R() * .35})`; g.fillRect(R() * W, R() * H, 1 + R() * 5, 1) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
export function wood({ tone = '#8a4b22', dark = '#3a1b0a', seed = 3, figure = .5, rough = .5, varnish = .5, wearTint = 1 } = {}) {
  const map = woodTexture(tone, dark, seed, figure);
  return new THREE.MeshPhysicalMaterial({ map, roughness: rough, metalness: 0, clearcoat: varnish, clearcoatRoughness: .28, bumpMap: map, bumpScale: .35 * wearTint, envMapIntensity: .8 });
}
export const brass = (rough = .3) => new THREE.MeshPhysicalMaterial({ color: 0xb48a3c, metalness: 1, roughness: rough, envMapIntensity: 1.3 });
export const cloth = (color = 0x9b1c1c) => new THREE.MeshStandardMaterial({ color, roughness: .95, metalness: 0 });
export const matte = (color = 0x050505, rough = .9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
export const paint = (color = 0xf2f2ee, rough = .5) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

/** box-project UVs onto a geometry so image textures work on extruded shapes. Grain runs along z (u). `scale` = metres per texture repeat */
export function boxUV(geo, scale = .3) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v; if (nx >= ny && nx >= nz) { u = p.getZ(i); v = p.getY(i) } else if (ny >= nz) { u = p.getZ(i); v = p.getX(i) } else { u = p.getX(i); v = p.getY(i) }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale * 2;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
