"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LoanAudit, PaymentAudit } from "@/lib/types/audit";
import { motion, AnimatePresence } from "motion/react";

const formatCurrency = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "paid":
      return "bg-emerald-100 text-emerald-700";
    case "active":
      return "bg-blue-100 text-blue-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "overdue":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const actionClass =
  "inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function AuditPage() {
  const [loanAudits, setLoanAudits] = useState<LoanAudit[]>([]);
  const [paymentAudits, setPaymentAudits] = useState<PaymentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Loan editing
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editLoanStatus, setEditLoanStatus] = useState("Pending");
  const [editLoanRemarks, setEditLoanRemarks] = useState("");

  // Payment editing
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number | "">("");
  const [editPaymentRemarks, setEditPaymentRemarks] = useState("");

  // Action states
  const [savingLoanId, setSavingLoanId] = useState<number | null>(null);
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

  // Loan audit editing
  const startLoanEdit = (audit: LoanAudit) => {
    setEditingLoanId(audit.id);
    setEditLoanStatus(audit.status || "Pending");
    setEditLoanRemarks(audit.remarks || "");
  };

  const cancelLoanEdit = () => {
    setEditingLoanId(null);
    setEditLoanStatus("Pending");
    setEditLoanRemarks("");
  };

  const saveLoanEdit = async (id: number) => {
    if (savingLoanId !== null) return;

    setSavingLoanId(id);

    try {
      const { error } = await supabase
        .from("loans_audit_log")
        .update({
          status: editLoanStatus,
          remarks: editLoanRemarks.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;

      setEditingLoanId(null);
      await load();
    } catch (error) {
      console.error("Error updating loan audit:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update loan audit record.",
      );
    } finally {
      setSavingLoanId(null);
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

      if (editingLoanId === id) cancelLoanEdit();

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

      setEditingPaymentId(null);
      setEditPaymentAmount("");
      setEditPaymentRemarks("");
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

  const pendingLoans = loanAudits.filter(
    (audit) => audit.status?.toLowerCase() === "pending",
  ).length;

  const paidLoans = loanAudits.filter(
    (audit) => audit.status?.toLowerCase() === "paid",
  ).length;

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Loan Principal
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatCurrency(totalLoans)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {loanAudits.length} audit records
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Interest</p>
          <p className="mt-2 text-2xl font-bold text-violet-700">
            {formatCurrency(totalInterest)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Interest across audited loans
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Repayment</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatCurrency(totalLoanAmount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Principal plus interest</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Payments</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            {formatCurrency(totalPayments)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {paymentAudits.length} payment records
          </p>
        </div>
      </div>

      {/* Loan Audit Log */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loans Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review loan amounts, repayment status, and audit remarks.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Borrower</th>
                <th className="whitespace-nowrap px-5 py-3">Principal</th>
                <th className="whitespace-nowrap px-5 py-3">Interest</th>
                <th className="whitespace-nowrap px-5 py-3">Total</th>
                <th className="whitespace-nowrap px-5 py-3">Monthly</th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
                <th className="min-w-56 px-5 py-3">Remarks</th>
                <th className="whitespace-nowrap px-5 py-3">Created Date</th>
                <th className="whitespace-nowrap px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Loading loan audit records...
                  </td>
                </tr>
              ) : loanAudits.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No loan audit records found.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {loanAudits.map((audit) => {
                    const isEditing = editingLoanId === audit.id;

                    return (
                      <motion.tr
                        key={audit.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">
                          {audit.borrower_name || "N/A"}
                          <p className="mt-1 text-xs font-normal text-slate-400">
                            Audit #{audit.id}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatCurrency(audit.amount)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-violet-700">
                          {formatCurrency(audit.interest)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-emerald-700">
                          {formatCurrency(audit.total)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatCurrency(audit.monthly)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(audit.status)}`}
                          >
                            {audit.status || "Unknown"}
                          </span>
                        </td>

                        <td className="min-w-56 px-5 py-4">
                          <span className="wrap-break-word text-slate-500">
                            {audit.remarks || "No remarks"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                          {audit.created_date
                            ? new Date(audit.created_date).toLocaleString(
                                "en-PH",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                },
                              )
                            : "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void deleteLoanAudit(audit.id)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
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

        {!loading && loanAudits.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {loanAudits.length} loan audit record
              {loanAudits.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </section>

      {/* Payment Audit Log */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Payment Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review payment amounts and manage audit remarks.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Week</th>
                <th className="whitespace-nowrap px-5 py-3">Amount</th>
                <th className="min-w-56 px-5 py-3">Remarks</th>
                <th className="whitespace-nowrap px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Loading payment audit records...
                  </td>
                </tr>
              ) : paymentAudits.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No payment audit records found.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {paymentAudits.map((payment) => {
                    const isEditing = editingPaymentId === payment.id;

                    return (
                      <motion.tr
                        key={payment.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">
                          {payment.week || "N/A"}
                          <p className="mt-1 text-xs font-normal text-slate-400">
                            Audit #{payment.id}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
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
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              aria-label={`Payment amount for audit ${payment.id}`}
                            />
                          ) : (
                            <span className="font-semibold text-emerald-700">
                              {formatCurrency(payment.amount)}
                            </span>
                          )}
                        </td>

                        <td className="min-w-56 px-5 py-4">
                          {isEditing ? (
                            <input
                              value={editPaymentRemarks}
                              onChange={(e) =>
                                setEditPaymentRemarks(e.target.value)
                              }
                              placeholder="Add remarks..."
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="wrap-break-word text-slate-500">
                              {payment.remarks || "No remarks"}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void savePaymentEdit(payment.id)
                                  }
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelPaymentEdit}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Delete
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
