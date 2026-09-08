import { describe, expect, it } from "vitest";

import { parseAuthConfirmation } from "../auth-confirmation";

describe("parseAuthConfirmation", () => {
  it("accepts an invite token hash and local destination", () => {
    const result = parseAuthConfirmation(
      new URL(
        "https://club.example/auth/confirm?token_hash=abc123&type=invite&next=/club",
      ),
    );

    expect(result).toEqual({
      tokenHash: "abc123",
      type: "invite",
      nextPath: "/club",
    });
  });

  it("rejects unsupported or incomplete confirmation data", () => {
    expect(
      parseAuthConfirmation(
        new URL("https://club.example/auth/confirm?type=invite"),
      ),
    ).toBeNull();
    expect(
      parseAuthConfirmation(
        new URL(
          "https://club.example/auth/confirm?token_hash=abc&type=unknown",
        ),
      ),
    ).toBeNull();
  });

  it("prevents external post-authentication redirects", () => {
    expect(
      parseAuthConfirmation(
        new URL(
          "https://club.example/auth/confirm?token_hash=abc&type=magiclink&next=//evil.example",
        ),
      ),
    ).toEqual({
      tokenHash: "abc",
      type: "magiclink",
      nextPath: "/club",
    });
  });

  it("accepts password recovery only to a local reset page", () => {
    expect(
      parseAuthConfirmation(
        new URL(
          "https://club.example/auth/confirm?token_hash=reset&type=recovery&next=/reset-password",
        ),
      ),
    ).toEqual({
      tokenHash: "reset",
      type: "recovery",
      nextPath: "/reset-password",
    });
  });
});
