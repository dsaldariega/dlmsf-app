export type Payment = {
  id: number;
  amount: number | string | null;
  week_start: string;
};

export type LoanPayment = {
  id: string | number;
  borrower: string;
  member_id: number;
  amount: number | string | null;
  paid_at: string;
};
