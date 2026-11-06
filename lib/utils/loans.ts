import { INTEREST_RATE, PENALTY_RATE } from "../constants/loans";

  // Loan calculation helpers: simple interest on original principal
export const calculateInterest = (principal: number, months: number) =>
    Number((principal * INTEREST_RATE * months).toFixed(2));

export const calculateTotal = (principal: number, months: number) =>
    Number((principal + calculateInterest(principal, months)).toFixed(2));

export const calculateMonthly = (principal: number, months: number) =>
    Number((calculateTotal(principal, months) / months).toFixed(2));

export const calculatePenalty = (principal: number) =>
    Number((principal * PENALTY_RATE).toFixed(2));

  // Currency formatter
export const formatCurrency = (value: number) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;