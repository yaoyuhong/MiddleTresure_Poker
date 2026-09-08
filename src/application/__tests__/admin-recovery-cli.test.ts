import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/reset-admin-password.mjs";

describe("reset-admin-password CLI", () => {
  it("documents the non-interactive recovery contract", () => {
    const output = execFileSync("node", [script, "--help"], {
      encoding: "utf8",
    });

    expect(output).toContain("--admin-email");
    expect(output).toContain("ADMIN_RESET_PASSWORD");
    expect(output).toContain("--dry-run");
    expect(output).toContain("verifies a password login");
  });

  it("validates without printing the temporary password", () => {
    const password = "Temporary-Admin-482!";
    const output = execFileSync(
      "node",
      [script, "--admin-email", "ADMIN@example.com", "--dry-run"],
      {
        encoding: "utf8",
        env: { ...process.env, ADMIN_RESET_PASSWORD: password },
      },
    );

    expect(output).toContain('"adminEmail": "admin@example.com"');
    expect(output).toContain('"loginVerification": "skipped"');
    expect(output).not.toContain(password);
  });

  it("rejects weak temporary passwords", () => {
    const result = spawnSync(
      "node",
      [script, "--admin-email", "admin@example.com", "--dry-run"],
      {
        encoding: "utf8",
        env: { ...process.env, ADMIN_RESET_PASSWORD: "short" },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ADMIN_RESET_PASSWORD must contain at least 12 characters",
    );
    expect(result.stderr).not.toContain("short");
  });
});
