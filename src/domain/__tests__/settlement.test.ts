import { describe, expect, it } from "vitest";

import { createSettlementPlan } from "../settlement";

describe("exact settlement", () => {
  it("returns no transfers for zero balances", () => {
    expect(
      createSettlementPlan([
        { memberId: "alice", net: 0 },
        { memberId: "bob", net: 0 },
      ]),
    ).toEqual([]);
  });

  it("creates deterministic transfers that preserve every balance", () => {
    const balances = [
      { memberId: "alice", net: 600 },
      { memberId: "bob", net: 400 },
      { memberId: "cara", net: -400 },
      { memberId: "drew", net: -300 },
      { memberId: "erin", net: -300 },
    ];

    const plan = createSettlementPlan(balances);

    expect(plan).toHaveLength(3);
    expect(plan).toEqual(createSettlementPlan([...balances].reverse()));
    expect(plan.every((transfer) => transfer.amount > 0)).toBe(true);
    expect(reconciledBalances(balances, plan)).toEqual(
      Object.fromEntries(balances.map(({ memberId }) => [memberId, 0])),
    );
  });

  it("finds the exact three-transfer plan where ordered greedy needs four", () => {
    expect(
      createSettlementPlan([
        { memberId: "credit-6", net: 6 },
        { memberId: "credit-4", net: 4 },
        { memberId: "debt-4", net: -4 },
        { memberId: "debt-3a", net: -3 },
        { memberId: "debt-3b", net: -3 },
      ]),
    ).toHaveLength(3);
  });

  it("rejects an unbalanced game", () => {
    expect(() =>
      createSettlementPlan([
        { memberId: "alice", net: 100 },
        { memberId: "bob", net: -99 },
      ]),
    ).toThrow("sum to zero");
  });

  it("rejects duplicate members and unsafe balances", () => {
    expect(() =>
      createSettlementPlan([
        { memberId: "alice", net: 100 },
        { memberId: "alice", net: -100 },
      ]),
    ).toThrow("Duplicate member");
    expect(() =>
      createSettlementPlan([
        { memberId: "alice", net: 1.5 },
        { memberId: "bob", net: -1.5 },
      ]),
    ).toThrow("safe integer");
  });

  it("rejects more than sixteen participants", () => {
    const balances = Array.from({ length: 18 }, (_, index) => ({
      memberId: `member-${index}`,
      net: index < 9 ? 1 : -1,
    }));

    expect(() => createSettlementPlan(balances)).toThrow(
      "at most 16 participants",
    );
  });
});

function reconciledBalances(
  balances: ReadonlyArray<{ memberId: string; net: number }>,
  transfers: ReadonlyArray<{
    fromMemberId: string;
    toMemberId: string;
    amount: number;
  }>,
) {
  const remaining = Object.fromEntries(
    balances.map(({ memberId, net }) => [memberId, net]),
  );

  for (const transfer of transfers) {
    remaining[transfer.fromMemberId] += transfer.amount;
    remaining[transfer.toMemberId] -= transfer.amount;
  }

  return remaining;
}
