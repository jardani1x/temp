// rd_seed.glsl — initialise the reaction-diffusion state. Chemical A fills the
// dish; a scattering of B "droplets" gives the reaction somewhere to start.
// State is packed as (A, B) into the R,G channels of a float texture.

in vec2 vUv;
out vec4 fragColor;

uniform float uSeed;

void main() {
  float A = 1.0;
  float B = 0.0;
  for (int i = 0; i < 28; i++) {
    vec2 c = hash22(vec2(float(i) + uSeed * 3.1, uSeed * 1.7 + 0.5));
    B += smoothstep(0.045, 0.0, distance(vUv, c));
  }
  fragColor = vec4(A, clamp(B, 0.0, 1.0), 0.0, 1.0);
}
