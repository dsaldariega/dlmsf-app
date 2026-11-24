-- Fiscal Year attribution for every financial workflow.
-- Transactions are assigned by their business date, never by the current calendar year.

alter table public.loans
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.loan_payments add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.loan_requests add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.payment_submissions add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.weekly_contribution_allocations add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.payments add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.loans_audit_log add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.payments_audit_log add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;
alter table public.loan_request_audit_events add column if not exists fiscal_year_id bigint references public.fiscal_years(id) on delete restrict;

alter table public.payments_audit_log alter column week_start drop not null;

create index if not exists loans_fiscal_year_idx on public.loans(fiscal_year_id);
create index if not exists loan_payments_fiscal_year_idx on public.loan_payments(fiscal_year_id);
create index if not exists loan_requests_fiscal_year_idx on public.loan_requests(fiscal_year_id);
create index if not exists payment_submissions_fiscal_year_idx on public.payment_submissions(fiscal_year_id);
create index if not exists weekly_allocations_fiscal_year_idx on public.weekly_contribution_allocations(fiscal_year_id);
create index if not exists payments_fiscal_year_idx on public.payments(fiscal_year_id);
create index if not exists loans_audit_fiscal_year_idx on public.loans_audit_log(fiscal_year_id);
create index if not exists payments_audit_fiscal_year_idx on public.payments_audit_log(fiscal_year_id);
create index if not exists loan_request_events_fiscal_year_idx on public.loan_request_audit_events(fiscal_year_id);

