"use client";
import {useUserRole} from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminPayments from "@/components/payments/AdminPayments";
import AdminPaymentSubmissions from "@/components/payments/AdminPaymentSubmissions";
import MemberPaymentSubmissions from "@/components/payments/MemberPaymentSubmissions";
import WeeklyContributions from "@/components/payments/WeeklyContributions";
export default function PaymentsPage(){
 const {role,loading,error}=useUserRole();
 if(loading)return <Loading/>; if(error)return <p role="alert">{error}</p>;
 if(role==="member")return <MemberPaymentSubmissions/>;
 if(role==="admin")return <div className="space-y-8"><WeeklyContributions/><AdminPaymentSubmissions/><AdminPayments/></div>;
 return <p>Unauthorized access.</p>;
}