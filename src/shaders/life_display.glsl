// life_display.glsl — render the Game of Life grid: dark field, neon heat
// trails for recently-living cells, crisp highlights for the living.

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2D uState;
uniform float uHue;
uniform float uTime;

void main() {
  vec2 s = texture(uState, vUv).rg;
  float alive = s.r;
  float heat = s.g;

  vec3 bg = vec3(0.02, 0.0, 0.06);
  vec3 trail = palette(
    0.62 - heat * 0.55 + uTime * 0.03,
    vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0), vec3(0.10, 0.40, 0.72)
  );

  vec3 col = bg + trail * heat;
  col += vec3(0.9, 1.0, 1.0) * alive * 0.35;

  col = hueShift(col, uHue);
  fragColor = vec4(col, 1.0);
}
