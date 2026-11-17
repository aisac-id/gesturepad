// GesturePad UI sounds — soft marimba-ish blips (distinct from the other apps).
"use strict";

let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

function tone(freq, dur, type = "triangle", gain = 0.06, when = 0) {
  if (!enabled) return;
  try {
    ctx = ctx || new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {}
}

export const sfx = {
  ui: () => tone(660, 0.07, "triangle", 0.035),
  ready: () => { tone(523, 0.1); tone(784, 0.14, "triangle", 0.05, 0.09); },
  fire: () => { tone(880, 0.09, "triangle", 0.06); tone(1318, 0.12, "sine", 0.045, 0.06); },
  swipe: () => { tone(440, 0.06, "sawtooth", 0.03); tone(880, 0.09, "sawtooth", 0.03, 0.05); },
  grab: () => tone(330, 0.1, "square", 0.03),
  error: () => { tone(220, 0.16, "sawtooth", 0.05); tone(180, 0.2, "sawtooth", 0.05, 0.1); },
};