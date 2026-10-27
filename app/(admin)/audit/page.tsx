"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuditToast, LoanAudit, PaymentAudit } from "@/lib/types/audit";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "@/lib/utils/loans";
import { getStatusStyle } from "@/lib/utils/audit";

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

  // Load audit records
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const [loans, payments] = await Promise.all([
        supabase
          .from("loans_audit_log")
          .select("*")
          .order("created_date", { ascending: false }),

        supabase
          .from("payments_audit_log")
          .select("*")
          .order("id", { ascending: false }),
      ]);

      if (loans.error) throw loans.error;
      if (payments.error) throw payments.error;

      setLoanAudits((loans.data || []) as LoanAudit[]);
      setPaymentAudits((payments.data || []) as PaymentAudit[]);

      if (showLoading) {
        showToast(
          "success",
          "Records refreshed",
          "Loan and payment audit records are up to date.",
        );
      }
    } catch (error) {
      console.error("Error loading audit records:", error);

      showToast(
        "error",
        "Unable to load audit records",
        error instanceof Error
          ? error.message
          : "Please refresh the page and try again.",
      );
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
      const { error } = await supabase
        .from("loans_audit_log")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setLoanAudits((current) => current.filter((audit) => audit.id !== id));

      setIsDeleteLoanModalOpen(false);
      setLoanToDelete(null);

      showToast(
        "success",
        "Audit record deleted",
        "The loan audit record was successfully removed.",
      );
    } catch (error) {
      console.error("Error deleting loan audit:", error);

      showToast(
        "error",
        "Deletion failed",
        error instanceof Error
          ? error.message
          : "Failed to delete loan audit record.",
      );
    } finally {
      setDeletingLoanId(null);
    }
  };

  const deletePaymentAudit = async (id: number) => {
    if (deletingLoanId !== null || deletingPaymentId !== null) return;

    setDeletingPaymentId(id);

    try {
      const { error } = await supabase
        .from("payments_audit_log")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPaymentAudits((current) =>
        current.filter((payment) => payment.id !== id),
      );

      setIsDeletePaymentModalOpen(false);
      setPaymentToDelete(null);

      showToast(
        "success",
        "Audit record deleted",
        "The payment audit record was successfully removed.",
      );
    } catch (error) {
      console.error("Error deleting payment audit:", error);

      showToast(
        "error",
        "Deletion failed",
        error instanceof Error
          ? error.message
          : "Failed to delete payment audit record.",
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const loadingCellClass =
    "h-75 px-5 py-10 text-center align-middle text-slate-500";

  const emptyCellClass =
    "h-75 px-5 py-10 text-center align-middle text-slate-400";

  const thClass =
    "w-1/3 border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

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

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh records"}
        </button>
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

        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <table className="relative w-full min-w-350 table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className={thClass}>Reference ID</th>
                <th className={thClass}>Borrower</th>
                <th className={thClass}>Principal</th>
                <th className={thClass}>Interest</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Monthly</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Remarks</th>
                <th className={thClass}>Created Date</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className={loadingCellClass}>
                    <span className="inline-flex items-center justify-center gap-3">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                      Loading loan audit records...
                    </span>
                  </td>
                </tr>
              ) : loanAudits.length === 0 ? (
                <tr>
                  <td colSpan={9} className={emptyCellClass}>
                    No loan audit records found.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {loanAudits.map((audit) => (
                    <motion.tr
                      key={audit.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        layout: { duration: 0.25 },
                      }}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-blue-700">
                        {audit.ref_id || "Not assigned"}
                      </td>
                      <td className="overflow-hidden px-5 py-4 font-semibold text-slate-800">
                        <span
                          className="block truncate"
                          title={audit.borrower_name || "N/A"}
                        >
                          {audit.borrower_name || "N/A"}
                        </span>
                        <p className="mt-1 text-xs font-normal text-slate-400">
                          Audit #{audit.id}
                        </p>
                      </td>

                      <td className="overflow-hidden px-5 py-4 tabular-nums text-slate-600">
                        {formatCurrency(audit.amount)}
                      </td>

                      <td className="overflow-hidden px-5 py-4 tabular-nums text-violet-700">
                        {formatCurrency(audit.interest)}
                      </td>

                      <td className="overflow-hidden px-5 py-4 font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(audit.total)}
                      </td>

                      <td className="overflow-hidden px-5 py-4 tabular-nums text-slate-600">
                        {formatCurrency(audit.monthly)}
                      </td>

                      <td className="overflow-hidden px-5 py-4">
                        <span
                          className={`inline-flex max-w-full truncate rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(audit.action)}`}
                        >
                          {audit.action || "Unknown"}
                        </span>
                      </td>

                      <td className="overflow-hidden px-5 py-4 text-slate-500">
                        <span className="block wrap-break-word">
                          {audit.remarks || "No remarks"}
                        </span>
                      </td>
                      <td className="overflow-hidden px-5 py-4 text-slate-500">
                        {audit.created_date
                          ? new Date(audit.created_date).toLocaleDateString(
                              "en-PH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "N/A"}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setLoanToDelete(audit);
                            setIsDeleteLoanModalOpen(true);
                          }}
                          disabled={
                            deletingLoanId !== null ||
                            deletingPaymentId !== null
                          }
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
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

        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <table className="relative w-full min-w-200 table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className={thClass}>Reference ID</th>
                <th className={thClass}>Week</th>
                <th className={thClass}>Amount</th>
                <th className={thClass}>Remarks</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className={loadingCellClass}>
                    <span className="inline-flex items-center justify-center gap-3">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                      Loading payment audit records...
                    </span>
                  </td>
                </tr>
              ) : paymentAudits.length === 0 ? (
                <tr>
                  <td colSpan={4} className={emptyCellClass}>
                    No payment audit records found.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {paymentAudits.map((payment) => (
                    <motion.tr
                      key={payment.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        layout: { duration: 0.25 },
                      }}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-blue-700">
                        {payment.ref_id || "Not assigned"}
                      </td>

                      <td className="overflow-hidden px-5 py-4 font-semibold text-slate-800">
                        <span className="block truncate">
                          {payment.week_start || "N/A"}
                        </span>
                        <p className="mt-1 text-xs font-normal text-slate-400">
                          Audit #{payment.id}
                        </p>
                      </td>

                      <td className="overflow-hidden px-5 py-4">
                        <span className="font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>

                      <td className="overflow-hidden px-5 py-4">
                        <span className="block wrap-break-word text-slate-500">
                          {payment.remarks || "No remarks"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentToDelete(payment);
                            setIsDeletePaymentModalOpen(true);
                          }}
                          disabled={
                            deletingLoanId !== null ||
                            deletingPaymentId !== null
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
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
      tsx
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
