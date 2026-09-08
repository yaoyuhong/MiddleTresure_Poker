import { signedAmount, subtractMoney, sumMoney, type Money } from "./money";

export interface PlayerResult {
  readonly memberId: string;
  readonly buyIn: Money;
  readonly cashOut: Money;
}

export interface PlayerBalance {
  readonly memberId: string;
  readonly net: number;
}

export interface GameSummary {
  readonly totalBuyIn: Money;
  readonly totalCashOut: Money;
  readonly difference: number;
  readonly balanced: boolean;
  readonly playerBalances: ReadonlyArray<PlayerBalance>;
}

export function playerNet(player: PlayerResult): number {
  return subtractMoney(player.cashOut, player.buyIn);
}

export function gameSummary(players: ReadonlyArray<PlayerResult>): GameSummary {
  assertUniqueMembers(players);

  const totalBuyIn = sumMoney(players.map((player) => player.buyIn));
  const totalCashOut = sumMoney(players.map((player) => player.cashOut));
  const difference = signedAmount(totalCashOut - totalBuyIn);

  return {
    totalBuyIn,
    totalCashOut,
    difference,
    balanced: difference === 0,
    playerBalances: players.map((player) => ({
      memberId: player.memberId,
      net: playerNet(player),
    })),
  };
}

function assertUniqueMembers(players: ReadonlyArray<PlayerResult>): void {
  const memberIds = new Set<string>();

  for (const player of players) {
    if (!player.memberId.trim()) {
      throw new Error("Member ID is required.");
    }
    if (memberIds.has(player.memberId)) {
      throw new Error(`Duplicate member: ${player.memberId}`);
    }
    memberIds.add(player.memberId);
  }
}
