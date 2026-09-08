import { signedAmount } from "./money";

const MAX_PARTICIPANTS = 16;

export interface SettlementBalance {
  readonly memberId: string;
  readonly net: number;
}

export interface SettlementTransfer {
  readonly fromMemberId: string;
  readonly toMemberId: string;
  readonly amount: number;
}

interface Party {
  readonly memberId: string;
  readonly remaining: number;
}

export function createSettlementPlan(
  balances: ReadonlyArray<SettlementBalance>,
): ReadonlyArray<SettlementTransfer> {
  validateBalances(balances);

  const debtors = balances
    .filter(({ net }) => net < 0)
    .map(({ memberId, net }) => ({ memberId, remaining: -net }))
    .sort(byMemberId);
  const creditors = balances
    .filter(({ net }) => net > 0)
    .map(({ memberId, net }) => ({ memberId, remaining: net }))
    .sort(byMemberId);

  return solve(debtors, creditors, new Map()) ?? [];
}

function solve(
  debtors: ReadonlyArray<Party>,
  creditors: ReadonlyArray<Party>,
  memo: Map<string, ReadonlyArray<SettlementTransfer> | null>,
): ReadonlyArray<SettlementTransfer> | null {
  const debtorIndex = debtors.findIndex(({ remaining }) => remaining > 0);

  if (debtorIndex === -1) {
    return [];
  }

  const key = stateKey(debtors, creditors);
  const memoized = memo.get(key);
  if (memoized !== undefined) {
    return memoized;
  }

  const debtor = debtors[debtorIndex];
  let best: ReadonlyArray<SettlementTransfer> | null = null;

  for (
    let creditorIndex = 0;
    creditorIndex < creditors.length;
    creditorIndex += 1
  ) {
    const creditor = creditors[creditorIndex];
    if (creditor.remaining === 0) {
      continue;
    }

    const amount = Math.min(debtor.remaining, creditor.remaining);
    const nextDebtors = debtors.map((party, index) =>
      index === debtorIndex
        ? { ...party, remaining: party.remaining - amount }
        : party,
    );
    const nextCreditors = creditors.map((party, index) =>
      index === creditorIndex
        ? { ...party, remaining: party.remaining - amount }
        : party,
    );
    const tail = solve(nextDebtors, nextCreditors, memo);

    if (tail === null) {
      continue;
    }

    const candidate = [
      {
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      },
      ...tail,
    ];

    if (best === null || comparePlans(candidate, best) < 0) {
      best = candidate;
    }
  }

  memo.set(key, best);
  return best;
}

function validateBalances(balances: ReadonlyArray<SettlementBalance>): void {
  if (balances.length > MAX_PARTICIPANTS) {
    throw new Error(
      `A game supports at most ${MAX_PARTICIPANTS} participants.`,
    );
  }

  const memberIds = new Set<string>();
  let total = 0;

  for (const { memberId, net } of balances) {
    if (!memberId.trim()) {
      throw new Error("Member ID is required.");
    }
    if (memberIds.has(memberId)) {
      throw new Error(`Duplicate member: ${memberId}`);
    }
    memberIds.add(memberId);
    total = signedAmount(total + signedAmount(net));
  }

  if (total !== 0) {
    throw new Error(
      `Settlement balances must sum to zero; difference is ${total}.`,
    );
  }
}

function stateKey(
  debtors: ReadonlyArray<Party>,
  creditors: ReadonlyArray<Party>,
): string {
  return `${debtors.map(({ remaining }) => remaining).join(",")}|${creditors
    .map(({ remaining }) => remaining)
    .join(",")}`;
}

function comparePlans(
  left: ReadonlyArray<SettlementTransfer>,
  right: ReadonlyArray<SettlementTransfer>,
): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return planKey(left) < planKey(right)
    ? -1
    : planKey(left) > planKey(right)
      ? 1
      : 0;
}

function planKey(plan: ReadonlyArray<SettlementTransfer>): string {
  return plan
    .map(
      ({ fromMemberId, toMemberId, amount }) =>
        `${fromMemberId}:${toMemberId}:${amount}`,
    )
    .join("|");
}

function byMemberId(left: Party, right: Party): number {
  return left.memberId < right.memberId
    ? -1
    : left.memberId > right.memberId
      ? 1
      : 0;
}
