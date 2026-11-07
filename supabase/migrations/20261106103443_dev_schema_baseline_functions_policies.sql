
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
 select exists(select 1 from public.members where auth_id=auth.uid() and 'admin'=any(roles));
$$;

create or replace function private.available_fund_balance()
returns numeric language sql stable security definer set search_path=pg_catalog
as $$
 with group_weekly as (
   select week_start,sum(amount) as amount from public.payments group by week_start
 ),
 member_weekly as (
   select week_start,sum(amount) as amount from public.weekly_contribution_allocations group by week_start
 ),
 weekly as (
   select greatest(coalesce(g.amount,0),coalesce(m.amount,0)) as amount
   from group_weekly g full outer join member_weekly m using(week_start)
 )
 select coalesce((select sum(amount) from weekly),0)
      + coalesce((select sum(amount) from public.loan_payments),0)
      - coalesce((select sum(amount) from public.loans),0);
$$;

create or replace function public.serialize_fund_balance_mutations()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
 perform pg_advisory_xact_lock(731904,1);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;

create or replace function public.enforce_loan_eligibility()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
declare v_collected numeric; v_outstanding numeric; v_available numeric;
begin
 perform pg_advisory_xact_lock(731904,1);
 if new.amount is null or new.amount<500 or mod(new.amount,500)<>0 then
   raise exception 'Loan amount must be at least PHP 500 and in PHP 500 increments' using errcode='check_violation';
 end if;
 if new.months is null or new.months not in (1,2,3,4,5,6,9,12,18,24) then
   raise exception 'Unsupported loan duration' using errcode='check_violation';
 end if;
 if exists(select 1 from public.loans l where l.borrower_id=new.borrower_id and coalesce(l.status,'Ongoing')<>'Paid') then
   raise exception 'This member already has an outstanding loan' using errcode='check_violation';
 end if;
 select coalesce(sum(p.amount),0) into v_collected from public.payments p;
 select coalesce(sum(l.amount),0) into v_outstanding from public.loans l where coalesce(l.status,'Ongoing')<>'Paid';
 v_available:=v_collected-v_outstanding;
 if new.amount>v_available then
   raise exception 'Insufficient available funds. Available: PHP %',v_available using errcode='check_violation';
 end if;
 return new;
end;
$$;

create or replace function public.generate_audit_ref_id()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_prefix text; v_date date; v_number bigint;
begin
 if tg_table_schema<>'public' then raise exception 'Unsupported audit schema'; end if;
 if tg_table_name='loans_audit_log' then v_prefix:='L';
 elsif tg_table_name='payments_audit_log' then v_prefix:='P';
 else raise exception 'Unsupported audit table: %',tg_table_name; end if;
 v_date:=coalesce(new.created_date::date,current_date);
 insert into public.audit_ref_counters as counters(prefix,ref_date,last_number)
 values(v_prefix,v_date,1)
 on conflict(prefix,ref_date) do update set last_number=counters.last_number+1
 returning last_number into v_number;
 new.ref_id:=v_prefix||'-'||to_char(v_date,'DDMMYYYY')||'-'||lpad(v_number::text,6,'0');
 return new;
end;
$$;

create or replace function public.record_full_loan_payment()
returns trigger language plpgsql set search_path=pg_catalog
as $$
declare v_paid numeric(12,2); v_remaining numeric(12,2);
begin
 if new.status='Paid' and old.status is distinct from new.status then
   select coalesce(sum(lp.amount),0) into v_paid from public.loan_payments lp where lp.loan_id=new.id;
   v_remaining:=greatest(coalesce(new.total,0)-v_paid,0);
   if v_remaining>0 then
     insert into public.loan_payments(loan_id,member_id,amount,paid_at)
     values(new.id,new.borrower_id,v_remaining,now());
   end if;
 end if;
 return new;
end;
$$;

