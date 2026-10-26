export type LoanAudit = {
  id: number;
  borrower_name: string;
  amount: number;
  interest: number;
  total: number;
  monthly: number;
  status: string;
  remarks: string | null;
  created_date: string;
};

export type PaymentAudit = {
  id: number;
  week: string;
  amount: number;
  remarks: string | null;
};