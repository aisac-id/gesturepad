// GesturePad app — tracking loop, gesture dispatch, playground, live control.
"use strict";

import { GESTURES, GestureEngine, ICON_NOHAND } from "./gestures.js";
import { DemoSource, drawSkeleton } from "./demo.js";
import { initHands, detectHands, handsReady } from "./hands.js";
import { WebcamSource } from "./sources.js";
import { sfx, setSound } from "./audio.js";

const $ = (id) => document.getElementById(id);
const TUNE_KEY = "gp-tuning-v1";
const DEFAULT_TUNE = { holdMs: 550, swipeDist: 0.26, mirror: true, skeleton: true, trail: true, sound: true, live: false };

let tune = { ...DEFAULT_TUNE };
let paused = false;
let engineReady = false;
let srcKind = "demo";
let lastLm = null;
let lastPose = null;
let lastTruth = null;
let holdProgress = 0;
let fps = 0;
let lastFrameT = 0;
let detectMs = 0;
let frames = 0;
let handFrames = 0;
let counts = Object.fromEntries(Object.keys(GESTURES).map((k) => [k, 0]));
let events = [];
let loopTimer = null;
const bootTime = performance.now();

const demo = new DemoSource();
const cam = new WebcamSource(onCamStatus);
const engine = new GestureEngine({ holdMs: tune.holdMs, swipeDist: tune.swipeDist });

// playground state
const SLIDES = [
  { t: "Welcome", b: "Swipe to change slides" },
  { t: "Gestures", b: "Hold a pose to fire it" },
  { t: "Privacy", b: "Everything stays on-device" },
];
let slideIdx = 0;
let tabCards = [{ id: 1, name: "tab 1" }];
let activeTab = 1;
let nextTabId = 2;
const orb = { x: 0.72, y: 0.30, r: 0.045, grabbed: false };
const pointer = { x: 0.5, y: 0.5, on: false };
const trail = [];

const stage = $("stageCanvas");
const sx = stage.getContext("2d");

/* ── persistence ── */
function saveTune() {
  try { chrome.storage?.local.set({ [TUNE_KEY]: tune }); }
  catch { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)); }
}
async function restoreTune() {
  try {
    const d = await chrome.storage?.local.get(TUNE_KEY);
    if (d?.[TUNE_KEY]) tune = { ...DEFAULT_TUNE, ...d[TUNE_KEY] };
  } catch {
    try { tune = { ...DEFAULT_TUNE, ...JSON.parse(localStorage.getItem(TUNE_KEY) || "{}") }; } catch {}
  }
}

function refreshTuneUI() {
  $("holdRange").value = tune.holdMs;
  $("holdVal").textContent = `${tune.holdMs} ms`;
  $("swipeRange").value = tune.swipeDist;
  $("swipeVal").textContent = tune.swipeDist.toFixed(2);
  $("mirrorTgl").checked = tune.mirror;
  $("skeletonTgl").checked = tune.skeleton;
  $("trailTgl").checked = tune.trail;
  $("liveTgl").checked = tune.live;
  $("soundBtn").classList.toggle("off", !tune.sound);
  setSound(tune.sound);
  engine.tune({ holdMs: tune.holdMs, swipeDist: tune.swipeDist });
}