create or replace function private.capture_loan_request_audit_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,auth
as $$
declare v_action text; v_actor_role text;
begin
 if tg_op='INSERT' then v_action:='Requested';
 elsif new.status is distinct from old.status and new.status in ('Approved','Rejected') then v_action:=new.status;
 else return new; end if;
 v_actor_role:=case when private.is_admin() then 'admin' when auth.uid() is not null then 'member' else 'system' end;
 insert into public.loan_request_audit_events(loan_request_id,member_id,amount,months,action,actor_id,actor_role,remarks,created_at)
 values(new.id,new.member_id,new.amount,new.months,v_action,auth.uid(),v_actor_role,case when v_action='Requested' then null else new.admin_remarks end,now());
 return new;
end;
$$;

create or replace function public.create_loan(p_borrower_id bigint,p_amount numeric,p_months integer)
returns public.loans language plpgsql security definer set search_path=pg_catalog
as $$
declare v_loan public.loans; v_borrower_name text; v_interest numeric(12,2); v_total numeric(12,2); v_monthly numeric(12,2); v_available numeric;
begin
 if auth.uid() is null or not private.is_admin() then
   raise exception 'Only authenticated administrators can create loans' using errcode='42501';
 end if;
 if p_borrower_id is null or p_amount is null or p_months is null then
   raise exception 'Borrower, amount, and duration are required' using errcode='22023';
 end if;
 if p_amount<500 or mod(p_amount,500)<>0 or p_months not in (1,2,3,4,5,6,9,12,18,24) then
   raise exception 'Invalid loan amount or duration' using errcode='22023';
 end if;
 select name into v_borrower_name from public.members where id=p_borrower_id;
 if not found then raise exception 'Borrower does not exist' using errcode='23503'; end if;
 perform pg_advisory_xact_lock(2026110601);
 v_available:=private.available_fund_balance();
 if p_amount>greatest(v_available,0) then
   raise exception 'Loan amount exceeds available sinking fund balance' using errcode='22023';
 end if;
 v_interest:=round(p_amount*0.05*p_months,2);
 v_total:=round(p_amount+v_interest,2);
 v_monthly:=round(v_total/p_months,2);
 insert into public.loans(borrower_id,amount,interest,total,monthly,months,status)
 values(p_borrower_id,p_amount,v_interest,v_total,v_monthly,p_months,'Ongoing') returning * into v_loan;
 insert into public.loans_audit_log(member_id,borrower_name,amount,interest,total,monthly,action,remarks,months,created_date)
 values(p_borrower_id,v_borrower_name,v_loan.amount,v_loan.interest,v_loan.total,v_loan.monthly,'New Loan Created',
 format('New loan created for %s %s',p_months,case when p_months=1 then 'month' else 'months' end),v_loan.months,current_date);
 return v_loan;
end;
$$;

create or replace function public.submit_loan_request(p_amount numeric,p_months integer)
returns public.loan_requests language plpgsql security definer set search_path=pg_catalog
as $$
declare v_mid bigint; v_available numeric; v_req public.loan_requests;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select id into v_mid from public.members where auth_id=auth.uid() and 'member'=any(roles) limit 1;
 if v_mid is null then raise exception 'Member profile not found' using errcode='42501'; end if;
 if p_amount is null or p_amount='NaN'::numeric or p_amount<500 or mod(p_amount,500)<>0 or p_months is null or p_months not in (1,2,3,4,5,6,9,12,18,24) then
   raise exception 'Invalid amount or duration' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(v_mid);
 if exists(select 1 from public.loans where borrower_id=v_mid and status<>'Paid') then
   raise exception 'You already have an ongoing loan. Fully pay your current loan before requesting another one.' using errcode='23505';
 end if;
 if exists(select 1 from public.loan_requests where member_id=v_mid and status='Pending') then
   raise exception 'You already have a pending loan request. Please wait for the administrator to review it.' using errcode='23505';
 end if;
 v_available:=private.available_fund_balance();
 if p_amount>greatest(v_available,0) then raise exception 'Requested amount exceeds available sinking fund balance' using errcode='22023'; end if;
 insert into public.loan_requests(member_id,amount,months) values(v_mid,p_amount,p_months) returning * into v_req;
 return v_req;
