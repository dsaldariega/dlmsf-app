"use client";
import {useCallback,useEffect,useState} from "react";
import {apiRequest} from "@/lib/api";
import {formatCurrency} from "@/lib/utils/loans";
import DataTable,{type DataTableColumn} from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import {tableClass,tdClass,thClass} from "@/components/ui/table-styles";
type Row={id:number;member?:{name:string}|null;amount:number|string;months:number;status:string;requested_at:string};
export default function AdminLoanRequests(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState(""),[remarks,setRemarks]=useState<Record<number,string>>({});
 const load=useCallback(async()=>{setLoading(true);try{setRows(await apiRequest<Row[]>("/api/loans/requests"));}catch(e){setError(e instanceof Error?e.message:"Unable to load loan requests.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function review(id:number,decision:"Approved"|"Rejected"){setBusy(id);setError("");try{await apiRequest("/api/loans/requests/"+id,{method:"PATCH",body:JSON.stringify({decision,remarks:remarks[id]||""})});await load();}catch(e){setError(e instanceof Error?e.message:"Unable to review request.");}finally{setBusy(null);}}
 const columns:DataTableColumn<Row>[]=[
 {key:"member",header:"Member",render:x=>x.member?.name||"—"},
 {key:"amount",header:"Requested amount",render:x=>formatCurrency(Number(x.amount))},
 {key:"terms",header:"Terms",render:x=>x.months+" months"},
 {key:"date",header:"Date requested",render:x=>new Date(x.requested_at).toLocaleDateString("en-PH")},
 {key:"status",header:"Status",render:x=><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${x.status==="Approved"?"bg-emerald-50 text-emerald-700":x.status==="Rejected"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{x.status}</span>},
 {key:"remarks",header:"Admin remarks",render:x=><input value={remarks[x.id]??""} onChange={e=>setRemarks(v=>({...v,[x.id]:e.target.value}))} disabled={x.status!=="Pending"} placeholder="Optional note" className="h-9 min-w-36 rounded-md border border-slate-300 px-2 text-xs"/>},
 {key:"actions",header:"Review",render:x=><div className="flex gap-2">{x.status==="Pending"?<><button disabled={busy!==null} onClick={()=>void review(x.id,"Approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy===x.id?"Saving...":"Approve"}</button><button disabled={busy!==null} onClick={()=>void review(x.id,"Rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button></>:"—"}</div>}
 ];
 return <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Member loan requests</h2><p className="mt-1 text-sm text-slate-500">Approval creates the loan record and rechecks available sinking fund balance.</p></div>{error&&<p role="alert" className="p-4 text-sm text-red-700">{error}</p>}<div className="overflow-x-auto"><DataTable data={rows} columns={columns} getRowKey={x=>x.id} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading requests..."/>} emptyMessage="No member loan requests."/></div></section>;
}
