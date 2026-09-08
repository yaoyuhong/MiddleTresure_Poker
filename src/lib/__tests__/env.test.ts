import { describe, expect, it } from "vitest";

import { getPublicEnv, getServerEnv } from "../env";

describe("environment validation", () => {
  const publicValues = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  };

  it("returns validated public Supabase settings", () => {
    expect(getPublicEnv(publicValues)).toEqual(publicValues);
  });

  it("rejects missing or malformed public settings", () => {
    expect(() => getPublicEnv({})).toThrow("Invalid public environment");
    expect(() =>
      getPublicEnv({
        ...publicValues,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow("Invalid public environment");
  });

  it("requires the server-only service role key", () => {
    expect(
      getServerEnv({
        ...publicValues,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toEqual({
      ...publicValues,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(() => getServerEnv(publicValues)).toThrow(
      "Invalid server environment",
    );
  });
});