end;
$$;

create or replace function public.review_loan_request(p_request_id bigint,p_decision text,p_remarks text default null)
returns public.loan_requests language plpgsql security definer set search_path=pg_catalog
as $$
declare v_req public.loan_requests; v_loan public.loans;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('Approved','Rejected') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into v_req from public.loan_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found' using errcode='P0002'; end if;
 if v_req.status<>'Pending' then raise exception 'Request already reviewed' using errcode='55000'; end if;
 if p_decision='Approved' then
   select * into v_loan from public.create_loan(v_req.member_id,v_req.amount,v_req.months);
   update public.loan_requests set status='Approved',reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),''),loan_id=v_loan.id where id=p_request_id returning * into v_req;
 else
   update public.loan_requests set status='Rejected',reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),'') where id=p_request_id returning * into v_req;
 end if;
 return v_req;
end;
$$;

create or replace function public.submit_payment(p_type text,p_amount numeric,p_paid_on date,p_week_start date,p_loan_id bigint,p_reference text)
returns public.payment_submissions language plpgsql security definer set search_path=pg_catalog
as $$
declare v_mid bigint; v_heads integer; v_week_start date; v_week_credit numeric; v_week_due numeric; v_loan public.loans; v_paid numeric; v_remaining numeric; v_sub public.payment_submissions;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select id,heads into v_mid,v_heads from public.members where auth_id=auth.uid() and 'member'=any(roles) limit 1;
 if v_mid is null then raise exception 'Member profile not found' using errcode='42501'; end if;
 if p_amount is null or p_amount='NaN'::numeric or p_amount<=0 or p_paid_on is null or p_paid_on>current_date then
   raise exception 'Enter a valid amount and payment date' using errcode='22023';
 end if;
 if p_type='Weekly' then
   if p_week_start is null or extract(dow from p_week_start)<>0 or p_loan_id is not null then
     raise exception 'Choose a valid collection Sunday' using errcode='22023';
   end if;
   perform pg_advisory_xact_lock(v_mid);
   if exists(select 1 from public.payment_submissions where member_id=v_mid and payment_type='Weekly' and status='Pending') then
     raise exception 'You already have a weekly payment awaiting review' using errcode='23505';
   end if;
   v_week_start:=p_week_start;
   v_week_due:=v_heads*50;
   if v_week_due<=0 then raise exception 'Your weekly obligation is not configured' using errcode='22023'; end if;
   for i in 1..520 loop
     select coalesce(sum(amount),0) into v_week_credit from public.weekly_contribution_allocations where member_id=v_mid and week_start=v_week_start;
     exit when v_week_credit<v_week_due;
     v_week_start:=v_week_start+7;
   end loop;
   v_remaining:=greatest(v_week_due-v_week_credit,0);
   if p_amount<v_remaining then raise exception 'Payment must cover at least the remaining weekly obligation of %',v_remaining using errcode='22023'; end if;
 elsif p_type='Loan' then
   if p_loan_id is null or p_week_start is not null then raise exception 'Select a loan' using errcode='22023'; end if;
   select * into v_loan from public.loans where id=p_loan_id and borrower_id=v_mid and status<>'Paid' for update;
   if not found then raise exception 'Active loan not found' using errcode='P0002'; end if;
   select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id=p_loan_id;
   v_remaining:=greatest(v_loan.total-v_paid,0);
   if p_amount>v_remaining then raise exception 'Payment exceeds remaining loan balance' using errcode='22023'; end if;
   if p_amount<least(coalesce(v_loan.monthly,0),v_remaining) then raise exception 'Payment must be at least the monthly due of %',least(coalesce(v_loan.monthly,0),v_remaining) using errcode='22023'; end if;
 else
   raise exception 'Invalid payment type' using errcode='22023';
 end if;
 insert into public.payment_submissions(member_id,payment_type,amount,paid_on,week_start,loan_id,reference)
 values(v_mid,p_type,p_amount,p_paid_on,case when p_type='Weekly' then v_week_start else null end,p_loan_id,nullif(trim(p_reference),'')) returning * into v_sub;
 return v_sub;
