// GesturePad webcam source.
"use strict";

export class WebcamSource {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.kind = "webcam";
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.stream = null;
    this.w = 960; this.h = 640;
  }

  async start() {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 640 }, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.w = this.video.videoWidth || 960;
    this.h = this.video.videoHeight || 640;
    this.stream.getVideoTracks()[0].addEventListener("ended", () => this.onStatus?.("cam-ended"));
    this.onStatus?.("webcam");
  }

  stop() {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
  }

  ready() { return !!this.stream && this.video.readyState >= 2; }
}