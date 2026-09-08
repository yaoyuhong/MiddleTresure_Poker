import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GameAdminConsole } from "../game-admin-console";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("GameAdminConsole idempotency", () => {
  it("reuses the same request ID after an unknown network outcome", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("connection lost"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const user = userEvent.setup();

    render(
      <GameAdminConsole
        availableMembers={[]}
        game={{
          id: "123e4567-e89b-42d3-a456-426614174000",
          status: "draft",
          version: 2,
          difference: -1_000,
        }}
        players={[
          {
            id: "223e4567-e89b-42d3-a456-426614174000",
            displayName: "Alex",
            status: "active",
            totalBuyIn: 1_000,
            totalCashOut: 0,
            netResult: -1_000,
          },
        ]}
        unitName="chips"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start game" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Retry the same request safely",
      }),
    );

    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<
      string,
      string
    >;
    expect(secondHeaders["x-request-id"]).toBe(firstHeaders["x-request-id"]);
    expect(refresh).toHaveBeenCalled();
  });
});
