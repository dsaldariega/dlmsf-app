import { Decimal } from "decimal.js";

export function calculateMonthlyInterest(
  principal: number,
  monthlyRate: number
): Decimal {
  return new Decimal(principal)
    .times(monthlyRate)
    .dividedBy(100)
    .toDecimalPlaces(2);
}