import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/reset-debug-club.mjs";

describe("reset-debug-club CLI", () => {
  it("documents the destructive confirmation contract", () => {
    const output = execFileSync("node", [script, "--help"], {
      encoding: "utf8",
    });

    expect(output).toContain("--retained-admin-email");
    expect(output).toContain("--confirm DELETE_ALL_DEBUG_DATA");
    expect(output).toContain("--dry-run");
  });

  it("validates an exact dry-run without production credentials", () => {
    const output = execFileSync(
      "node",
      [
        script,
        "--retained-admin-email",
        "KEEPER@example.com",
        "--confirm",
        "DELETE_ALL_DEBUG_DATA",
        "--dry-run",
      ],
      { encoding: "utf8" },
    );

    expect(output).toContain('"retainedAdminEmail": "keeper@example.com"');
    expect(output).toContain('"destructiveConfirmation": true');
  });

  it("refuses an inexact confirmation phrase", () => {
    const result = spawnSync(
      "node",
      [
        script,
        "--retained-admin-email",
        "keeper@example.com",
        "--confirm",
        "delete",
        "--dry-run",
      ],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Exact confirmation required");
  });
});
