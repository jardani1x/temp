import { describe, it, expect } from "vitest";
import { frag, composeFragment } from "../src/shaders";

// These run under Vitest's Vite pipeline, so the `?raw` GLSL imports resolve
// exactly as they do in the app. We can't compile GLSL without a GPU, but we
// can guarantee every shader is well-formed enough to *reach* the compiler:
// one version directive, a precision header, shared helpers, and a main().

const names = Object.keys(frag) as (keyof typeof frag)[];

describe("composed fragment shaders", () => {
  it("exposes the full set of shaders", () => {
    expect(names.length).toBeGreaterThanOrEqual(14);
  });

  for (const name of names) {
    describe(name, () => {
      const src = frag[name];

      it("starts with the GLSL ES 3.00 version directive", () => {
        expect(src.startsWith("#version 300 es")).toBe(true);
      });

      it("declares float precision and exactly one #version directive", () => {
        expect(src).toContain("precision highp float;");
        // Count real directive lines (a "#version" inside a // comment is fine).
        const directives = src
          .split("\n")
          .filter((line) => line.trim().startsWith("#version")).length;
        expect(directives).toBe(1);
      });

      it("includes the shared helper library and an entry point", () => {
        expect(src).toContain("hsv2rgb"); // from common.glsl
        expect(src).toContain("void main");
      });
    });
  }
});

describe("composeFragment", () => {
  it("prepends the header before the body", () => {
    const out = composeFragment("void main() { fragColor = vec4(1.0); }");
    expect(out.indexOf("#version 300 es")).toBe(0);
    expect(out.indexOf("void main")).toBeGreaterThan(0);
  });
});
