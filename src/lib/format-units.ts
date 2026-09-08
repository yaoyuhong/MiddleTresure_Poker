const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatUnits(amount: number, unitName: string): string {
  return `${integerFormatter.format(amount)} ${unitName}`;
}

export function formatSignedUnits(amount: number, unitName: string): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${integerFormatter.format(amount)} ${unitName}`;
}
