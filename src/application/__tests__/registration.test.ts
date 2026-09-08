import { describe, expect, it } from "vitest";

import {
  passwordLoginSchema,
  passwordUpdateSchema,
  registrationSchema,
} from "../registration";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("registrationSchema", () => {
  it("normalizes a valid invite-code registration", () => {
    expect(
      registrationSchema.parse({
        displayName: "  Alex  ",
        email: " ALEX@Example.com ",
        password: "ten-characters",
        inviteCode: " mtp-m-23456789abcdefgh ",
        requestId,
      }),
    ).toEqual({
      displayName: "Alex",
      email: "alex@example.com",
      password: "ten-characters",
      inviteCode: "MTP-M-23456789ABCDEFGH",
      requestId,
    });
  });

  it("rejects weak passwords and malformed codes", () => {
    expect(
      registrationSchema.safeParse({
        displayName: "Alex",
        email: "alex@example.com",
        password: "short",
        inviteCode: "guess",
        requestId,
      }).success,
    ).toBe(false);
  });
});

describe("password schemas", () => {
  it("normalizes login email and accepts an existing password", () => {
    expect(
      passwordLoginSchema.parse({
        email: " ALEX@Example.com ",
        password: "existing-password",
      }),
    ).toEqual({
      email: "alex@example.com",
      password: "existing-password",
    });
  });

  it("requires matching new passwords", () => {
    expect(
      passwordUpdateSchema.safeParse({
        password: "new-password",
        confirmation: "different-password",
      }).success,
    ).toBe(false);
  });
});
