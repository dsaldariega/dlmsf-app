"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from "@/lib/supabase";
import { MemberCount } from "@/lib/types/member";
import { LoanPayment, Payment } from "@/lib/types/payment";
import { RATE } from "@/lib/constants/payment";
import { motion, AnimatePresence } from "motion/react";

export default function PaymentsPage() {
  const [members, setMembers] = useState<MemberCount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);

  // Select only one date for the weekly collection.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);

    try {
      const [m, p, lp] = await Promise.all([
        supabase.from("members").select("id, heads"),
        supabase
          .from("payments")
          .select("*")
          .order("week_start", { ascending: false }),
        supabase
          .from("loan_payments")
          .select("*")
          .order("paid_at", { ascending: false }),
      ]);

      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (lp.error) throw lp.error;

      setMembers(m.data || []);
      setPayments(m.data ? p.data || [] : []);
      setLoanPayments(lp.data || []);
    } catch (error) {
      console.error("Error loading payment data:", error);
      alert("Unable to load payment data.");
    } finally {
      setLoading(false);
    }
  };

  // Format a local calendar date as YYYY-MM-DD.
  // This avoids date shifts caused by UTC conversion.
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Get Sunday for the week containing the selected date.
  const getSunday = (date: Date) => {
    const sunday = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    sunday.setDate(sunday.getDate() - sunday.getDay());

    return sunday;
  };

  // Generate exactly one weekly payment record
  const generateWeeklyPayment = async () => {
    if (!selectedDate) {
      alert("Please select a collection date.");
      return;
    }

    if (generating || loading) return;

    setGenerating(true);

    try {
      const sunday = getSunday(selectedDate);
      const weekStart = toDateString(sunday);

      // Check whether this Sunday already has a payment
      const { data: existing, error: existingError } = await supabase
        .from("payments")
        .select("id")
        .eq("week_start", weekStart)
        .limit(1);

      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        alert(`A weekly payment for Sunday, ${weekStart}, already exists.`);
        return;
      }

      // Calculate the collection from all member heads
      const totalAmount =
        members.reduce((sum, member) => sum + Number(member.heads || 0), 0) *
        RATE;

      // Insert and retrieve the newly created payment
      const { data: newPayment, error: insertError } = await supabase
        .from("payments")
        .insert({
          amount: totalAmount,
          week_start: weekStart,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      if (!newPayment) {
        throw new Error(
          "Payment was created, but its record could not be retrieved.",
        );
      }

      // Update only the weekly payments table
      setPayments((currentPayments) =>
        [newPayment as Payment, ...currentPayments].sort(
          (a, b) =>
            new Date(b.week_start).getTime() - new Date(a.week_start).getTime(),
        ),
      );

      setSelectedDate(null);

      // Avoid a blocking alert so the animation can play immediately
    } catch (error) {
      console.error("Error generating weekly payment:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to generate the weekly payment.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const deletePayment = async (id: number) => {
    if (!confirm("Delete this weekly payment?")) return;

    const { error } = await supabase.from("payments").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    // Remove the deleted payment from local state
    setPayments((currentPayments) =>
      currentPayments.filter((payment) => payment.id !== id),
    );
  };

  const total = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Payments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate weekly sinking fund collections and manage payment records.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Sinking Fund Payments
          </p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatCurrency(total)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Weekly Payment Records
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {payments.length}
          </p>
        </div>
      </div>

      {/* Weekly payment generator */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Generate Weekly Reports
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Select a date for the weekly collection. The system will automatically
          assign the payment to the Sunday of that week.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] lg:max-w-2xl">
          {/* Collection date */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Collection date
            </label>

            <DatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="MMMM d, yyyy"
              placeholderText="Select a collection date"
              isClearable
              filterDate={(date) => date.getDay() === 0}
              className="h-11.5 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              wrapperClassName="w-full"
            />

            <p className="mt-2 text-xs text-slate-500">
              The payment will be recorded under the Sunday of the selected
              week.
            </p>
          </div>

          {/* Generate button */}
          <div className="flex items-start pt-7.5 sm:pt-7.5">
            <button
              type="button"
              onClick={generateWeeklyPayment}
              disabled={!selectedDate || generating || loading}
              className="inline-flex h-11.5 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <span aria-hidden="true">+</span>
                  Generate Weekly Payment
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Weekly payments table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Weekly Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review, edit, or delete generated payment records.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Week Start</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No weekly payments yet.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {payments.map((payment) => (
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
                      {/* Week Start */}
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                        {payment.week_start}
                      </td>

                      {/* Payment Amount */}
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-green-700">
                        {formatCurrency(Number(payment.amount))}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() => deletePayment(payment.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          <svg
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
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="m19 6-1 14H6L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>

            {!loading && payments.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    Total
                  </td>
                  <td className="px-5 py-4 font-bold text-green-700">
                    {formatCurrency(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Loan payments table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loan Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded loan repayments.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Borrower</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Date Paid</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Loading loan payments...
                  </td>
                </tr>
              ) : loanPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No loan payments yet.
                  </td>
                </tr>
              ) : (
                loanPayments.map((payment, index) => (
                  <tr
                    key={`${payment.paid_at}-${index}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {payment.borrower || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-purple-700">
                      {formatCurrency(Number(payment.amount || 0))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
