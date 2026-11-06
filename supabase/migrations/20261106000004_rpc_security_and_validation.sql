-- Tighten workflow RPC edge-case validation and keep the balance helper private.
alter function public.create_loan(bigint, numeric, integer) security definer;
revoke all on function private.available_fund_balance() from public, anon, authenticated;

create or replace function public.submit_loan_request(p_amount numeric, p_months integer)
returns public.loan_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_mid bigint;
  v_available numeric;
  v_req public.loan_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_mid from public.members
  where auth_id = auth.uid() and 'member' = any(roles) limit 1;
  if v_mid is null then raise exception 'Member profile not found' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 500
     or mod(p_amount, 500) <> 0 or p_months is null
     or p_months not in (1,2,3,4,5,6,9,12,18,24) then
    raise exception 'Invalid amount or duration' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(v_mid);
  if exists(select 1 from public.loan_requests where member_id = v_mid and status = 'Pending') then
    raise exception 'You already have a pending loan request' using errcode = '23505';
  end if;
  v_available := private.available_fund_balance();
  if p_amount > greatest(v_available, 0) then
    raise exception 'Requested amount exceeds available sinking fund balance' using errcode = '22023';
  end if;
  insert into public.loan_requests(member_id, amount, months)
  values (v_mid, p_amount, p_months) returning * into v_req;
  return v_req;
end;
$$;

create or replace function public.review_loan_request(p_request_id bigint, p_decision text, p_remarks text default null)
returns public.loan_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_req public.loan_requests;
  v_loan public.loans;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('Approved', 'Rejected') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  select * into v_req from public.loan_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if v_req.status <> 'Pending' then raise exception 'Request already reviewed' using errcode = '55000'; end if;
  if p_decision = 'Approved' then
    select * into v_loan from public.create_loan(v_req.member_id, v_req.amount, v_req.months);
    update public.loan_requests set status = 'Approved', reviewed_at = now(), reviewed_by = auth.uid(),
      admin_remarks = nullif(trim(p_remarks), ''), loan_id = v_loan.id
    where id = p_request_id returning * into v_req;
  else
    update public.loan_requests set status = 'Rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      admin_remarks = nullif(trim(p_remarks), '')
    where id = p_request_id returning * into v_req;
  end if;
  return v_req;
end;
$$;

create or replace function public.review_payment_submission(p_submission_id bigint, p_decision text, p_remarks text default null)
returns public.payment_submissions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_sub public.payment_submissions;
  v_total numeric;
  v_paid numeric;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('Confirmed', 'Rejected') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if v_sub.status <> 'Pending' then raise exception 'Submission already reviewed' using errcode = '55000'; end if;
  if p_decision = 'Confirmed' and v_sub.payment_type = 'Loan' then
    select total into v_total from public.loans
    where id = v_sub.loan_id and borrower_id = v_sub.member_id for update;
    if not found then raise exception 'Loan no longer exists for this member' using errcode = 'P0002'; end if;
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = v_sub.loan_id;
    if v_sub.amount > greatest(v_total - v_paid, 0) then
      raise exception 'Payment exceeds the remaining loan balance' using errcode = '22023';
    end if;
    insert into public.loan_payments(loan_id, member_id, amount, paid_at)
    values (v_sub.loan_id, v_sub.member_id, v_sub.amount, v_sub.paid_on);
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = v_sub.loan_id;
    if v_paid >= v_total then update public.loans set status = 'Paid' where id = v_sub.loan_id; end if;
  end if;
  update public.payment_submissions set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
    admin_remarks = nullif(trim(p_remarks), '')
  where id = p_submission_id returning * into v_sub;
  return v_sub;
end;
$$;

create or replace function public.submit_payment(
  p_type text, p_amount numeric, p_paid_on date, p_week_start date, p_loan_id bigint, p_reference text
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_mid bigint;
  v_heads integer;
  v_loan public.loans;
  v_paid numeric;
  v_sub public.payment_submissions;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id, heads into v_mid, v_heads from public.members
  where auth_id = auth.uid() and 'member' = any(roles) limit 1;
  if v_mid is null then raise exception 'Member profile not found' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount <= 0
     or p_paid_on is null or p_paid_on > current_date then
    raise exception 'Enter a valid amount and payment date' using errcode = '22023';
  end if;
  if p_type = 'Weekly' then
    if p_week_start is null or extract(dow from p_week_start) <> 0
       or p_week_start > current_date or p_loan_id is not null or p_amount > v_heads * 50 then
      raise exception 'Invalid weekly contribution amount or collection Sunday' using errcode = '22023';
    end if;
  elsif p_type = 'Loan' then
    if p_loan_id is null or p_week_start is not null then raise exception 'Select a loan' using errcode = '22023'; end if;
    select * into v_loan from public.loans where id = p_loan_id and borrower_id = v_mid and status <> 'Paid' for update;
    if not found then raise exception 'Active loan not found' using errcode = 'P0002'; end if;
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = p_loan_id;
    if p_amount > greatest(v_loan.total - v_paid, 0) then raise exception 'Payment exceeds remaining loan balance' using errcode = '22023'; end if;
  else
    raise exception 'Invalid payment type' using errcode = '22023';
  end if;
  insert into public.payment_submissions(member_id, payment_type, amount, paid_on, week_start, loan_id, reference)
  values (v_mid, p_type, p_amount, p_paid_on, p_week_start, p_loan_id, nullif(trim(p_reference), ''))
  returning * into v_sub;
  return v_sub;
end;
$$;
