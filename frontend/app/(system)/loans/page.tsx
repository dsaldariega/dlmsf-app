"use client";
import {useUserRole} from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminLoans from "@/components/loans/AdminLoans";
import MemberLoanRequests from "@/components/loans/MemberLoanRequests";
import AdminLoanRequests from "@/components/loans/AdminLoanRequests";
export default function LoansPage(){
 const {role,loading,error}=useUserRole();
 if(loading)return <Loading/>; if(error)return <p role="alert">{error}</p>;
 if(role==="member")return <MemberLoanRequests/>;
 if(role==="admin")return <><AdminLoanRequests/><AdminLoans/></>;
 return <p>Unauthorized access.</p>;
}