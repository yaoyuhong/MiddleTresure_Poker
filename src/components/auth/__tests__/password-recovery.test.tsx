import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "../password-recovery";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

describe("ForgotPasswordForm", () => {
  it("routes recovery through the server callback before password reset", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<ForgotPasswordForm />);
    await user.type(
      screen.getByLabelText("Email address"),
      "ADMIN@Example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Send recovery link" }),
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith("admin@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Freset-password",
    });
  });
});
