// channels/index.ts — the broadcast line-up, in tuning order.
//
// Station construction is fault-tolerant: if a station can't initialise on this
// GPU (e.g. no float render targets for BLOOM), we skip it and keep the rest,
// so one unsupported feature never blanks the whole set.

import { GL, GLError } from "../core/gl";
import { frag } from "../shaders";
import { Channel, ShaderChannel } from "./Channel";
import { ReactionDiffusionChannel } from "./reactionDiffusion";
import { LifeChannel } from "./life";

export function createChannels(gl: GL, width: number, height: number): Channel[] {
  const channels: Channel[] = [];

  const add = (id: string, make: () => Channel) => {
    try {
      channels.push(make());
    } catch (err) {
      console.error(`[CATHODE-88] station "${id}" failed to initialise and was skipped:`, err);
    }
  };

  add("sunset", () => new ShaderChannel(gl, "sunset", "SUNSET", "endless neon horizon · move to parallax", frag.sunset));
  add("flow", () => new ShaderChannel(gl, "flow", "FLOW", "domain-warped curl noise · swirl it", frag.flow));
  add("plasma", () => new ShaderChannel(gl, "plasma", "PLASMA", "sum-of-sines plasma + oscilloscope", frag.plasma));

  // BLOOM (reaction-diffusion) needs to render into a float texture. WebKit
  // (and therefore every browser on iOS) often lacks EXT_color_buffer_float, so
  // we only offer the station when the GPU can actually back it.
  if (gl.getExtension("EXT_color_buffer_float")) {
    add("bloom", () => new ReactionDiffusionChannel(gl, width, height));
  } else {
    console.warn("[CATHODE-88] EXT_color_buffer_float unavailable — BLOOM station disabled on this device.");
  }

  add("life", () => new LifeChannel(gl, width, height));
  add("deadair", () => new ShaderChannel(gl, "deadair", "DEADAIR", "no signal · tune left/right to find it", frag.deadair));

  if (channels.length === 0) {
    throw new GLError("No stations could be initialised on this GPU.");
  }
  return channels;
}
