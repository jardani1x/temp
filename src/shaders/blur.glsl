// blur.glsl — one direction of a separable 9-tap Gaussian. Run it twice
// (horizontal then vertical) for a full blur. `uDir` is the per-tap step in
// UV space (already scaled by texel size and spread on the CPU side).

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2 uDir;

void main() {
  float weights[5] = float[5](0.227027, 0.194595, 0.121622, 0.054054, 0.016216);
  vec3 c = texture(uTex, vUv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDir * float(i);
    c += texture(uTex, vUv + offset).rgb * weights[i];
    c += texture(uTex, vUv - offset).rgb * weights[i];
  }
  fragColor = vec4(c, 1.0);
}
