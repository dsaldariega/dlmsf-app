"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LoanAudit, PaymentAudit } from "@/lib/types/audit";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "@/lib/utils/loans";
import { getStatusStyle } from "@/lib/utils/audit";

export default function AuditPage() {
  const [loanAudits, setLoanAudits] = useState<LoanAudit[]>([]);
  const [paymentAudits, setPaymentAudits] = useState<PaymentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Payment editing
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number | "">("");
  const [editPaymentRemarks, setEditPaymentRemarks] = useState("");

  // Action states
  const [savingPaymentId, setSavingPaymentId] = useState<number | null>(null);
  const [deletingLoanId, setDeletingLoanId] = useState<number | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(
    null,
  );

  // Load audit records
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorMessage("");

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
    } catch (error) {
      console.error("Error loading audit records:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load audit records. Please try again.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Payment audit editing
  const startPaymentEdit = (payment: PaymentAudit) => {
    setEditingPaymentId(payment.id);
    setEditPaymentAmount(Number(payment.amount) || 0);
    setEditPaymentRemarks(payment.remarks || "");
  };

  const cancelPaymentEdit = () => {
    setEditingPaymentId(null);
    setEditPaymentAmount("");
    setEditPaymentRemarks("");
  };

  const savePaymentEdit = async (id: number) => {
    if (savingPaymentId !== null) return;

    if (
      editPaymentAmount === "" ||
      !Number.isFinite(editPaymentAmount) ||
      editPaymentAmount <= 0
    ) {
      alert("Amount must be greater than 0.");
      return;
    }

    setSavingPaymentId(id);

    try {
      const { error } = await supabase
        .from("payment_audit")
        .update({
          amount: Number(editPaymentAmount.toFixed(2)),
          remarks: editPaymentRemarks.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;

      setPaymentAudits((current) =>
        current.map((payment) =>
          payment.id === id
            ? {
                ...payment,
                amount: Number(editPaymentAmount.toFixed(2)),
                remarks: editPaymentRemarks.trim() || null,
              }
            : payment,
        ),
      );

      cancelPaymentEdit();
    } catch (error) {
      console.error("Error updating payment audit:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update payment audit record.",
      );
    } finally {
      setSavingPaymentId(null);
    }
  };

  const deleteLoanAudit = async (id: number) => {
    if (deletingLoanId !== null) return;

    if (!confirm("Delete this loan audit record? This cannot be undone.")) {
      return;
    }

    setDeletingLoanId(id);

    try {
      const { error } = await supabase
        .from("loans_audit_log")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setLoanAudits((current) => current.filter((audit) => audit.id !== id));
    } catch (error) {
      console.error("Error deleting loan audit:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete loan audit record.",
      );
    } finally {
      setDeletingLoanId(null);
    }
  };

  const deletePaymentAudit = async (id: number) => {
    if (deletingPaymentId !== null) return;

    if (!confirm("Delete this payment audit record? This cannot be undone.")) {
      return;
    }

    setDeletingPaymentId(id);

    try {
      const { error } = await supabase
        .from("payment_audit_log")
        .delete()
        .eq("id", id);

      if (error) throw error;

      if (editingPaymentId === id) cancelPaymentEdit();

      setPaymentAudits((current) =>
        current.filter((payment) => payment.id !== id),
      );
    } catch (error) {
      console.error("Error deleting payment audit:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete payment audit record.",
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Summary calculations
  const totalLoans = loanAudits.reduce(
    (sum, audit) => sum + Number(audit.amount || 0),
    0,
  );

  const totalInterest = loanAudits.reduce(
    (sum, audit) => sum + Number(audit.interest || 0),
    0,
  );

  const totalLoanAmount = loanAudits.reduce(
    (sum, audit) => sum + Number(audit.total || 0),
    0,
  );

  const totalPayments = paymentAudits.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const loadingCellClass =
    "h-75 px-5 py-10 text-center align-middle text-slate-500";

  const emptyCellClass =
    "h-75 px-5 py-10 text-center align-middle text-slate-400";

  const thClass =
    "w-1/3 border-b border-slate-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-6">
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

      {/* Summary Cards - cards remain static; values animate */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Loan Principal
          </p>
          <motion.p
            key={`${loading}-${totalLoans}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-blue-700"
          >
            {loading ? "—" : formatCurrency(totalLoans)}
          </motion.p>
          <p className="mt-1 text-xs text-slate-400">
            {loading
              ? "Loading records..."
              : `${loanAudits.length} audit records`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Interest</p>
          <motion.p
            key={`${loading}-${totalInterest}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="mt-2 text-2xl font-bold tabular-nums text-violet-700"
          >
            {loading ? "—" : formatCurrency(totalInterest)}
          </motion.p>
          <p className="mt-1 text-xs text-slate-400">
            Interest across audited loans
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Repayment</p>
          <motion.p
            key={`${loading}-${totalLoanAmount}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
            className="mt-2 text-2xl font-bold tabular-nums text-emerald-700"
          >
            {loading ? "—" : formatCurrency(totalLoanAmount)}
          </motion.p>
          <p className="mt-1 text-xs text-slate-400">Principal plus interest</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Payments</p>
          <motion.p
            key={`${loading}-${totalPayments}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.15 }}
            className="mt-2 text-2xl font-bold tabular-nums text-orange-600"
          >
            {loading ? "—" : formatCurrency(totalPayments)}
          </motion.p>
          <p className="mt-1 text-xs text-slate-400">
            {loading
              ? "Loading records..."
              : `${paymentAudits.length} payment records`}
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

        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <table className="relative w-full min-w-350 table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
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
                          className={`inline-flex max-w-full truncate rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(audit.status)}`}
                        >
                          {audit.status || "Unknown"}
                        </span>
                      </td>

                      <td className="overflow-hidden px-5 py-4 text-slate-500">
                        <span className="block wrap-break-word">
                          {audit.remarks || "No remarks"}
                        </span>
                      </td>

                      <td className="overflow-hidden px-5 py-4 text-slate-500">
                        <span className="block">
                          {audit.created_date
                            ? new Date(audit.created_date).toLocaleString(
                                "en-PH",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                },
                              )
                            : "N/A"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void deleteLoanAudit(audit.id)}
                          disabled={deletingLoanId !== null}
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingLoanId === audit.id
                            ? "Deleting..."
                            : "Delete"}
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
            Review payment amounts and manage audit remarks.
          </p>
        </div>

        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <table className="relative w-full min-w-200 table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
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
                  {paymentAudits.map((payment) => {
                    const isEditing = editingPaymentId === payment.id;

                    return (
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
                        <td className="overflow-hidden px-5 py-4 font-semibold text-slate-800">
                          <span className="block truncate">
                            {payment.week || "N/A"}
                          </span>
                          <p className="mt-1 text-xs font-normal text-slate-400">
                            Audit #{payment.id}
                          </p>
                        </td>

                        <td className="overflow-hidden px-5 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editPaymentAmount}
                              onChange={(e) =>
                                setEditPaymentAmount(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              aria-label={`Payment amount for audit ${payment.id}`}
                            />
                          ) : (
                            <span className="font-semibold tabular-nums text-emerald-700">
                              {formatCurrency(payment.amount)}
                            </span>
                          )}
                        </td>

                        <td className="overflow-hidden px-5 py-4">
                          {isEditing ? (
                            <input
                              value={editPaymentRemarks}
                              onChange={(e) =>
                                setEditPaymentRemarks(e.target.value)
                              }
                              placeholder="Add remarks..."
                              className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="block wrap-break-word text-slate-500">
                              {payment.remarks || "No remarks"}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void savePaymentEdit(payment.id)
                                  }
                                  disabled={savingPaymentId !== null}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {savingPaymentId === payment.id
                                    ? "Saving..."
                                    : "Save"}
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelPaymentEdit}
                                  disabled={savingPaymentId !== null}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startPaymentEdit(payment)}
                                  className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deletePaymentAudit(payment.id)
                                  }
                                  disabled={deletingPaymentId !== null}
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {deletingPaymentId === payment.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
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
              {" · "}Total payments: {formatCurrency(totalPayments)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
