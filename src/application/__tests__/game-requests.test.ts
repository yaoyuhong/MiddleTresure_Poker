import { describe, expect, it } from "vitest";

import {
  cancelGameRequestSchema,
  memberGameRequestSchema,
  reviewGameRequestSchema,
} from "../game-requests";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("memberGameRequestSchema", () => {
  it.each([
    { action: "join", amount: 1_000 },
    { action: "add_on", amount: 500 },
    { action: "exit", amount: 0 },
  ])("accepts $action amount rules", (input) => {
    expect(
      memberGameRequestSchema.safeParse({ ...input, requestId }).success,
    ).toBe(true);
  });

  it("rejects a negative exit and zero buy-in", () => {
    expect(
      memberGameRequestSchema.safeParse({
        action: "exit",
        amount: -1,
        requestId,
      }).success,
    ).toBe(false);
    expect(
      memberGameRequestSchema.safeParse({
        action: "join",
        amount: 0,
        requestId,
      }).success,
    ).toBe(false);
  });
});

describe("request transitions", () => {
  it("validates review and cancellation request IDs", () => {
    expect(
      reviewGameRequestSchema.safeParse({
        decision: "approve",
        note: "",
        requestId,
      }).success,
    ).toBe(true);
    expect(cancelGameRequestSchema.safeParse({ requestId }).success).toBe(true);
  });

  it("limits administrator review notes", () => {
    expect(
      reviewGameRequestSchema.safeParse({
        decision: "reject",
        note: "x".repeat(501),
        requestId,
      }).success,
    ).toBe(false);
  });
});
