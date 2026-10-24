import { describe, expect, it } from "vitest";
import { normalizeBooleanFlag } from "../../shared/boolean-flags";

describe("normalizeBooleanFlag", () => {
  it("normalizes database and API active flags to strict booleans", () => {
    expect(normalizeBooleanFlag(1)).toBe(true);
    expect(normalizeBooleanFlag(0)).toBe(false);
    expect(normalizeBooleanFlag(true)).toBe(true);
    expect(normalizeBooleanFlag(false)).toBe(false);
    expect(normalizeBooleanFlag("1")).toBe(true);
    expect(normalizeBooleanFlag("0")).toBe(false);
    expect(normalizeBooleanFlag(null)).toBe(false);
    expect(normalizeBooleanFlag(undefined)).toBe(false);
  });
});