create or replace function public.validate_fiscal_year_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.start_date > new.end_date then raise exception 'Fiscal year start date must be on or before its end date'; end if;
  if new.status <> 'draft' and exists (
    select 1 from public.fiscal_years fy
    where fy.id <> coalesce(new.id, 0) and fy.status <> 'draft'
      and daterange(fy.start_date, fy.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then raise exception 'Activated fiscal-year date ranges cannot overlap'; end if;
  return new;
end; $$;

drop trigger if exists fiscal_year_period_guard on public.fiscal_years;
create trigger fiscal_year_period_guard before insert or update of start_date, end_date, status
on public.fiscal_years for each row execute function public.validate_fiscal_year_period();

create or replace function public.require_active_fiscal_year_id(p_business_date date)
returns bigint language plpgsql stable set search_path = '' as $$
declare v_id bigint;
begin
  if p_business_date is null then raise exception 'A business date is required to determine the fiscal year'; end if;
  select id into v_id from public.fiscal_years
  where status = 'active' and p_business_date between start_date and end_date limit 1;
  if v_id is null then
    raise exception 'No active fiscal year covers business date %', p_business_date using errcode = '22023';
  end if;
  return v_id;
end; $$;

create or replace function public.set_transaction_fiscal_year()
returns trigger language plpgsql set search_path = '' as $$
declare v_date date; v_related_fy bigint;
begin
  if tg_table_name = 'loans' then v_date := new.created_at::date;
  elsif tg_table_name = 'loan_payments' then v_date := new.paid_at;
  elsif tg_table_name = 'loan_requests' then v_date := new.requested_at::date;
  elsif tg_table_name = 'payment_submissions' then
    v_date := case when new.payment_type = 'Weekly' then new.week_start else new.paid_on end;
  elsif tg_table_name = 'weekly_contribution_allocations' then v_date := new.week_start;
  elsif tg_table_name = 'payments' then v_date := new.week_start;
  elsif tg_table_name = 'loans_audit_log' then
    if new.fiscal_year_id is null and new.action = 'New Loan Created' then
      select fiscal_year_id into v_related_fy from public.loans
      where borrower_id = new.member_id and amount = new.amount
      order by created_at desc limit 1;
      if v_related_fy is not null then new.fiscal_year_id := v_related_fy; end if;
    end if;
    v_date := new.created_date;
  elsif tg_table_name = 'payments_audit_log' then
    if new.fiscal_year_id is null and new.action = 'Loan Payment Recorded' then
      select fiscal_year_id into v_related_fy from public.loan_payments
      where member_id = new.member_id and amount = new.amount
      order by created_at desc limit 1;
      if v_related_fy is not null then new.fiscal_year_id := v_related_fy; end if;
    end if;
    v_date := coalesce(new.week_start, new.created_date::date);
  elsif tg_table_name = 'loan_request_audit_events' then
    select fiscal_year_id into v_related_fy from public.loan_requests where id = new.loan_request_id;
    if new.fiscal_year_id is null and v_related_fy is not null then new.fiscal_year_id := v_related_fy; end if;
    v_date := new.created_at::date;
  else raise exception 'Fiscal year trigger is not configured for table %', tg_table_name;
  end if;
  if new.fiscal_year_id is null then new.fiscal_year_id := public.require_active_fiscal_year_id(v_date); end if;
  return new;
end; $$;

drop trigger if exists loans_set_fiscal_year on public.loans;
create trigger loans_set_fiscal_year before insert or update of created_at on public.loans
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists loan_payments_set_fiscal_year on public.loan_payments;
create trigger loan_payments_set_fiscal_year before insert or update of paid_at on public.loan_payments
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists loan_requests_set_fiscal_year on public.loan_requests;
create trigger loan_requests_set_fiscal_year before insert or update of requested_at on public.loan_requests
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists payment_submissions_set_fiscal_year on public.payment_submissions;
create trigger payment_submissions_set_fiscal_year before insert or update of payment_type, paid_on, week_start on public.payment_submissions
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists weekly_allocations_set_fiscal_year on public.weekly_contribution_allocations;
create trigger weekly_allocations_set_fiscal_year before insert or update of week_start on public.weekly_contribution_allocations
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists payments_set_fiscal_year on public.payments;
create trigger payments_set_fiscal_year before insert or update of week_start on public.payments
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists loans_audit_set_fiscal_year on public.loans_audit_log;
create trigger loans_audit_set_fiscal_year before insert or update of created_date on public.loans_audit_log
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists payments_audit_set_fiscal_year on public.payments_audit_log;
create trigger payments_audit_set_fiscal_year before insert or update of week_start, created_date on public.payments_audit_log
for each row execute function public.set_transaction_fiscal_year();
drop trigger if exists loan_request_events_set_fiscal_year on public.loan_request_audit_events;
create trigger loan_request_events_set_fiscal_year before insert or update of created_at on public.loan_request_audit_events
for each row execute function public.set_transaction_fiscal_year();

create or replace function public.assign_new_member_to_active_fiscal_year()
returns trigger language plpgsql set search_path = '' as $$
declare v_fy_id bigint; v_tier_code text;
begin
  select id into v_fy_id from public.fiscal_years
  where status = 'active' and current_date between start_date and end_date order by id desc limit 1;
  if v_fy_id is null then return new; end if;
  select tier_code into v_tier_code from public.tier_settings
  where fiscal_year_id = v_fy_id and enabled
  order by case tier_code when 'bronze' then 1 when 'silver' then 2 when 'gold' then 3 else 4 end limit 1;
  if v_tier_code is null then raise exception 'The active fiscal year has no enabled membership tier'; end if;
  insert into public.member_fiscal_years(fiscal_year_id, member_id, tier_code, assigned_heads)
  values (v_fy_id, new.id, v_tier_code, coalesce(new.heads, 1));
  return new;
end; $$;

drop trigger if exists members_auto_fiscal_year_assignment on public.members;
create trigger members_auto_fiscal_year_assignment after insert on public.members
for each row execute function public.assign_new_member_to_active_fiscal_year();

create or replace function private.active_member_loan_limit(p_member_id bigint)
returns table(active boolean, eligible boolean, limit_amount numeric)
language plpgsql stable set search_path = '' as $$
declare v_fy public.fiscal_years; v_assignment public.member_fiscal_years; v_tier public.tier_settings;
  v_paid numeric := 0; v_limit numeric := 0;
begin
  select * into v_fy from public.fiscal_years
  where status = 'active' and current_date between start_date and end_date order by id desc limit 1;
  if not found then return query select false, true, null::numeric; return; end if;
  select * into v_assignment from public.member_fiscal_years where fiscal_year_id = v_fy.id and member_id = p_member_id;
  if not found then return query select true, false, 0::numeric; return; end if;
  select * into v_tier from public.tier_settings where fiscal_year_id = v_fy.id and tier_code = v_assignment.tier_code;
  if not found or not v_tier.enabled or not v_tier.loan_eligible then return query select true, false, 0::numeric; return; end if;
  select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
  where wca.member_id = p_member_id and wca.fiscal_year_id = v_fy.id;
  if v_tier.loan_limit_mode = 'contributions_only' then v_limit := v_paid;
  elsif v_tier.loan_limit_mode = 'tier_maximum' then
    v_limit := v_paid * v_tier.contribution_multiplier;
    if v_tier.max_loan_amount is not null then v_limit := least(v_limit, v_tier.max_loan_amount); end if;
  else v_limit := coalesce(v_tier.max_loan_amount, 999999999999); end if;
  return query select true, true, greatest(v_limit,0);
end; $$;

revoke execute on function private.active_member_loan_limit(bigint) from public, anon, authenticated;

create or replace function public.submit_loan_request(p_amount numeric, p_months integer)
returns public.loan_requests language plpgsql security definer set search_path = '' as $$
declare v_mid bigint; v_fy public.fiscal_years; v_tier public.tier_settings;
  v_assignment public.member_fiscal_years; v_paid numeric := 0; v_member_limit numeric := 0;
  v_available numeric := 0; v_req public.loan_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_mid from public.members where auth_id = auth.uid() and 'member' = any(roles) limit 1;
  if v_mid is null then raise exception 'Member profile not found' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 500 or mod(p_amount, 500) <> 0
     or p_months is null or p_months not in (1,2,3,4,5,6,9,12,18,24) then
    raise exception 'Invalid amount or duration' using errcode = '22023';
  end if;
  select * into v_fy from public.fiscal_years
  where status = 'active' and current_date between start_date and end_date order by id desc limit 1;
  if not found then raise exception 'No active fiscal year is configured for loan requests' using errcode = '22023'; end if;
  select * into v_assignment from public.member_fiscal_years where fiscal_year_id = v_fy.id and member_id = v_mid;
  if not found then raise exception 'You have not been assigned a membership tier for the active fiscal year' using errcode = '22023'; end if;
  select * into v_tier from public.tier_settings where fiscal_year_id = v_fy.id and tier_code = v_assignment.tier_code;
  if not found or not v_tier.enabled then raise exception 'Your membership tier is not available for the active fiscal year' using errcode = '22023'; end if;
  if not v_tier.loan_eligible then raise exception 'Your membership tier is not eligible for loans in the active fiscal year' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(v_mid);
  if exists (select 1 from public.loans where borrower_id = v_mid and status <> 'Paid') then
    raise exception 'You already have an ongoing loan. Fully pay your current loan before requesting another one.' using errcode = '23505';
  end if;
  if exists (select 1 from public.loan_requests where member_id = v_mid and status = 'Pending') then
    raise exception 'You already have a pending loan request. Please wait for the administrator to review it.' using errcode = '23505';
  end if;
  select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
  where wca.member_id = v_mid and wca.fiscal_year_id = v_fy.id;
  if v_tier.loan_limit_mode = 'contributions_only' then v_member_limit := v_paid;
  elsif v_tier.loan_limit_mode = 'tier_maximum' then
    v_member_limit := v_paid * v_tier.contribution_multiplier;
    if v_tier.max_loan_amount is not null then v_member_limit := least(v_member_limit, v_tier.max_loan_amount); end if;
  else v_member_limit := coalesce(v_tier.max_loan_amount, 999999999999); end if;
  if p_amount > greatest(v_member_limit, 0) then
    raise exception 'Requested amount exceeds your % tier loan limit of % based on your paid contributions and tier settings', v_tier.display_name, v_member_limit using errcode = '22023';
  end if;
  v_available := private.available_fund_balance();
  if p_amount > greatest(v_available, 0) then raise exception 'Requested amount exceeds available sinking fund balance' using errcode = '22023'; end if;
  insert into public.loan_requests(member_id, amount, months, fiscal_year_id)
  values (v_mid, p_amount, p_months, v_fy.id) returning * into v_req;
  return v_req;
end; $$;

revoke execute on function public.submit_loan_request(numeric,integer) from public, anon;
grant execute on function public.submit_loan_request(numeric,integer) to authenticated;
