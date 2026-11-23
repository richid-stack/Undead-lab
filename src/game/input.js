/**
 * input.js
 * Keyboard + mouse (drag, or pointer-lock) + touch (virtual stick on the left, look-drag on the right, jump button).
 * Exposes a tiny polling API so the controller never touches DOM events.
 */
const KEYS = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
};

export class Input {
  constructor(canvas, hudParent, { touch = false } = {}) {
    this.canvas = canvas; this.down = new Set(); this.jumpQueued = false; this.stick = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.zoomD = 0;
    this.touch = touch; this.dragging = false; this.ids = { stick: null, look: null }; this.bound = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this.bound.push([t, ev, fn, o]) };
    on(window, 'keydown', e => { const k = KEYS[e.code]; if (!k) return; e.preventDefault(); if (k === 'jump' && !this.down.has('jump')) this.jumpQueued = true; this.down.add(k) });
    on(window, 'keyup', e => { const k = KEYS[e.code]; if (k) this.down.delete(k) });
    on(window, 'blur', () => { this.down.clear(); this.stick.x = this.stick.y = 0 });
    on(canvas, 'wheel', e => { e.preventDefault(); this.zoomD += Math.sign(e.deltaY) }, { passive: false });
    on(canvas, 'contextmenu', e => e.preventDefault());
    on(canvas, 'pointerdown', e => {
      if (e.pointerType === 'mouse') { this.dragging = true; canvas.setPointerCapture?.(e.pointerId); try { canvas.requestPointerLock?.()?.catch?.(() => {}) } catch { /* not allowed here: drag-to-look still works */ } return }
      if (!this.touch) return;
      const left = e.clientX < innerWidth * .45;
      if (left && this.ids.stick === null) { this.ids.stick = e.pointerId; this.so = { x: e.clientX, y: e.clientY }; this.showStick(e.clientX, e.clientY) }
      else if (!left && this.ids.look === null) { this.ids.look = e.pointerId; this.lp = { x: e.clientX, y: e.clientY } }
      canvas.setPointerCapture?.(e.pointerId);
    });
    on(canvas, 'pointermove', e => {
      if (e.pointerType === 'mouse') { if (this.dragging || document.pointerLockElement === canvas) { this.look.x += e.movementX; this.look.y += e.movementY } return }
      if (e.pointerId === this.ids.stick) {
        const R = 54, dx = e.clientX - this.so.x, dy = e.clientY - this.so.y, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / R);
        this.stick.x = dx / l * k; this.stick.y = -dy / l * k; this.moveKnob(dx / l * Math.min(l, R), dy / l * Math.min(l, R));
      } else if (e.pointerId === this.ids.look) { this.look.x += (e.clientX - this.lp.x) * 1.4; this.look.y += (e.clientY - this.lp.y) * 1.4; this.lp = { x: e.clientX, y: e.clientY } }
    });
    const up = e => {
      if (e.pointerType === 'mouse') { this.dragging = false; return }
      if (e.pointerId === this.ids.stick) { this.ids.stick = null; this.stick.x = this.stick.y = 0; this.hideStick() }
      if (e.pointerId === this.ids.look) this.ids.look = null;
    };
    on(canvas, 'pointerup', up); on(canvas, 'pointercancel', up);
    if (touch) this.buildTouchUI(hudParent);
  }
  buildTouchUI(parent) {
    const base = this.base = document.createElement('div'); base.className = 'joy'; const knob = this.knob = document.createElement('div'); knob.className = 'knob'; base.appendChild(knob); base.style.display = 'none';
    const jump = this.jumpBtn = document.createElement('button'); jump.id = 'jump'; jump.textContent = 'JUMP';
    jump.addEventListener('pointerdown', e => { e.stopPropagation(); this.jumpQueued = true });
    const run = this.runBtn = document.createElement('button'); run.id = 'runbtn'; run.textContent = 'RUN';
    run.addEventListener('pointerdown', e => { e.stopPropagation(); this.runToggle = !this.runToggle; run.classList.toggle('on', this.runToggle) });
    parent.append(base, jump, run);
  }
  showStick(x, y) { if (!this.base) return; this.base.style.display = 'block'; this.base.style.left = x - 60 + 'px'; this.base.style.top = y - 60 + 'px'; this.moveKnob(0, 0) }
  moveKnob(x, y) { if (this.knob) this.knob.style.transform = `translate(${x}px,${y}px)` }
  hideStick() { if (this.base) this.base.style.display = 'none' }
  /** { x: right+, z: forward+, mag 0..1, run } */
  move() {
    let x = (this.down.has('r') ? 1 : 0) - (this.down.has('l') ? 1 : 0), z = (this.down.has('f') ? 1 : 0) - (this.down.has('b') ? 1 : 0), mag = 0, run = this.down.has('run');
    if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; mag = 1 }
    else if (this.stick.x || this.stick.y) { x = this.stick.x; z = this.stick.y; mag = Math.min(1, Math.hypot(x, z)); const l = Math.hypot(x, z); x /= l; z /= l; run = mag > .72 || !!this.runToggle }
    return { x, z, mag, run };
  }
  takeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j }
  takeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = this.look.y = 0; return l }
  takeZoom() { const z = this.zoomD; this.zoomD = 0; return z }
  dispose() {
    for (const [t, ev, fn, o] of this.bound) t.removeEventListener(ev, fn, o);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.base?.remove(); this.jumpBtn?.remove(); this.runBtn?.remove();
  }
}
