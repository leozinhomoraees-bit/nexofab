export type HistoricalFinancialMonth = {
  competenceMonth: string;
  otherRevenue: number;
  otherVariableCosts: number;
};

export type HistoricalPayment = { date: string; amount: number };
export type HistoricalVariableCost = { date: string; amount: number };

const monthKey = (date: string) => date.slice(0, 7);

export function historicalContributionProjection(
  months: HistoricalFinancialMonth[],
  payments: HistoricalPayment[],
  variableCosts: HistoricalVariableCost[],
) {
  const totals = new Map<string, { revenue: number; variableCosts: number }>();
  const ensure = (month: string) => {
    const current = totals.get(month) ?? { revenue: 0, variableCosts: 0 };
    totals.set(month, current);
    return current;
  };

  for (const row of months) {
    const current = ensure(monthKey(row.competenceMonth));
    current.revenue += Number(row.otherRevenue || 0);
    current.variableCosts += Number(row.otherVariableCosts || 0);
  }
  for (const payment of payments) ensure(monthKey(payment.date)).revenue += Number(payment.amount || 0);
  for (const cost of variableCosts) ensure(monthKey(cost.date)).variableCosts += Number(cost.amount || 0);

  const validMonths = [...totals.entries()]
    .filter(([, value]) => value.revenue > 0 && value.revenue > value.variableCosts)
    .sort(([a], [b]) => a.localeCompare(b));
  const revenue = validMonths.reduce((sum, [, value]) => sum + value.revenue, 0);
  const contribution = validMonths.reduce((sum, [, value]) => sum + value.revenue - value.variableCosts, 0);

  return {
    rate: revenue > 0 ? contribution / revenue : 0,
    months: validMonths.length,
    periodStart: validMonths[0]?.[0] ?? null,
    periodEnd: validMonths.at(-1)?.[0] ?? null,
  };
}

export function recurringValue(current: unknown, previous: unknown, fallback = 0) {
  const currentValue = Number(current ?? 0);
  if (currentValue > 0) return { value: currentValue, inherited: false, source: "current" as const };
  const previousValue = Number(previous ?? 0);
  if (previousValue > 0) return { value: previousValue, inherited: true, source: "previous" as const };
  const fallbackValue = Number(fallback || 0);
  return { value: fallbackValue, inherited: fallbackValue > 0, source: fallbackValue > 0 ? "pricing" as const : "empty" as const };
}

export function effectivePaidAmount(item: { amount?: unknown; paid_amount?: unknown; interest_amount?: unknown; fine_amount?: unknown; discount_amount?: unknown }) {
  return Number(item.paid_amount ?? item.amount ?? 0) + Number(item.interest_amount ?? 0) + Number(item.fine_amount ?? 0) - Number(item.discount_amount ?? 0);
}
