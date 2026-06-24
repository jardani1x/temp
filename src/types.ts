// types.ts — small shared types passed between the app loop, channels and post.

/** Pointer state in screen-UV space (origin bottom-left, y up, range [0,1]). */
export interface PointerState {
  x: number;
  y: number;
  down: number; // 0 or 1 (float so it drops straight into a uniform)
  vx: number; // velocity, uv units per second
  vy: number;
}

/** Per-frame context handed to every channel each tick. */
export interface Frame {
  time: number; // seconds since boot
  dt: number; // seconds since last frame (clamped for stability)
  frame: number; // integer frame counter
  width: number; // scene render resolution, px
  height: number;
  aspect: number; // width / height
  pointer: PointerState;
  hue: number; // palette/hue shift in turns, from the HUE knob
}

/** Post-processing knob values (0..1 unless noted). */
export interface FxSettings {
  tracking: number; // VHS distortion
  glow: number; // bloom
  scanline: number; // scanline depth
  persist: number; // phosphor persistence
  hue: number; // palette/hue shift, turns (also forwarded into Frame.hue)
}
