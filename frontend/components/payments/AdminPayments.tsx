"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from "@/lib/supabase";
import { MemberCount } from "@/lib/types/member";
import { LoanPayment, Payment } from "@/lib/types/payment";
import { Toast } from "@/lib/types/loan";
import { RATE } from "@/lib/constants/member";
import { motion, AnimatePresence } from "motion/react";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import {
  tableClass,
  tbodyClass,
  tdClass,
  thClass,
} from "@/components/ui/table-styles";

export default function PaymentsPage() {
  const [members, setMembers] = useState<MemberCount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);

  // Select only one date for the weekly collection.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

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
          .select("*, borrower:members!loan_payments_member_id_fkey(name)")
          .order("paid_at", { ascending: false }),
      ]);

      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (lp.error) throw lp.error;

      setMembers(m.data || []);
      setPayments(p.data || []);
      setLoanPayments(
        (lp.data || []).map((payment) => ({
          ...payment,
          borrower: payment.borrower?.name ?? "—",
        })),
      );
    } catch (error) {
      console.error("Error loading payment data:", error);

      showToast(
        "error",
        "Unable to load payment data",
        error instanceof Error
          ? error.message
          : "Please refresh the page and try again.",
      );
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
    if (generating || loading) return;

    if (!selectedDate) {
      showToast(
        "warning",
        "Collection date required",
        "Please select a Sunday for the weekly collection.",
      );
      return;
    }

    setGenerating(true);

    let paymentCreated = false;

    try {
      const sunday = getSunday(selectedDate);
      const weekStart = toDateString(sunday);

      // 1. Check whether this Sunday already has a payment.
      const { data: existing, error: existingError } = await supabase
        .from("payments")
        .select("id")
        .eq("week_start", weekStart)
        .limit(1);

      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        showToast(
          "warning",
          "Payment already exists",
          `A weekly payment for Sunday, ${weekStart}, already exists.`,
        );
        return;
      }

      // 2. Calculate the collection from all member heads.
      const totalHeads = members.reduce(
        (sum, member) => sum + Number(member.heads || 0),
        0,
      );

      const totalAmount = totalHeads * RATE;

      // 3. Insert the weekly payment and retrieve its record.
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

      paymentCreated = true;

      // 4. Insert the audit record.
      const { error: auditError } = await supabase
        .from("payments_audit_log")
        .insert({
          ref_id: newPayment.id,
          amount: totalAmount,
          week_start: weekStart,
          action: "Weekly Payment Created",
          remarks: `Weekly sinking fund collection generated for Sunday, ${weekStart}. Total member heads: ${totalHeads}. Rate per head: ${RATE}.`,
          created_date: new Date().toISOString(),
        });

      if (auditError) {
        console.error("Payment audit logging failed:", auditError);

        // The payment already exists. Refresh the table and do not
        // ask the user to retry as that could create a duplicate.
        await load();

        showToast(
          "warning",
          "Payment created with a warning",
          "The weekly payment was created, but its audit record failed. Check the audit log before retrying.",
        );

        return;
      }

      // 5. Update the weekly payments table immediately.
      setPayments((currentPayments) =>
        [newPayment as Payment, ...currentPayments].sort(
          (a, b) =>
            new Date(b.week_start).getTime() - new Date(a.week_start).getTime(),
        ),
      );

      // 6. Reset and close the modal.
      setSelectedDate(null);
      setIsGenerateModalOpen(false);

      showToast(
        "success",
        "Weekly payment generated",
        `${formatCurrency(totalAmount)} has been recorded for ${weekStart}, and the audit entry was saved.`,
      );
    } catch (error) {
      console.error("Error generating weekly payment:", error);

      if (paymentCreated) {
        // The payment exists even though a later operation failed.
        await load();

        showToast(
          "warning",
          "Payment created with a warning",
          "The weekly payment may already exist, but a subsequent operation failed. Check the payment records and audit log before retrying.",
        );
      } else {
        showToast(
          "error",
          "Generation failed",
          error instanceof Error
            ? error.message
            : "Unable to generate the weekly payment. Please try again.",
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  //Delete Payment

  const deletePayment = async (id: number) => {
    if (deletingId !== null) return;

    const paymentToRemove = payments.find((payment) => payment.id === id);

    if (!paymentToRemove) {
      setPaymentToDelete(null);

      showToast(
        "error",
        "Payment not found",
        "Refresh the records and try again.",
      );
      return;
    }

    setDeletingId(id);

    try {
      // 1. Delete the weekly payment.
      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // 2. Update the UI immediately after deletion.
      setPayments((currentPayments) =>
        currentPayments.filter((payment) => payment.id !== id),
      );

      setPaymentToDelete(null);

      // 3. Create an audit record for the deleted payment.
      const { error: auditError } = await supabase
        .from("payments_audit_log")
        .insert({
          ref_id: paymentToRemove.id,
          amount: Number(paymentToRemove.amount || 0),
          week_start: paymentToRemove.week_start,
          action: "Weekly Payment Deleted",
          remarks: `Weekly sinking fund payment deleted for Sunday, ${paymentToRemove.week_start}. Deleted payment ID: ${paymentToRemove.id}. Amount: ${formatCurrency(Number(paymentToRemove.amount || 0))}.`,
          created_date: new Date().toISOString(),
        });

      // The payment is already deleted, so don't report the deletion itself
      // as failed if only the audit operation fails.
      if (auditError) {
        console.error("Payment deletion audit logging failed:", auditError);

        showToast(
          "warning",
          "Payment deleted with a warning",
          "The weekly payment was deleted, but its audit record could not be saved. Check the audit log.",
        );

        return;
      }

      // 4. Confirm that both operations succeeded.
      showToast(
        "success",
        "Payment deleted",
        `The weekly payment for ${paymentToRemove.week_start} has been deleted and recorded in the audit log.`,
      );
    } catch (error) {
      console.error("Error deleting weekly payment:", error);

      showToast(
        "error",
        "Deletion failed",
        error instanceof Error
          ? error.message
          : "Unable to delete the weekly payment. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
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

  const weeklyPaymentColumns: DataTableColumn<Payment>[] = [
    {
      key: "week_start",
      header: "Week Start",
      headerClassName: "w-1/3",
      cellClassName: "overflow-hidden font-medium text-slate-700",
      render: (payment) => (
        <span className="block truncate" title={payment.week_start}>
          {payment.week_start}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      headerClassName: "w-1/3",
      cellClassName:
        "overflow-hidden font-semibold tabular-nums text-green-700",
      render: (payment) => (
        <span className="block truncate">
          {formatCurrency(Number(payment.amount || 0))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "w-1/3",
      render: (payment) => (
        <button
          type="button"
          onClick={() => setPaymentToDelete(payment)}
          disabled={deletingId !== null}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      ),
    },
  ];

  const loanPaymentColumns: DataTableColumn<LoanPayment>[] = [
    {
      key: "borrower",
      header: "Borrower",
      headerClassName: "w-1/3",
      cellClassName: "font-medium text-slate-700",
      render: (payment) => payment.borrower || "—",
    },
    {
      key: "amount",
      header: "Amount",
      headerClassName: "w-1/3",
      cellClassName: "whitespace-nowrap font-semibold text-purple-700",
      render: (payment) => formatCurrency(Number(payment.amount || 0)),
    },
    {
      key: "paid_at",
      header: "Date Paid",
      headerClassName: "w-1/3",
      cellClassName: "whitespace-nowrap text-slate-600",
      render: (payment) =>
        payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—",
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
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Payments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate weekly sinking fund collections and manage payment records.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">
            Total Sinking Fund Payments
          </p>

          <motion.p
            key={`${loading}-${total}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-green-700"
          >
            {loading ? "—" : formatCurrency(total)}
          </motion.p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">
            Weekly Payment Records
          </p>

          <motion.p
            key={`${loading}-${payments.length}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-2 text-2xl font-bold tabular-nums text-blue-700"
          >
            {loading ? "—" : payments.length.toLocaleString("en-PH")}
          </motion.p>
        </div>
      </div>

      {/* Generate Weekly Payment Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsGenerateModalOpen(true)}
          disabled={loading || generating}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          Generate Weekly Payment
        </button>
      </div>

      {/* Generate Weekly Payment Modal */}
      <AnimatePresence>
        {isGenerateModalOpen && (
          <motion.div
            key="generate-payment-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !generating) {
                setIsGenerateModalOpen(false);
                setSelectedDate(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="generate-payment-title"
              className="my-auto w-full max-w-2xl overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between rounded-t-2xl border-b border-slate-100 px-6 py-5">
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
                      id="generate-payment-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Generate Weekly Payment
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a collection Sunday and review the amount before
                      generating the payment record.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setSelectedDate(null);
                  }}
                  disabled={generating}
                  aria-label="Close dialog"
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {/* Modal content */}
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label
                    htmlFor="collectionDate"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Collection Date <span className="text-red-500">*</span>
                  </label>

                  <DatePicker
                    id="collectionDate"
                    selected={selectedDate}
                    onChange={(date: Date | null) => setSelectedDate(date)}
                    dateFormat="MMMM d, yyyy"
                    placeholderText="Select a collection Sunday"
                    isClearable
                    filterDate={(date) => date.getDay() === 0}
                    popperClassName="!z-[9999]"
                    disabled={generating}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                    wrapperClassName="w-full"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Only Sundays can be selected. The payment will be assigned
                    to the Sunday of the selected week.
                  </p>
                </div>

                {/* Collection calculation */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <h3 className="text-sm font-semibold text-blue-900">
                    Collection Summary
                  </h3>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-blue-800">
                      Total member heads
                    </span>
                    <span className="font-semibold tabular-nums text-blue-900">
                      {members
                        .reduce(
                          (sum, member) => sum + Number(member.heads || 0),
                          0,
                        )
                        .toLocaleString("en-PH")}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-blue-800">Rate per head</span>
                    <span className="font-semibold text-blue-900">
                      {formatCurrency(RATE)}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-blue-200 pt-3">
                    <p className="text-xs text-blue-700">
                      Total weekly collection
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-blue-900">
                      {formatCurrency(
                        members.reduce(
                          (sum, member) => sum + Number(member.heads || 0),
                          0,
                        ) * RATE,
                      )}
                    </p>
                  </div>
                </div>

                {selectedDate && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Payment will be recorded for
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      Sunday, {toDateString(getSunday(selectedDate))}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setSelectedDate(null);
                  }}
                  disabled={generating}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void generateWeeklyPayment()}
                  disabled={!selectedDate || generating || loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    "Generate Payment"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Payment Confirmation Modal */}
      <AnimatePresence>
        {paymentToDelete && (
          <motion.div
            key="delete-payment-confirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && deletingId === null) {
                setPaymentToDelete(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-payment-title"
              aria-describedby="delete-payment-description"
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
                      id="delete-payment-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      Delete Weekly Payment?
                    </h2>

                    <p
                      id="delete-payment-description"
                      className="mt-2 text-sm leading-6 text-slate-500"
                    >
                      This weekly payment will be permanently removed from your
                      records. This action cannot be undone.
                    </p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Week starting {paymentToDelete.week_start}
                      </p>

                      <p className="mt-1 text-sm font-medium text-red-600">
                        {formatCurrency(Number(paymentToDelete.amount || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPaymentToDelete(null)}
                  disabled={deletingId !== null}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void deletePayment(paymentToDelete.id)}
                  disabled={deletingId !== null}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === paymentToDelete.id ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Payment"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Weekly payments table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Weekly Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review, edit, or delete generated payment records.
          </p>
        </div>

        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <div className="h-105 overflow-y-auto overflow-x-auto">
            <DataTable
              data={payments}
              columns={weeklyPaymentColumns}
              getRowKey={(payment) => payment.id}
              tableClassName={tableClass}
              thClassName={thClass}
              tdClassName={tdClass}
              tbodyClassName="divide-y divide-slate-100"
              loading={loading}
              loadingMessage="Loading payments..."
              loadingRow={
                <TableLoading
                  message="Loading payments..."
                  colSpan={weeklyPaymentColumns.length}
                />
              }
              emptyMessage="No weekly payments yet."
              emptyContent={
                <div className="flex min-h-105 items-center justify-center text-slate-400">
                  No weekly payments yet.
                </div>
              }
            />
          </div>
        </div>

        {!loading && payments.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {payments.length} payment record
              {payments.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </section>

      {/* Loan payments table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Loan Payments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded loan repayments.
          </p>
        </div>
        <div className="h-105 overflow-y-scroll overflow-x-auto">
          <div className="h-105 overflow-y-auto overflow-x-auto">
            <DataTable
              data={loanPayments}
              columns={loanPaymentColumns}
              getRowKey={(payment) =>
                `${payment.paid_at}-${payment.borrower}-${payment.amount}`
              }
              tableClassName="relative w-full min-w-175 table-fixed border-collapse text-left text-sm"
              thClassName={thClass}
              tdClassName={tdClass}
              tbodyClassName={tbodyClass}
              loading={loading}
              loadingMessage="Loading loan payments..."
              loadingRow={
                <TableLoading
                  message="Loading loan payments..."
                  colSpan={loanPaymentColumns.length}
                />
              }
              emptyMessage="No loan payments yet."
              emptyContent={
                <div className="flex min-h-105 items-center justify-center text-slate-400">
                  No loan payments yet.
                </div>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
