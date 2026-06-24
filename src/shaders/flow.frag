// flow.frag — domain-warped fractal noise (à la IQ) that drifts like ink in
// water. The cursor swirls the field locally; holding the button intensifies it.

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;      // uv space, y up
uniform float uMouseDown;  // 0 or 1
uniform float uHue;
uniform float uAspect;

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float t = uTime;

  // Local swirl around the cursor.
  vec2 m = (uMouse - 0.5);
  m.x *= uAspect;
  vec2 rel = p - m;
  float dist = length(rel);
  float swirl = exp(-dist * 3.5) * (1.2 + uMouseDown * 2.5);
  vec2 sp = m + rot(swirl * 2.2) * rel;

  // Two-stage domain warp.
  vec2 cc = sp * 3.0;
  vec2 q = vec2(
    fbm(cc + t * 0.10),
    fbm(cc + vec2(5.2, 1.3) + t * 0.11)
  );
  vec2 r = vec2(
    fbm(cc + 4.0 * q + vec2(1.7, 9.2)),
    fbm(cc + 4.0 * q + vec2(8.3, 2.8))
  );
  float f = fbm(cc + 4.0 * r);

  vec3 col = palette(
    f + 0.12 * q.x + t * 0.02,
    vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
    vec3(1.0, 0.9, 0.8), vec3(0.30, 0.20, 0.60)
  );

  // Bright filaments where the warp folds over itself.
  col += vec3(0.3, 0.8, 1.0) * smoothstep(0.62, 1.0, f) * 0.6;
  col *= 0.55 + 0.9 * f;                       // contrast

  // Cursor highlight.
  col += vec3(1.0, 0.6, 0.9) * exp(-dist * 9.0) * (0.4 + uMouseDown * 0.8);

  col = hueShift(col, uHue);
  fragColor = vec4(max(col, 0.0), 1.0);
}
