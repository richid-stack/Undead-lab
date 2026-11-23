/**
 * textures.js
 * Procedural surface textures for the test street (asphalt, laterite, concrete, stucco, corrugated iron, signs, sky).
 * All are tiled in world metres: each tile comment says how many metres one repeat covers.
 */
import * as THREE from 'three';
import { rng, cvs, canvasTex } from '../core/engine.js';

const cache = {};
const once = (k, f) => (cache[k] ||= f());

function speckle(g, W, H, R, n, size, cols) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect(R() * W, R() * H, 1 + R() * size, 1 + R() * size) }
}
function blobs(g, W, H, R, n, r0, r1, cols, a0, a1) {
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, r = r0 + R() * (r1 - r0), c = cols[(R() * cols.length) | 0], gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c + Math.round((a0 + R() * (a1 - a0)) * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
const withBump = (c, srgb = true, rep) => { const map = canvasTex(c, srgb, rep || [1, 1]); return map };

// 8 m x 8 m tile. u runs along the road, v across it (road is exactly one tile wide).
export function asphalt() {
  return once('asphalt', () => {
    const [c, g] = cvs(512, 512), R = rng(5);
    g.fillStyle = '#3b3b3e'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, R, 90, 20, 90, ['#2c2c2f', '#46464a', '#34343a'], .25, .55);
    for (const v of [.27, .73]) { const gr = g.createLinearGradient(0, (v - .09) * 512, 0, (v + .09) * 512); gr.addColorStop(0, 'rgba(70,70,76,0)'); gr.addColorStop(.5, 'rgba(70,70,76,.5)'); gr.addColorStop(1, 'rgba(70,70,76,0)'); g.fillStyle = gr; g.fillRect(0, (v - .09) * 512, 512, .18 * 512) }
    speckle(g, 512, 512, R, 6500, 2, ['#4a4a4d', '#222224', '#58585c', '#2a2a2c']);
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(10,10,12,${.35 + R() * .3})`; g.lineWidth = .7 + R() * 1.4; g.beginPath(); let x = R() * 512, y = R() * 512; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - .4) * 50; y += (R() - .5) * 40; g.lineTo(x, y) } g.stroke() }
    for (let i = 0; i < 2; i++) { const x = R() * 512, y = 60 + R() * 390, rx = 10 + R() * 16, ry = 7 + R() * 10; g.fillStyle = '#4a4a4d'; g.beginPath(); g.ellipse(x, y, rx + 4, ry + 4, 0, 0, 6.283); g.fill(); g.fillStyle = '#17171a'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill() }
    g.fillStyle = 'rgba(232,226,200,.78)';                                                       // faded centre dashes (3 m on, 5 m off)
    for (let i = 0; i < 1; i++) g.fillRect(40, 256 - 4, 192, 8);
    g.fillStyle = 'rgba(232,226,200,.42)'; g.fillRect(0, 14, 512, 5); g.fillRect(0, 493, 512, 5);  // worn edge lines
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(40,40,44,${.2 + R() * .4})`; g.fillRect(R() * 512, 250 + R() * 12 - 6, 1 + R() * 3, 1 + R() * 3) }
    return withBump(c);
  });
}
// 4 m tile. Red-brown laterite earth.
export function laterite() {
  return once('laterite', () => {
    const [c, g] = cvs(512, 512), R = rng(9);
    g.fillStyle = '#9b4d2e'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, R, 140, 25, 110, ['#b65f36', '#7d3a22', '#c47441', '#8a4529', '#a65a33'], .25, .6);
    speckle(g, 512, 512, R, 6000, 3, ['#b8805a', '#5e2b19', '#a96f4c', '#86411f', '#c79068']);
    for (let i = 0; i < 90; i++) { const x = R() * 512, y = R() * 512, r = 1.5 + R() * 3.5; g.fillStyle = ['#c9a27c', '#8f5a3a', '#6d3a24'][(R() * 3) | 0]; g.beginPath(); g.ellipse(x, y, r * 1.3, r, R() * 3, 0, 6.283); g.fill() }
    return withBump(c);
  });
}
// 2 m tile. Cast concrete slabs with joints.
export function concrete() {
  return once('concrete', () => {
    const [c, g] = cvs(512, 512), R = rng(13);
    g.fillStyle = '#b4b0a6'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, R, 80, 30, 120, ['#9e9a90', '#c4c0b6', '#8e8a80', '#a89f90'], .15, .4);
    speckle(g, 512, 512, R, 6000, 2, ['#d4d0c6', '#777268', '#c0bbb0']);
    g.strokeStyle = 'rgba(40,38,34,.65)'; g.lineWidth = 3; g.strokeRect(1, 1, 510, 510); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
    blobs(g, 512, 512, R, 10, 40, 90, ['#4d5a3a', '#3a3328'], .15, .3);
    return withBump(c);
  });
}
// 3 m tile. Neutral, light stucco; tint with material.color to get any paint colour. Dirt collects at the bottom of each tile.
export function stucco() {
  return once('stucco', () => {
    const [c, g] = cvs(512, 512), R = rng(17);
    g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, R, 70, 30, 110, ['#e2dccd', '#fffaf0', '#d6cebc'], .2, .5);
    speckle(g, 512, 512, R, 5000, 2, ['#cfc7b4', '#ffffff', '#bdb5a2']);
    for (let i = 0; i < 46; i++) { const x = R() * 512, w = 2 + R() * 9, h = 60 + R() * 330, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(70,56,40,.0)'); gr.addColorStop(.3, `rgba(70,56,40,${.08 + R() * .1})`); gr.addColorStop(1, 'rgba(70,56,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, h) }
    const dg = g.createLinearGradient(0, 380, 0, 512); dg.addColorStop(0, 'rgba(110,70,45,0)'); dg.addColorStop(1, 'rgba(110,70,45,.45)'); g.fillStyle = dg; g.fillRect(0, 380, 512, 132);
    blobs(g, 512, 512, R, 9, 30, 90, ['#8a7a66', '#6e5f50'], .08, .22);
    return withBump(c);
  });
}
// 4 m tile. Leaf clusters on transparent ground (alpha-tested foliage cards).
export function foliage() {
  return once('foliage', () => {
    const [c, g] = cvs(256, 256), R = rng(41), greens = ['#2f5a24', '#3f6e2b', '#547f32', '#6b9440', '#27491d'];
    for (let k = 0; k < 150; k++) {
      const cx = 128 + (R() - .5) * 190, cy = 128 + (R() - .5) * 190, d = Math.hypot(cx - 128, cy - 128); if (d > 112) continue;
      const a0 = R() * 6.283, col = greens[(R() * greens.length) | 0];
      for (let l = 0; l < 6; l++) { const a = a0 + l * 1.05 + R() * .3, len = 16 + R() * 12; g.fillStyle = col; g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.ellipse(len * .5, 0, len * .5, 4.2 + R() * 2, 0, 0, 6.283); g.fill(); g.restore() }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  });
}
// 1.5 m x 1.5 m. Rusty corrugated sheet (ribs run along v).
export function corrugated() {
  return once('corr', () => {
    const [c, g] = cvs(256, 256), R = rng(21);
    g.fillStyle = '#8d8b88'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(x, 0, 32, 256) }
    blobs(g, 256, 256, R, 40, 10, 50, ['#8a3f1c', '#a8532a', '#5b2a14', '#6b6a68'], .25, .6);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(60,30,15,${R() * .25})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 5, 1 + R() * 14) }
    return withBump(c);
  });
}
// Roller-shutter (ribs run along u).
export function shutter() {
  return once('shutter', () => {
    const [c, g] = cvs(128, 256), R = rng(23);
    g.fillStyle = '#6e7378'; g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 8) { const gr = g.createLinearGradient(0, y, 0, y + 8); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = gr; g.fillRect(0, y, 128, 8) }
    blobs(g, 128, 256, R, 20, 10, 40, ['#7a3a1a', '#3a3f44'], .15, .4);
    return withBump(c);
  });
}
/** Painted signboard; returns a canvas texture (one per distinct text). */
export function sign(text, bg, fg, sub = '') {
  const [c, g] = cvs(512, 128), R = rng(text.length * 7 + 3);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  blobs(g, 512, 128, R, 20, 10, 60, ['#000000', '#ffffff'], .05, .18);
  g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${text.length > 12 ? 50 : 62}px 'Arial Black', Impact, sans-serif`; g.fillText(text, 256, sub ? 54 : 66, 480);
  if (sub) { g.font = "bold 24px Arial, sans-serif"; g.fillText(sub, 256, 100, 470) }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${R() * .25})`; g.fillRect(R() * 512, R() * 128, 1 + R() * 3, 1 + R() * 3) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** Equirect evening sky. */
export function sky() {
  const [c, g] = cvs(1024, 512), R = rng(31);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#1f3358'); gr.addColorStop(.22, '#3d5b8e'); gr.addColorStop(.38, '#8d93b4'); gr.addColorStop(.46, '#f0b98a'); gr.addColorStop(.5, '#f6cf9b'); gr.addColorStop(.52, '#a9795a'); gr.addColorStop(1, '#4a3328');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 46; i++) { const x = R() * 1024, y = 90 + R() * 150, w = 80 + R() * 220, h = 6 + R() * 14, a = .05 + R() * .12; g.fillStyle = `rgba(${R() < .5 ? '255,214,180' : '210,200,225'},${a})`; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 6.283); g.fill() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
