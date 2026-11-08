"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { Activity, ShieldCheck } from "lucide-react";
import type { DataTableColumn, LoanAudit, PaymentAudit } from "@/lib/types";

export default function MemberAudit() {
  const [loans, setLoans] = useState<LoanAudit[]>([]);
  const [payments, setPayments] = useState<PaymentAudit[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please sign in again.");
        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("name")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (memberError) throw memberError;
        if (!member) throw new Error("Your member profile could not be found.");
        const data = await apiRequest<{
          loans: LoanAudit[];
          payments: PaymentAudit[];
        }>("/api/audit");
        if (active) {
          setName(member.name || "");
          setLoans(data.loans.filter((x) => x.borrower_name === member.name));
          setPayments(data.payments);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load audit history.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const loanColumns: DataTableColumn<LoanAudit>[] = [
    {
      key: "date",
      header: "Date",
      render: (x) =>
        x.created_date
          ? new Date(x.created_date).toLocaleDateString("en-PH")
          : "—",
    },
    {
      key: "action",
      header: "Activity",
      render: (x) => x.action || "Loan update",
    },
    {
      key: "principal",
      header: "Principal",
      render: (x) => formatCurrency(Number(x.amount || 0)),
    },
    {
      key: "total",
      header: "Total",
      render: (x) => formatCurrency(Number(x.total || 0)),
    },
    { key: "remarks", header: "Remarks", render: (x) => x.remarks || "—" },
  ];
  const paymentColumns: DataTableColumn<PaymentAudit>[] = [
    {
      key: "date",
      header: "Date",
      render: (x) =>
        x.created_date
          ? new Date(x.created_date).toLocaleDateString("en-PH")
          : "—",
    },
    {
      key: "week",
      header: "Collection week",
      render: (x) => x.week_start || "—",
    },
    {
      key: "action",
      header: "Activity",
      render: (x) => x.action || "Payment update",
    },
    {
      key: "amount",
      header: "Amount",
      render: (x) => formatCurrency(Number(x.amount || 0)),
    },
    { key: "remarks", header: "Remarks", render: (x) => x.remarks || "—" },
  ];
  return (
    <div className="space-y-6">
      <div className="dlmsf-page-header">
        <div>
          <h2 className="dlmsf-page-title">Audit History</h2>
          <p className="dlmsf-page-subtitle">
            Read-only financial activity for {name || "your account"}.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="dlmsf-alert dlmsf-alert-danger">
          {error}
        </p>
      )}
      <div className="dlmsf-alert dlmsf-alert-success">
        <ShieldCheck size={20} className="shrink-0" />
        <p>
          Members have read-only access. Editing and deleting audit records
          remain administrator-only actions.
        </p>
      </div>
      <section className="dlmsf-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={19} className="text-blue-600" />
          <h3 className="font-semibold">My loan activity</h3>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Loading records...
          </p>
        ) : (
          <DataTable
            data={loans}
            columns={loanColumns}
            getRowKey={(x) => x.id}
            emptyMessage="No loan audit activity found for your account."
          />
        )}
      </section>
      <section className="dlmsf-card p-5">
        <h3 className="mb-4 font-semibold">Sinking fund collection activity</h3>
        <DataTable
          data={payments}
          columns={paymentColumns}
          getRowKey={(x) => x.id}
          loading={loading}
          loadingRow={
            <TableLoading
              message="Loading payment audit records..."
              colSpan={paymentColumns.length}
            />
          }
          emptyMessage="No payment audit records found."
        />
      </section>
    </div>
  );
}
