// rd_sim.glsl — one Gray-Scott reaction-diffusion step. Reads the previous
// state, applies a 9-point Laplacian + the reaction terms, and lets the cursor
// inject fresh B to "paint" growth.

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2D uState;   // highp: state lives in a float texture
uniform vec2  uTexel;       // 1.0 / simResolution
uniform float uFeed;
uniform float uKill;
uniform float uDA;
uniform float uDB;
uniform float uDt;
uniform vec2  uMouse;       // uv space
uniform float uMouseDown;

vec2 sampleState(vec2 offset) {
  return texture(uState, vUv + offset * uTexel).xy;
}

void main() {
  vec2 s = texture(uState, vUv).xy;

  // Weighted Laplacian (edges 0.2, corners 0.05, center -1.0).
  vec2 lap = vec2(0.0);
  lap += sampleState(vec2(-1.0,  0.0)) * 0.2;
  lap += sampleState(vec2( 1.0,  0.0)) * 0.2;
  lap += sampleState(vec2( 0.0, -1.0)) * 0.2;
  lap += sampleState(vec2( 0.0,  1.0)) * 0.2;
  lap += sampleState(vec2(-1.0, -1.0)) * 0.05;
  lap += sampleState(vec2( 1.0, -1.0)) * 0.05;
  lap += sampleState(vec2(-1.0,  1.0)) * 0.05;
  lap += sampleState(vec2( 1.0,  1.0)) * 0.05;
  lap += s * -1.0;

  float A = s.x;
  float B = s.y;
  float reaction = A * B * B;
  float dA = uDA * lap.x - reaction + uFeed * (1.0 - A);
  float dB = uDB * lap.y + reaction - (uKill + uFeed) * B;
  A += dA * uDt;
  B += dB * uDt;

  // Cursor paints B.
  B += uMouseDown * smoothstep(0.035, 0.0, distance(vUv, uMouse));

  fragColor = vec4(clamp(A, 0.0, 1.0), clamp(B, 0.0, 1.0), 0.0, 1.0);
}
