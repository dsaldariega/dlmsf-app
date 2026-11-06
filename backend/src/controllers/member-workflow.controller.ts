import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";

function client(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function validId(value: string | string[]) {
  const id = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid record ID."), { status: 400 });
  return id;
}
export async function listLoanRequests(req: Request,res: Response,next: NextFunction) {
  try {
    let q=client(req).from("loan_requests").select("*, member:members!loan_requests_member_id_fkey(name)").order("requested_at",{ascending:false});
    if(req.user?.role==="member") {
      const {data:m,error}=await client(req).from("members").select("id").eq("auth_id",req.user.id).maybeSingle();
      if(error) throw error; if(!m) throw Object.assign(new Error("Member profile not found."),{status:404});
      q=q.eq("member_id",m.id);
    }
    const {data,error}=await q; if(error) throw error;
    res.json({success:true,data:data??[]});
  } catch(e) { next(e); }
}
export async function submitLoanRequest(req: Request,res: Response,next: NextFunction) {
  try {
    const amount=Number(req.body?.amount), months=Number(req.body?.months);
    if(!Number.isFinite(amount)||!Number.isInteger(months)) throw Object.assign(new Error("Enter a valid amount and duration."),{status:400});
    const {data,error}=await client(req).rpc("submit_loan_request",{p_amount:amount,p_months:months});
    if(error) throw error; res.status(201).json({success:true,data,message:"Loan request submitted."});
  } catch(e) { next(e); }
}
export async function reviewLoanRequest(req: Request,res: Response,next: NextFunction) {
  try {
    const decision=req.body?.decision;
    if(!["Approved","Rejected"].includes(decision)) throw Object.assign(new Error("Choose Approved or Rejected."),{status:400});
    const {data,error}=await client(req).rpc("review_loan_request",{p_request_id:validId(req.params.id),p_decision:decision,p_remarks:typeof req.body?.remarks==="string"?req.body.remarks:null});
    if(error) throw error; res.json({success:true,data,message:"Loan request "+decision.toLowerCase()+"."});
  } catch(e) { next(e); }
}
export async function listPaymentSubmissions(req: Request,res: Response,next: NextFunction) {
  try {
    let q=client(req).from("payment_submissions").select("*, member:members!payment_submissions_member_id_fkey(name), loan:loans(id,total,monthly,months,status)").order("submitted_at",{ascending:false});
    if(req.user?.role==="member") {
      const {data:m,error}=await client(req).from("members").select("id").eq("auth_id",req.user.id).maybeSingle();
      if(error) throw error; if(!m) throw Object.assign(new Error("Member profile not found."),{status:404});
      q=q.eq("member_id",m.id);
    }
    const {data,error}=await q; if(error) throw error;
    res.json({success:true,data:data??[]});
  } catch(e) { next(e); }
}
export async function submitPayment(req: Request,res: Response,next: NextFunction) {
  try {
    const {paymentType,amount,paidOn,weekStart,loanId,reference}=req.body??{};
    if(!["Weekly","Loan"].includes(paymentType)||!Number.isFinite(Number(amount))) throw Object.assign(new Error("Enter a valid payment type and amount."),{status:400});
    const {data,error}=await client(req).rpc("submit_payment",{
      p_type:paymentType,p_amount:Number(amount),p_paid_on:paidOn||null,p_week_start:weekStart||null,
      p_loan_id:loanId?Number(loanId):null,p_reference:typeof reference==="string"?reference:null
    });
    if(error) throw error; res.status(201).json({success:true,data,message:"Payment submitted for administrator confirmation."});
  } catch(e) { next(e); }
}
export async function reviewPaymentSubmission(req: Request,res: Response,next: NextFunction) {
  try {
    const decision=req.body?.decision;
    if(!["Confirmed","Rejected"].includes(decision)) throw Object.assign(new Error("Choose Confirmed or Rejected."),{status:400});
    const {data,error}=await client(req).rpc("review_payment_submission",{
      p_submission_id:validId(req.params.id),p_decision:decision,p_remarks:typeof req.body?.remarks==="string"?req.body.remarks:null
    });
    if(error) throw error; res.json({success:true,data,message:"Payment submission "+decision.toLowerCase()+"."});
  } catch(e) { next(e); }
}
