// post/crt.ts — the post-processing pipeline that gives CATHODE-88 its look.
//
// Flow each frame:
//   channel ──► scene ──► bright-pass ──► blur×2 ──► bloom
//                  │                                   │
//                  └────────────┬──────────────────────┘
//                               ▼
//                    CRT composite (+ previous frame)  ──► swap ──► blit to screen
//
// The "previous frame" feedback is what creates phosphor persistence, so the
// CRT output lives in a ping-pong pair.

import { GL } from "../core/gl";
import { Framebuffer, PingPong } from "../core/framebuffer";
import { ShaderPass } from "../core/pass";
import { frag } from "../shaders";
import { FxSettings } from "../types";

const BLOOM_THRESHOLD = 0.55;
const BLOOM_SPREAD = 1.5; // blur step in texels

export class CRTPipeline {
  private scene!: Framebuffer;
  private bloomA!: Framebuffer;
  private bloomB!: Framebuffer;
  private crt!: PingPong;

  private brightPass: ShaderPass;
  private blurPass: ShaderPass;
  private crtPass: ShaderPass;
  private copyPass: ShaderPass;

  private width = 0;
  private height = 0;
  private bloomW = 0;
  private bloomH = 0;

  /** Decaying 0..1 burst that drives channel-change static + vertical roll. */
  private change = 0;

  constructor(
    private gl: GL,
    width: number,
    height: number,
  ) {
    this.brightPass = new ShaderPass(gl, frag.brightpass, "brightpass");
    this.blurPass = new ShaderPass(gl, frag.blur, "blur");
    this.crtPass = new ShaderPass(gl, frag.crt, "crt");
    this.copyPass = new ShaderPass(gl, frag.copy, "copy");
    this.resize(width, height);
  }

  /** Channels render their image into this target. */
  get sceneTarget(): Framebuffer {
    return this.scene;
  }

  /** Kick off the static burst shown when the station changes. */
  triggerChange() {
    this.change = 1;
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height && this.scene) return;
    this.width = w;
    this.height = h;
    this.bloomW = Math.max(1, Math.floor(w / 2));
    this.bloomH = Math.max(1, Math.floor(h / 2));

    const linear = { format: "rgba8", filter: "linear" } as const;
    if (!this.scene) {
      this.scene = new Framebuffer(this.gl, w, h, linear);
      this.bloomA = new Framebuffer(this.gl, this.bloomW, this.bloomH, linear);
      this.bloomB = new Framebuffer(this.gl, this.bloomW, this.bloomH, linear);
      this.crt = new PingPong(this.gl, w, h, linear);
    } else {
      this.scene.resize(w, h);
      this.bloomA.resize(this.bloomW, this.bloomH);
      this.bloomB.resize(this.bloomW, this.bloomH);
      this.crt.resize(w, h);
    }
    this.clearFeedback();
  }

  private clearFeedback() {
    // Persistence reads last frame; make sure it starts black, not garbage.
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);
    this.crt.read.bind();
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.crt.write.bind();
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Run bloom + CRT + blit. Call after the active channel has drawn `scene`. */
  present(time: number, dt: number, fx: FxSettings) {
    const gl = this.gl;
    this.change *= Math.exp(-dt * 6.0);
    if (this.change < 0.001) this.change = 0;

    // Bloom: extract bright areas, then separable blur (H then V).
    this.brightPass.render(this.bloomA, {
      uTex: this.scene.texture,
      uThreshold: BLOOM_THRESHOLD,
    });
    this.blurPass.render(this.bloomB, {
      uTex: this.bloomA.texture,
      uDir: [BLOOM_SPREAD / this.bloomW, 0],
    });
    this.blurPass.render(this.bloomA, {
      uTex: this.bloomB.texture,
      uDir: [0, BLOOM_SPREAD / this.bloomH],
    });

    // CRT composite into the write buffer (reading the previous frame).
    this.crtPass.render(this.crt.write, {
      uScene: this.scene.texture,
      uBloom: this.bloomA.texture,
      uPrev: this.crt.read.texture,
      uResolution: [this.width, this.height],
      uTime: time,
      uTracking: fx.tracking,
      uGlow: fx.glow,
      uScanline: fx.scanline,
      uPersist: fx.persist,
      uChange: this.change,
    });
    this.crt.swap();

    // Blit the finished frame to the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.copyPass.render(null, { uTex: this.crt.read.texture });
  }

  dispose() {
    this.scene.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.crt.dispose();
    this.brightPass.dispose();
    this.blurPass.dispose();
    this.crtPass.dispose();
    this.copyPass.dispose();
  }
}
