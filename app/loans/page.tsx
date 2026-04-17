"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Loan = {
  id: number;
  borrower_id: number;
  borrower?: { name: string };
  amount: number;
  interest: number;
  total: number;
  monthly: number;
  status: string;
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(0);

  const INTEREST_RATE = 0.1;

  useEffect(() => {
    fetchLoans();
    fetchMembers();
  }, []);

  // ✅ Fetch Members
  const fetchMembers = async () => {
    const { data, error } = await supabase.from("members").select("*");

    if (error) return alert(error.message);

    const sorted = (data || []).sort((a, b) => a.id - b.id);
    setMembers(sorted);
  };

  // ✅ Fetch Loans with relation
  const fetchLoans = async () => {
    const { data, error } = await supabase
      .from("loans")
      .select("*, borrower:borrower_id(name)")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      alert("Error fetching loans");
      return;
    }

    setLoans(data || []);
  };

  // ✅ Add Loan (FIXED + SAFE)
  const addLoan = async () => {
    if (!borrowerId) return alert("Select a member");
    if (!amount || amount <= 0) return alert("Invalid amount");

    // 🔥 VALIDATE MEMBER EXISTS
    const memberExists = members.find((m) => m.id === borrowerId);
    if (!memberExists) return alert("Invalid member selected");

    const interest = amount * INTEREST_RATE;
    const total = amount + interest;
    const monthly = parseFloat((total / 2).toFixed(2));

    const { error } = await supabase.from("loans").insert([
      {
        borrower_id: memberExists.id, // ✅ GUARANTEED correct ID
        amount,
        interest,
        total,
        monthly,
        status: "Ongoing",
      },
    ]);

    if (error) return alert(error.message);

    setBorrowerId(null);
    setAmount(0);
    fetchLoans();
  };

  // ✅ Mark as Paid (SAFER)
  const markPaid = async (id: number) => {
    const confirmAction = confirm("Mark this loan as paid?");
    if (!confirmAction) return;

    const { error } = await supabase
      .from("loans")
      .update({ status: "Paid" })
      .eq("id", id);

    if (error) return alert(error.message);

    fetchLoans();
  };

  // ✅ Delete Loan
  const deleteLoan = async (id: number) => {
    const confirmAction = confirm("Delete this loan?");
    if (!confirmAction) return;

    const { error } = await supabase.from("loans").delete().eq("id", id);

    if (error) return alert(error.message);

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
        <div className="bg-white rounded-xl shadow p-5 mb-6 hover:shadow-lg transition">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Member Dropdown */}
            <select
              value={borrowerId || ""}
              onChange={(e) => setBorrowerId(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (ID: {m.id})
                </option>
              ))}
            </select>

            <input
              type="number"
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Loan amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={addLoan}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Add Loan
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Interest: 10% • Repayment: 2 months
          </p>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left">Borrower</th>
                  <th className="p-4 text-left">Loan</th>
                  <th className="p-4 text-left">Interest</th>
                  <th className="p-4 text-left">Total</th>
                  <th className="p-4 text-left">Monthly</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Actions</th>
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
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">
                        {l.borrower?.name || "N/A"}
                      </td>
                      <td className="p-4">₱{l.amount.toLocaleString()}</td>
                      <td className="p-4">₱{l.interest.toLocaleString()}</td>
                      <td className="p-4">₱{l.total.toLocaleString()}</td>
                      <td className="p-4">₱{l.monthly.toLocaleString()}</td>

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
