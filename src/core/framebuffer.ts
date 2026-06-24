// ---------------------------------------------------------------------------
// core/framebuffer.ts — render targets and ping-pong buffers.
//
// Most passes draw into an offscreen texture that a later pass reads. Stateful
// simulations (reaction-diffusion, Game of Life) need to read last frame while
// writing this frame, which is what `PingPong` is for.
// ---------------------------------------------------------------------------

import { GL, GLError } from "./gl";

export type TextureFormat = "rgba8" | "rgba16f";
export type TextureFilter = "nearest" | "linear";

export interface TextureOptions {
  format?: TextureFormat;
  filter?: TextureFilter;
  /** Texture wrap mode; "clamp" by default, "repeat" for tiling noise. */
  wrap?: "clamp" | "repeat";
}

function resolveFormat(gl: GL, format: TextureFormat) {
  switch (format) {
    case "rgba16f":
      return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    case "rgba8":
    default:
      return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
  }
}

export function createTexture(
  gl: GL,
  width: number,
  height: number,
  opts: TextureOptions = {},
): WebGLTexture {
  const { format = "rgba8", filter = "linear", wrap = "clamp" } = opts;
  const tex = gl.createTexture();
  if (!tex) throw new GLError("Failed to allocate texture.");

  const f = resolveFormat(gl, format);
  const filterMode = filter === "linear" ? gl.LINEAR : gl.NEAREST;
  const wrapMode = wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, width, height, 0, f.format, f.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** A single offscreen render target: one framebuffer wrapping one color texture. */
export class Framebuffer {
  readonly fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;

  constructor(
    private gl: GL,
    width: number,
    height: number,
    private opts: TextureOptions = {},
  ) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new GLError("Failed to allocate framebuffer.");
    this.fbo = fbo;
    this.texture = createTexture(gl, this.width, this.height, opts);
    this.attach();
  }

  private attach() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new GLError(`Framebuffer incomplete (status 0x${status.toString(16)}).`);
    }
  }

  /** Bind this framebuffer and set the viewport to its size. */
  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    // Re-allocate the backing texture at the new size.
    this.gl.deleteTexture(this.texture);
    this.texture = createTexture(this.gl, w, h, this.opts);
    this.attach();
  }

  dispose() {
    this.gl.deleteFramebuffer(this.fbo);
    this.gl.deleteTexture(this.texture);
  }
}

/** Two framebuffers you swap between for read-this / write-that simulations. */
export class PingPong {
  private a: Framebuffer;
  private b: Framebuffer;

  constructor(gl: GL, width: number, height: number, opts: TextureOptions = {}) {
    this.a = new Framebuffer(gl, width, height, opts);
    this.b = new Framebuffer(gl, width, height, opts);
  }

  /** The framebuffer holding the latest written state (read from this). */
  get read(): Framebuffer {
    return this.a;
  }

  /** The framebuffer to render the next state into (write to this). */
  get write(): Framebuffer {
    return this.b;
  }

  swap() {
    const tmp = this.a;
    this.a = this.b;
    this.b = tmp;
  }

  resize(width: number, height: number) {
    this.a.resize(width, height);
    this.b.resize(width, height);
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
  }
}
