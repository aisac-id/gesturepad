// GesturePad gesture engine — pure geometry over 21 MediaPipe hand landmarks.
// No classifier model: finger extension + pinch distance + wrist velocity.
"use strict";

// landmark indices: 0 wrist; thumb 1-4; index 5-8; middle 9-12; ring 13-16; pinky 17-20
const FINGERS = [
  { name: "index", mcp: 5, pip: 6, tip: 8 },
  { name: "middle", mcp: 9, pip: 10, tip: 12 },
  { name: "ring", mcp: 13, pip: 14, tip: 16 },
  { name: "pinky", mcp: 17, pip: 18, tip: 20 },
];

const SVG = (body) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const GESTURES = {
  OPEN_PALM:  { label: "Open palm",  icon: SVG('<path d="M7 11V5M10 11V3.5M13 11V4M16 11V6"/><path d="M5 11v3a7 7 0 0 0 14 0v-3"/><path d="M5 13l-2.5-3"/>'), action: "newtab",    desc: "New tab" },
  FIST:       { label: "Fist",       icon: SVG('<rect x="5" y="8" width="14" height="10" rx="4"/><path d="M8 8V6.5M11 8V6M14 8V6M17 8V6.5"/><path d="M5 13h6"/>'), action: "halt",      desc: "Stop / cancel" },
  POINT:      { label: "Point",      icon: SVG('<path d="M9 12V3.5"/><rect x="6" y="12" width="13" height="8" rx="4"/><path d="M13 12v-2.5M16 12v-2.5"/>'), action: "pointer",   desc: "Air pointer" },
  PEACE:      { label: "Peace",      icon: SVG('<path d="M9 12L7 3.5M14 12l2-8.5"/><rect x="6" y="12" width="13" height="8" rx="4"/>'), action: "duplicate", desc: "Duplicate tab" },
  THUMBS_UP:  { label: "Thumbs up",  icon: SVG('<path d="M8 10V4.5a1.8 1.8 0 0 1 3.6 0V10"/><rect x="6" y="10" width="14" height="9" rx="3.5"/><path d="M14 10v-1.5M17 10v-1.5"/>'), action: "reload",    desc: "Reload tab" },
  PINCH:      { label: "Pinch",      icon: SVG('<path d="M6 18C6 10 10 6 15 6"/><path d="M10 20c6 0 9-4 9-9"/><circle cx="17" cy="8" r="1.8"/>'), action: "grab",      desc: "Grab / drag" },
  SWIPE_LEFT: { label: "Swipe left", icon: SVG('<path d="M20 12H7M11 6l-6 6 6 6"/><path d="M20 7h-4M20 17h-4"/>'), action: "back",      desc: "History back" },
  SWIPE_RIGHT:{ label: "Swipe right",icon: SVG('<path d="M4 12h13M13 6l6 6-6 6"/><path d="M4 7h4M4 17h4"/>'), action: "forward",   desc: "History forward" },
};

export const ICON_NOHAND = SVG('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>');

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// finger extended when the tip is clearly farther from the wrist than the PIP
// joint and the finger is reasonably straight (works at any hand rotation)
function fingerExtended(lm, f, handSize) {
  const tip = lm[f.tip], pip = lm[f.pip], mcp = lm[f.mcp];
  const dTip = dist(tip, lm[0]), dPip = dist(pip, lm[0]);
  if (dTip < dPip * 1.06) return false;
  // straightness: angle MCP→PIP vs PIP→TIP
  const v1 = { x: pip.x - mcp.x, y: pip.y - mcp.y };
  const v2 = { x: tip.x - pip.x, y: tip.y - pip.y };
  const n1 = Math.hypot(v1.x, v1.y) || 1e-6, n2 = Math.hypot(v2.x, v2.y) || 1e-6;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
  return cos > 0.35;
}

function thumbExtended(lm) {
  // thumb tip far from the pinky MCP compared to the thumb IP joint
  return dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.12;
}

export function classifyPose(lm) {
  const handSize = dist(lm[0], lm[9]) || 1e-6;
  const ext = FINGERS.map((f) => fingerExtended(lm, f, handSize));
  const nExt = ext.filter(Boolean).length;
  const thumb = thumbExtended(lm);
  const pinchD = dist(lm[4], lm[8]) / handSize;

  // PINCH: tips touch AND the pinch point is held away from the palm —
  // in a fist the thumb also rests near the index, but close to the wrist
  const mid = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
  if (pinchD < 0.32 && !ext[0] && dist(mid, lm[0]) > 1.0 * handSize)
    return { pose: "PINCH", pinchD, ext, thumb };
  if (nExt >= 4) return { pose: "OPEN_PALM", pinchD, ext, thumb };
  if (nExt === 0) {
    // thumbs-up: thumb extended and pointing clearly upward vs wrist
    if (thumb && lm[4].y < lm[0].y - 0.55 * handSize) return { pose: "THUMBS_UP", pinchD, ext, thumb };
    return { pose: "FIST", pinchD, ext, thumb };
  }
  if (nExt === 1 && ext[0]) return { pose: "POINT", pinchD, ext, thumb };
  if (nExt === 2 && ext[0] && ext[1]) return { pose: "PEACE", pinchD, ext, thumb };
  return { pose: "UNKNOWN", pinchD, ext, thumb };
}

