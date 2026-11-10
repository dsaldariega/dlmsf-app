-- Standardize confirmed loan-payment audit remarks and record the
-- confirmed repayment in the payment audit log.
create or replace function public.review_payment_submission(
  p_submission_id bigint,
  p_decision text,
  p_remarks text default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_sub public.payment_submissions;
  v_total numeric;
  v_paid numeric;
  v_heads integer;
  v_week_start date;
  v_week_due numeric;
  v_week_credit numeric;
  v_to_allocate numeric;
  v_remaining numeric;
  v_loan public.loans;
  v_member_name text;
  v_standard_remarks text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('Confirmed', 'Rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into v_sub
  from public.payment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if v_sub.status <> 'Pending' then
    raise exception 'Submission already reviewed' using errcode = '55000';
  end if;

  if p_decision = 'Confirmed' and v_sub.payment_type = 'Weekly' then
    perform pg_advisory_xact_lock(v_sub.member_id);

    select heads into v_heads
    from public.members
    where id = v_sub.member_id;

    v_week_due := v_heads * 50;
    v_week_start := v_sub.week_start;
    v_remaining := v_sub.amount;

    for i in 1..520 loop
      exit when v_remaining <= 0;

      select coalesce(sum(amount), 0) into v_week_credit
      from public.weekly_contribution_allocations
      where member_id = v_sub.member_id
        and week_start = v_week_start;

      v_to_allocate := least(
        v_remaining,
        greatest(v_week_due - v_week_credit, 0)
      );

      if v_to_allocate > 0 then
        insert into public.weekly_contribution_allocations(
          payment_submission_id,
          member_id,
          week_start,
          amount
        )
        values (
          v_sub.id,
          v_sub.member_id,
          v_week_start,
          v_to_allocate
        );

        v_remaining := v_remaining - v_to_allocate;
      end if;

      v_week_start := v_week_start + 7;
    end loop;

    if v_remaining > 0 then
      raise exception 'Unable to allocate the full weekly payment'
        using errcode = '22023';
    end if;

  elsif p_decision = 'Confirmed' and v_sub.payment_type = 'Loan' then
    select * into v_loan
    from public.loans
    where id = v_sub.loan_id
      and borrower_id = v_sub.member_id
    for update;

    if not found then
      raise exception 'Loan no longer exists for this member'
        using errcode = 'P0002';
    end if;

    select coalesce(sum(amount), 0) into v_paid
    from public.loan_payments
    where loan_id = v_sub.loan_id;

    v_total := greatest(v_loan.total - v_paid, 0);

    if v_sub.amount > v_total then
      raise exception 'Payment exceeds the remaining loan balance'
        using errcode = '22023';
    end if;

    if v_sub.amount < least(coalesce(v_loan.monthly, 0), v_total) then
      raise exception 'Payment is below the required monthly due'
        using errcode = '22023';
    end if;

    insert into public.loan_payments(
      loan_id,
      member_id,
      amount,
      paid_at
    )
    values (
      v_sub.loan_id,
      v_sub.member_id,
      v_sub.amount,
      v_sub.paid_on
    );

    select coalesce(sum(amount), 0) into v_paid
    from public.loan_payments
    where loan_id = v_sub.loan_id;

    if v_paid >= v_loan.total then
      update public.loans
      set status = 'Paid'
      where id = v_sub.loan_id;
    end if;

    select name into v_member_name
    from public.members
    where id = v_sub.member_id;

    v_standard_remarks :=
      coalesce(v_member_name, 'Member')
      || ' made a loan payment of PHP '
      || to_char(v_sub.amount, 'FM999,999,990.00')
      || '.';

    insert into public.payments_audit_log(
      member_id,
      amount,
      action,
      remarks,
      created_date
    )
    values (
      v_sub.member_id,
      v_sub.amount,
      'Loan Payment Recorded',
      v_standard_remarks,
      now()
    );
  end if;

  update public.payment_submissions
  set status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      admin_remarks = case
        when p_decision = 'Confirmed' and v_sub.payment_type = 'Loan'
          then v_standard_remarks
        else nullif(trim(p_remarks), '')
      end
  where id = p_submission_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke all on function public.review_payment_submission(bigint,text,text) from public, anon;
grant execute on function public.review_payment_submission(bigint,text,text) to authenticated, service_role;
