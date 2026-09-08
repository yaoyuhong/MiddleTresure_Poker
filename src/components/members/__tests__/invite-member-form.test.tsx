import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteMemberForm } from "../invite-member-form";

describe("InviteMemberForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a normalized member invitation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const user = userEvent.setup();

    render(<InviteMemberForm />);
    await user.type(screen.getByLabelText("Display name"), "  Alex  ");
    await user.type(
      screen.getByLabelText("Email address"),
      " ALEX@Example.com ",
    );
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Alex",
        email: "alex@example.com",
      }),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Invitation sent.");
  });

  it("shows a safe retryable error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 409 }),
    );
    const user = userEvent.setup();

    render(<InviteMemberForm />);
    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email address"), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not send this invitation.",
    );
  });
});
