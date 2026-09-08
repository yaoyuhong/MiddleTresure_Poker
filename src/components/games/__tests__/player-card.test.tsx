import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerCard } from "../player-card";

describe("PlayerCard", () => {
  it("shows administrator actions for an active player", () => {
    render(
      <PlayerCard
        canManage
        player={{
          id: "player-1",
          displayName: "Alex",
          status: "active",
          totalBuyIn: 1_000,
          totalCashOut: 0,
          netResult: -1_000,
        }}
        unitName="chips"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add chips for Alex" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Exit Alex" })).toBeVisible();
  });

  it("keeps member and exited-player views read-only", () => {
    render(
      <PlayerCard
        canManage={false}
        player={{
          id: "player-2",
          displayName: "Bo",
          status: "exited",
          totalBuyIn: 1_000,
          totalCashOut: 1_200,
          netResult: 200,
        }}
        unitName="chips"
      />,
    );

    expect(screen.getByText("+200 chips")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
