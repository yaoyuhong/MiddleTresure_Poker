import { z } from "zod";

export const invitationInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const memberAccessSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
});
