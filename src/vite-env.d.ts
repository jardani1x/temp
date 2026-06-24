/// <reference types="vite/client" />

// Vite's client types already declare `*?raw` imports as `string`, but we add an
// explicit declaration for `*.glsl` so editors give us nice hovers on shader
// sources even without the query suffix.
declare module "*.glsl" {
  const source: string;
  export default source;
}
