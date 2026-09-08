import { describe, expect, it } from "vitest";

import { addMoney, money, subtractMoney, sumMoney } from "../money";

describe("money", () => {
  it.each([-1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, "100", null])(
    "rejects invalid amount %p",
    (value) => {
      expect(() => money(value)).toThrow("non-negative safe integer");
    },
  );

  it("accepts zero and positive safe integers", () => {
    expect(money(0)).toBe(0);
    expect(money(4_200)).toBe(4_200);
  });

  it("adds and sums amounts without losing integer safety", () => {
    expect(addMoney(money(400), money(250))).toBe(650);
    expect(sumMoney([money(100), money(200), money(300)])).toBe(600);
  });

  it("returns a signed safe integer when subtracting", () => {
    expect(subtractMoney(money(250), money(400))).toBe(-150);
  });

  it("rejects unsafe totals", () => {
    expect(() => addMoney(money(Number.MAX_SAFE_INTEGER), money(1))).toThrow(
      "safe integer",
    );
  });
});
