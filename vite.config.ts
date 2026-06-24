/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// CATHODE-88 is a zero-framework Vite app. We keep the config tiny on purpose:
// raw GLSL is imported via Vite's built-in `?raw` suffix, so no extra plugins
// are needed. `base: "./"` makes the production build work from any static host
// (or from `file://`-style relative paths) without configuration.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
