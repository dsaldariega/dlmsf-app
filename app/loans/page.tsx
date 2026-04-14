"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Loan = {
  id: number;
  borrower: string;
  amount: number;
  interest: number;
  total: number;
  monthly: number;
  status: string;
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(0);

  const INTEREST_RATE = 0.1;

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("id", { ascending: false });
    if (error) return alert(error.message);
    setLoans(data || []);
  };

  const addLoan = async () => {
    if (!name.trim()) return alert("Missing borrower name");
    if (!amount || amount <= 0) return alert("Invalid amount");

    const interest = amount * INTEREST_RATE;
    const total = amount + interest;
    const monthly = total / 2;

    const { error } = await supabase.from("loans").insert([
      {
        borrower: name,
        amount,
        interest,
        total,
        monthly,
        status: "Ongoing",
      },
    ]);

    if (error) return alert(error.message);
    setName("");
    setAmount(0);
    fetchLoans();
  };

  const markPaid = async (id: number) => {
    await supabase.from("loans").update({ status: "Paid" }).eq("id", id);
    fetchLoans();
  };

  const deleteLoan = async (id: number) => {
    await supabase.from("loans").delete().eq("id", id);
    fetchLoans();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Loans</h1>
        <p className="text-sm text-gray-500 mb-6">
          Manage borrower loans and repayment status
        </p>

        {/* FORM */}
        <div className="bg-white rounded-xl shadow p-5 mb-6 hover:shadow-lg transition-transform transform hover:-translate-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Borrower name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 transition"
            />

            <input
              type="number"
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Loan amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 transition"
            />

            <button
              onClick={addLoan}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Add Loan
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Interest rate: 10% • Repayment: 2 months (auto split)
          </p>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat title="Total Loans" value={loans.length} />
          <Stat
            title="Ongoing"
            value={loans.filter((l) => l.status !== "Paid").length}
          />
          <Stat
            title="Paid"
            value={loans.filter((l) => l.status === "Paid").length}
          />
          <Stat
            title="Active Amount"
            value={
              "₱" +
              loans
                .filter((l) => l.status !== "Paid")
                .reduce((s, l) => s + l.total, 0)
            }
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left border-b border-gray-200">
                    Borrower
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Loan
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Interest
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Total
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Monthly
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Status
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-400">
                      No loans yet
                    </td>
                  </tr>
                ) : (
                  loans.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="p-4 font-medium text-gray-800">
                        {l.borrower}
                      </td>
                      <td className="p-4">₱{l.amount}</td>
                      <td className="p-4">₱{l.interest}</td>
                      <td className="p-4">₱{l.total}</td>
                      <td className="p-4">₱{l.monthly}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            l.status === "Paid"
                              ? "bg-green-100 text-green-600"
                              : "bg-yellow-100 text-yellow-600"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="p-4 flex gap-3">
                        {l.status !== "Paid" && (
                          <button
                            onClick={() => markPaid(l.id)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => deleteLoan(l.id)}
                          className="text-red-500 hover:underline text-sm"
                        >
                          Delete
                        </button>
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

// SMALL CARD COMPONENT
function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border border-gray-100 hover:shadow-lg transition">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
