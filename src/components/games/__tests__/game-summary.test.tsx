import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameSummaryCard } from "../game-summary";

describe("GameSummaryCard", () => {
  it("shows a balanced live game", () => {
    render(
      <GameSummaryCard
        difference={0}
        status="active"
        totalBuyIn={8_400}
        totalCashOut={8_400}
        unitName="chips"
      />,
    );

    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("8,400 chips")).toBeInTheDocument();
    expect(screen.getByText("Ready to finalize")).toBeInTheDocument();
  });

  it("shows the exact missing cash-out amount", () => {
    render(
      <GameSummaryCard
        difference={-300}
        status="active"
        totalBuyIn={8_400}
        totalCashOut={8_100}
        unitName="chips"
      />,
    );

    expect(screen.getByText("300 chips short")).toBeInTheDocument();
    expect(screen.getByText("Settlement is not balanced")).toBeInTheDocument();
  });
});
