declare const moneyBrand: unique symbol;

export type Money = number & { readonly [moneyBrand]: "Money" };

export function money(value: unknown): Money {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Money must be a non-negative safe integer.");
  }

  return value as Money;
}

export function signedAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("Amount must be a safe integer.");
  }

  return value;
}

export function addMoney(left: Money, right: Money): Money {
  return money(signedAmount(left + right));
}

export function sumMoney(amounts: ReadonlyArray<Money>): Money {
  return amounts.reduce<Money>(
    (total, amount) => addMoney(total, amount),
    money(0),
  );
}

export function subtractMoney(left: Money, right: Money): number {
  return signedAmount(left - right);
}
