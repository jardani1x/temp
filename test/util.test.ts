import { describe, it, expect } from "vitest";
import { clamp, clamp01, wrapIndex, mapRange } from "../src/util";

describe("clamp", () => {
  it("passes values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below and above", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("clamp01 is the [0,1] case", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});

describe("wrapIndex", () => {
  it("is the identity inside the range", () => {
    expect(wrapIndex(3, 6)).toBe(3);
  });
  it("wraps past the end back to the start", () => {
    expect(wrapIndex(6, 6)).toBe(0);
    expect(wrapIndex(7, 6)).toBe(1);
  });
  it("wraps negatives correctly", () => {
    expect(wrapIndex(-1, 6)).toBe(5);
    expect(wrapIndex(-7, 6)).toBe(5);
  });
  it("guards against zero/negative length", () => {
    expect(wrapIndex(2, 0)).toBe(0);
  });
});

describe("mapRange", () => {
  it("remaps linearly", () => {
    expect(mapRange(0.5, 0, 1, 0, 100)).toBe(50);
    expect(mapRange(5, 0, 10, -1, 1)).toBe(0);
  });
  it("returns outMin for a degenerate input range", () => {
    expect(mapRange(5, 2, 2, 7, 9)).toBe(7);
  });
});
