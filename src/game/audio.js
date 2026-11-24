/**
 * audio.js
 * Procedural sound (Web Audio, no files): gunshots with a slap-back echo off the buildings, mechanical clicks, impacts.
 * The AudioContext only starts after the first key press or click (a browser rule), so everything is a no-op until then.
 * These are placeholders: recorded Ghana ambience and real weapon samples replace them later (docs/REALISM.md).
 */
export function createAudio() {
  let ctx = null, master = null, echo = null, noise = null;
  const ensure = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC() } catch { return null }
    const comp = ctx.createDynamicsCompressor(); master = ctx.createGain(); master.gain.value = .8; master.connect(comp); comp.connect(ctx.destination);
    const d = ctx.createDelay(1); d.delayTime.value = .19;
    const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
    fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 1500; wet.gain.value = .32;
    echo = ctx.createGain(); echo.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(master);
    const n = ctx.sampleRate; noise = ctx.createBuffer(1, n, ctx.sampleRate); const ch = noise.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    return ctx;
  };
  /** a burst of filtered noise: freq sweeps from f0 to f1 over `len` seconds */
  const burst = (t, f0, f1, len, vol, type = 'lowpass', send = 0) => {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
    s.connect(f); f.connect(g); g.connect(master); if (send) { const e = ctx.createGain(); e.gain.value = send; g.connect(e); e.connect(echo) }
    s.start(t, Math.random() * .5); s.stop(t + len + .05);
  };
  const tone = (t, f0, f1, len, vol, type = 'sine', send = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
    o.connect(g); g.connect(master); if (send) { const e = ctx.createGain(); e.gain.value = send; g.connect(e); e.connect(echo) }
    o.start(t); o.stop(t + len + .05);
  };
  return {
    resume: ensure,
    shot(kind = 'pistol', vol = 1) {
      if (!ensure()) return; const t = ctx.currentTime;
      if (kind === 'dane') { burst(t, 2600, 180, .55, 1.1 * vol, 'lowpass', .8); tone(t, 95, 28, .3, .9 * vol, 'sine', .5); burst(t, 900, 120, .9, .35 * vol, 'lowpass', .6) }
      else if (kind === 'rifle') { burst(t, 6500, 260, .3, .95 * vol, 'lowpass', .7); tone(t, 140, 40, .16, .8 * vol, 'sine', .4); burst(t, 3200, 900, .05, .4 * vol, 'bandpass') }
      else { burst(t, 5200, 300, .24, .85 * vol, 'lowpass', .6); tone(t, 170, 45, .13, .7 * vol, 'sine', .3); burst(t, 3800, 1200, .04, .35 * vol, 'bandpass') }
    },
    click(kind = 'mag') {
      if (!ensure()) return; const t = ctx.currentTime;
      if (kind === 'empty') { tone(t, 1900, 900, .03, .35, 'square'); burst(t, 4000, 2000, .03, .25, 'highpass') }
      else if (kind === 'slide') { burst(t, 3000, 1200, .09, .3, 'bandpass'); tone(t + .05, 900, 500, .05, .22, 'square') }
      else { tone(t, 1300, 700, .05, .3, 'square'); burst(t, 2600, 1200, .06, .25, 'bandpass') }
    },
    impact(kind = 'world', dist = 10) {
      if (!ensure()) return; const t = ctx.currentTime + Math.min(.25, dist / 340), v = Math.max(.12, 1 - dist / 140);
      if (kind === 'plate') { tone(t, 1750, 1500, .5, .5 * v, 'sine', .3); tone(t, 2900, 2600, .35, .22 * v, 'sine'); burst(t, 5000, 1500, .05, .3 * v, 'highpass') }
      else if (kind === 'drum') { tone(t, 220, 140, .35, .5 * v, 'triangle'); burst(t, 2800, 400, .12, .4 * v) }
      else if (kind === 'wood') { burst(t, 1800, 300, .1, .6 * v); tone(t, 260, 120, .07, .3 * v, 'triangle') }
      else if (kind === 'dummy') { burst(t, 1500, 250, .1, .5 * v); tone(t, 150, 70, .1, .3 * v) }
      else { burst(t, 2400, 200, .13, .45 * v); tone(t, 120, 60, .08, .2 * v) }
    },
    dispose() { try { ctx && ctx.close() } catch { /* already closed */ } ctx = null },
  };
}
