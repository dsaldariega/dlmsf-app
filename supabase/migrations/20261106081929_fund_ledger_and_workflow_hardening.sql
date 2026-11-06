-- Keep the available-fund calculation consistent across loan requests, approvals, and admin-created loans.
create or replace function private.available_fund_balance()
returns numeric
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with group_weekly as (
    select week_start, sum(amount) as amount
    from public.payments
    group by week_start
  ),
  member_weekly as (
    select week_start, sum(amount) as amount
    from public.payment_submissions
    where payment_type = 'Weekly' and status = 'Confirmed'
    group by week_start
  ),
  weekly as (
    select greatest(coalesce(g.amount, 0), coalesce(m.amount, 0)) as amount
    from group_weekly g
    full outer join member_weekly m using (week_start)
  )
  select
    coalesce((select sum(amount) from weekly), 0)
    + coalesce((select sum(amount) from public.loan_payments), 0)
    - coalesce((select sum(amount) from public.loans), 0);
$$;

revoke all on function private.available_fund_balance() from public, anon;
grant execute on function private.available_fund_balance() to authenticated;

create or replace function public.create_loan(p_borrower_id bigint, p_amount numeric, p_months integer)
returns public.loans
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_loan public.loans;
  v_borrower_name text;
  v_interest numeric(12,2);
  v_total numeric(12,2);
  v_monthly numeric(12,2);
  v_available numeric;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Only authenticated administrators can create loans' using errcode = '42501';
  end if;
  if p_borrower_id is null or p_amount is null or p_months is null then
    raise exception 'Borrower, amount, and duration are required' using errcode = '22023';
  end if;
  if p_amount < 500 or mod(p_amount, 500) <> 0 or p_months not in (1,2,3,4,5,6,9,12,18,24) then
    raise exception 'Invalid loan amount or duration' using errcode = '22023';
  end if;

  select name into v_borrower_name from public.members where id = p_borrower_id;
  if not found then
    raise exception 'Borrower does not exist' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(2026110601);
  v_available := private.available_fund_balance();
  if p_amount > greatest(v_available, 0) then
    raise exception 'Loan amount exceeds available sinking fund balance' using errcode = '22023';
  end if;

  v_interest := round(p_amount * 0.05 * p_months, 2);
  v_total := round(p_amount + v_interest, 2);
  v_monthly := round(v_total / p_months, 2);

  insert into public.loans (borrower_id, amount, interest, total, monthly, months, status)
  values (p_borrower_id, p_amount, v_interest, v_total, v_monthly, p_months, 'Ongoing')
  returning * into v_loan;

  insert into public.loans_audit_log
    (member_id, borrower_name, amount, interest, total, monthly, action, remarks, months, created_date)
  values (
    p_borrower_id, v_borrower_name, v_loan.amount, v_loan.interest, v_loan.total,
    v_loan.monthly, 'New Loan Created',
    format('New loan created for %s %s', p_months, case when p_months = 1 then 'month' else 'months' end),
    v_loan.months, current_date
  );

  return v_loan;
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select id into v_mid
  from public.members
  where auth_id = auth.uid() and 'member' = any(roles)
  limit 1;
  if v_mid is null then
    raise exception 'Member profile not found' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 500 or mod(p_amount, 500) <> 0
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
  values (v_mid, p_amount, p_months)
  returning * into v_req;
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
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('Approved', 'Rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into v_req from public.loan_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if v_req.status <> 'Pending' then raise exception 'Request already reviewed' using errcode = '55000'; end if;

  if p_decision = 'Approved' then
    -- create_loan serializes all disbursements and rechecks the balance.
    select * into v_loan from public.create_loan(v_req.member_id, v_req.amount, v_req.months);
    update public.loan_requests
      set status = 'Approved', reviewed_at = now(), reviewed_by = auth.uid(),
          admin_remarks = nullif(trim(p_remarks), ''), loan_id = v_loan.id
      where id = p_request_id returning * into v_req;
  else
    update public.loan_requests
      set status = 'Rejected', reviewed_at = now(), reviewed_by = auth.uid(),
          admin_remarks = nullif(trim(p_remarks), '')
      where id = p_request_id returning * into v_req;
  end if;
  return v_req;
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
  select id, heads into v_mid, v_heads
  from public.members
  where auth_id = auth.uid() and 'member' = any(roles)
  limit 1;
  if v_mid is null then raise exception 'Member profile not found' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_paid_on is null or p_paid_on > current_date then
    raise exception 'Enter a valid amount and payment date' using errcode = '22023';
  end if;

  if p_type = 'Weekly' then
    if p_week_start is null or extract(dow from p_week_start) <> 0
       or p_week_start > current_date or p_loan_id is not null or p_amount > v_heads * 50 then
      raise exception 'Invalid weekly contribution amount or collection Sunday' using errcode = '22023';
    end if;
  elsif p_type = 'Loan' then
    if p_loan_id is null or p_week_start is not null then raise exception 'Select a loan' using errcode = '22023'; end if;
    select * into v_loan from public.loans
    where id = p_loan_id and borrower_id = v_mid and status <> 'Paid'
    for update;
    if not found then raise exception 'Active loan not found' using errcode = 'P0002'; end if;
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = p_loan_id;
    if p_amount > greatest(v_loan.total - v_paid, 0) then
      raise exception 'Payment exceeds remaining loan balance' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid payment type' using errcode = '22023';
  end if;

  insert into public.payment_submissions(member_id, payment_type, amount, paid_on, week_start, loan_id, reference)
  values (v_mid, p_type, p_amount, p_paid_on, p_week_start, p_loan_id, nullif(trim(p_reference), ''))
  returning * into v_sub;
  return v_sub;
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
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('Confirmed', 'Rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if v_sub.status <> 'Pending' then raise exception 'Submission already reviewed' using errcode = '55000'; end if;

  if p_decision = 'Confirmed' and v_sub.payment_type = 'Loan' then
    select total into v_total from public.loans
    where id = v_sub.loan_id and borrower_id = v_sub.member_id
    for update;
    if not found then raise exception 'Loan no longer exists for this member' using errcode = 'P0002'; end if;
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = v_sub.loan_id;
    if v_sub.amount > greatest(v_total - v_paid, 0) then
      raise exception 'Payment exceeds the remaining loan balance' using errcode = '22023';
    end if;
    insert into public.loan_payments(loan_id, member_id, amount, paid_at)
    values (v_sub.loan_id, v_sub.member_id, v_sub.amount, v_sub.paid_on);
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = v_sub.loan_id;
    if v_paid >= v_total then
      update public.loans set status = 'Paid' where id = v_sub.loan_id;
    end if;
  end if;

  update public.payment_submissions
  set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      admin_remarks = nullif(trim(p_remarks), '')
  where id = p_submission_id returning * into v_sub;
  return v_sub;
end;
$$;

revoke all on function public.create_loan(bigint, numeric, integer) from public, anon;
revoke all on function public.submit_loan_request(numeric, integer),
  public.review_loan_request(bigint, text, text),
  public.submit_payment(text, numeric, date, date, bigint, text),
  public.review_payment_submission(bigint, text, text) from public, anon;
grant execute on function public.create_loan(bigint, numeric, integer),
  public.submit_loan_request(numeric, integer),
  public.review_loan_request(bigint, text, text),
  public.submit_payment(text, numeric, date, date, bigint, text),
  public.review_payment_submission(bigint, text, text) to authenticated;
