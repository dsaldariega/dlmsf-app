import type { ReactNode } from "react";

/** Shared domain and API types used by dashboard pages and components. */
export type Toast = {
  id: number;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

export type AuditToast = Toast;

export type Member = {
  id: number;
  name: string;
  heads: number;
  roles: string;
};

export type DashboardMember = {
  id: number;
  name?: string;
  heads?: number;
};

export type MemberOption = { id: number; name: string };
export type MemberCount = { id: number; heads: number };

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

export type LoanAction =
  | { type: "paid"; loan: Loan }
  | { type: "delete"; loan: Loan };

export type LoanAudit = {
  id: number;
  borrower_name: string;
  amount: number | string;
  interest?: number | string;
  total: number | string;
  monthly?: number | string;
  action: string;
  remarks?: string | null;
  created_date: string;
  ref_id?: string | null;
  synthetic?: boolean;
};

export type PaymentAudit = {
  id: number;
  week_start?: string;
  amount: number | string;
  remarks?: string | null;
  ref_id?: string | null;
  action: string;
  created_date?: string;
  synthetic?: boolean;
};

export type Payment = {
  id: number;
  amount: number | string | null;
  week_start: string;
};

export type LoanPayment = {
  id: string | number;
  borrower?: string;
  member_id: number;
  loan_id?: number;
  amount: number | string | null;
  paid_at: string;
  remarks?: string;
  action?: string;
};

export type LoanRequest = {
  id: number;
  amount: number | string;
  months: number;
  status: string;
  requested_at: string;
  admin_remarks?: string | null;
};

export type AdminLoanRequest = LoanRequest & {
  member?: { name: string } | null;
};

export type PaymentSubmission = {
  id: number;
  payment_type: string;
  amount: number | string;
  paid_on: string;
  loan_id?: number | null;
  reference?: string | null;
  week_start?: string | null;
  status: string;
  admin_remarks?: string | null;
  member?: { name: string } | null;
  loan?: { id: number } | null;
};

export type DashboardRequest = { id: number; status: string };

export type MemberDashboardData = {
  payments: Payment[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  loanRequests: DashboardRequest[];
  paymentSubmissions: DashboardRequest[];
};

export type MemberPaymentData = {
  payments: Payment[];
  loanPayments: LoanPayment[];
};

export type WeeklyContributionMember = {
  id: number;
  name: string;
  heads: number;
  due: number;
  paid: number;
  remaining: number;
};

export type WeeklyContributionResponse = {
  weekStart: string;
  members: WeeklyContributionMember[];
};

export type UnderDevelopmentProps = {
  title?: string;
  description?: string;
};

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  tableClassName?: string;
  thClassName?: string;
  tdClassName?: string;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  tbodyClassName?: string;
  loadingContent?: ReactNode;
  emptyContent?: ReactNode;
  loadingRow?: ReactNode;
  getRowKey: (row: T) => string | number;
  pageSize?: number;
};
