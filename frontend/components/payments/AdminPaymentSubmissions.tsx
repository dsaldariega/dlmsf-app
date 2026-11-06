"use client";
import {useCallback,useEffect,useState} from "react";
import {apiRequest} from "@/lib/api";
import {formatCurrency} from "@/lib/utils/loans";
import DataTable,{type DataTableColumn} from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import {tableClass,tdClass,thClass} from "@/components/ui/table-styles";
type Row={id:number;member?:{name:string}|null;loan?:{id:number}|null;payment_type:string;amount:number|string;paid_on:string;week_start?:string|null;reference?:string|null;status:string};
export default function AdminPaymentSubmissions(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState(""),[remarks,setRemarks]=useState<Record<number,string>>({});
 const load=useCallback(async()=>{setLoading(true);try{setRows(await apiRequest<Row[]>("/api/payments/submissions"));}catch(e){setError(e instanceof Error?e.message:"Unable to load payment submissions.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function review(id:number,decision:"Confirmed"|"Rejected"){setBusy(id);setError("");try{await apiRequest("/api/payments/submissions/"+id,{method:"PATCH",body:JSON.stringify({decision,remarks:remarks[id]||""})});await load();}catch(e){setError(e instanceof Error?e.message:"Unable to review payment.");}finally{setBusy(null);}}
 const columns:DataTableColumn<Row>[]=[
 {key:"member",header:"Member",render:x=>x.member?.name||"—"},
 {key:"type",header:"Type",render:x=>x.payment_type},
 {key:"amount",header:"Amount",render:x=>formatCurrency(Number(x.amount))},
 {key:"loan",header:"Loan",render:x=>x.loan?.id?"Loan #"+x.loan.id:"—"},
 {key:"paid",header:"Paid on / week",render:x=>x.payment_type==="Weekly"?(x.week_start||"—"):new Date(x.paid_on+"T00:00:00").toLocaleDateString("en-PH")},
 {key:"reference",header:"Reference",render:x=>x.reference||"—"},
 {key:"status",header:"Status",render:x=><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${x.status==="Confirmed"?"bg-emerald-50 text-emerald-700":x.status==="Rejected"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{x.status}</span>},
 {key:"remarks",header:"Admin remarks",render:x=><input value={remarks[x.id]??""} onChange={e=>setRemarks(v=>({...v,[x.id]:e.target.value}))} disabled={x.status!=="Pending"} placeholder="Optional note" className="h-9 min-w-32 rounded-md border border-slate-300 px-2 text-xs"/>},
 {key:"actions",header:"Review",render:x=><div className="flex gap-2">{x.status==="Pending"?<><button disabled={busy!==null} onClick={()=>void review(x.id,"Confirmed")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy===x.id?"Saving...":"Confirm"}</button><button disabled={busy!==null} onClick={()=>void review(x.id,"Rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button></>:"—"}</div>}
 ];
 return <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Member payment submissions</h2><p className="mt-1 text-sm text-slate-500">Verify receipt before confirming. Confirmed loan repayments are posted to the loan ledger.</p></div>{error&&<p role="alert" className="p-4 text-sm text-red-700">{error}</p>}<div className="overflow-x-auto"><DataTable data={rows} columns={columns} getRowKey={x=>x.id} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading submissions..." colSpan={columns.length}/>} emptyMessage="No member payment submissions."/></div></section>;
}
