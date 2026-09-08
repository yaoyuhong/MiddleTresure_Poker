import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettlementPlan } from "../settlement-plan";

describe("SettlementPlan", () => {
  it("renders offline transfer instructions", () => {
    render(
      <SettlementPlan
        transfers={[
          {
            id: "transfer-1",
            fromDisplayName: "Alex",
            toDisplayName: "Bo",
            amount: 500,
          },
        ]}
        unitName="chips"
      />,
    );

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("pays")).toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
    expect(screen.getByText("500 chips")).toBeInTheDocument();
    expect(
      screen.getByText("Payments happen outside this app."),
    ).toBeInTheDocument();
  });
});
