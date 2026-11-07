
create or replace function public.submit_payment(
  p_type text, p_amount numeric, p_paid_on date, p_week_start date, p_loan_id bigint, p_reference text
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_mid bigint; v_heads integer; v_week_start date; v_week_credit numeric; v_week_due numeric;
  v_loan public.loans; v_paid numeric; v_remaining numeric; v_sub public.payment_submissions;
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
    -- Future collection Sundays are valid because the member may already have
    -- fully covered the current and following weeks with an advance payment.
    if p_week_start is null or extract(dow from p_week_start) <> 0 or p_loan_id is not null then
      raise exception 'Choose a valid collection Sunday' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(v_mid);
    if exists(select 1 from public.payment_submissions
              where member_id = v_mid and payment_type = 'Weekly' and status = 'Pending') then
      raise exception 'You already have a weekly payment awaiting review' using errcode = '23505';
    end if;
    v_week_start := p_week_start;
    v_week_due := v_heads * 50;
    if v_week_due <= 0 then raise exception 'Your weekly obligation is not configured' using errcode = '22023'; end if;
    for i in 1..520 loop
      select coalesce(sum(amount), 0) into v_week_credit
      from public.weekly_contribution_allocations
      where member_id = v_mid and week_start = v_week_start;
      exit when v_week_credit < v_week_due;
      v_week_start := v_week_start + 7;
    end loop;
    v_remaining := greatest(v_week_due - v_week_credit, 0);
    if p_amount < v_remaining then
      raise exception 'Payment must cover at least the remaining weekly obligation of %', v_remaining using errcode = '22023';
    end if;
  elsif p_type = 'Loan' then
    if p_loan_id is null or p_week_start is not null then raise exception 'Select a loan' using errcode = '22023'; end if;
    select * into v_loan from public.loans
    where id = p_loan_id and borrower_id = v_mid and status <> 'Paid' for update;
    if not found then raise exception 'Active loan not found' using errcode = 'P0002'; end if;
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = p_loan_id;
    v_remaining := greatest(v_loan.total - v_paid, 0);
    if p_amount > v_remaining then raise exception 'Payment exceeds remaining loan balance' using errcode = '22023'; end if;
    if p_amount < least(coalesce(v_loan.monthly, 0), v_remaining) then
      raise exception 'Payment must be at least the monthly due of %', least(coalesce(v_loan.monthly, 0), v_remaining) using errcode = '22023';
    end if;
  else
    raise exception 'Invalid payment type' using errcode = '22023';
  end if;
  insert into public.payment_submissions(member_id, payment_type, amount, paid_on, week_start, loan_id, reference)
  values (v_mid, p_type, p_amount, p_paid_on, case when p_type = 'Weekly' then v_week_start else null end,
          p_loan_id, nullif(trim(p_reference), '')) returning * into v_sub;
  return v_sub;
end;
$$;
