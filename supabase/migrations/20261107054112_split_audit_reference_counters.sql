-- Split loan and payment audit reference sequences while preserving every existing counter.
-- The legacy combined table is retained as a rollback reference and is no longer used by the trigger.

create table if not exists public.audit_ref_loan_counters (
  ref_date date primary key,
  last_number bigint not null default 0 check (last_number >= 0)
);

create table if not exists public.audit_ref_payment_counters (
  ref_date date primary key,
  last_number bigint not null default 0 check (last_number >= 0)
);

alter table public.audit_ref_loan_counters enable row level security;
alter table public.audit_ref_payment_counters enable row level security;

revoke all on table public.audit_ref_loan_counters from public, anon, authenticated;
revoke all on table public.audit_ref_payment_counters from public, anon, authenticated;

insert into public.audit_ref_loan_counters (ref_date, last_number)
select ref_date, last_number
from public.audit_ref_counters
where prefix = 'L'
on conflict (ref_date) do update
set last_number = greatest(public.audit_ref_loan_counters.last_number, excluded.last_number);

insert into public.audit_ref_payment_counters (ref_date, last_number)
select ref_date, last_number
from public.audit_ref_counters
where prefix = 'P'
on conflict (ref_date) do update
set last_number = greatest(public.audit_ref_payment_counters.last_number, excluded.last_number);

create or replace function public.generate_audit_ref_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prefix text;
  v_date date;
  v_number bigint;
begin
  if tg_table_schema <> 'public' then
    raise exception 'Unsupported audit schema';
  end if;

  v_date := coalesce(new.created_date::date, current_date);

  if tg_table_name = 'loans_audit_log' then
    v_prefix := 'L';
    insert into public.audit_ref_loan_counters as counters (ref_date, last_number)
    values (v_date, 1)
    on conflict (ref_date)
    do update set last_number = counters.last_number + 1
    returning last_number into v_number;
  elsif tg_table_name = 'payments_audit_log' then
    v_prefix := 'P';
    insert into public.audit_ref_payment_counters as counters (ref_date, last_number)
    values (v_date, 1)
    on conflict (ref_date)
    do update set last_number = counters.last_number + 1
    returning last_number into v_number;
  else
    raise exception 'Unsupported audit table: %', tg_table_name;
  end if;

  new.ref_id := v_prefix || '-' ||
    to_char(v_date, 'DDMMYYYY') || '-' ||
    lpad(v_number::text, greatest(6, length(v_number::text)), '0');

  return new;
end;
$function$;

revoke all on function public.generate_audit_ref_id() from public, anon, authenticated;

comment on table public.audit_ref_counters is
  'Deprecated combined reference counters. Values were copied to audit_ref_loan_counters and audit_ref_payment_counters; the audit reference trigger no longer reads this table.';
