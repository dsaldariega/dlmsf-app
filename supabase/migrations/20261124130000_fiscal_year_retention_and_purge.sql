-- Closed fiscal-year retention and explicit, audited cleanup.
alter table public.fiscal_years
  add column if not exists retention_months integer not null default 3,
  add column if not exists closed_at timestamptz,
  add column if not exists exported_at timestamptz,
  add column if not exists purged_at timestamptz,
  add column if not exists purge_summary jsonb;

alter table public.fiscal_years drop constraint if exists fiscal_years_retention_months_check;
alter table public.fiscal_years add constraint fiscal_years_retention_months_check
  check (retention_months between 3 and 60);

update public.fiscal_years
set closed_at = coalesce(closed_at, created_at, now())
where status = 'closed' and closed_at is null;

comment on column public.fiscal_years.retention_months is
  'Transaction retention in months after closure; minimum 3 months.';
comment on column public.fiscal_years.exported_at is
  'Timestamp of the latest successful administrator FY export.';
comment on column public.fiscal_years.purged_at is
  'Timestamp of explicit transaction cleanup; FY metadata is retained.';

create or replace function public.purge_fiscal_year_transactions(
  p_fiscal_year_id bigint,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fy public.fiscal_years;
  v_requests integer := 0;
  v_request_events integer := 0;
  v_submissions integer := 0;
  v_payments integer := 0;
  v_payment_audit integer := 0;
  v_summary jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Only administrators can purge fiscal-year activity' using errcode = '42501';
  end if;

  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id for update;
  if not found then raise exception 'Fiscal year not found'; end if;
  if v_fy.status <> 'closed' then raise exception 'Only a closed fiscal year can be purged'; end if;
  if v_fy.purged_at is not null then raise exception 'This fiscal year has already been purged'; end if;
  if v_fy.exported_at is null then raise exception 'Export this fiscal year before purging it'; end if;
  if v_fy.closed_at is null or now() < v_fy.closed_at + make_interval(months => v_fy.retention_months) then
    raise exception 'The fiscal-year retention period has not expired';
  end if;
  if p_confirmation <> 'PURGE ' || v_fy.code then
    raise exception 'Purge confirmation phrase does not match';
  end if;
  if exists (select 1 from public.loans where lower(coalesce(status,'')) not in ('paid','settled')) then
    raise exception 'Purge blocked: an ongoing loan exists. Settle all active loans before cleanup';
  end if;

  delete from public.loan_request_audit_events e
  where e.loan_request_id in (
    select lr.id from public.loan_requests lr
    where lr.requested_at >= v_fy.start_date::timestamptz
      and lr.requested_at < (v_fy.end_date + 1)::timestamptz
  );
  get diagnostics v_request_events = row_count;

  delete from public.loan_requests
  where requested_at >= v_fy.start_date::timestamptz
    and requested_at < (v_fy.end_date + 1)::timestamptz;
  get diagnostics v_requests = row_count;

  delete from public.payment_submissions
  where (submitted_at >= v_fy.start_date::timestamptz and submitted_at < (v_fy.end_date + 1)::timestamptz)
     or paid_on between v_fy.start_date and v_fy.end_date;
  get diagnostics v_submissions = row_count;

  delete from public.payments
  where week_start between v_fy.start_date and v_fy.end_date;
  get diagnostics v_payments = row_count;

  delete from public.payments_audit_log
  where week_start between v_fy.start_date and v_fy.end_date;
  get diagnostics v_payment_audit = row_count;

  v_summary := jsonb_build_object(
    'loan_requests', v_requests,
    'loan_request_events', v_request_events,
    'payment_submissions', v_submissions,
    'weekly_payments', v_payments,
    'payment_audit_entries', v_payment_audit,
    'loan_contracts_and_repayments_preserved', true
  );

  update public.fiscal_years
  set purged_at = now(), purge_summary = v_summary
  where id = p_fiscal_year_id;

  return v_summary;
end;
$$;

revoke all on function public.purge_fiscal_year_transactions(bigint,text) from public, anon;
grant execute on function public.purge_fiscal_year_transactions(bigint,text) to authenticated;
