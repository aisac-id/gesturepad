// GesturePad demo source — procedurally generated 21-point hand landmarks
// with ground-truth gesture labels. Feeds the SAME recognition pipeline as
// the webcam, so the demo is an honest end-to-end test, not a canned UI.
"use strict";

// Build a plausible right hand (palm to camera, fingers up) at wrist x = wx.
// pose: OPEN_PALM | FIST | POINT | PEACE | THUMBS_UP | PINCH
export function makeHand(wx, pose) {
  const wy = 0.80;
  const lm = new Array(21);
  lm[0] = { x: wx, y: wy, z: 0 };

  const knuckles = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, kx: wx - 0.09, fan: -0.030 },  // index
    { mcp: 9, pip: 10, dip: 11, tip: 12, kx: wx - 0.03, fan: -0.010 }, // middle
    { mcp: 13, pip: 14, dip: 15, tip: 16, kx: wx + 0.03, fan: 0.010 }, // ring
    { mcp: 17, pip: 18, dip: 19, tip: 20, kx: wx + 0.09, fan: 0.030 }, // pinky
  ];
  const extended = {
    OPEN_PALM: [1, 1, 1, 1],
    FIST: [0, 0, 0, 0],
    POINT: [1, 0, 0, 0],
    PEACE: [1, 1, 0, 0],
    THUMBS_UP: [0, 0, 0, 0],
    PINCH: [0, 0, 0, 0],
  }[pose] || [0, 0, 0, 0];

  knuckles.forEach((f, i) => {
    lm[f.mcp] = { x: f.kx, y: 0.55, z: 0 };
    if (extended[i]) {
      lm[f.pip] = { x: f.kx + f.fan * 0.4, y: 0.44, z: 0 };
      lm[f.dip] = { x: f.kx + f.fan * 0.7, y: 0.36, z: 0 };
      lm[f.tip] = { x: f.kx + f.fan, y: 0.28, z: 0 };
    } else {
      lm[f.pip] = { x: f.kx, y: 0.47, z: 0 };
      lm[f.dip] = { x: f.kx, y: 0.53, z: 0 };
      lm[f.tip] = { x: f.kx, y: 0.58, z: 0 };
    }
  });

  // thumb: 1 CMC, 2 MCP, 3 IP, 4 tip
  if (pose === "THUMBS_UP") {
    lm[1] = { x: wx - 0.09, y: 0.70, z: 0 };
    lm[2] = { x: wx - 0.10, y: 0.58, z: 0 };
    lm[3] = { x: wx - 0.11, y: 0.45, z: 0 };
    lm[4] = { x: wx - 0.12, y: 0.30, z: 0 };
  } else if (pose === "PINCH") {
    // index curls into an arc meeting the thumb tip
    lm[6] = { x: wx - 0.14, y: 0.44, z: 0 };
    lm[7] = { x: wx - 0.17, y: 0.41, z: 0 };
    lm[8] = { x: wx - 0.15, y: 0.47, z: 0 };
    lm[1] = { x: wx - 0.10, y: 0.72, z: 0 };
    lm[2] = { x: wx - 0.13, y: 0.63, z: 0 };
    lm[3] = { x: wx - 0.14, y: 0.55, z: 0 };
    lm[4] = { x: wx - 0.15, y: 0.47, z: 0 };
  } else if (pose === "OPEN_PALM") {
    lm[1] = { x: wx - 0.10, y: 0.72, z: 0 };
    lm[2] = { x: wx - 0.15, y: 0.64, z: 0 };
    lm[3] = { x: wx - 0.20, y: 0.57, z: 0 };
    lm[4] = { x: wx - 0.26, y: 0.50, z: 0 };
  } else {
    // curled thumb across the palm
    lm[1] = { x: wx - 0.10, y: 0.72, z: 0 };
    lm[2] = { x: wx - 0.12, y: 0.66, z: 0 };
    lm[3] = { x: wx - 0.10, y: 0.62, z: 0 };
    lm[4] = { x: wx - 0.06, y: 0.60, z: 0 };
  }
  return lm;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpHand = (A, B, t) => A.map((p, i) => ({ x: lerp(p.x, B[i].x, t), y: lerp(p.y, B[i].y, t), z: 0 }));

// ground-truth timeline (ms). wx animates for swipes.
const SCRIPT = [
  { pose: "OPEN_PALM", dur: 2300, wx0: 0.50, wx1: 0.50, truth: "OPEN_PALM" },
  { pose: "OPEN_PALM", dur: 1300, wx0: 0.28, wx1: 0.72, moveMs: 380, truth: "SWIPE_RIGHT" },
  { pose: "PEACE",     dur: 2300, wx0: 0.50, wx1: 0.50, truth: "PEACE" },
  { pose: "POINT",     dur: 2300, wx0: 0.46, wx1: 0.54, truth: "POINT" },
  { pose: "PINCH",     dur: 2300, wx0: 0.50, wx1: 0.50, truth: "PINCH" },
  { pose: "THUMBS_UP", dur: 2300, wx0: 0.50, wx1: 0.50, truth: "THUMBS_UP" },
  { pose: "FIST",      dur: 2300, wx0: 0.50, wx1: 0.50, truth: "FIST" },
  { pose: "OPEN_PALM", dur: 1300, wx0: 0.72, wx1: 0.28, moveMs: 380, truth: "SWIPE_LEFT" },
];
const TOTAL = SCRIPT.reduce((s, x) => s + x.dur, 0);
const TRANS = 240; // cross-fade between poses

export class DemoSource {
  constructor() {
    this.kind = "demo";
    this.w = 960; this.h = 640;
  }

  // returns { lm, truth, segIndex }
  frame(tMs) {
    let t = tMs % TOTAL;
    let idx = 0;
    while (t > SCRIPT[idx].dur) { t -= SCRIPT[idx].dur; idx = (idx + 1) % SCRIPT.length; }
    const seg = SCRIPT[idx];
    const prev = SCRIPT[(idx - 1 + SCRIPT.length) % SCRIPT.length];
    // swipes: the hand settles into pose first, THEN moves (like a real swipe)
    const moveT = seg.moveMs
      ? Math.max(0, Math.min(1, (t - TRANS) / seg.moveMs))
      : Math.min(1, t / seg.dur);
    const wx = lerp(seg.wx0, seg.wx1, seg.moveMs ? moveT : moveT * 0.999);
    let lm = makeHand(wx, seg.pose);
    if (t < TRANS) {
      const from = makeHand(prev.wx1, prev.pose);
      lm = lerpHand(from, lm, t / TRANS);
    }
    // tiny natural jitter so the pipeline sees realistic noise
    const j = Math.sin(tMs / 130) * 0.0025;
    lm = lm.map((p) => ({ x: p.x + j, y: p.y + Math.cos(tMs / 170) * 0.002, z: 0 }));
    return { lm, truth: seg.truth, segIndex: idx };
  }

  ready() { return true; }
}

// skeleton drawing shared by demo + webcam overlays
export const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export function drawSkeleton(ctx, lm, w, h, color = "#c084fc") {
  ctx.save();
  ctx.lineWidth = Math.max(2, w / 320);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const [a, b] of BONES) {
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 21; i++) {
    const tip = [4, 8, 12, 16, 20].includes(i);
    ctx.fillStyle = tip ? "#f0abfc" : "#e9d5ff";
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, tip ? w / 130 : w / 210, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}