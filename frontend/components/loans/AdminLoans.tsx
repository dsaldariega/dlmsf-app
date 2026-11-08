"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Loan, LoanAction, MemberOption, Toast, DataTableColumn } from "@/lib/types";
import {
  INTEREST_RATE,
  LOAN_DURATIONS,
  PENALTY_RATE,
} from "@/lib/constants/loans";
import { motion, AnimatePresence } from "motion/react";
import {
  calculateInterest,
  calculateMonthly,
  calculatePenalty,
  calculateTotal,
  formatCurrency,
} from "@/lib/utils/loans";

import DataTable from "@/components/ui/DataTable";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import TableLoading from "@/components/ui/TableLoading";

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [loanMonths, setLoanMonths] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loanAction, setLoanAction] = useState<LoanAction | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    void fetchMembers();
    void fetchLoans();
  }, []);

  // Fetch members and loans through the Node API
  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await apiRequest<MemberOption[]>("/api/members");
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
      showToast("error", "Unable to load members", error instanceof Error ? error.message : "Please try again.");
    } finally { setLoadingMembers(false); }
  };

  const fetchLoans = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await apiRequest<Loan[]>("/api/loans");
      setLoans(data);
    } catch (error) {
      console.error("Error fetching loans:", error);
      showToast("error", "Unable to load loans", error instanceof Error ? error.message : "Please try again.");
    } finally { if (showLoading) setLoading(false); }
  };

  // Create a loan through the Node API
  const addLoan = async () => {
    if (adding) return;
    if (borrowerId === null) {
      showToast("warning", "Borrower required", "Please select a member before creating a loan.");
      return;
    }
    if (amount === "" || !Number.isFinite(amount) || amount < 500 || amount % 500 !== 0) {
      showToast("warning", "Invalid loan amount", "Enter an amount of at least ₱500 in increments of ₱500.");
      return;
    }
    if (!Number.isInteger(loanMonths) || !LOAN_DURATIONS.includes(loanMonths)) {
      showToast("warning", "Invalid loan duration", "Please select a valid repayment duration.");
      return;
    }
    const memberExists = members.find((member) => member.id === borrowerId);
    if (!memberExists) {
      showToast("warning", "Invalid borrower", "Please select a valid registered member.");
      return;
    }

    setAdding(true);
    try {
      const newLoan = await apiRequest<Loan>("/api/loans", {
        method: "POST",
        body: JSON.stringify({ borrowerId, amount: Number(amount.toFixed(2)), months: loanMonths }),
      });
      setLoans((current) => [newLoan, ...current]);
      setBorrowerId(null);
      setAmount("");
      setLoanMonths(2);
      setIsAddModalOpen(false);
      showToast("success", "Loan created successfully", `${memberExists.name}'s loan has been added to your records.`);
    } catch (error) {
      console.error("Error adding loan:", error);
      showToast("error", "Failed to create loan", error instanceof Error ? error.message : "Please try again.");
    } finally { setAdding(false); }
  };

  // Mark a loan as paid through the Node API
  const markPaid = async (id: number) => {
    if (processingId !== null) return;
    setProcessingId(id);
    try {
      const updated = await apiRequest<Loan>(`/api/loans/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Paid" }),
      });
      setLoans((current) => current.map((loan) => loan.id === id ? updated : loan));
      setLoanAction(null);
      showToast("success", "Loan marked as paid", "The loan status has been updated successfully.");
    } catch (error) {
      console.error("Error marking loan as paid:", error);
      showToast("error", "Update failed", error instanceof Error ? error.message : "Please try again.");
    } finally { setProcessingId(null); }
  };

  // Delete a loan through the Node API
  const deleteLoan = async (id: number) => {
    if (processingId !== null) return;
    const loanToDelete = loans.find((loan) => loan.id === id);
    if (!loanToDelete) {
      showToast("error", "Loan not found", "Refresh the records and try again.");
      return;
    }
    setProcessingId(id);
    try {
      const result = await apiRequest<{ id: number; auditWarning?: string | null }>(`/api/loans/${id}`, { method: "DELETE" });
      setLoans((current) => current.filter((loan) => loan.id !== id));
      setLoanAction(null);
      if (result.auditWarning) {
        showToast("warning", "Loan deleted with a warning", "The loan was deleted, but its audit record could not be saved. " + result.auditWarning);
      } else {
        showToast("success", "Loan deleted", "The loan was removed and its deletion was recorded in the audit log.");
      }
    } catch (error) {
      console.error("Error deleting loan:", error);
      showToast("error", "Deletion failed", error instanceof Error ? error.message : "Please try again.");
      await fetchLoans(false);
    } finally { setProcessingId(null); }
  };

  // Summary calculations
  const totalLoanAmount = loans.reduce(
    (sum, loan) => sum + Number(loan.amount || 0),
    0,
  );

  const totalOutstanding = loans
    .filter((loan) => loan.status !== "Paid")
    .reduce((sum, loan) => sum + Number(loan.total || 0), 0);

  const paidLoans = loans.filter((loan) => loan.status === "Paid").length;

  const ongoingLoans = loans.filter((loan) => loan.status !== "Paid").length;

  //Toast
  const showToast = (type: Toast["type"], title: string, message: string) => {
    setToast({
      id: Date.now(),
      type,
      title,
      message,
    });
  };

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 4000);

    return () => clearTimeout(timeout);
  }, [toast]);

  const closeAddModal = () => {
    if (adding) return;

    setIsAddModalOpen(false);
    setBorrowerId(null);
    setAmount("");
    setLoanMonths(2);
  };
  const loanColumns: DataTableColumn<Loan>[] = [
    {
      key: "borrower",
      header: "Borrower",
      render: (loan) => (
        <span className="block truncate" title={loan.borrower?.name || "N/A"}>
          {loan.borrower?.name || "N/A"}
        </span>
      ),
    },
    {
      key: "principal",
      header: "Principal",
      render: (loan) => formatCurrency(Number(loan.amount)),
    },
    {
      key: "duration",
      header: "Duration",
      render: (loan) => {
        const months = loan.months || 2;

        return `${months} ${months === 1 ? "Month" : "Months"}`;
      },
    },
    {
      key: "interest",
      header: "Interest",
      render: (loan) => formatCurrency(Number(loan.interest)),
    },
    {
      key: "total",
      header: "Total",
      render: (loan) => formatCurrency(Number(loan.total)),
    },
    {
      key: "monthly",
      header: "Monthly",
      render: (loan) => formatCurrency(Number(loan.monthly)),
    },
    {
      key: "status",
      header: "Status",
      render: (loan) => {
        const status = loan.status || "Unknown";

        const badgeStyle: Record<string, string> = {
          Paid: "bg-emerald-500 text-white",
          Ongoing: "bg-amber-400 text-slate-900",
          Cancelled: "bg-red-500 text-white",
          Unknown: "bg-slate-500 text-white",
        };

        return (
          <span
            className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
              badgeStyle[status] || badgeStyle.Unknown
            }`}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (loan) => (
        <div className="flex w-max items-center gap-2 whitespace-nowrap">
          {loan.status !== "Paid" && (
            <button
              type="button"
              onClick={() => setLoanAction({ type: "paid", loan })}
              disabled={processingId !== null}
              className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Paid
            </button>
          )}

          <button
            type="button"
            onClick={() => setLoanAction({ type: "delete", loan })}
            disabled={processingId !== null}
            className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];
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
                    : toast.type === "warning"
                      ? "border-amber-200"
                      : "border-blue-200"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    toast.type === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : toast.type === "error"
                        ? "bg-red-50 text-red-600"
                        : toast.type === "warning"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-blue-50 text-blue-600"
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
                  ) : toast.type === "error" ? (
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
                      <path d="m15 9-6 6" />
                      <path d="m9 9 6 6" />
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
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
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
                  <span aria-hidden="true">✕</span>
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
                      : toast.type === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Loans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage borrower loans, interest, and repayment status.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Loan Principal",
            value: formatCurrency(totalLoanAmount),
            color: "text-blue-700",
          },
          {
            label: "Outstanding Loan Balance",
            value: formatCurrency(totalOutstanding),
            color: "text-orange-600",
          },
          {
            label: "Ongoing Loans",
            value: ongoingLoans.toLocaleString("en-PH"),
            color: "text-amber-600",
          },
          {
            label: "Paid Loans",
            value: paidLoans.toLocaleString("en-PH"),
            color: "text-green-700",
          },
        ].map((card, index) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                ease: "easeOut",
                delay: index * 0.07,
              }}
              key={`${loading}-${card.value}`}
              className={`mt-2 text-2xl font-bold tabular-nums ${card.color}`}
            >
              {loading ? "—" : card.value}
            </motion.p>
          </div>
        ))}
      </div>

      {/* Add Loan button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          disabled={loading || loadingMembers || members.length === 0}
          className="dlmsf-btn dlmsf-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Add Loan
        </button>
      </div>

      {/* Add Loan Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            key="add-loan-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto dlmsf-modal-backdrop p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeAddModal();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-loan-title"
              className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 10h18M7 15h3" />
                    </svg>
                  </div>

                  <div>
                    <h2
                      id="add-loan-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Create New Loan
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a borrower and review the repayment details.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={adding}
                  aria-label="Close dialog"
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void addLoan();
                }}
              >
                <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-6">
                  {/* Borrower and loan details */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="borrower"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Borrower <span className="text-red-500">*</span>
                      </label>

                      <select
                        id="borrower"
                        value={borrowerId ?? ""}
                        onChange={(event) =>
                          setBorrowerId(
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                          )
                        }
                        disabled={adding}
                        required
                        className="dlmsf-control disabled:opacity-60"
                      >
                        <option value="">Choose a borrower</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="loanAmount"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Loan Amount <span className="text-red-500">*</span>
                      </label>

                      <div className="flex h-12 overflow-hidden rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                        <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600">
                          ₱
                        </span>
                        <input
                          id="loanAmount"
                          type="number"
                          min="500"
                          step="500"
                          value={amount}
                          onChange={(event) =>
                            setAmount(
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                            )
                          }
                          disabled={adding}
                          required
                          placeholder="500"
                          className="min-w-0 w-full px-3 text-sm outline-none"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Minimum ₱500, in increments of ₱500.
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="loanMonths"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Repayment Duration{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        id="loanMonths"
                        value={loanMonths}
                        onChange={(event) =>
                          setLoanMonths(Number(event.target.value))
                        }
                        disabled={adding}
                        className="dlmsf-control disabled:opacity-60"
                      >
                        {LOAN_DURATIONS.map((months) => (
                          <option key={months} value={months}>
                            {months} {months === 1 ? "Month" : "Months"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Loan terms */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Loan Terms
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-blue-800">
                      <li>
                        Monthly interest: {INTEREST_RATE * 100}% of the original
                        principal.
                      </li>
                      <li>
                        Repayment duration: {loanMonths}{" "}
                        {loanMonths === 1 ? "month" : "months"}.
                      </li>
                      <li>Payment due date: Every 15th of the month.</li>
                      <li>
                        Late-payment penalty: {PENALTY_RATE * 100}% of the
                        original loan amount.
                      </li>
                    </ul>
                  </div>

                  {/* Live calculation preview */}
                  {amount !== "" && Number.isFinite(amount) && amount > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">
                        Repayment Summary
                      </h3>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">
                            Loan Principal
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {formatCurrency(amount)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                          <p className="text-xs text-blue-700">
                            Total Interest
                          </p>
                          <p className="mt-1 font-semibold text-blue-700">
                            {formatCurrency(
                              calculateInterest(amount, loanMonths),
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                          <p className="text-xs text-emerald-700">
                            Total Repayment
                          </p>
                          <p className="mt-1 font-semibold text-emerald-700">
                            {formatCurrency(calculateTotal(amount, loanMonths))}
                          </p>
                        </div>

                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                          <p className="text-xs text-indigo-700">
                            Monthly Payment
                          </p>
                          <p className="mt-1 font-semibold text-indigo-700">
                            {formatCurrency(
                              calculateMonthly(amount, loanMonths),
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg border border-red-100 bg-red-50 p-4 sm:col-span-2">
                          <p className="text-xs text-red-600">
                            Late Payment Penalty
                          </p>
                          <p className="mt-1 font-semibold text-red-700">
                            {formatCurrency(calculatePenalty(amount))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    disabled={adding}
                    className="dlmsf-btn dlmsf-btn-outline disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      adding ||
                      loading ||
                      loadingMembers ||
                      members.length === 0
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adding ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating Loan...
                      </>
                    ) : (
                      "Create Loan"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Loan Action Confirmation Modal */}
      <AnimatePresence>
        {loanAction && (
          <motion.div
            key="loan-action-confirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto dlmsf-modal-backdrop p-4"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                processingId === null
              ) {
                setLoanAction(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="loan-action-title"
              aria-describedby="loan-action-description"
            >
              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                      loanAction.type === "delete"
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {loanAction.type === "delete" ? (
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
                    ) : (
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
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      id="loan-action-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      {loanAction.type === "delete"
                        ? "Delete Loan?"
                        : "Mark Loan as Paid?"}
                    </h2>

                    <p
                      id="loan-action-description"
                      className="mt-2 text-sm leading-6 text-slate-500"
                    >
                      {loanAction.type === "delete"
                        ? "This loan will be permanently removed from your records. This action cannot be undone."
                        : "Confirm that this loan has been fully paid before changing its status."}
                    </p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {loanAction.loan.borrower?.name || "Unknown borrower"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(Number(loanAction.loan.total))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLoanAction(null)}
                  disabled={processingId !== null}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (loanAction.type === "delete") {
                      void deleteLoan(loanAction.loan.id);
                    } else {
                      void markPaid(loanAction.loan.id);
                    }
                  }}
                  disabled={processingId !== null}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    loanAction.type === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {processingId !== null ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Processing...
                    </>
                  ) : loanAction.type === "delete" ? (
                    "Delete Loan"
                  ) : (
                    "Confirm Payment"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loans table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loan Records</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review loan balances, repayment durations, and statuses.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-105 overflow-y-scroll">
            <DataTable
              data={loans}
              columns={loanColumns}
              getRowKey={(loan) => loan.id}
              tableClassName={`${tableClass} min-w-300`}
              thClassName={thClass}
              tdClassName={tdClass}
              loading={loading}
              loadingRow={<TableLoading message="Loading loans..." />}
              emptyMessage="No loan records yet."
            />
          </div>
        </div>

        {/* Table footer */}
        {!loading && loans.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {loans.length} loan record
              {loans.length === 1 ? "" : "s"} · {ongoingLoans} ongoing ·{" "}
              {paidLoans} paid
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
