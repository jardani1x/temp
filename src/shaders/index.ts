// shaders/index.ts — single place that loads every GLSL source (via Vite's
// `?raw` import) and composes the final fragment-shader strings.
//
// GLSL ES 3.00 has no `#include`, so we do the simplest thing that works:
// prepend a fixed header (version + precision) and the shared `common.glsl`
// helper library to each fragment body. Keeping this in one module means the
// channels and post passes just import ready-to-compile strings.

import common from "./common.glsl?raw";

import sunsetSrc from "./sunset.frag?raw";
import flowSrc from "./flow.frag?raw";
import plasmaSrc from "./plasma.frag?raw";
import deadairSrc from "./deadair.frag?raw";

import rdSeedSrc from "./rd_seed.glsl?raw";
import rdSimSrc from "./rd_sim.glsl?raw";
import rdDisplaySrc from "./rd_display.glsl?raw";

import lifeSeedSrc from "./life_seed.glsl?raw";
import lifeSimSrc from "./life_sim.glsl?raw";
import lifeDisplaySrc from "./life_display.glsl?raw";

import brightpassSrc from "./brightpass.glsl?raw";
import blurSrc from "./blur.glsl?raw";
import crtSrc from "./crt.glsl?raw";
import copySrc from "./copy.glsl?raw";

const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

/** Build a complete fragment shader: header + shared helpers + body. */
export function composeFragment(body: string): string {
  return `${HEADER}\n${common}\n${body}`;
}

/** All composed fragment shaders, keyed by name. */
export const frag = {
  sunset: composeFragment(sunsetSrc),
  flow: composeFragment(flowSrc),
  plasma: composeFragment(plasmaSrc),
  deadair: composeFragment(deadairSrc),

  rdSeed: composeFragment(rdSeedSrc),
  rdSim: composeFragment(rdSimSrc),
  rdDisplay: composeFragment(rdDisplaySrc),

  lifeSeed: composeFragment(lifeSeedSrc),
  lifeSim: composeFragment(lifeSimSrc),
  lifeDisplay: composeFragment(lifeDisplaySrc),

  brightpass: composeFragment(brightpassSrc),
  blur: composeFragment(blurSrc),
  crt: composeFragment(crtSrc),
  copy: composeFragment(copySrc),
} as const;

export type FragName = keyof typeof frag;
