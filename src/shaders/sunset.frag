// sunset.frag — the iconic vaporwave scene: banded sun, neon perspective grid,
// twinkling stars. Mouse moves the sun and parallaxes the world.

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;   // uv space, y up
uniform float uHue;
uniform float uAspect;

// Distance to the nearest grid line at integer+0.5 positions.
float gridGlow(float coord, float halfWidth) {
  float d = abs(fract(coord) - 0.5);
  return smoothstep(halfWidth, 0.0, d);
}

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;

  float par = (uMouse.x - 0.5);              // -0.5..0.5 horizontal parallax
  float horizon = 0.0 + (uMouse.y - 0.5) * 0.12;
  float t = uTime;

  vec3 col;

  if (p.y > horizon) {
    // ---- SKY -------------------------------------------------------------
    float h = (p.y - horizon) / (0.5 - horizon);        // 0 at horizon, 1 at top
    vec3 sky = palette(
      0.55 - h * 0.45,
      vec3(0.5, 0.2, 0.5), vec3(0.5, 0.35, 0.5),
      vec3(1.0, 1.0, 1.0), vec3(0.0, 0.15, 0.3)
    );
    col = sky;

    // Stars, fading in toward the top of the sky.
    vec2 sp = floor((p + vec2(par * 0.1, 0.0)) * 90.0);
    float star = step(0.985, hash21(sp));
    float tw = 0.5 + 0.5 * sin(t * 3.0 + hash21(sp) * TAU);
    col += star * tw * smoothstep(0.0, 0.6, h) * 0.9;

    // ---- SUN -------------------------------------------------------------
    vec2 sun = p - vec2(par * 0.25, horizon + 0.18);
    float r = length(sun);
    float disc = smoothstep(0.30, 0.285, r);
    // Vertical gradient across the sun face (gold top -> hot magenta bottom).
    float sy = (sun.y + 0.30) / 0.60;
    vec3 sunCol = palette(
      0.0 + sy * 0.35,
      vec3(0.9, 0.4, 0.45), vec3(0.5, 0.45, 0.3),
      vec3(1.0, 1.0, 1.0), vec3(0.1, 0.25, 0.55)
    );
    // Retro slit bands: cut horizontal gaps, widening toward the bottom.
    float bandPhase = (sun.y) * 26.0;
    float gap = smoothstep(0.0, -0.30, sun.y);          // 0 at center, 1 low
    float bands = step(0.5 + gap * 0.45, fract(bandPhase));
    float sunMask = disc * bands;
    col = mix(col, sunCol, sunMask);

    // Soft outer glow / atmosphere around the sun.
    col += sunCol * smoothstep(0.55, 0.0, r) * 0.25;
  } else {
    // ---- GROUND: neon perspective grid -----------------------------------
    float d = horizon - p.y;                  // depth below horizon (>0)
    float persp = 1.0 / max(d, 1.0e-3);
    float gx = (p.x + par * 0.1) * persp * 0.75;
    float gz = persp * 0.5 - t * 0.7;

    float lines = max(gridGlow(gx, 0.05), gridGlow(gz, 0.06));
    // Floor base color darkens with depth; horizon edge glows.
    vec3 floorCol = mix(vec3(0.05, 0.0, 0.12), vec3(0.20, 0.02, 0.25), exp(-d * 2.0));
    vec3 neon = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.85), 0.5 + 0.5 * sin(gz));
    col = floorCol + neon * lines * (0.35 + 0.65 * exp(-d * 1.2));

    // Sun reflection: a bright column under the sun fading downward.
    float refl = smoothstep(0.18, 0.0, abs(p.x - par * 0.25)) * exp(-d * 1.6);
    col += vec3(1.0, 0.4, 0.7) * refl * 0.6;

    // Horizon haze.
    col += vec3(1.0, 0.5, 0.8) * smoothstep(0.04, 0.0, d) * 0.8;
  }

  col = hueShift(col, uHue);
  col = pow(max(col, 0.0), vec3(0.9));     // gentle lift
  fragColor = vec4(col, 1.0);
}
