"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type LoanAudit = {
  id: number;
  borrower: string;
  loan: number;
  interest: number;
  total: number;
  monthly: number;
  status: string;
  remarks: string;
};

type PaymentAudit = {
  id: number;
  week: string;
  amount: number;
  remarks: string;
};

export default function AuditPage() {
  const [loanAudits, setLoanAudits] = useState<LoanAudit[]>([]);
  const [paymentAudits, setPaymentAudits] = useState<PaymentAudit[]>([]);
  const [loading, setLoading] = useState(true);

  // Loan editing
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editLoanStatus, setEditLoanStatus] = useState("");
  const [editLoanRemarks, setEditLoanRemarks] = useState("");

  // Payment editing
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentRemarks, setEditPaymentRemarks] = useState("");

  useEffect(() => {
    load();
  }, []);

  // =========================================
  // LOAD AUDIT RECORDS
  // =========================================

  const load = async () => {
    setLoading(true);

    const [loans, payments] = await Promise.all([
      supabase.from("audit").select("*").order("id", { ascending: false }),

      supabase
        .from("payment_audit")
        .select("*")
        .order("id", { ascending: false }),
    ]);

    if (loans.error) {
      console.error("Error loading loan audit records:", loans.error);
    }

    if (payments.error) {
      console.error("Error loading payment audit records:", payments.error);
    }

    setLoanAudits(loans.data || []);
    setPaymentAudits(payments.data || []);

    setLoading(false);
  };

  // =========================================
  // LOAN AUDIT
  // =========================================

  const startLoanEdit = (audit: LoanAudit) => {
    setEditingLoanId(audit.id);
    setEditLoanStatus(audit.status);
    setEditLoanRemarks(audit.remarks || "");
  };

  const saveLoanEdit = async (id: number) => {
    const { error } = await supabase
      .from("audit")
      .update({
        status: editLoanStatus,
        remarks: editLoanRemarks,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update loan audit record");
      return;
    }

    setEditingLoanId(null);
    load();
  };

  const deleteLoanAudit = async (id: number) => {
    if (!confirm("Delete this loan audit record?")) return;

    const { error } = await supabase.from("audit").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to delete loan audit record");
      return;
    }

    load();
  };

  // =========================================
  // PAYMENT AUDIT
  // =========================================

  const startPaymentEdit = (payment: PaymentAudit) => {
    setEditingPaymentId(payment.id);
    setEditPaymentAmount(payment.amount);
    setEditPaymentRemarks(payment.remarks || "");
  };

  const savePaymentEdit = async (id: number) => {
    if (editPaymentAmount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    const { error } = await supabase
      .from("payment_audit")
      .update({
        amount: editPaymentAmount,
        remarks: editPaymentRemarks,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update payment audit record");
      return;
    }

    setEditingPaymentId(null);
    load();
  };

  const deletePaymentAudit = async (id: number) => {
    if (!confirm("Delete this payment audit record?")) return;

    const { error } = await supabase
      .from("payment_audit")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to delete payment audit record");
      return;
    }

    load();
  };

  // =========================================
  // TOTALS
  // =========================================

  const totalLoans = loanAudits.reduce(
    (sum, audit) => sum + Number(audit.loan || 0),
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

  // =========================================
  // STATUS STYLE
  // =========================================

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-700";

      case "active":
        return "bg-blue-100 text-blue-700";

      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "overdue":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        {/* =========================================
            PAGE HEADER
        ========================================= */}

        <h1 className="text-3xl font-bold text-gray-800 mb-1">Audit</h1>

        <p className="text-sm text-gray-500 mb-6">
          Review and manage loan and payment audit records
        </p>

        {/* =========================================
            SUMMARY CARDS
        ========================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-xs p-5 hover:shadow-md transition-transform transform hover:-translate-y-1">
            <p className="text-sm text-gray-500">Total Loans</p>

            <p className="text-2xl font-bold text-blue-600 mt-1">
              ₱{totalLoans.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-xs p-5 hover:shadow-md transition-transform transform hover:-translate-y-1">
            <p className="text-sm text-gray-500">Total Interest</p>

            <p className="text-2xl font-bold text-purple-600 mt-1">
              ₱{totalInterest.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-xs p-5 hover:shadow-md transition-transform transform hover:-translate-y-1">
            <p className="text-sm text-gray-500">Loan Total</p>

            <p className="text-2xl font-bold text-green-600 mt-1">
              ₱{totalLoanAmount.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-xs p-5 hover:shadow-md transition-transform transform hover:-translate-y-1">
            <p className="text-sm text-gray-500">Payments</p>

            <p className="text-2xl font-bold text-orange-600 mt-1">
              ₱{totalPayments.toLocaleString()}
            </p>
          </div>
        </div>

        {/* =========================================
            LOANS AUDIT LOG
        ========================================= */}

        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Loans Audit Log
        </h2>

        <div className="w-full overflow-hidden rounded-lg shadow-xs bg-white mb-8">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Borrower</th>

                  <th className="px-4 py-3">Loan</th>

                  <th className="px-4 py-3">Interest</th>

                  <th className="px-4 py-3">Total</th>

                  <th className="px-4 py-3">Monthly</th>

                  <th className="px-4 py-3">Status</th>

                  <th className="px-4 py-3">Action</th>

                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8">
                      <div className="flex justify-center items-center">
                        <div className="w-6 h-6 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : loanAudits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">
                      No loan audit records yet
                    </td>
                  </tr>
                ) : (
                  loanAudits.map((audit) => (
                    <tr
                      key={audit.id}
                      className="text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-3 font-medium">
                        {audit.borrower}
                      </td>

                      <td className="px-4 py-3 font-semibold text-blue-600">
                        ₱{Number(audit.loan).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 font-semibold text-purple-600">
                        ₱{Number(audit.interest).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 font-semibold text-green-700">
                        ₱{Number(audit.total).toLocaleString()}
                      </td>

                      <td className="px-4 py-3">
                        ₱{Number(audit.monthly).toLocaleString()}
                      </td>

                      <td className="px-4 py-3">
                        {editingLoanId === audit.id ? (
                          <select
                            value={editLoanStatus}
                            onChange={(e) => setEditLoanStatus(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none"
                          >
                            <option value="Pending">Pending</option>

                            <option value="Active">Active</option>

                            <option value="Paid">Paid</option>

                            <option value="Overdue">Overdue</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                              audit.status,
                            )}`}
                          >
                            {audit.status}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {editingLoanId === audit.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveLoanEdit(audit.id)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Save
                            </button>

                            <button
                              onClick={() => setEditingLoanId(null)}
                              className="text-gray-500 hover:underline text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startLoanEdit(audit)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteLoanAudit(audit.id)}
                              className="text-red-500 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 min-w-[180px]">
                        {editingLoanId === audit.id ? (
                          <input
                            type="text"
                            value={editLoanRemarks}
                            onChange={(e) => setEditLoanRemarks(e.target.value)}
                            placeholder="Enter remarks"
                            className="w-full min-w-[160px] px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                          />
                        ) : (
                          <span className="text-gray-500">
                            {audit.remarks || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================
            PAYMENT AUDIT LOG
        ========================================= */}

        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Payment Audit Log
        </h2>

        <div className="w-full overflow-hidden rounded-lg shadow-xs bg-white">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Week</th>

                  <th className="px-4 py-3">Amount</th>

                  <th className="px-4 py-3">Action</th>

                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8">
                      <div className="flex justify-center items-center">
                        <div className="w-6 h-6 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : paymentAudits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      No payment audit records yet
                    </td>
                  </tr>
                ) : (
                  paymentAudits.map((payment) => (
                    <tr
                      key={payment.id}
                      className="text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-3 font-medium">{payment.week}</td>

                      <td className="px-4 py-3 font-semibold text-green-700">
                        {editingPaymentId === payment.id ? (
                          <input
                            type="number"
                            min={0}
                            value={editPaymentAmount}
                            onChange={(e) =>
                              setEditPaymentAmount(Number(e.target.value))
                            }
                            className="w-28 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                          />
                        ) : (
                          `₱${Number(payment.amount).toLocaleString()}`
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {editingPaymentId === payment.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => savePaymentEdit(payment.id)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Save
                            </button>

                            <button
                              onClick={() => setEditingPaymentId(null)}
                              className="text-gray-500 hover:underline text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startPaymentEdit(payment)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deletePaymentAudit(payment.id)}
                              className="text-red-500 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 min-w-[180px]">
                        {editingPaymentId === payment.id ? (
                          <input
                            type="text"
                            value={editPaymentRemarks}
                            onChange={(e) =>
                              setEditPaymentRemarks(e.target.value)
                            }
                            placeholder="Enter remarks"
                            className="w-full min-w-[160px] px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                          />
                        ) : (
                          <span className="text-gray-500">
                            {payment.remarks || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
