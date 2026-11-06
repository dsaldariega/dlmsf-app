export type LoanAudit = {
  id: number;
  borrower_name: string;
  amount: number;
  interest: number;
  total: number;
  monthly: number;
  action: string;
  remarks: string | null;
  created_date: string;
  ref_id: string | null;
  synthetic?: boolean;
};

export type PaymentAudit = {
  id: number;
  week_start: string;
  amount: number;
  remarks: string | null;
  ref_id: string | null;
  action: string;
  synthetic?: boolean;
};

export type AuditToast = {
  id: number;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
};