import { z } from "zod";

const requestId = z.string().uuid();
const positiveAmount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeAmount = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const memberGameRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), amount: positiveAmount, requestId }),
  z.object({ action: z.literal("add_on"), amount: positiveAmount, requestId }),
  z.object({ action: z.literal("exit"), amount: nonNegativeAmount, requestId }),
]);

export const reviewGameRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
  requestId,
});

export const cancelGameRequestSchema = z.object({ requestId });

export type MemberGameRequestInput = z.infer<typeof memberGameRequestSchema>;
export type ReviewGameRequestInput = z.infer<typeof reviewGameRequestSchema>;
