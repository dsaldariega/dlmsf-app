"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Member = { id: number; heads: number };
type Payment = { id: number; amount: number; week_start: string };
type LoanPayment = {
  id: number;
  borrower: string;
  amount: number;
  paid_at: string;
};

export default function PaymentsPage() {
  const RATE = 50;

  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [m, p, lp] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("loan_payments").select("*"),
    ]);
    setMembers(m.data || []);
    setPayments(p.data || []);
    setLoanPayments(lp.data || []);
  };

  const getSunday = (d: Date) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
  };

  const generateRange = async () => {
    if (!startDate || !endDate) return alert("Select start and end dates");

    const start = getSunday(new Date(startDate));
    const end = new Date(endDate);
    const totalAmount = members.reduce((sum, m) => sum + m.heads, 0) * RATE;

    const weeks: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      weeks.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("week_start")
      .in("week_start", weeks);
    const existingWeeks = existing?.map((w) => w.week_start) || [];

    const rows = weeks
      .filter((w) => !existingWeeks.includes(w))
      .map((w) => ({ amount: totalAmount, week_start: w }));

    if (rows.length === 0)
      return alert("All selected weeks already have payments");

    await supabase.from("payments").insert(rows);
    load();
    alert(`${rows.length} weekly payments generated`);
  };

  const deletePayment = async (id: number) => {
    if (!confirm("Delete this weekly payment?")) return;
    await supabase.from("payments").delete().eq("id", id);
    load();
  };

  const startEdit = (p: Payment) => {
    setEditingId(p.id);
    setEditAmount(p.amount);
  };
  const saveEdit = async (id: number) => {
    if (editAmount <= 0) return alert("Amount must be > 0");
    await supabase.from("payments").update({ amount: editAmount }).eq("id", id);
    setEditingId(null);
    load();
  };

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Weekly Payments
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Generate weekly total collection
        </p>

        {/* Date Range Card */}
        <div className="bg-white rounded-lg shadow-xs p-5 mb-6 flex flex-col sm:flex-row gap-3 items-center hover:shadow-md transition-transform transform hover:-translate-y-1">
          <input
            type="date"
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none transition"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none transition"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button
            onClick={generateRange}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Generate Weekly Payments
          </button>
          <div className="text-sm text-gray-500 mt-2 sm:mt-0">
            Total:{" "}
            <span className="font-semibold text-green-600">₱{total}</span>
          </div>
        </div>

        {/* Weekly Payments Table */}
        <div className="w-full overflow-hidden rounded-lg shadow-xs bg-white mb-8">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      No weekly payments yet
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="text-gray-700 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.week_start}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">
                        {editingId === p.id ? (
                          <input
                            type="number"
                            value={editAmount}
                            min={0}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            onChange={(e) =>
                              setEditAmount(Number(e.target.value))
                            }
                          />
                        ) : (
                          `₱${p.amount}`
                        )}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        {editingId === p.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:underline text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(p)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePayment(p.id)}
                              className="text-red-500 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loan Payments Table */}
        <div className="text-xl font-bold mb-4">Loan Payments</div>
        <div className="w-full overflow-hidden rounded-lg shadow-xs bg-white">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b bg-gray-50">
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid At</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {loanPayments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      No loan payments yet
                    </td>
                  </tr>
                ) : (
                  loanPayments.map((lp) => (
                    <tr
                      key={lp.id}
                      className="text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-3 font-medium">{lp.borrower}</td>
                      <td className="px-4 py-3 font-semibold text-purple-600">
                        ₱{lp.amount}
                      </td>
                      <td className="px-4 py-3">{lp.paid_at}</td>
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