export class GestureEngine {
  constructor(opts = {}) {
    this.holdMs = opts.holdMs ?? 550;
    this.swipeDist = opts.swipeDist ?? 0.26;   // normalized x travel
    this.swipeWindow = opts.swipeWindow ?? 420; // ms (base, at full frame rate)
    this.cooldownMs = opts.cooldownMs ?? 900;
    this.dtEma = 33;
    this.lastT = 0;
    this.reset();
  }

  reset() {
    this.poseHist = [];
    this.candidate = null;
    this.candidateSince = 0;
    this.firedFor = null;          // pose already fired during this entry
    this.wristTrail = [];
    this.lastSwipe = 0;
    this.lastFire = 0;
    this.current = null;           // last stable pose
    this.holdProgress = 0;
  }

  tune(o) {
    if (o.holdMs !== undefined) this.holdMs = o.holdMs;
    if (o.swipeDist !== undefined) this.swipeDist = o.swipeDist;
  }

  // lm: 21 normalized landmarks (mirrored already if desired), t: ms timestamp.
  // returns { pose, fired, holdProgress, pinchD } — fired is a gesture name or null
  push(lm, t) {
    if (!lm) {
      this.poseHist = [];
      this.candidate = null;
      this.firedFor = null;
      this.wristTrail = [];
      this.current = null;
      this.holdProgress = 0;
      return { pose: null, fired: null, holdProgress: 0 };
    }
    const { pose, pinchD } = classifyPose(lm);

    // adaptive swipe window: background tabs are throttled to ~1 Hz, so the
    // window widens with the observed tick interval (velocity is unmeasurable
    // there — distance alone decides, which is the honest trade-off)
    if (this.lastT) {
      const dt = t - this.lastT;
      if (dt > 0 && dt < 5000) this.dtEma = this.dtEma * 0.8 + dt * 0.2;
    }
    this.lastT = t;
    const win = Math.max(this.swipeWindow, Math.min(3000, 2.5 * this.dtEma));

    // 5-frame majority for stability
    this.poseHist.push(pose);
    if (this.poseHist.length > 5) this.poseHist.shift();
    const counts = {};
    for (const p of this.poseHist) counts[p] = (counts[p] || 0) + 1;
    const stable = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const stablePose = stable[1] >= 3 ? stable[0] : this.current;

    let fired = null;

    // pose entry bookkeeping first: a swipe must be measured within one stable
    // pose, so the wrist trail restarts whenever the pose changes (otherwise
    // the transition's opposite-direction motion dilutes the swipe distance)
    if (stablePose !== this.candidate) {
      this.candidate = stablePose;
      this.candidateSince = t;
      if (stablePose !== this.firedFor) this.firedFor = null;
      this.wristTrail = [];
    }
    this.current = stablePose;

    // swipe: wrist x velocity while the hand is open or pointing
    this.wristTrail.push({ x: lm[0].x, y: lm[0].y, t });
    while (this.wristTrail.length && t - this.wristTrail[0].t > win) this.wristTrail.shift();
    if ((stablePose === "OPEN_PALM" || stablePose === "POINT") && this.wristTrail.length >= 2) {
      const a = this.wristTrail[0], b = this.wristTrail[this.wristTrail.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > this.swipeDist && Math.abs(dx) > 1.6 * Math.abs(dy) && t - this.lastSwipe > this.cooldownMs) {
        fired = dx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT";
        this.lastSwipe = t;
        this.wristTrail = [];
        this.firedFor = stablePose; // don't also fire the static pose for this entry
      }
    }

    // static pose: hold-to-fire, once per entry
    const held = t - this.candidateSince;
    const actionable = stablePose && stablePose !== "UNKNOWN";
    this.holdProgress = actionable ? Math.min(1, held / this.holdMs) : 0;
    if (!fired && actionable && held >= this.holdMs && this.firedFor !== stablePose && t - this.lastFire > 250) {
      fired = stablePose;
      this.firedFor = stablePose;
      this.lastFire = t;
    }

    return { pose: stablePose, fired, holdProgress: this.holdProgress, pinchD };
  }
}