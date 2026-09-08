import { describe, expect, it } from "vitest";

import { correctionRequestSchema, gameActionSchema } from "../game-actions";

const id = "123e4567-e89b-42d3-a456-426614174000";

describe("game action validation", () => {
  it("accepts a safe integer add-on", () => {
    expect(
      gameActionSchema.safeParse({
        action: "add-on",
        expectedVersion: 3,
        gamePlayerId: id,
        amount: 500,
      }).success,
    ).toBe(true);
  });

  it("rejects fractional financial writes", () => {
    expect(
      gameActionSchema.safeParse({
        action: "exit",
        expectedVersion: 3,
        gamePlayerId: id,
        amount: 10.5,
      }).success,
    ).toBe(false);
  });
});

describe("correction request validation", () => {
  it("accepts an attributable signed correction", () => {
    expect(
      correctionRequestSchema.safeParse({
        expectedVersion: 8,
        note: "Cash-out was entered 100 chips too low.",
        corrections: [
          {
            gamePlayerId: id,
            correctionOf: "223e4567-e89b-42d3-a456-426614174000",
            buyInDelta: 0,
            cashOutDelta: 100,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects no-op and unsafe corrections", () => {
    expect(
      correctionRequestSchema.safeParse({
        expectedVersion: 8,
        note: "No change",
        corrections: [
          {
            gamePlayerId: id,
            correctionOf: "223e4567-e89b-42d3-a456-426614174000",
            buyInDelta: 0,
            cashOutDelta: 0,
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      correctionRequestSchema.safeParse({
        expectedVersion: 8,
        note: "Unsafe",
        corrections: [
          {
            gamePlayerId: id,
            correctionOf: "223e4567-e89b-42d3-a456-426614174000",
            buyInDelta: Number.MAX_SAFE_INTEGER + 1,
            cashOutDelta: 0,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
