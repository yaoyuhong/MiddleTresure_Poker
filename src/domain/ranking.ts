import { signedAmount } from "./money";

export interface SeasonResult {
  readonly memberId: string;
  readonly net: number;
}

export interface RankingMember {
  readonly memberId: string;
  readonly displayName: string;
}

export interface RankingRow extends RankingMember {
  readonly profit: number;
  readonly rank: number;
}

export function createSeasonRanking(
  results: ReadonlyArray<SeasonResult>,
  members: ReadonlyArray<RankingMember>,
): ReadonlyArray<RankingRow> {
  const profits = new Map<string, number>();

  for (const member of members) {
    if (profits.has(member.memberId)) {
      throw new Error(`Duplicate member: ${member.memberId}`);
    }
    profits.set(member.memberId, 0);
  }

  for (const result of results) {
    const current = profits.get(result.memberId);
    if (current === undefined) {
      throw new Error(`Unknown member: ${result.memberId}`);
    }
    profits.set(
      result.memberId,
      signedAmount(current + signedAmount(result.net)),
    );
  }

  const sorted = members
    .map((member) => ({
      ...member,
      profit: profits.get(member.memberId) ?? 0,
    }))
    .sort(compareRankingRows);

  let currentRank = 0;
  let previousProfit: number | undefined;

  return sorted.map((row, index) => {
    if (row.profit !== previousProfit) {
      currentRank = index + 1;
      previousProfit = row.profit;
    }

    return { ...row, rank: currentRank };
  });
}

function compareRankingRows(
  left: Omit<RankingRow, "rank">,
  right: Omit<RankingRow, "rank">,
): number {
  if (left.profit !== right.profit) {
    return left.profit > right.profit ? -1 : 1;
  }
  if (left.displayName !== right.displayName) {
    return left.displayName < right.displayName ? -1 : 1;
  }
  return left.memberId < right.memberId
    ? -1
    : left.memberId > right.memberId
      ? 1
      : 0;
}
