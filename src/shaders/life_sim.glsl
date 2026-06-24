// life_sim.glsl — one Conway's Game of Life step (B3/S23) on a texture grid.
// A separate "heat" channel spikes to 1 for living cells and decays for dead
// ones, leaving the phosphor trails the display + CRT bloom turn into glow.

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2D uState;
uniform vec2  uTexel;       // 1.0 / simResolution
uniform vec2  uMouse;       // uv space
uniform float uMouseDown;

float cell(vec2 offset) {
  return texture(uState, vUv + offset * uTexel).r;
}

void main() {
  float n = 0.0;
  n += cell(vec2(-1.0, -1.0));
  n += cell(vec2( 0.0, -1.0));
  n += cell(vec2( 1.0, -1.0));
  n += cell(vec2(-1.0,  0.0));
  n += cell(vec2( 1.0,  0.0));
  n += cell(vec2(-1.0,  1.0));
  n += cell(vec2( 0.0,  1.0));
  n += cell(vec2( 1.0,  1.0));

  float alive = texture(uState, vUv).r;
  float next;
  if (alive > 0.5) {
    next = (n > 1.5 && n < 3.5) ? 1.0 : 0.0;   // survive with 2 or 3 neighbours
  } else {
    next = (n > 2.5 && n < 3.5) ? 1.0 : 0.0;   // born with exactly 3
  }

  // Cursor paints living cells.
  if (uMouseDown > 0.5 && distance(vUv, uMouse) < 0.02) next = 1.0;

  float heat = max(next, texture(uState, vUv).g * 0.90);
  fragColor = vec4(next, heat, 0.0, 1.0);
}
