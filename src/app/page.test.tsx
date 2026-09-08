import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("presents the invite-only club entry point", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Middle Treasure Poker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Private games. Clear settlement."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Access requires an invitation"),
    ).toBeInTheDocument();
  });
});
