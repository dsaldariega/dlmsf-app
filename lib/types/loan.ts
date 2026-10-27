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

export type Toast = {
  id: number;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

export type LoanAction =
  | { type: "paid"; loan: Loan }
  | { type: "delete"; loan: Loan };