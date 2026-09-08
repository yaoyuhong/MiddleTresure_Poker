import { z } from "zod";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type PublicEnvironment = z.infer<typeof publicSchema>;
export type ServerEnvironment = z.infer<typeof serverSchema>;

export function getPublicEnv(
  source: EnvironmentSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): PublicEnvironment {
  const result = publicSchema.safeParse(source);

  if (!result.success) {
    throw new Error("Invalid public environment configuration.");
  }

  return result.data;
}

export function getServerEnv(
  source: EnvironmentSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
): ServerEnvironment {
  const result = serverSchema.safeParse(source);

  if (!result.success) {
    throw new Error("Invalid server environment configuration.");
  }

  return result.data;
}
