// channels/index.ts — the broadcast line-up, in tuning order.

import { GL } from "../core/gl";
import { frag } from "../shaders";
import { Channel, ShaderChannel } from "./Channel";
import { ReactionDiffusionChannel } from "./reactionDiffusion";
import { LifeChannel } from "./life";

export function createChannels(gl: GL, width: number, height: number): Channel[] {
  return [
    new ShaderChannel(gl, "sunset", "SUNSET", "endless neon horizon · move to parallax", frag.sunset),
    new ShaderChannel(gl, "flow", "FLOW", "domain-warped curl noise · swirl it", frag.flow),
    new ShaderChannel(gl, "plasma", "PLASMA", "sum-of-sines plasma + oscilloscope", frag.plasma),
    new ReactionDiffusionChannel(gl, width, height),
    new LifeChannel(gl, width, height),
    new ShaderChannel(gl, "deadair", "DEADAIR", "no signal · tune left/right to find it", frag.deadair),
  ];
}
