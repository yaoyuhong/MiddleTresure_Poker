import { z } from "zod";

const version = z.number().int().positive();
const identifier = z.uuid();
const positiveAmount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeAmount = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    expectedVersion: version,
  }),
  z.object({
    action: z.literal("add-player"),
    expectedVersion: version,
    membershipId: identifier,
    amount: positiveAmount,
  }),
  z.object({
    action: z.literal("add-on"),
    expectedVersion: version,
    gamePlayerId: identifier,
    amount: positiveAmount,
  }),
  z.object({
    action: z.literal("exit"),
    expectedVersion: version,
    gamePlayerId: identifier,
    amount: nonNegativeAmount,
  }),
  z.object({
    action: z.literal("finalize"),
    expectedVersion: version,
  }),
]);

export const createSeasonSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const seasonActionSchema = z.object({
  action: z.enum(["open", "close"]),
});

export const createGameSchema = z.object({
  name: z.string().trim().min(1).max(120),
  seasonId: identifier,
});

const signedDelta = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

const correctionSchema = z
  .object({
    gamePlayerId: identifier,
    correctionOf: identifier,
    buyInDelta: signedDelta,
    cashOutDelta: signedDelta,
  })
  .refine(
    ({ buyInDelta, cashOutDelta }) => buyInDelta !== 0 || cashOutDelta !== 0,
    "A correction must change at least one amount.",
  );

export const correctionRequestSchema = z
  .object({
    expectedVersion: version,
    note: z.string().trim().min(1).max(500),
    corrections: z.array(correctionSchema).min(1).max(16),
  })
  .superRefine(({ corrections }, context) => {
    const players = new Set<string>();
    for (const correction of corrections) {
      if (players.has(correction.gamePlayerId)) {
        context.addIssue({
          code: "custom",
          message: "Only one correction per player is allowed.",
          path: ["corrections"],
        });
      }
      players.add(correction.gamePlayerId);
    }
  });
