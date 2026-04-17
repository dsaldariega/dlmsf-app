"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import LogoutButton from "@/components/LogoutButton";

export default withAuth(function MemberDashboard() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]); // ✅ NEW

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("members")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (!member) return;

      const [{ data: p }, { data: lp }, { data: l }] = await Promise.all([
        supabase.from("payments").select("*").eq("member_id", member.id),
        supabase.from("loan_payments").select("*").eq("member_id", member.id),
        supabase.from("loans").select("*").eq("borrower_id", member.id), // ✅ FETCH LOANS
      ]);

      setPayments(p || []);
      setLoanPayments(lp || []);
      setLoans(l || []);
    };

    loadData();
  }, []);

  const formatCurrency = (val: number) => `₱${val.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      {/* Logout top-right */}
      <div className="flex justify-end mb-6">
        <LogoutButton />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">
        My Dashboard
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow rounded-xl p-4">
          <p className="text-sm text-gray-500 uppercase">
            Sinking Fund Payments
          </p>
          <p className="text-xl font-bold text-green-600">
            ₱{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white shadow rounded-xl p-4">
          <p className="text-sm text-gray-500 uppercase">Loan Payments</p>
          <p className="text-xl font-bold text-blue-600">
            ₱
            {loanPayments
              .reduce((sum, lp) => sum + lp.amount, 0)
              .toLocaleString()}
          </p>
        </div>

        {/* ✅ OPTIONAL: Total Loan Balance */}
        <div className="bg-white shadow rounded-xl p-4">
          <p className="text-sm text-gray-500 uppercase">My Loans</p>
          <p className="text-xl font-bold text-yellow-600">
            ₱{loans.reduce((sum, l) => sum + l.total, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ✅ NEW: Loans Table */}
      <section className="mb-8">
        <h2 className="font-semibold mb-3 text-gray-700 text-lg">My Loans</h2>

        <div className="overflow-x-auto bg-white shadow rounded-xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Amount</th>
                <th className="p-3 text-left text-sm font-medium">Interest</th>
                <th className="p-3 text-left text-sm font-medium">Total</th>
                <th className="p-3 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-400">
                    No loans yet
                  </td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id}>
                    <td className="p-3">{formatCurrency(l.amount)}</td>
                    <td className="p-3">{formatCurrency(l.interest)}</td>
                    <td className="p-3">{formatCurrency(l.total)}</td>
                    <td className="p-3">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sinking Fund Table */}
      <section className="mb-8">
        <h2 className="font-semibold mb-3 text-gray-700 text-lg">
          Sinking Fund Contributions
        </h2>

        <div className="overflow-x-auto bg-white shadow rounded-xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left text-sm font-medium">
                  Week Start
                </th>
                <th className="p-3 text-left text-sm font-medium text-green-600">
                  Amount Paid
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-3 text-center text-gray-400">
                    No contributions yet
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">
                      {new Date(p.week_start).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-semibold text-green-600">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Loan Payments Table */}
      <section>
        <h2 className="font-semibold mb-3 text-gray-700 text-lg">
          Loan Payments
        </h2>

        <div className="overflow-x-auto bg-white shadow rounded-xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Loan ID</th>
                <th className="p-3 text-left text-sm font-medium text-blue-600">
                  Amount Paid
                </th>
                <th className="p-3 text-left text-sm font-medium">Date Paid</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loanPayments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-gray-400">
                    No loan payments yet
                  </td>
                </tr>
              ) : (
                loanPayments.map((lp) => (
                  <tr key={lp.id}>
                    <td className="p-3">{lp.loan_id}</td>
                    <td className="p-3 font-semibold text-blue-600">
                      {formatCurrency(lp.amount)}
                    </td>
                    <td className="p-3">
                      {new Date(lp.paid_at).toLocaleDateString()}
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
}, "member");
