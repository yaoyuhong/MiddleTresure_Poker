import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MagicLinkForm } from "../magic-link-form";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { signInWithOtp },
  }),
}));

describe("MagicLinkForm", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
  });

  it("requests an invite-only magic link", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<MagicLinkForm />);
    await user.type(
      screen.getByLabelText("Email address"),
      "member@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Email me a sign-in link" }),
    );

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "member@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
        shouldCreateUser: false,
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Check your email for the sign-in link.",
    );
  });

  it("shows a safe error when the provider rejects the request", async () => {
    signInWithOtp.mockResolvedValue({
      error: new Error("provider internals"),
    });
    const user = userEvent.setup();

    render(<MagicLinkForm />);
    await user.type(
      screen.getByLabelText("Email address"),
      "member@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Email me a sign-in link" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not send a sign-in link. Ask a club administrator to check your invitation.",
    );
    expect(screen.queryByText("provider internals")).not.toBeInTheDocument();
  });
});