end;
$$;

create or replace function public.review_payment_submission(p_submission_id bigint,p_decision text,p_remarks text default null)
returns public.payment_submissions language plpgsql security definer set search_path=pg_catalog
as $$
declare v_sub public.payment_submissions; v_total numeric; v_paid numeric; v_heads integer; v_week_start date; v_week_due numeric; v_week_credit numeric; v_to_allocate numeric; v_remaining numeric; v_loan public.loans;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('Confirmed','Rejected') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into v_sub from public.payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
 if v_sub.status<>'Pending' then raise exception 'Submission already reviewed' using errcode='55000'; end if;
 if p_decision='Confirmed' and v_sub.payment_type='Weekly' then
   perform pg_advisory_xact_lock(v_sub.member_id);
   select heads into v_heads from public.members where id=v_sub.member_id;
   v_week_due:=v_heads*50;
   v_week_start:=v_sub.week_start;
   v_remaining:=v_sub.amount;
   for i in 1..520 loop
     exit when v_remaining<=0;
     select coalesce(sum(amount),0) into v_week_credit from public.weekly_contribution_allocations where member_id=v_sub.member_id and week_start=v_week_start;
     v_to_allocate:=least(v_remaining,greatest(v_week_due-v_week_credit,0));
     if v_to_allocate>0 then
       insert into public.weekly_contribution_allocations(payment_submission_id,member_id,week_start,amount) values(v_sub.id,v_sub.member_id,v_week_start,v_to_allocate);
       v_remaining:=v_remaining-v_to_allocate;
     end if;
     v_week_start:=v_week_start+7;
   end loop;
   if v_remaining>0 then raise exception 'Unable to allocate the full weekly payment' using errcode='22023'; end if;
 elsif p_decision='Confirmed' and v_sub.payment_type='Loan' then
   select * into v_loan from public.loans where id=v_sub.loan_id and borrower_id=v_sub.member_id for update;
   if not found then raise exception 'Loan no longer exists for this member' using errcode='P0002'; end if;
   select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id=v_sub.loan_id;
   v_total:=greatest(v_loan.total-v_paid,0);
   if v_sub.amount>v_total then raise exception 'Payment exceeds the remaining loan balance' using errcode='22023'; end if;
   if v_sub.amount<least(coalesce(v_loan.monthly,0),v_total) then raise exception 'Payment is below the required monthly due' using errcode='22023'; end if;
   insert into public.loan_payments(loan_id,member_id,amount,paid_at) values(v_sub.loan_id,v_sub.member_id,v_sub.amount,v_sub.paid_on);
   select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id=v_sub.loan_id;
   if v_paid>=v_loan.total then update public.loans set status='Paid' where id=v_sub.loan_id; end if;
 end if;
 update public.payment_submissions set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),admin_remarks=nullif(trim(p_remarks),'') where id=p_submission_id returning * into v_sub;
 return v_sub;
end;
$$;

