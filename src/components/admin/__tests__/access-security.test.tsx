import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessSecurity } from "../access-security";

const updateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { updateUser },
  }),
}));

describe("AccessSecurity", () => {
  beforeEach(() => {
    updateUser.mockReset();
    vi.restoreAllMocks();
  });

  it("rotates and displays a member code exactly after success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          kind: "member",
          code: "MTP-M-23456789ABCDEFGH",
          rotatedAt: "2026-09-08T14:00:00Z",
        },
        { status: 201 },
      ),
    );
    const user = userEvent.setup();

    render(<AccessSecurity codeStatus={[]} />);
    await user.click(
      screen.getByRole("button", { name: "Initialize member code" }),
    );

    expect(screen.getByText("MTP-M-23456789ABCDEFGH")).toBeInTheDocument();
    expect(screen.queryByText(/code_hash/i)).not.toBeInTheDocument();
  });

  it("sets a matching password for the existing administrator", async () => {
    updateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<AccessSecurity codeStatus={[]} />);
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(screen.getByRole("status")).toHaveTextContent("Password updated.");
  });

  it("always warns about reusable administrator access", () => {
    render(<AccessSecurity codeStatus={[]} />);

    expect(
      screen.getByText(/anyone who knows the administrator code/i),
    ).toBeInTheDocument();
  });
});
