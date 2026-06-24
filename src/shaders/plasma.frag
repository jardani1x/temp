// plasma.frag — classic sum-of-sines plasma with a glowing oscilloscope curve
// drawn on top. The cursor drags the plasma's radial center and re-tunes the
// Lissajous frequencies.

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;   // uv space, y up
uniform float uHue;
uniform float uAspect;

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float t = uTime;
  vec2 m = (uMouse - 0.5);
  m.x *= uAspect;

  // ---- plasma field --------------------------------------------------------
  float v = 0.0;
  v += sin(p.x * 10.0 + t);
  v += sin(p.y * 10.0 + t * 0.5);
  v += sin((p.x + p.y) * 8.0 + t);
  vec2 c = p + vec2(0.5 * sin(t * 0.33), 0.5 * cos(t * 0.40)) + m;
  v += sin(sqrt(120.0 * dot(c, c) + 1.0) - t * 1.5);
  v *= 0.25;

  vec3 col = palette(
    v + t * 0.03,
    vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 0.5), vec3(0.80, 0.90, 0.30)
  );

  // ---- oscilloscope Lissajous trace ---------------------------------------
  // Accumulated inverse-square glow along a parametric curve = phosphor beam.
  float ax = 3.0 + floor((uMouse.x) * 3.0);
  float ay = 2.0 + floor((uMouse.y) * 3.0);
  float scope = 0.0;
  for (int i = 0; i < 128; i++) {
    float s = float(i) / 128.0 * TAU;
    vec2 lp = vec2(sin(ax * s + t * 0.5), sin(ay * s)) * 0.42;
    vec2 dlt = p - lp;
    scope += 0.00045 / (dot(dlt, dlt) + 0.0006);
  }
  col += vec3(0.4, 1.0, 0.65) * scope;

  col = hueShift(col, uHue);
  fragColor = vec4(max(col, 0.0), 1.0);
}
