// ---------------------------------------------------------------------------
// core/gl.ts — the thinnest possible WebGL2 helper.
//
// Everything CATHODE-88 draws is a full-screen fragment-shader pass, so the
// "framework" here is deliberately tiny: get a context, compile/link programs
// with *useful* error messages, and set uniforms without ceremony. The bet is
// that good diagnostics matter more than abstraction — a GLSL typo should point
// you at the exact line, not a blank screen.
// ---------------------------------------------------------------------------

export type GL = WebGL2RenderingContext;

export class GLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GLError";
  }
}

/** Create a WebGL2 context tuned for a fullscreen generative toy. */
export function createContext(canvas: HTMLCanvasElement): GL {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // We snapshot the canvas for photo mode, which needs the drawing buffer to
    // survive past the compositing step.
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });

  if (!gl) {
    throw new GLError(
      "WebGL2 is not available in this browser. CATHODE-88 needs WebGL2 to broadcast.",
    );
  }

  // Reaction-diffusion and other simulations render into floating-point
  // targets; without this extension those framebuffers are "incomplete".
  if (!gl.getExtension("EXT_color_buffer_float")) {
    console.warn(
      "[gl] EXT_color_buffer_float unavailable — the BLOOM station may not render.",
    );
  }

  return gl;
}

/** Prefix every line of a shader with its number, so compiler errors line up. */
function numberLines(source: string): string {
  return source
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3, " ")} | ${line}`)
    .join("\n");
}

function compileShader(gl: GL, type: number, source: string, label: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new GLError(`Failed to allocate ${label} shader.`);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(no info log)";
    gl.deleteShader(shader);
    throw new GLError(
      `Could not compile ${label} shader:\n${log}\n\n--- source ---\n${numberLines(source)}`,
    );
  }
  return shader;
}

/** Compile + link a program from a vertex and fragment source pair. */
export function createProgram(
  gl: GL,
  vertexSource: string,
  fragmentSource: string,
  label = "program",
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertexSource, `${label}:vertex`);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label}:fragment`);

  const program = gl.createProgram();
  if (!program) throw new GLError(`Failed to allocate ${label}.`);

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // Shaders can be detached/deleted once linked; the program keeps what it needs.
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(no info log)";
    gl.deleteProgram(program);
    throw new GLError(`Could not link ${label}:\n${log}`);
  }
  return program;
}
