// rd_display.glsl — turn reaction-diffusion state into a glowing vaporwave image.

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2D uState;   // highp: state lives in a float texture
uniform float uHue;
uniform float uTime;

void main() {
  vec2 s = texture(uState, vUv).xy;
  float b = s.y;

  vec3 col = palette(
    0.55 - b * 0.65 + uTime * 0.02,
    vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0), vec3(0.00, 0.33, 0.66)
  );
  col *= smoothstep(0.05, 0.35, b);          // dark dish where nothing grows
  col += smoothstep(0.25, 0.55, b) * 0.35;   // bright ridges

  col = hueShift(col, uHue);
  fragColor = vec4(max(col, 0.0), 1.0);
}
