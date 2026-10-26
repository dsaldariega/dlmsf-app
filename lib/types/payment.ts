export type Payment = {
  id: string | number;
  amount: number | string | null;
  week_start: string;
};

export type LoanPayment = {
  id: string | number;
  member_id: number;
  amount: number | string | null;
  paid_at: string;
};
