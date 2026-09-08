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
