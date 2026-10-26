export type Loan = {
  id: number;
  borrower_id: number;
  borrower?: { name: string } | null;
  amount: number | string | null;
  interest: number;
  total: number;
  monthly: number;
  months: number;
  status: string | null;
};
