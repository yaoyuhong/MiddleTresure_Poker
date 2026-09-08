import { describe, expect, it } from "vitest";

import { createSeasonRanking } from "../ranking";

describe("season ranking", () => {
  it("aggregates finalized profit and assigns shared competition ranks", () => {
    expect(
      createSeasonRanking(
        [
          { memberId: "a", net: 200 },
          { memberId: "b", net: 100 },
          { memberId: "a", net: -50 },
          { memberId: "c", net: 150 },
        ],
        [
          { memberId: "a", displayName: "Alex" },
          { memberId: "b", displayName: "Bo" },
          { memberId: "c", displayName: "Chen" },
        ],
      ),
    ).toEqual([
      { memberId: "a", displayName: "Alex", profit: 150, rank: 1 },
      { memberId: "c", displayName: "Chen", profit: 150, rank: 1 },
      { memberId: "b", displayName: "Bo", profit: 100, rank: 3 },
    ]);
  });

  it("includes members without finalized games and orders ties deterministically", () => {
    expect(
      createSeasonRanking(
        [],
        [
          { memberId: "z", displayName: "Same" },
          { memberId: "a", displayName: "Same" },
          { memberId: "c", displayName: "Alpha" },
        ],
      ),
    ).toEqual([
      { memberId: "c", displayName: "Alpha", profit: 0, rank: 1 },
      { memberId: "a", displayName: "Same", profit: 0, rank: 1 },
      { memberId: "z", displayName: "Same", profit: 0, rank: 1 },
    ]);
  });

  it("rejects results for unknown members", () => {
    expect(() =>
      createSeasonRanking(
        [{ memberId: "missing", net: 10 }],
        [{ memberId: "known", displayName: "Known" }],
      ),
    ).toThrow("Unknown member");
  });
});
