"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

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

  // Helper: get Sunday of a given date
  const getSunday = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay(); // 0=Sunday, 6=Saturday
    copy.setDate(copy.getDate() - day);
    return copy;
  };

  // Generate weekly payments for date range
  const generateRange = async () => {
    if (!startDate || !endDate) return alert("Select start and end dates");

    const start = getSunday(new Date(startDate));
    const end = new Date(endDate);
    const totalAmount = members.reduce((sum, m) => sum + m.heads, 0) * RATE;

    const weeks: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      weeks.push(current.toISOString().split("T")[0]); // yyyy-mm-dd
      current.setDate(current.getDate() + 7);
    }

    // Check existing weeks to avoid duplicates
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

  // Edit & Delete same as before
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
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Weekly Payments
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Generate weekly total collection
        </p>

        {/* Date Range Inputs */}
        <div className="bg-white rounded-xl shadow p-5 mb-6 flex flex-col sm:flex-row gap-3 items-center hover:shadow-lg transition-transform transform hover:-translate-y-1">
          <input
            type="date"
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-green-500 transition"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-green-500 transition"
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

        {/* WEEKLY PAYMENTS TABLE */}
        <div className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left border-b border-gray-200">
                    Week
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Amount
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      No weekly payments yet
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="p-4 font-medium text-gray-800">
                        {p.week_start}
                      </td>
                      <td className="p-4 font-semibold text-green-600">
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
                      <td className="p-4 flex gap-2">
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

        {/* LOAN PAYMENTS TABLE */}
        <div className="text-xl font-bold mb-4">Loan Payments</div>
        <div className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left border-b border-gray-200">
                    Borrower
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Amount
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Paid At
                  </th>
                </tr>
              </thead>
              <tbody>
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
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="p-4 font-medium text-gray-800">
                        {lp.borrower}
                      </td>
                      <td className="p-4 font-semibold text-purple-600">
                        ₱{lp.amount}
                      </td>
                      <td className="p-4">{lp.paid_at}</td>
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
