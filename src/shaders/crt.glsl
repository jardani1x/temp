// crt.glsl — the look. Takes the raw channel image (+ bloom + last frame) and
// runs it through a cathode-ray tube: screen curvature, chromatic aberration,
// scanlines, an aperture-grille subpixel mask, vignette, grain, a phosphor
// persistence feedback, plus the VHS tracking + channel-change static/roll that
// the bezel knobs drive.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;   // current channel image
uniform sampler2D uBloom;   // blurred bright pass
uniform sampler2D uPrev;    // previous CRT output (for persistence)
uniform vec2  uResolution;  // output resolution, px
uniform float uTime;
uniform float uTracking;    // VHS distortion amount   0..1
uniform float uGlow;        // bloom amount            0..1
uniform float uScanline;    // scanline depth          0..1
uniform float uPersist;     // phosphor persistence     0..1
uniform float uChange;      // channel-change burst     0..1 (decays)

// Barrel distortion to fake tube curvature.
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(5.0, 4.0);
  uv += uv * offset * offset * 0.18;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = vUv;

  // --- pre-sample warps (tracking + channel change) -----------------------
  // Vertical roll: a violent jump right after a channel change, settling fast.
  uv.y = fract(uv.y + uChange * 0.35);

  // Horizontal line jitter + a slow wobble — classic worn-tape tracking.
  float lineNoise = hash21(vec2(floor(uv.y * uResolution.y), floor(uTime * 30.0))) - 0.5;
  uv.x += lineNoise * uTracking * 0.02;
  uv.x += sin(uv.y * 40.0 + uTime * 5.0) * uTracking * 0.004;

  vec2 cuv = curve(uv);

  // --- chromatic aberration -----------------------------------------------
  float ab = 0.0012 + uTracking * 0.004;
  vec3 col;
  col.r = texture(uScene, cuv + vec2(ab, 0.0)).r;
  col.g = texture(uScene, cuv).g;
  col.b = texture(uScene, cuv - vec2(ab, 0.0)).b;

  // --- bloom --------------------------------------------------------------
  col += texture(uBloom, cuv).rgb * uGlow * 1.6;

  // --- channel-change static burst ----------------------------------------
  float snow = hash21(gl_FragCoord.xy + floor(uTime * 60.0) * 7.0);
  col = mix(col, vec3(snow), clamp(uChange, 0.0, 1.0) * 0.75);

  // --- scanlines (fixed line count so it doesn't shimmer with resolution) --
  float lines = 320.0;
  float scan = 0.5 + 0.5 * sin(cuv.y * lines * TAU);
  col *= mix(1.0, scan, uScanline * 0.7);

  // --- aperture-grille subpixel mask --------------------------------------
  float grilleAmt = 0.12;
  vec3 grille = 0.5 + 0.5 * cos(
    gl_FragCoord.x * (TAU / 3.0) + vec3(0.0, TAU / 3.0, 2.0 * TAU / 3.0)
  );
  col *= (1.0 - grilleAmt) + grilleAmt * grille * 2.0;

  // --- vignette + soft tube border ----------------------------------------
  float vig = cuv.x * (1.0 - cuv.x) * cuv.y * (1.0 - cuv.y);
  col *= clamp(pow(max(vig, 0.0) * 16.0, 0.22), 0.0, 1.0); // max() avoids NaN past the curved edge

  float border =
    smoothstep(0.0, 0.006, cuv.x) * smoothstep(1.0, 0.994, cuv.x) *
    smoothstep(0.0, 0.006, cuv.y) * smoothstep(1.0, 0.994, cuv.y);
  col *= border;

  // --- grain + gentle mains flicker ---------------------------------------
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.035;
  col *= 0.985 + 0.015 * sin(uTime * 8.0);

  // --- phosphor persistence (screen-space feedback) -----------------------
  vec3 prev = texture(uPrev, vUv).rgb;
  col = max(col, prev * uPersist);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
