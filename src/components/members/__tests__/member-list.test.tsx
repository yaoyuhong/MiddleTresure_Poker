import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemberList } from "../member-list";

describe("MemberList", () => {
  it("deactivates a non-admin member through the protected endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();

    render(
      <MemberList
        members={[
          {
            id: "123e4567-e89b-42d3-a456-426614174000",
            displayName: "Alex",
            role: "member",
            status: "active",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Deactivate Alex" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/members/123e4567-e89b-42d3-a456-426614174000",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "deactivate" }),
      }),
    );
  });

  it("does not offer deactivation for administrators", () => {
    render(
      <MemberList
        members={[
          {
            id: "123e4567-e89b-42d3-a456-426614174000",
            displayName: "Owner",
            role: "admin",
            status: "active",
          },
        ]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Deactivate Owner" }),
    ).not.toBeInTheDocument();
  });
});