revoke all on function private.available_fund_balance() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
revoke all on function private.capture_loan_request_audit_event() from public,anon,authenticated;
revoke all on function public.enforce_loan_eligibility() from public,anon,authenticated;
revoke all on function public.generate_audit_ref_id() from public,anon,authenticated;
revoke all on function public.record_full_loan_payment() from public,anon,authenticated;
revoke all on function public.serialize_fund_balance_mutations() from public,anon,authenticated;
revoke all on function public.create_loan(bigint,numeric,integer) from public,anon;
revoke all on function public.submit_loan_request(numeric,integer) from public,anon;
revoke all on function public.review_loan_request(bigint,text,text) from public,anon;
revoke all on function public.submit_payment(text,numeric,date,date,bigint,text) from public,anon;
revoke all on function public.review_payment_submission(bigint,text,text) from public,anon;
grant execute on function public.create_loan(bigint,numeric,integer) to authenticated,service_role;
grant execute on function public.submit_loan_request(numeric,integer) to authenticated,service_role;
grant execute on function public.review_loan_request(bigint,text,text) to authenticated,service_role;
grant execute on function public.submit_payment(text,numeric,date,date,bigint,text) to authenticated,service_role;
grant execute on function public.review_payment_submission(bigint,text,text) to authenticated,service_role;

create trigger loan_request_audit_event_trigger after insert or update of status on public.loan_requests for each row execute function private.capture_loan_request_audit_event();
create trigger trg_enforce_loan_eligibility before insert on public.loans for each row execute function public.enforce_loan_eligibility();
create trigger trg_record_full_loan_payment after update of status on public.loans for each row when (new.status='Paid' and old.status is distinct from new.status) execute function public.record_full_loan_payment();
create trigger trg_serialize_loan_balance_updates before update of amount,status,borrower_id on public.loans for each row execute function public.serialize_fund_balance_mutations();
create trigger trg_loan_audit_ref_id before insert on public.loans_audit_log for each row execute function public.generate_audit_ref_id();
create trigger trg_serialize_payment_balance_mutations before insert or delete or update on public.payments for each row execute function public.serialize_fund_balance_mutations();
create trigger trg_payment_audit_ref_id before insert on public.payments_audit_log for each row execute function public.generate_audit_ref_id();

create policy "Admins can delete loan payments" on public.loan_payments for delete to authenticated using ((select private.is_admin()));
create policy "Admins can insert loan payments" on public.loan_payments for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update loan payments" on public.loan_payments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Members view own loan payments by member ID" on public.loan_payments for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=loan_payments.member_id and m.auth_id=(select auth.uid())));
create policy "Members and admins can read loan request audit events" on public.loan_request_audit_events for select to authenticated using ((select private.is_admin()) or member_id=(select id from public.members where auth_id=(select auth.uid()) limit 1));
create policy "Members view own loan requests or admins view all" on public.loan_requests for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=loan_requests.member_id and m.auth_id=(select auth.uid())));
create policy "Admins can delete loans" on public.loans for delete to authenticated using ((select private.is_admin()));
create policy "Admins can insert loans" on public.loans for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update loans" on public.loans for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Members can view own loans or admins can view all" on public.loans for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=loans.borrower_id and m.auth_id=(select auth.uid())));
create policy "Admin can view audit log" on public.loans_audit_log for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Members can view own loan audit rows" on public.loans_audit_log for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=loans_audit_log.member_id and m.auth_id=(select auth.uid())));
create policy "Admins can delete members" on public.members for delete to authenticated using ((select private.is_admin()));
create policy "Admins can insert members" on public.members for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update members" on public.members for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Members can view own profile or admins can view all" on public.members for select to authenticated using ((select private.is_admin()) or (select auth.uid())=auth_id);
create policy "Members view own payment submissions or admins view all" on public.payment_submissions for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=payment_submissions.member_id and m.auth_id=(select auth.uid())));
create policy "Admins can manage payments" on public.payments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admin can view payments audit log" on public.payments_audit_log for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Members view own weekly allocations or admins view all" on public.weekly_contribution_allocations for select to authenticated using ((select private.is_admin()) or exists(select 1 from public.members m where m.id=weekly_contribution_allocations.member_id and m.auth_id=(select auth.uid())));

revoke all on public.loan_requests,public.payment_submissions,public.loan_request_audit_events from anon,authenticated;
grant select on public.loan_requests,public.payment_submissions,public.loan_request_audit_events to authenticated;
