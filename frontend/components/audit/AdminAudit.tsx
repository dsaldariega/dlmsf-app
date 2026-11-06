"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AuditToast, LoanAudit, PaymentAudit } from "@/lib/types/audit";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "@/lib/utils/loans";
import { getStatusStyle } from "@/lib/utils/audit";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";

export default function AuditPage() {
  const [loanAudits, setLoanAudits] = useState<LoanAudit[]>([]);
  const [paymentAudits, setPaymentAudits] = useState<PaymentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Action states
  const [deletingLoanId, setDeletingLoanId] = useState<number | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(
    null,
  );

  // Delete confirmation modals
  const [loanToDelete, setLoanToDelete] = useState<LoanAudit | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentAudit | null>(
    null,
  );

  const [isDeleteLoanModalOpen, setIsDeleteLoanModalOpen] = useState(false);
  const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] =
    useState(false);
  const [toast, setToast] = useState<AuditToast | null>(null);

  // Load audit records through the Node API
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await apiRequest<{ loans: LoanAudit[]; payments: PaymentAudit[] }>("/api/audit");
      setLoanAudits(data.loans);
      setPaymentAudits(data.payments);
      setErrorMessage("");
    } catch (error) {
      console.error("Error loading audit records:", error);
      const message = error instanceof Error ? error.message : "Please refresh the page and try again.";
      setErrorMessage(message);
      showToast("error", "Unable to load audit records", message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteLoanAudit = async (id: number) => {
    if (deletingLoanId !== null || deletingPaymentId !== null) return;
    setDeletingLoanId(id);
    try {
      await apiRequest<{ id: number }>(`/api/audit/loans/${id}`, { method: "DELETE" });
      setLoanAudits((current) => current.filter((audit) => audit.id !== id));
      setIsDeleteLoanModalOpen(false);
      setLoanToDelete(null);
      showToast("success", "Audit record deleted", "The loan audit record was successfully removed.");
    } catch (error) {
      console.error("Error deleting loan audit:", error);
      showToast("error", "Deletion failed", error instanceof Error ? error.message : "Failed to delete loan audit record.");
    } finally { setDeletingLoanId(null); }
  };

  const deletePaymentAudit = async (id: number) => {
    if (deletingLoanId !== null || deletingPaymentId !== null) return;
    setDeletingPaymentId(id);
    try {
      await apiRequest<{ id: number }>(`/api/audit/payments/${id}`, { method: "DELETE" });
      setPaymentAudits((current) => current.filter((payment) => payment.id !== id));
      setIsDeletePaymentModalOpen(false);
      setPaymentToDelete(null);
      showToast("success", "Audit record deleted", "The payment audit record was successfully removed.");
    } catch (error) {
      console.error("Error deleting payment audit:", error);
      showToast("error", "Deletion failed", error instanceof Error ? error.message : "Failed to delete payment audit record.");
    } finally { setDeletingPaymentId(null); }
  };

  const thClass =
    "border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

  const tdClass = "px-5 py-4";

  const loanAuditColumns: DataTableColumn<LoanAudit>[] = [
    {
      key: "ref_id",
      header: "Reference ID",
      headerClassName: "w-40",
      render: (audit) => (
        <span className="font-mono text-xs font-semibold text-blue-700">
          {audit.ref_id || "Not assigned"}
        </span>
      ),
    },
    {
      key: "borrower_name",
      header: "Borrower",
      render: (audit) => (
        <div className="overflow-hidden font-semibold text-slate-800">
          <span className="block truncate" title={audit.borrower_name || "N/A"}>
            {audit.borrower_name || "N/A"}
          </span>
          <p className="mt-1 text-xs font-normal text-slate-400">
            Audit #{audit.id}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Principal",
      render: (audit) => (
        <span className="tabular-nums text-slate-600">
          {formatCurrency(audit.amount)}
        </span>
      ),
    },
    {
      key: "interest",
      header: "Interest",
      render: (audit) => (
        <span className="tabular-nums text-violet-700">
          {formatCurrency(audit.interest)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (audit) => (
        <span className="font-semibold tabular-nums text-emerald-700">
          {formatCurrency(audit.total)}
        </span>
      ),
    },
    {
      key: "monthly",
      header: "Monthly",
      render: (audit) => (
        <span className="tabular-nums text-slate-600">
          {formatCurrency(audit.monthly)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Status",
      render: (audit) => (
        <span
          className={`inline-flex max-w-full truncate rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(audit.action)}`}
        >
          {audit.action || "Unknown"}
        </span>
      ),
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (audit) => (
        <span className="block wrap-break-word text-slate-500">
          {audit.remarks || "No remarks"}
        </span>
      ),
    },
    {
      key: "created_date",
      header: "Created Date",
      render: (audit) =>
        audit.created_date
          ? new Date(audit.created_date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "N/A",
    },
    {
      key: "actions",
      header: "Actions",
      render: (audit) => (
        <button
          type="button"
          onClick={() => {
            setLoanToDelete(audit);
            setIsDeleteLoanModalOpen(true);
          }}
          disabled={deletingLoanId !== null || deletingPaymentId !== null}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      ),
    },
  ];

  const paymentAuditColumns: DataTableColumn<PaymentAudit>[] = [
    {
      key: "ref_id",
      header: "Reference ID",
      render: (payment) => (
        <span className="font-mono text-xs font-semibold text-blue-700">
          {payment.ref_id || "Not assigned"}
        </span>
      ),
    },
    {
      key: "week_start",
      header: "Week",
      render: (payment) => (
        <div className="overflow-hidden font-semibold text-slate-800">
          <span className="block truncate">{payment.week_start || "N/A"}</span>
          <p className="mt-1 text-xs font-normal text-slate-400">
            Audit #{payment.id}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (payment) => (
        <span className="font-semibold tabular-nums text-emerald-700">
          {formatCurrency(payment.amount)}
        </span>
      ),
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (payment) => (
        <span className="block wrap-break-word text-slate-500">
          {payment.remarks || "No remarks"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (payment) => (
        <button
          type="button"
          onClick={() => {
            setPaymentToDelete(payment);
            setIsDeletePaymentModalOpen(true);
          }}
          disabled={deletingLoanId !== null || deletingPaymentId !== null}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      ),
    },
  ];

  const showToast = (
    type: AuditToast["type"],
    title: string,
    message: string,
  ) => {
    setToast({ id: Date.now(), type, title, message });
  };

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  return (
    <div className="space-y-6">
      {/* Animated toast notifications */}
      <div
        className="pointer-events-none fixed right-4 top-4 z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role={toast.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto overflow-hidden rounded-xl border bg-white shadow-xl ${
                toast.type === "success"
                  ? "border-emerald-200"
                  : toast.type === "error"
                    ? "border-red-200"
                    : "border-amber-200"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    toast.type === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : toast.type === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {toast.type === "success" ? (
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  ) : (
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {toast.title}
                  </p>
                  <p className="mt-1 wrap-break-word text-sm leading-5 text-slate-500">
                    {toast.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  aria-label="Dismiss notification"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <motion.div
                key={`progress-${toast.id}`}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: "linear" }}
                style={{ transformOrigin: "left" }}
                className={`h-1 ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Audit
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and manage loan and payment audit records.
          </p>
        </div>
      </div>
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}
      {/* Loan Audit Log - static card, independently scrollable table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loans Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review loan amounts, repayment status, and audit remarks.
          </p>
        </div>

        <div className="h-105 overflow-y-auto overflow-x-auto">
          <DataTable
            data={loanAudits}
            columns={loanAuditColumns}
            getRowKey={(record) => record.id}
            tableClassName="relative w-full min-w-350 table-fixed border-collapse text-left text-sm"
            thClassName={thClass}
            tdClassName={tdClass}
            tbodyClassName="divide-y divide-slate-100"
            loading={loading}
            loadingMessage="Loading loan audit records..."
            loadingRow={
              <TableLoading
                message="Loading loan audit records..."
                colSpan={loanAuditColumns.length}
              />
            }
            emptyMessage="No loan audit records found."
            emptyContent={
              <div className="flex min-h-105 items-center justify-center text-slate-400">
                No loan audit records found.
              </div>
            }
          />
        </div>

        {!loading && loanAudits.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {loanAudits.length} loan audit record
              {loanAudits.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </section>
      {/* Payment Audit Log - static card, independently scrollable table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Payment Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review payment references, weekly amounts, and audit remarks.
          </p>
        </div>

        <div className="h-105 overflow-y-auto overflow-x-auto">
          <DataTable
            data={paymentAudits}
            columns={paymentAuditColumns}
            getRowKey={(record) => record.id}
            tableClassName="relative w-full min-w-200 table-fixed border-collapse text-left text-sm"
            thClassName={thClass}
            tdClassName={tdClass}
            tbodyClassName="divide-y divide-slate-100"
            loading={loading}
            loadingMessage="Loading payment audit records..."
            loadingRow={
              <TableLoading
                message="Loading payment audit records..."
                colSpan={paymentAuditColumns.length}
              />
            }
            emptyMessage="No payment audit records found."
            emptyContent={
              <div className="flex min-h-105 items-center justify-center text-slate-400">
                No payment audit records found.
              </div>
            }
          />
        </div>

        {!loading && paymentAudits.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {paymentAudits.length} payment audit record
              {paymentAudits.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </section>
      <AnimatePresence>
        {isDeleteLoanModalOpen && loanToDelete && (
          <motion.div
            key="loan-audit-delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                deletingLoanId === null
              ) {
                setIsDeleteLoanModalOpen(false);
                setLoanToDelete(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-loan-audit-title"
              aria-describedby="delete-loan-audit-description"
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="m19 6-1 14H6L5 6" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      id="delete-loan-audit-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Delete Loan Audit?
                    </h2>

                    <p
                      id="delete-loan-audit-description"
                      className="mt-2 text-sm leading-6 text-slate-500"
                    >
                      This loan audit record will be permanently removed. This
                      action cannot be undone.
                    </p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">
                        Reference ID
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-blue-700">
                        {loanToDelete.ref_id || "Not assigned"}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Borrower
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {loanToDelete.borrower_name || "Unknown borrower"}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Total repayment
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {formatCurrency(Number(loanToDelete.total))}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Action
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {loanToDelete.action || "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteLoanModalOpen(false);
                    setLoanToDelete(null);
                  }}
                  disabled={deletingLoanId !== null}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void deleteLoanAudit(loanToDelete.id)}
                  disabled={
                    deletingLoanId !== null || deletingPaymentId !== null
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingLoanId === loanToDelete.id ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Record"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Payment Audit Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeletePaymentModalOpen && paymentToDelete && (
          <motion.div
            key="payment-audit-delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                deletingPaymentId === null
              ) {
                setIsDeletePaymentModalOpen(false);
                setPaymentToDelete(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-payment-audit-title"
              aria-describedby="delete-payment-audit-description"
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="m19 6-1 14H6L5 6" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      id="delete-payment-audit-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Delete Payment Audit?
                    </h2>

                    <p
                      id="delete-payment-audit-description"
                      className="mt-2 text-sm leading-6 text-slate-500"
                    >
                      This payment audit record will be permanently removed.
                      This action cannot be undone.
                    </p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">
                        Reference ID
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-blue-700">
                        {paymentToDelete.ref_id || "Not assigned"}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Week
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {paymentToDelete.week_start || "N/A"}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Amount
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {formatCurrency(Number(paymentToDelete.amount))}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Remarks
                      </p>
                      <p className="mt-1 wrap-break-word text-sm text-slate-700">
                        {paymentToDelete.remarks || "No remarks"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeletePaymentModalOpen(false);
                    setPaymentToDelete(null);
                  }}
                  disabled={deletingPaymentId !== null}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void deletePaymentAudit(paymentToDelete.id)}
                  disabled={
                    deletingLoanId !== null || deletingPaymentId !== null
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingPaymentId === paymentToDelete.id ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Record"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
