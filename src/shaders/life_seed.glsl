// life_seed.glsl — random "soup" initial state for Game of Life.
// R = alive (0/1), G = heat (glow trail), seeded equal to alive.

in vec2 vUv;
out vec4 fragColor;

uniform float uSeed;

void main() {
  float alive = step(0.62, hash21(floor(gl_FragCoord.xy) + uSeed * 17.0));
  fragColor = vec4(alive, alive, 0.0, 1.0);
}
