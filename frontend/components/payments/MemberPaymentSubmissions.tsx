"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {X,Plus,Receipt} from "lucide-react";
import {apiRequest} from "@/lib/api";
import {supabase} from "@/lib/supabase";
import {formatCurrency} from "@/lib/utils/loans";
import DataTable,{type DataTableColumn} from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import {tableClass,tdClass,thClass} from "@/components/ui/table-styles";
type Loan={id:number;total:number|string;monthly:number|string;status:string};
type Submission={id:number;payment_type:string;amount:number|string;paid_on:string;week_start?:string|null;loan_id?:number|null;reference?:string|null;status:string;admin_remarks?:string|null};
const inputClass="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const localDate=(d:Date)=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day;};
const sundayOf=(d:Date)=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-x.getDay());return x;};
export default function MemberPaymentSubmissions(){
 const [loans,setLoans]=useState<Loan[]>([]),[rows,setRows]=useState<Submission[]>([]),[type,setType]=useState<"Weekly"|"Loan">("Weekly"),[amount,setAmount]=useState(""),[paidOn,setPaidOn]=useState(localDate(new Date())),[week,setWeek]=useState(localDate(sundayOf(new Date()))),[weeklyMinimum,setWeeklyMinimum]=useState(0),[heads,setHeads]=useState(0),[loanId,setLoanId]=useState(""),[reference,setReference]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[open,setOpen]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const [l,r]=await Promise.all([apiRequest<Loan[]>("/api/loans"),apiRequest<Submission[]>("/api/payments/submissions")]);
   setLoans(l.filter(x=>x.status!=="Paid"));setRows(r);
   const {data:{user}}=await supabase.auth.getUser();
   if(user){
    const {data:profile,error:profileError}=await supabase.from("members").select("id,heads").eq("auth_id",user.id).maybeSingle();
    if(profileError) throw profileError;
    if(profile){
     const due=Number(profile.heads||0)*50;setHeads(Number(profile.heads||0));
     const {data:allocations,error:allocationError}=await supabase.from("weekly_contribution_allocations").select("week_start,amount").eq("member_id",profile.id);
     if(allocationError) throw allocationError;
     let first=sundayOf(new Date()),credit=0;
     for(let i=0;i<520;i++){
      const key=localDate(first);
      credit=(allocations||[]).filter(x=>x.week_start===key).reduce((sum,x)=>sum+Number(x.amount||0),0);
      if(credit<due) break;
      first.setDate(first.getDate()+7);
     }
     setWeek(localDate(first));setWeeklyMinimum(Math.max(due-credit,0));
    }
   }
  }catch(e){setError(e instanceof Error?e.message:"Unable to load payment records.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const selectedLoan=loans.find(x=>String(x.id)===loanId);
 useEffect(()=>{if(type==="Weekly")setAmount(weeklyMinimum>0?weeklyMinimum.toFixed(2):"");else setAmount(selectedLoan?Number(selectedLoan.monthly||0).toFixed(2):"");},[type,weeklyMinimum,selectedLoan]);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   await apiRequest("/api/payments/submissions",{method:"POST",body:JSON.stringify({paymentType:type,amount:Number(amount),paidOn,weekStart:type==="Weekly"?week:null,loanId:type==="Loan"?Number(loanId):null,reference})});
   setReference("");setOpen(false);setNotice("Payment submitted. It will show as confirmed after an administrator reviews it.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to submit payment.");}finally{setBusy(false);}
 }
 const cols:DataTableColumn<Submission>[]=[{key:"type",header:"Payment type",render:x=>x.payment_type==="Weekly"?"Weekly sinking fund":"Loan repayment"},{key:"amount",header:"Amount",render:x=>formatCurrency(Number(x.amount))},{key:"loan",header:"Loan",render:x=>x.loan_id?"Loan #"+x.loan_id:"—"},{key:"date",header:"Paid on",render:x=>x.paid_on?new Date(x.paid_on+"T00:00:00").toLocaleDateString("en-PH"):"—"},{key:"week",header:"Starting week",render:x=>x.week_start||"—"},{key:"reference",header:"Reference",render:x=>x.reference||"—"},{key:"status",header:"Status",render:x=><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${x.status==="Confirmed"?"bg-emerald-50 text-emerald-700":x.status==="Rejected"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{x.status}</span>},{key:"remarks",header:"Admin remarks",render:x=>x.admin_remarks||"—"}];
 const pending=rows.filter(x=>x.status==="Pending").length,approved=rows.filter(x=>x.status==="Confirmed").length;
 return <div className="space-y-6"><header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My Payments</h1><p className="mt-1 text-sm text-slate-500">Submit payment claims and track administrator confirmation.</p></div><button type="button" onClick={()=>setOpen(true)} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"><Plus size={17}/>Submit payment</button></header>{error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
 <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Total submissions</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Confirmed</p><p className="mt-2 text-2xl font-bold text-emerald-700">{approved}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Pending review</p><p className="mt-2 text-2xl font-bold text-amber-700">{pending}</p></article></section>
 <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">My payment submissions</h2><p className="mt-1 text-sm text-slate-500">Payments are recorded only after administrator confirmation.</p></div><div className="overflow-x-auto"><DataTable data={rows} columns={cols} getRowKey={x=>x.id} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading submissions..." colSpan={cols.length}/>} emptyMessage="No payment submissions yet."/></div></section>
 {open&&<div className="animate-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="payment-request-title" className="animate-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><span className="mb-3 inline-flex rounded-lg bg-blue-50 p-2 text-blue-700"><Receipt size={20}/></span><h2 id="payment-request-title" className="text-lg font-semibold text-slate-900">Submit payment</h2><p className="mt-1 text-sm text-slate-500">Choose the payment type and provide the details.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close modal" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button></div><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Payment type<select value={type} onChange={e=>setType(e.target.value as "Weekly"|"Loan")} className={inputClass}><option value="Weekly">Weekly sinking fund</option><option value="Loan">Loan repayment</option></select></label><label className="text-sm font-medium text-slate-700">Amount (₱)<input required type="number" min={type==="Weekly"?weeklyMinimum:0.01} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={inputClass}/>{type==="Weekly"?<span className="mt-1 block text-xs font-normal text-slate-500">Minimum due: {formatCurrency(weeklyMinimum)} · {heads} heads × ₱50. Extra payment carries forward to future weeks.</span>:<span className="mt-1 block text-xs font-normal text-slate-500">Monthly due: {selectedLoan?formatCurrency(Number(selectedLoan.monthly)): "Select a loan"} · You may pay more to settle early.</span>}</label><label className="text-sm font-medium text-slate-700">Date paid<input required type="date" value={paidOn} onChange={e=>setPaidOn(e.target.value)} className={inputClass}/></label>{type==="Weekly"?<div className="text-sm font-medium text-slate-700">Credit starts on<div className={inputClass+" flex items-center"}>{new Date(week+"T00:00:00").toLocaleDateString("en-PH",{dateStyle:"long"})}</div><span className="mt-1 block text-xs font-normal text-slate-500">Already covered weeks are skipped automatically.</span></div>:<label className="text-sm font-medium text-slate-700">Loan<select required value={loanId} onChange={e=>setLoanId(e.target.value)} className={inputClass}><option value="">Select loan</option>{loans.map(x=><option key={x.id} value={x.id}>Loan #{x.id} · Monthly {formatCurrency(Number(x.monthly))}</option>)}</select></label>}<label className="text-sm font-medium text-slate-700 sm:col-span-2">Reference / note (optional)<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={160} className={inputClass}/></label><p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800 sm:col-span-2">{type==="Weekly"?"Your payment is allocated across consecutive weeks. Any leftover amount becomes credit toward the next week.":"This submission is not treated as received until an administrator confirms it."} This submission is not treated as received until an administrator confirms it.</p><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={busy||!amount||Number(amount)<=0||(type==="Loan"&&!loanId)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy?"Submitting...":"Submit for confirmation"}</button></div></form></section></div>}
 </div>;
}
