// brightpass.glsl — keep only the bright parts of the image so the blur passes
// turn them into bloom. Everything below the threshold fades to black.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform float uThreshold;

void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float k = smoothstep(uThreshold, uThreshold + 0.35, luma(c));
  fragColor = vec4(c * k, 1.0);
}
