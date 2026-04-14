export type Loan = {
  id: number;
  borrower: string;
  amount: number;
  interest: number;
  total: number;
  monthly: number;
  status: "Ongoing" | "Paid";
};

export type Member = {
  id: number;
  name: string;
  heads: number;
  contribution: number;
};

export const FUND_TOTAL = 10500;