// Copy the static frontend (src/web) into the build output (dist/web) so the
// production server can serve it. Runs after `tsc` in the build script.
import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src", "web");
const dest = path.join(root, "dist", "web");

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
