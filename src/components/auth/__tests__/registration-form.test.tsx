import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationForm } from "../registration-form";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("RegistrationForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("registers with normalized account and invite-code data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }));
    const user = userEvent.setup();

    render(<RegistrationForm />);
    await user.type(screen.getByLabelText("Display name"), " Alex ");
    await user.type(screen.getByLabelText("Email address"), "ALEX@Example.com");
    await user.type(screen.getByLabelText("Password"), "ten-characters");
    await user.type(
      screen.getByLabelText("Invite code"),
      "mtp-m-23456789abcdefgh",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      displayName: "Alex",
      email: "alex@example.com",
      password: "ten-characters",
      inviteCode: "MTP-M-23456789ABCDEFGH",
    });
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(replace).toHaveBeenCalledWith("/club");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows one generic registration failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 400 }),
    );
    const user = userEvent.setup();

    render(<RegistrationForm />);
    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email address"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "ten-characters");
    await user.type(
      screen.getByLabelText("Invite code"),
      "MTP-M-23456789ABCDEFGH",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not create this account.",
    );
  });
});
