import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankingTable } from "../ranking-table";

describe("RankingTable", () => {
  it("renders shared ranks and signed profits", () => {
    render(
      <RankingTable
        rows={[
          { membershipId: "a", displayName: "Alex", profit: 150, rank: 1 },
          { membershipId: "c", displayName: "Chen", profit: 150, rank: 1 },
          { membershipId: "b", displayName: "Bo", profit: -300, rank: 3 },
        ]}
        unitName="chips"
      />,
    );

    expect(screen.getAllByText("#1")).toHaveLength(2);
    expect(screen.getAllByText("+150 chips")).toHaveLength(2);
    expect(screen.getByText("-300 chips")).toBeInTheDocument();
  });

  it("renders an intentional empty state", () => {
    render(<RankingTable rows={[]} unitName="chips" />);

    expect(screen.getByText("No finalized games yet.")).toBeInTheDocument();
  });
});
