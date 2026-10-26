"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loan } from "@/lib/types/loan";
import { MemberOption } from "@/lib/types/member";
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

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [loanMonths, setLoanMonths] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void fetchMembers();
    void fetchLoans();
  }, []);

  // Fetch members
  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("id, name")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching members:", error);
      alert("Unable to load members.");
      return;
    }

    setMembers(data || []);
  };

  // Fetch loans
  const fetchLoans = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("loans")
        .select("*, borrower:borrower_id(name)")
        .order("id", { ascending: false });

      if (error) throw error;

      setLoans((data || []) as Loan[]);
    } catch (error) {
      console.error("Error fetching loans:", error);
      alert("Unable to load loans.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  function TableLoading({ message }: { message: string }) {
    return (
      <tr>
        <td
          colSpan={4}
          className="h-75 px-5 py-10 text-center align-middle text-slate-500"
        >
          <span className="inline-flex items-center justify-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            {message}
          </span>
        </td>
      </tr>
    );
  }

  const tableClass =
    "w-full min-w-[600px] table-fixed border-collapse text-left text-sm";

  const thClass =
    "border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

  const tdClass = "border-b border-slate-100 px-5 py-4 text-slate-700";

  // Add loan and create audit log
  const addLoan = async () => {
    if (adding) return;

    if (borrowerId === null) {
      alert("Please select a member.");
      return;
    }

    if (amount === "" || !Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid loan amount.");
      return;
    }

    if (!Number.isInteger(loanMonths) || !LOAN_DURATIONS.includes(loanMonths)) {
      alert("Please select a valid loan duration.");
      return;
    }

    const memberExists = members.find((member) => member.id === borrowerId);

    if (!memberExists) {
      alert("Invalid member selected.");
      return;
    }

    setAdding(true);

    let loanCreated = false;

    try {
      // Calculate loan amounts
      const principal = Number(amount.toFixed(2));
      const interest = calculateInterest(principal, loanMonths);
      const total = Number((principal + interest).toFixed(2));
      const monthly = calculateMonthly(principal, loanMonths);
      const status = "Ongoing";

      // 1. Insert loan and retrieve the created record
      const { data: newLoan, error: loanError } = await supabase
        .from("loans")
        .insert({
          borrower_id: memberExists.id,
          amount: principal,
          interest,
          total,
          monthly,
          months: loanMonths,
          status,
        })
        .select("*, borrower:borrower_id(name)")
        .single();

      if (loanError) throw loanError;

      if (!newLoan) {
        throw new Error(
          "Loan was created, but its record could not be retrieved.",
        );
      }

      loanCreated = true;

      // 2. Insert audit record linked to the new loan
      const { error: auditError } = await supabase
        .from("loans_audit_log")
        .insert({
          id: newLoan.id,
          borrower_name: memberExists.id,
          amount: principal,
          interest,
          total,
          monthly,
          status,
          remarks: `New loan created (${loanMonths} ${
            loanMonths === 1 ? "month" : "months"
          })`,
          created_date: new Date().toISOString(),
        });

      if (auditError) {
        console.error("Loan audit logging failed:", auditError);

        await fetchLoans();

        alert(
          "Loan was created, but the audit record failed. Check the loans_audit_log columns and foreign key relationships. Do not submit the loan again.",
        );

        return;
      }

      // 3. Insert the new loan into the table immediately
      setLoans((currentLoans) => [newLoan as Loan, ...currentLoans]);

      // 4. Reset the form
      setBorrowerId(null);
      setAmount("");
      setLoanMonths(2);
    } catch (error) {
      console.error("Error adding loan:", error);

      if (loanCreated) {
        await fetchLoans();

        alert(
          "The loan was created, but a later operation failed. Check your audit log before trying again.",
        );
      } else {
        alert(error instanceof Error ? error.message : "Unable to add loan.");
      }
    } finally {
      setAdding(false);
    }
  };

  // Mark loan as paid
  const markPaid = async (id: number) => {
    if (!confirm("Mark this loan as paid?")) return;

    const { error } = await supabase
      .from("loans")
      .update({ status: "Paid" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    // Full refresh: show the loading state and then animate rows in again.
    await fetchLoans();
  };

  // Delete loan
  const deleteLoan = async (id: number) => {
    if (!confirm("Delete this loan? This action cannot be undone.")) {
      return;
    }

    const { error } = await supabase.from("loans").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    // Remove the loan from the table with an exit animation
    setLoans((currentLoans) => currentLoans.filter((loan) => loan.id !== id));
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Loans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage borrower loans, interest, and repayment status.
        </p>
      </div>

      {/* Summary cards */}
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

      {/* Add loan form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add New Loan</h2>

        <p className="mt-1 text-sm text-slate-500">
          Select a borrower, enter the loan amount, and choose the repayment
          duration to calculate interest and monthly payments.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          {/* Borrower */}
          <div className="min-w-0">
            <label
              htmlFor="borrower"
              className="mb-2 block text-sm font-semibold leading-5 text-slate-700"
            >
              Borrower <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <select
                id="borrower"
                value={borrowerId ?? ""}
                onChange={(event) =>
                  setBorrowerId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className="h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Choose a borrower</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Loan amount */}
          <div className="min-w-0">
            <label
              htmlFor="loanAmount"
              className="mb-2 block text-sm font-semibold leading-5 text-slate-700"
            >
              Loan Amount <span className="text-red-500">*</span>
            </label>

            <div className="flex h-12 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
              <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600">
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
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                placeholder="500"
                className="min-w-0 w-full px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Loan duration */}
          <div className="min-w-0">
            <label
              htmlFor="loanMonths"
              className="mb-2 block text-sm font-semibold leading-5 text-slate-700"
            >
              Loan Duration <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <select
                id="loanMonths"
                value={loanMonths}
                onChange={(event) => setLoanMonths(Number(event.target.value))}
                className="h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {LOAN_DURATIONS.map((months) => (
                  <option key={months} value={months}>
                    {months} {months === 1 ? "Month" : "Months"}
                  </option>
                ))}
              </select>

              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Add loan button */}
          <div className="flex min-w-0 items-end">
            <button
              type="button"
              onClick={addLoan}
              disabled={adding || loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Add Loan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loan terms */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium">Loan terms:</p>
          <ul className="mt-1 space-y-1 text-xs leading-5 text-blue-700">
            <li>- Monthly interest: 5% of the original loan principal.</li>
            <li>
              - Repayment duration: {loanMonths}{" "}
              {loanMonths === 1 ? "month" : "months"}.
            </li>
            <li>- Payment due date: Every 15th of the month.</li>
            <li>
              - Late-payment penalty: 2.5% of the original loan amount when
              payment is overdue.
            </li>
          </ul>
        </div>

        {/* Live loan calculations */}
        {amount !== "" && Number.isFinite(amount) && amount > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">
                Loan Principal
              </p>
              <p className="mt-1 font-semibold tabular-nums text-slate-800">
                {formatCurrency(amount)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">
                Total Interest ({loanMonths}{" "}
                {loanMonths === 1 ? "Month" : "Months"})
              </p>
              <p className="mt-1 font-semibold tabular-nums text-blue-700">
                {formatCurrency(calculateInterest(amount, loanMonths))}
              </p>
              <p className="mt-1 text-xs text-slate-500">5% per month</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">
                Total Repayment
              </p>
              <p className="mt-1 font-semibold tabular-nums text-green-700">
                {formatCurrency(calculateTotal(amount, loanMonths))}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Principal + total interest
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">
                Monthly Payment
              </p>
              <p className="mt-1 font-semibold tabular-nums text-indigo-700">
                {formatCurrency(calculateMonthly(amount, loanMonths))}
              </p>
              <p className="mt-1 text-xs text-slate-500">Due every 15th</p>
            </div>

            <div className="rounded-lg border border-red-100 bg-red-50 p-4 sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-medium text-red-600">
                Late Payment Penalty (2.5%)
              </p>
              <p className="mt-1 font-semibold tabular-nums text-red-700">
                {formatCurrency(calculatePenalty(amount))}
              </p>
              <p className="mt-1 text-xs text-red-600">
                Additional charge when a payment is overdue.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Loans table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loan Records</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review loan balances, repayment durations, and statuses.
          </p>
        </div>

        <div className="h-105 overflow-y-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className={`${tableClass} relative min-w-300`}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={thClass}>Borrower</th>
                <th className={thClass}>Principal</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Interest</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Monthly</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableLoading message="Loading loans..." />
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${tdClass} text-center`}>
                    No loan records yet.
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="sync">
                  {loans.map((loan) => {
                    const status = loan.status || "Unknown";

                    const badgeStyle: Record<string, string> = {
                      Paid: "bg-emerald-500 text-white",
                      Ongoing: "bg-amber-400 text-slate-900",
                      Cancelled: "bg-red-500 text-white",
                      Unknown: "bg-slate-500 text-white",
                    };

                    return (
                      <motion.tr
                        key={loan.id}
                        layout
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut",
                          layout: { duration: 0.25 },
                        }}
                        className="hover:bg-slate-50"
                      >
                        <td
                          className={`${tdClass} w-72 font-medium text-slate-700`}
                        >
                          <span
                            className="block truncate"
                            title={loan.borrower?.name || "N/A"}
                          >
                            {loan.borrower?.name || "N/A"}
                          </span>
                        </td>

                        <td className={tdClass}>
                          {formatCurrency(Number(loan.amount))}
                        </td>

                        <td className={tdClass}>
                          {loan.months || 2}{" "}
                          {(loan.months || 2) === 1 ? "Month" : "Months"}
                        </td>

                        <td className={tdClass}>
                          {formatCurrency(Number(loan.interest))}
                        </td>

                        <td className={tdClass}>
                          {formatCurrency(Number(loan.total))}
                        </td>

                        <td className={tdClass}>
                          {formatCurrency(Number(loan.monthly))}
                        </td>

                        <td className={tdClass}>
                          <span
                            className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                              badgeStyle[status] || badgeStyle.Unknown
                            }`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className={tdClass}>
                          <div className="flex items-center gap-2">
                            {loan.status !== "Paid" && (
                              <button
                                type="button"
                                onClick={() => markPaid(loan.id)}
                                className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Mark Paid
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteLoan(loan.id)}
                              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
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
