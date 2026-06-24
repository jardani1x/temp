// ---------------------------------------------------------------------------
// core/pass.ts — a single full-screen fragment-shader pass.
//
// Every visual in CATHODE-88 is "run this fragment shader over the whole
// screen". `ShaderPass` owns one program and draws a single oversized triangle
// that covers the viewport (no vertex buffers — the positions come from
// gl_VertexID). Uniforms are set from a plain object; types are inferred.
//
// Uniform convention: GLSL uniforms are either `sampler2D` (set from a
// WebGLTexture) or floating-point (`float`/`vec2..4`). We deliberately avoid
// `int`/`bool` uniforms so the type-inference below never has to guess — flags
// are passed as 0.0/1.0 floats.
// ---------------------------------------------------------------------------

import { GL, createProgram } from "./gl";
import { Framebuffer } from "./framebuffer";

/** Shared vertex shader: a single triangle covering clip space, uv in [0,1]. */
const VERT_SOURCE = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  // Classic gl_VertexID fullscreen-triangle trick — vertices (0,0)(2,0)(0,2).
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export type UniformValue = number | number[] | Float32Array | WebGLTexture;
export type Uniforms = Record<string, UniformValue | undefined>;

export class ShaderPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private locations = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private gl: GL,
    fragmentSource: string,
    label = "pass",
  ) {
    this.program = createProgram(gl, VERT_SOURCE, fragmentSource, label);
    const vao = gl.createVertexArray();
    if (!vao) throw new Error(`Failed to allocate VAO for ${label}.`);
    this.vao = vao;
  }

  private loc(name: string): WebGLUniformLocation | null {
    let location = this.locations.get(name);
    if (location === undefined) {
      location = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, location);
    }
    return location;
  }

  /**
   * Render this pass into `target` (or the default framebuffer when null —
   * in which case the caller must have set the viewport).
   */
  render(target: Framebuffer | null, uniforms: Uniforms = {}) {
    const gl = this.gl;
    if (target) target.bind();
    else gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    this.applyUniforms(uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  private applyUniforms(uniforms: Uniforms) {
    const gl = this.gl;
    let textureUnit = 0;

    for (const name in uniforms) {
      const value = uniforms[name];
      if (value === undefined) continue;
      const location = this.loc(name);
      if (location === null) continue; // optimized out by the compiler — ignore

      if (value instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, value);
        gl.uniform1i(location, textureUnit);
        textureUnit++;
      } else if (typeof value === "number") {
        gl.uniform1f(location, value);
      } else {
        switch (value.length) {
          case 2:
            gl.uniform2f(location, value[0], value[1]);
            break;
          case 3:
            gl.uniform3f(location, value[0], value[1], value[2]);
            break;
          case 4:
            gl.uniform4f(location, value[0], value[1], value[2], value[3]);
            break;
          default:
            throw new Error(`Unsupported uniform array length ${value.length} for "${name}".`);
        }
      }
    }
  }

  dispose() {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}
