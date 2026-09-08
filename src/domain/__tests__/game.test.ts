import { describe, expect, it } from "vitest";

import { gameSummary, playerNet } from "../game";
import { money } from "../money";

describe("game totals", () => {
  const players = [
    { memberId: "alice", buyIn: money(1_000), cashOut: money(1_500) },
    { memberId: "bob", buyIn: money(2_000), cashOut: money(1_500) },
  ];

  it("calculates a signed player result", () => {
    expect(playerNet(players[0])).toBe(500);
    expect(playerNet(players[1])).toBe(-500);
  });

  it("reports a balanced game", () => {
    expect(gameSummary(players)).toEqual({
      totalBuyIn: 3_000,
      totalCashOut: 3_000,
      difference: 0,
      balanced: true,
      playerBalances: [
        { memberId: "alice", net: 500 },
        { memberId: "bob", net: -500 },
      ],
    });
  });

  it("reports the exact difference for an unbalanced game", () => {
    expect(
      gameSummary([
        ...players.slice(0, 1),
        { memberId: "bob", buyIn: money(2_000), cashOut: money(1_400) },
      ]).difference,
    ).toBe(-100);
  });

  it("rejects duplicate participants", () => {
    expect(() => gameSummary([players[0], players[0]])).toThrow(
      "Duplicate member",
    );
  });
});