/* ── toasts / log ── */
function toast(msg, cls = "", ms = 2600) {
  const el = document.createElement("div");
  el.className = `toast ${cls}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function logEvent(cls, text) {
  events.push({ t: new Date().toISOString(), cls, text });
  if (events.length > 120) events.shift();
  const div = document.createElement("div");
  div.className = `log-item ${cls}`;
  const time = document.createElement("time");
  time.textContent = events[events.length - 1].t.slice(11, 19);
  div.append(time, document.createTextNode(text));
  $("logList").prepend(div);
  while ($("logList").children.length > 60) $("logList").lastChild.remove();
  $("logEmpty").hidden = true;
}

/* ── gesture cards / stats ── */
function buildCards() {
  const grid = $("gestureGrid");
  for (const key in GESTURES) {
    const g = GESTURES[key];
    const card = document.createElement("div");
    card.className = "g-card";
    card.id = `gc-${key}`;
    card.innerHTML = `<div class="g-icon">${g.icon}</div><div class="g-name">${g.label}</div><div class="g-act">${g.desc}</div><span class="g-count" id="gn-${key}">0</span><div class="g-bar" id="gb-${key}"></div>`;
    grid.appendChild(card);
  }
  const stats = [
    ["stFired", "GESTURES FIRED"], ["stFps", "TRACK FPS"],
    ["stDetect", "DETECT MS"], ["stHand", "HAND IN FRAME"],
    ["stTabs", "PLAYGROUND TABS"], ["stTime", "SESSION"],
  ];
  for (const [id, label] of stats) {
    const d = document.createElement("div");
    d.className = "stat";
    d.innerHTML = `<b id="${id}">–</b><span>${label}</span>`;
    $("statsGrid").appendChild(d);
  }
}

/* ── playground ── */
function renderDeck() {
  $("slideTitle").textContent = SLIDES[slideIdx].t;
  $("slideBody").textContent = SLIDES[slideIdx].b;
  const wrap = $("tabChips");
  wrap.innerHTML = "";
  for (const t of tabCards) {
    const chip = document.createElement("span");
    chip.className = "tab-chip" + (t.id === activeTab ? " active" : "");
    chip.textContent = t.name;
    wrap.appendChild(chip);
  }
}
function flashSlide() {
  $("slideCard").classList.add("flash");
  setTimeout(() => $("slideCard").classList.remove("flash"), 450);
}

function applyPlayground(cmd) {
  switch (cmd) {
    case "back": slideIdx = (slideIdx - 1 + SLIDES.length) % SLIDES.length; flashSlide(); break;
    case "forward": slideIdx = (slideIdx + 1) % SLIDES.length; flashSlide(); break;
    case "reload": flashSlide(); break;
    case "newtab": {
      const id = nextTabId++;
      tabCards.push({ id, name: `tab ${id}` });
      activeTab = id;
      if (tabCards.length > 8) tabCards.shift();
      break;
    }
    case "duplicate": {
      const id = nextTabId++;
      const src = tabCards.find((t) => t.id === activeTab);
      tabCards.push({ id, name: `${src ? src.name : "tab"} copy` });
      activeTab = id;
      if (tabCards.length > 8) tabCards.shift();
      break;
    }
    case "halt": orb.grabbed = false; break;
  }
  renderDeck();
}

/* ── dispatch ── */
function fireGesture(key) {
  counts[key]++;
  const g = GESTURES[key];
  const card = $(`gc-${key}`);
  card.classList.remove("fired");
  void card.offsetWidth;
  card.classList.add("fired");
  $(`gn-${key}`).textContent = counts[key];
  const isSwipe = key.startsWith("SWIPE");
  if (isSwipe) sfx.swipe(); else if (key === "PINCH") sfx.grab(); else sfx.fire();
  logEvent("fire", `${g.label} → ${g.desc}`);
  toast(`${g.label} — ${g.desc}`, "fire", 1800);

  const cmd = g.action;
  if (cmd === "pointer" || cmd === "grab") return; // continuous modes, not commands
  applyPlayground(cmd);
  if (tune.live) {
    try {
      chrome.runtime.sendMessage({ type: "gp-command", cmd }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          logEvent("warn", `live command failed: ${chrome.runtime.lastError?.message || res?.error || "no response"}`);
        } else {
          logEvent("cmd", `live: ${cmd} executed`);
        }
      });
    } catch (e) {
      logEvent("warn", `live unavailable: ${e.message}`);
    }
  }
}

/* ── status ── */
function updateStatus() {
  const banner = $("statusBanner");
  if (!engineReady) return;
  if (!lastLm) {
    banner.dataset.s = "nohand";
    $("statusIcon").innerHTML = ICON_NOHAND;
    $("statusWord").textContent = "NO HAND";
    $("statusSub").textContent = srcKind === "demo" ? "Waiting for the demo hand…" : "Show your whole hand to the camera, palm forward.";
    $("handPill").textContent = "NO HAND";
    $("handPill").classList.remove("ok");
  } else if (lastPose && lastPose !== "UNKNOWN") {
    banner.dataset.s = "gesture";
    const g = GESTURES[lastPose];
    $("statusIcon").innerHTML = g.icon;
    $("statusWord").textContent = g.label.toUpperCase();
    $("statusSub").textContent = holdProgress >= 1 ? `${g.desc} — armed` : `Hold steady… ${Math.round(holdProgress * 100)}%`;
    $("handPill").textContent = "HAND ✓";
    $("handPill").classList.add("ok");
  } else {
    banner.dataset.s = "tracking";
    $("statusIcon").innerHTML = GESTURES.OPEN_PALM.icon;
    $("statusWord").textContent = "TRACKING";
    $("statusSub").textContent = "Hand tracked — make a gesture.";
    $("handPill").textContent = "HAND ✓";
    $("handPill").classList.add("ok");
  }
}

/* ── tracking loop (timer-driven, background-safe at browser throttle) ── */
function scheduleLoop() {
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = setTimeout(tick, 33);
}

function tick() {
  const now = performance.now();
  if (paused || !engineReady) { scheduleLoop(); return; }
  let lm = null;
  if (srcKind === "demo") {
    const f = demo.frame(now - bootTime);
    lm = f.lm;
    lastTruth = f.truth;
    $("truthChip").textContent = `TRUTH · ${f.truth}`;
    detectMs = 0;
  } else if (cam.ready() && handsReady()) {
    const r = detectHands(cam.video, now);
    lm = r.lm;
    detectMs = detectMs * 0.8 + r.ms * 0.2;
    if (lm && tune.mirror) lm = lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
    lastTruth = null;
  }
  frames++;
  if (lm) handFrames++;
  const dt = now - lastFrameT;
  lastFrameT = now;
  if (dt > 0 && dt < 1000) fps = fps * 0.9 + (1000 / dt) * 0.1;

  const r = engine.push(lm, now);
  lastLm = lm;
  lastPose = r.pose;
  holdProgress = r.holdProgress;

  // continuous modes
  pointer.on = r.pose === "POINT" && !!lm;
  if (pointer.on) { pointer.x = lm[8].x; pointer.y = lm[8].y; }
  if (r.pose === "PINCH" && lm) {
    const px = (lm[4].x + lm[8].x) / 2, py = (lm[4].y + lm[8].y) / 2;
    if (!orb.grabbed && Math.hypot(px - orb.x, py - orb.y) < orb.r * 2.2) orb.grabbed = true;
    if (orb.grabbed) { orb.x = px; orb.y = py; }
  } else {
    orb.grabbed = false;
  }

  // wrist trail
  if (lm) {
    trail.push({ x: lm[0].x, y: lm[0].y, t: now });
    while (trail.length && now - trail[0].t > 600) trail.shift();
  } else trail.length = 0;

  if (r.fired) fireGesture(r.fired);

  updateStatus();
  updateCards();
  updateStats();
  scheduleLoop();
}

function updateCards() {
  for (const key in GESTURES) {
    const active = lastPose === key;
    $(`gc-${key}`).classList.toggle("active", active);
    $(`gb-${key}`).style.width = active ? `${holdProgress * 100}%` : "0%";
  }
}

function updateStats() {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  $("stFired").textContent = total;
  $("stFps").textContent = fps ? fps.toFixed(0) : "–";
  $("stDetect").textContent = srcKind === "webcam" ? detectMs.toFixed(0) : "sim";
  $("stHand").textContent = frames ? `${Math.round((handFrames / frames) * 100)}%` : "–";
  $("stTabs").textContent = tabCards.length;
  const el = Math.floor((performance.now() - bootTime) / 1000);
  $("stTime").textContent = `${String(Math.floor(el / 60)).padStart(2, "0")}:${String(el % 60).padStart(2, "0")}`;
  $("clockChip").textContent = $("stTime").textContent;
  $("fpsPill").textContent = `${fps ? fps.toFixed(0) : "–"} FPS`;
}

/* ── stage drawing ── */
function draw() {
  requestAnimationFrame(draw);
  const w = stage.width, h = stage.height;
  // background
  const grad = sx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0d0618");
  grad.addColorStop(1, "#150a26");
  sx.fillStyle = grad;
  sx.fillRect(0, 0, w, h);

  if (srcKind === "webcam" && cam.ready()) {
    sx.save();
    if (tune.mirror) { sx.translate(w, 0); sx.scale(-1, 1); }
    sx.drawImage(cam.video, 0, 0, w, h);
    sx.restore();
    sx.fillStyle = "rgba(11,7,20,0.25)";
    sx.fillRect(0, 0, w, h);
  } else {
    // demo backdrop: subtle grid
    sx.strokeStyle = "rgba(168,85,247,0.07)";
    sx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) { sx.beginPath(); sx.moveTo(x, 0); sx.lineTo(x, h); sx.stroke(); }
    for (let y = 0; y < h; y += 48) { sx.beginPath(); sx.moveTo(0, y); sx.lineTo(w, y); sx.stroke(); }
  }

  // wrist trail
  if (tune.trail && trail.length > 1) {
    sx.strokeStyle = "rgba(232,121,249,0.5)";
    sx.lineWidth = 3;
    sx.beginPath();
    trail.forEach((p, i) => i ? sx.lineTo(p.x * w, p.y * h) : sx.moveTo(p.x * w, p.y * h));
    sx.stroke();
  }

  // orb (pinch target)
  sx.beginPath();
  sx.arc(orb.x * w, orb.y * h, orb.r * w, 0, Math.PI * 2);
  sx.fillStyle = orb.grabbed ? "rgba(232,121,249,0.85)" : "rgba(168,85,247,0.4)";
  sx.shadowColor = "#e879f9";
  sx.shadowBlur = orb.grabbed ? 30 : 14;
  sx.fill();
  sx.shadowBlur = 0;
  sx.strokeStyle = "#c084fc";
  sx.lineWidth = 2;
  sx.stroke();
  sx.fillStyle = "#ede9fe";
  sx.font = "600 11px 'Space Grotesk', sans-serif";
  sx.textAlign = "center";
  sx.fillText(orb.grabbed ? "GRABBED" : "PINCH ME", orb.x * w, orb.y * h + 4);
  sx.textAlign = "left";

  // skeleton
  if (lastLm && tune.skeleton) drawSkeleton(sx, lastLm, w, h);

  // air pointer
  if (pointer.on) {
    sx.beginPath();
    sx.arc(pointer.x * w, pointer.y * h, 10, 0, Math.PI * 2);
    sx.strokeStyle = "#4ade80";
    sx.lineWidth = 3;
    sx.stroke();
    sx.beginPath();
    sx.arc(pointer.x * w, pointer.y * h, 3, 0, Math.PI * 2);
    sx.fillStyle = "#4ade80";
    sx.fill();
  }

  // hold ring near wrist
  if (lastLm && lastPose && GESTURES[lastPose] && holdProgress > 0 && holdProgress < 1) {
    const cx = lastLm[0].x * w, cy = lastLm[0].y * h + 40;
    sx.beginPath();
    sx.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
    sx.strokeStyle = "#e879f9";
    sx.lineWidth = 4;
    sx.stroke();
  }

  // demo truth badge
  if (srcKind === "demo" && lastTruth) {
    sx.fillStyle = "rgba(11,7,20,0.75)";
    sx.fillRect(12, h - 36, 250, 26);
    sx.fillStyle = "#fbbf24";
    sx.font = "600 12px 'Space Grotesk', sans-serif";
    sx.fillText(`GROUND TRUTH · ${lastTruth}`, 20, h - 18);
  }
}

/* ── sources ── */
function onCamStatus(s) {
  if (s === "webcam") {
    $("srcStatus").textContent = "webcam live · all processing local";
    $("srcGate").hidden = true;
    $("srcChip").textContent = "WEBCAM";
    $("truthChip").hidden = true;
    engine.reset();
    logEvent("sys", "webcam started");
  } else if (s === "cam-ended") {
    $("srcStatus").textContent = "camera ended";
    $("gateMsg").textContent = "Camera stopped. Start again or switch to the demo hand.";
    $("srcGate").hidden = false;
    logEvent("warn", "camera ended");
  }
}

async function switchSource(kind) {
  srcKind = kind;
  $("camBtn").hidden = kind !== "webcam";
  engine.reset();
  lastLm = null;
  if (kind === "demo") {
    cam.stop();
    $("srcGate").hidden = true;
    $("srcChip").textContent = "DEMO HAND";
    $("truthChip").hidden = false;
    $("srcStatus").textContent = "synthetic landmarks · same pipeline as webcam";
    logEvent("sys", "demo hand source");
  } else {
    $("gateMsg").textContent = "Allow camera access to track your hand.";
    $("srcGate").hidden = false;
    $("srcStatus").textContent = "waiting for camera…";
    $("srcChip").textContent = "WEBCAM";
    $("truthChip").hidden = true;
  }
}

async function startCam() {
  try {
    await cam.start();
  } catch (err) {
    $("srcStatus").textContent = `camera error: ${err.message || err.name}`;
    $("srcStatus").classList.add("err");
    toast(`Camera failed: ${err.message || err.name}`, "err");
    sfx.error();
  }
}

/* ── report ── */
function exportReport() {
  const report = {
    tool: "GesturePad 1.0.0",
    generated: new Date().toISOString(),
    source: srcKind,
    liveControl: tune.live,
    sessionSeconds: Math.round((performance.now() - bootTime) / 1000),
    frames, handFrames,
    fps: Math.round(fps),
    detectMs: Math.round(detectMs),
    gestureCounts: counts,
    tuning: tune,
    events,
    privacy: "No video or landmarks are stored or transmitted. Counts and events only.",
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gesturepad-report-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Report downloaded", "ok");
  sfx.ui();
}

/* ── wiring ── */
function wire() {
  $("sourceSel").addEventListener("change", (e) => { sfx.ui(); switchSource(e.target.value); });
  $("camBtn").addEventListener("click", startCam);
  $("gateBtn").addEventListener("click", startCam);
  $("soundBtn").addEventListener("click", () => { tune.sound = !tune.sound; refreshTuneUI(); saveTune(); });
  $("pauseBtn").addEventListener("click", () => setPaused(!paused));
  $("helpBtn").addEventListener("click", () => { $("helpModal").hidden = false; sfx.ui(); });
  $("helpClose").addEventListener("click", () => { $("helpModal").hidden = true; });
  $("helpModal").addEventListener("click", (e) => { if (e.target === $("helpModal")) $("helpModal").hidden = true; });
  $("reportBtn").addEventListener("click", exportReport);
  $("clearLogBtn").addEventListener("click", () => { events = []; $("logList").innerHTML = ""; $("logEmpty").hidden = false; sfx.ui(); });
  $("liveTgl").addEventListener("change", (e) => {
    tune.live = e.target.checked;
    saveTune();
    logEvent(tune.live ? "warn" : "sys", tune.live ? "LIVE CONTROL ON — gestures now drive real tabs" : "live control off (playground only)");
    toast(tune.live ? "Live control ON — gestures control real tabs" : "Live control off — playground only", tune.live ? "warn" : "ok", 3200);
    sfx.ui();
  });
  $("mirrorTgl").addEventListener("change", (e) => { tune.mirror = e.target.checked; saveTune(); });
  $("skeletonTgl").addEventListener("change", (e) => { tune.skeleton = e.target.checked; saveTune(); });
  $("trailTgl").addEventListener("change", (e) => { tune.trail = e.target.checked; saveTune(); });
  $("holdRange").addEventListener("input", (e) => {
    tune.holdMs = +e.target.value;
    $("holdVal").textContent = `${tune.holdMs} ms`;
    engine.tune({ holdMs: tune.holdMs });
    saveTune();
  });
  $("swipeRange").addEventListener("input", (e) => {
    tune.swipeDist = +e.target.value;
    $("swipeVal").textContent = tune.swipeDist.toFixed(2);
    engine.tune({ swipeDist: tune.swipeDist });
    saveTune();
  });
  $("resetTuneBtn").addEventListener("click", () => {
    const live = tune.live;
    tune = { ...DEFAULT_TUNE, live };
    refreshTuneUI(); saveTune();
    toast("Tuning reset", "ok");
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "l" || e.key === "L") { $("liveTgl").checked = !tune.live; $("liveTgl").dispatchEvent(new Event("change")); }
    else if (e.key === "m" || e.key === "M") { $("mirrorTgl").checked = !tune.mirror; $("mirrorTgl").dispatchEvent(new Event("change")); }
    else if (e.key === "s" || e.key === "S") $("soundBtn").click();
    else if (e.key === "?") $("helpModal").hidden = !$("helpModal").hidden;
    else if (e.key === "Escape") $("helpModal").hidden = true;
  });
}

function setPaused(p) {
  paused = p;
  $("pauseVeil").hidden = !p;
  $("pauseBtn").textContent = p ? "▶" : "⏸";
  $("pauseBtn").classList.toggle("active", p);
  if (!p) engine.reset();
  sfx.ui();
}

/* ── boot ── */
(async function boot() {
  await restoreTune();
  refreshTuneUI();
  buildCards();
  renderDeck();
  wire();
  requestAnimationFrame(draw);
  await switchSource("demo");
  lastFrameT = performance.now();
  // demo works without the engine; webcam needs it
  engineReady = true;
  scheduleLoop();
  try {
    await initHands((s) => {
      $("enginePill").textContent = s === "ready" ? "ENGINE · MEDIAPIPE LOCAL" : "ENGINE · LOADING";
      $("enginePill").classList.toggle("ok", s === "ready");
    });
    logEvent("sys", "MediaPipe hand landmarker ready (CPU, local WASM)");
    sfx.ready();
  } catch (err) {
    $("enginePill").textContent = "ENGINE · FAILED";
    toast(`Hand engine failed: ${err.message || err}`, "err", 8000);
    logEvent("warn", `engine load failed: ${err.message || err}`);
    sfx.error();
  }
})();

// debug/test hook
window.__gp = {
  get pose() { return lastPose; },
  get truth() { return lastTruth; },
  get counts() { return counts; },
  get firedTotal() { return Object.values(counts).reduce((a, b) => a + b, 0); },
  get fps() { return fps; },
  get frames() { return frames; },
  get handFrames() { return handFrames; },
  get engineReady() { return engineReady; },
  get handsReady() { return handsReady(); },
  get tune() { return tune; },
  get srcKind() { return srcKind; },
  get slideIdx() { return slideIdx; },
  get tabs() { return tabCards; },
  get orb() { return orb; },
  get events() { return events; },
  engine,
};