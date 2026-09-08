import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberGameRequestPanel } from "../member-game-request-panel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("MemberGameRequestPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("submits a join request for a member outside the game", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "request" }));
    const user = userEvent.setup();

    render(
      <MemberGameRequestPanel
        gameId="50000000-0000-0000-0000-000000000701"
        pendingRequest={null}
        playerStatus={null}
        unitName="chips"
      />,
    );
    await user.type(screen.getByLabelText("Requested buy-in"), "1000");
    await user.click(screen.getByRole("button", { name: "Request to join" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/games/50000000-0000-0000-0000-000000000701/requests",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows pending state instead of another action form", () => {
    render(
      <MemberGameRequestPanel
        gameId="50000000-0000-0000-0000-000000000701"
        pendingRequest={{
          id: "70000000-0000-0000-0000-000000000701",
          action: "exit",
          amount: 1250,
        }}
        playerStatus="active"
        unitName="chips"
      />,
    );

    expect(
      screen.getByText(/exit request is awaiting approval/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request add-on" }),
    ).not.toBeInTheDocument();
  });
});
