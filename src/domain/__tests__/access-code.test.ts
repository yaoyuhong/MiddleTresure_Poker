import { describe, expect, it, vi } from "vitest";

import { generateAccessCode } from "../access-code";

describe("generateAccessCode", () => {
  it("creates a human-readable member code with 80 bits of symbols", () => {
    const randomBytes = vi.fn((size: number) =>
      Uint8Array.from({ length: size }, (_, index) => index),
    );

    expect(generateAccessCode("member", randomBytes)).toMatch(
      /^MTP-M-[A-Z2-9]{16}$/,
    );
    expect(randomBytes).toHaveBeenCalledWith(16);
  });

  it("creates a longer administrator code with a distinct prefix", () => {
    const randomBytes = (size: number) => new Uint8Array(size).fill(7);

    expect(generateAccessCode("admin", randomBytes)).toMatch(
      /^MTP-A-[A-Z2-9]{24}$/,
    );
    expect(generateAccessCode("admin", randomBytes)).not.toBe(
      generateAccessCode("member", randomBytes),
    );
  });
});
