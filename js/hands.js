// GesturePad hand tracking — vendored MediaPipe tasks-vision HandLandmarker.
// CPU delegate: deterministic everywhere (no GPU/driver dependence), ~20 ms/frame.
"use strict";

import { FilesetResolver, HandLandmarker } from "../vendor/vision_bundle.mjs";

let landmarker = null;

export async function initHands(onStatus) {
  onStatus?.("loading");
  const fileset = await FilesetResolver.forVisionTasks("vendor/wasm");
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "vendor/hand_landmarker.task", delegate: "CPU" },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  onStatus?.("ready");
  return landmarker;
}

// video: HTMLVideoElement with current frame; ts: monotonic ms
export function detectHands(video, ts) {
  if (!landmarker || video.readyState < 2) return { lm: null, ms: 0 };
  const t0 = performance.now();
  const res = landmarker.detectForVideo(video, ts);
  const ms = performance.now() - t0;
  const lm = res.landmarks?.[0] || null;
  return { lm, ms };
}

export function handsReady() { return !!landmarker; }