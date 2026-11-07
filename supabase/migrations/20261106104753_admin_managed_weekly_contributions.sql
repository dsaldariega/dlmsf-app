
-- Dev-only weekly contribution workflow: admin records received contributions per member.
alter table public.audit_ref_counters enable row level security;
revoke all on public.audit_ref_counters from anon, authenticated;

create or replace function public.admin_record_weekly_contribution(
  p_member_id bigint,
  p_week_start date,
  p_amount numeric,
  p_paid_on date default current_date,
  p_reference text default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_member public.members;
  v_paid numeric(12,2);
  v_due numeric(12,2);
  v_submission public.payment_submissions;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_member_id is null or p_week_start is null
     or extract(dow from p_week_start) <> 0 then
    raise exception 'Choose a valid member and Sunday collection week' using errcode = '22023';
  end if;
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount <= 0 then
    raise exception 'Contribution amount must be greater than zero' using errcode = '22023';
  end if;
  if p_paid_on is null or p_paid_on > current_date then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'weekly-contribution:' || p_member_id::text || ':' || p_week_start::text, 0
  ));

  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  v_due := coalesce(v_member.heads, 0) * 50;
  select coalesce(sum(amount), 0) into v_paid
  from public.weekly_contribution_allocations
  where member_id = p_member_id and week_start = p_week_start;

  if v_due <= 0 then
    raise exception 'Member weekly contribution is not configured' using errcode = '22023';
  end if;
  if p_amount > v_due - v_paid then
    raise exception 'Amount exceeds the remaining weekly contribution of PHP %', greatest(v_due-v_paid,0)
      using errcode = '22023';
  end if;

  insert into public.payment_submissions(
    member_id, payment_type, amount, paid_on, week_start, reference,
    status, submitted_at, reviewed_at, reviewed_by, admin_remarks
  ) values (
    p_member_id, 'Weekly', p_amount, p_paid_on, p_week_start,
    nullif(trim(coalesce(p_reference,'')), ''),
    'Confirmed', now(), now(), auth.uid(), 'Recorded directly by administrator.'
  ) returning * into v_submission;

  insert into public.weekly_contribution_allocations(
    payment_submission_id, member_id, week_start, amount
  ) values (v_submission.id, p_member_id, p_week_start, p_amount);

  insert into public.payments_audit_log(
    member_id, amount, week_start, action, remarks, created_date
  ) values (
    p_member_id, p_amount, p_week_start, 'Weekly Contribution Recorded',
    format('Administrator recorded PHP %s for %s (member ID %s), week starting %s. Submission ID: %s. Reference: %s.',
      to_char(p_amount, 'FM999,999,990.00'), v_member.name, p_member_id,
      p_week_start, v_submission.id, coalesce(nullif(trim(coalesce(p_reference,'')),''),'—')),
    now()
  );

  return v_submission;
end;
$$;

revoke all on function public.admin_record_weekly_contribution(bigint,date,numeric,date,text) from public, anon;
grant execute on function public.admin_record_weekly_contribution(bigint,date,numeric,date,text) to authenticated, service_role;
