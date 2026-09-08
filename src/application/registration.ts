import { z } from "zod";

const password = z.string().min(10).max(128);
const email = z.string().trim().toLowerCase().email().max(254);
const inviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MTP-[MA]-[A-Z2-9]{16,24}$/);

export const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email,
  password,
  inviteCode,
  requestId: z.string().uuid(),
});

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const passwordUpdateSchema = z
  .object({
    password,
    confirmation: password,
  })
  .refine(({ password: value, confirmation }) => value === confirmation, {
    message: "Passwords must match.",
    path: ["confirmation"],
  });

export const accessCodeRotationSchema = z.object({
  kind: z.enum(["member", "admin"]),
  requestId: z.string().uuid(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
