import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordLoginForm } from "../password-login-form";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { signInWithPassword },
  }),
}));

describe("PasswordLoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
  });

  it("signs in with normalized email and password", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<PasswordLoginForm />);
    await user.type(screen.getByLabelText("Email address"), "ALEX@Example.com");
    await user.type(screen.getByLabelText("Password"), "existing-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "alex@example.com",
      password: "existing-password",
    });
    expect(replace).toHaveBeenCalledWith("/club");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not expose provider errors", async () => {
    signInWithPassword.mockResolvedValue({
      error: new Error("provider details"),
    });
    const user = userEvent.setup();

    render(<PasswordLoginForm />);
    await user.type(screen.getByLabelText("Email address"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(screen.queryByText("provider details")).not.toBeInTheDocument();
  });
});
