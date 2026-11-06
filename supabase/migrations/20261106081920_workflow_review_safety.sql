-- Serialize loan disbursement approvals and revalidate loan repayment submissions at confirmation time.
create or replace function public.review_loan_request(p_request_id bigint,p_decision text,p_remarks text default null)
returns public.loan_requests language plpgsql security definer set search_path=pg_catalog as $$
declare v_req public.loan_requests; v_available numeric; v_loan public.loans;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision not in('Approved','Rejected') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into v_req from public.loan_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found' using errcode='P0002'; end if;
 if v_req.status<>'Pending' then raise exception 'Request already reviewed' using errcode='55000'; end if;
 if p_decision='Approved' then
  perform pg_advisory_xact_lock(2026110601);
  select coalesce((select sum(amount) from public.payments),0)+coalesce((select sum(amount) from public.loan_payments),0)-coalesce((select sum(amount) from public.loans),0) into v_available;
  if v_req.amount>greatest(v_available,0) then raise exception 'Insufficient available sinking fund balance' using errcode='22023'; end if;
  select * into v_loan from public.create_loan(v_req.member_id,v_req.amount,v_req.months);
  update public.loan_requests set status='Approved',reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),''),loan_id=v_loan.id where id=p_request_id returning * into v_req;
 else
  update public.loan_requests set status='Rejected',reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),'') where id=p_request_id returning * into v_req;
 end if;
 return v_req;
end $$;

create or replace function public.review_payment_submission(p_submission_id bigint,p_decision text,p_remarks text default null)
returns public.payment_submissions language plpgsql security definer set search_path=pg_catalog as $$
declare v_sub public.payment_submissions; v_total numeric; v_paid numeric;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision not in('Confirmed','Rejected') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into v_sub from public.payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
 if v_sub.status<>'Pending' then raise exception 'Submission already reviewed' using errcode='55000'; end if;
 if p_decision='Confirmed' and v_sub.payment_type='Loan' then
  select total into v_total from public.loans where id=v_sub.loan_id and borrower_id=v_sub.member_id for update;
  if not found then raise exception 'Loan no longer exists for this member' using errcode='P0002'; end if;
  select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id=v_sub.loan_id;
  if v_sub.amount>greatest(v_total-v_paid,0) then raise exception 'Payment exceeds the remaining loan balance' using errcode='22023'; end if;
  insert into public.loan_payments(loan_id,member_id,amount,paid_at) values(v_sub.loan_id,v_sub.member_id,v_sub.amount,v_sub.paid_on);
  select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id=v_sub.loan_id;
  if v_paid>=v_total then update public.loans set status='Paid' where id=v_sub.loan_id; end if;
 end if;
 update public.payment_submissions set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),'') where id=p_submission_id returning * into v_sub;
 return v_sub;
end $$;
