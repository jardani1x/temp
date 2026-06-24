// deadair.frag — the "no signal" station. Television snow, a ghost of SMPTE
// color bars bleeding through, a rolling sync bar and head-switching noise at
// the bottom. Move the cursor left/right to "tune" between bars and pure snow.

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHue;

vec3 barColor(int i) {
  if (i <= 0) return vec3(0.75);
  if (i == 1) return vec3(0.75, 0.75, 0.0);
  if (i == 2) return vec3(0.0, 0.75, 0.75);
  if (i == 3) return vec3(0.0, 0.75, 0.0);
  if (i == 4) return vec3(0.75, 0.0, 0.75);
  if (i == 5) return vec3(0.75, 0.0, 0.0);
  if (i == 6) return vec3(0.0, 0.0, 0.75);
  return vec3(0.0);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;

  // White noise snow, re-rolled a few dozen times per second.
  vec2 cell = floor(gl_FragCoord.xy) + floor(t * 48.0) * 13.0;
  float snow = hash21(cell);
  snow = snow * snow;                      // crush toward black for grit

  // Ghost color bars.
  int bi = int(floor(clamp(uv.x, 0.0, 0.999) * 7.0));
  vec3 bars = barColor(bi);
  // Bottom 25%: castellation row of darker bars, like a real test card.
  if (uv.y < 0.25) bars = barColor(int(floor(uv.x * 4.0))) * 0.4;

  // How much real "signal" is present (cursor tunes it).
  float signal = clamp(uMouse.x * 0.9 + 0.05 * sin(t * 0.6), 0.0, 0.85);
  vec3 col = mix(vec3(snow), mix(vec3(snow), bars, 0.8), signal);

  // Rolling sync bar drifting upward.
  float band = fract(uv.y * 1.0 + t * 0.35);
  col += smoothstep(0.97, 1.0, band) * 0.5;

  // Head-switching tear near the very bottom.
  float head = smoothstep(0.06, 0.0, uv.y) * step(0.5, hash21(vec2(floor(t * 30.0), 1.0)));
  col = mix(col, vec3(hash21(gl_FragCoord.yx + t)), head * 0.8);

  col = hueShift(col, uHue);
  fragColor = vec4(col, 1.0);
}
