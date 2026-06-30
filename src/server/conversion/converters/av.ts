import path from "node:path";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { config } from "../../config.js";
import { run } from "../../util/exec.js";
import { mimeFor } from "../../util/mime.js";

const AUDIO = new Set<Format>(["mp3", "wav", "ogg", "opus", "flac", "aac", "m4a", "wma"]);
const VIDEO = new Set<Format>(["mp4", "webm", "mkv", "mov", "avi", "flv", "wmv"]);
// Animated image targets ffmpeg can produce from a video source.
const VIDEO_IMAGE_OUT = new Set<Format>(["gif", "webp"]);

function isAudio(f: Format) {
  return AUDIO.has(f);
}
function isVideo(f: Format) {
  return VIDEO.has(f);
}

/**
 * Per-target ffmpeg argument presets. Returned args are inserted before the
 * output path. We let ffmpeg infer the container from the extension and only
 * pin codecs where the default would be poor or unavailable.
 */
function targetArgs(to: Format, from: Format): string[] {
  switch (to) {
    // ---- animated image (from video) ----
    case "gif":
      return ["-vf", "fps=12,scale=480:-1:flags=lanczos", "-loop", "0"];
    case "webp":
      return ["-c:v", "libwebp", "-vf", "fps=15,scale=640:-1:flags=lanczos", "-loop", "0", "-an", "-vsync", "0"];


    // ---- audio ----
    case "mp3":
      return ["-vn", "-c:a", "libmp3lame", "-q:a", "2"];
    case "wav":
      return ["-vn", "-c:a", "pcm_s16le"];
    case "flac":
      return ["-vn", "-c:a", "flac"];
    case "ogg":
      return ["-vn", "-c:a", "libvorbis", "-q:a", "5"];
    case "opus":
      return ["-vn", "-c:a", "libopus", "-b:a", "128k"];
    case "aac":
    case "m4a":
      return ["-vn", "-c:a", "aac", "-b:a", "192k"];
    case "wma":
      return ["-vn", "-c:a", "wmav2", "-b:a", "192k"];

    // ---- video ----
    case "mp4":
    case "mov":
      return ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-pix_fmt", "yuv420p"];
    case "webm":
      return ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-c:a", "libopus"];
    case "mkv":
      return ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", "-b:a", "192k"];
    case "avi":
      return ["-c:v", "mpeg4", "-q:v", "4", "-c:a", "libmp3lame", "-q:a", "3"];
    case "flv":
      return ["-c:v", "flv", "-q:v", "4", "-c:a", "aac", "-b:a", "128k"];
    case "wmv":
      return ["-c:v", "wmv2", "-q:v", "4", "-c:a", "wmav2", "-b:a", "192k"];
    default:
      void from;
      return [];
  }
}

/** Audio & video conversion powered by ffmpeg. */
export const avConverter: Converter = {
  name: "av",
  requiresTool: "ffmpeg",

  supports(from: Format, to: Format): boolean {
    // Video -> animated image (GIF / animated WebP).
    if (isVideo(from) && VIDEO_IMAGE_OUT.has(to)) return true;

    const fromAV = isAudio(from) || isVideo(from);
    const toAV = isAudio(to) || isVideo(to);
    if (!fromAV || !toAV) return false;
    // Cannot synthesise video from audio.
    if (isAudio(from) && isVideo(to)) return false;
    return true;
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    const { inputPath, from, to, outputDir, baseName } = input;
    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);

    const args = ["-y", "-i", inputPath, ...targetArgs(to, from), outputPath];
    const res = await run(config.tools.ffmpeg, args, { timeoutMs: 600_000 });

    if (res.code !== 0) {
      const tail = res.stderr.split("\n").slice(-4).join(" ").trim();
      throw new ConversionError(
        `ffmpeg exited ${res.code}: ${tail}`,
        "The media file could not be converted. It may be corrupt or use an unsupported codec.",
      );
    }

    return { outputPath, fileName, mimeType: mimeFor(to) };
  },
};
