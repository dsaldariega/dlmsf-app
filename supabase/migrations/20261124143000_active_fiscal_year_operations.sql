-- Fiscal years are explicitly activated on creation. Operational access is governed by
-- the active status rather than whether today's date falls inside the configured period.

create or replace function public.require_active_fiscal_year_id(p_business_date date)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_id bigint;
begin
  select id into v_id
  from public.fiscal_years
  where status = 'active'
  order by id desc
  limit 1;
  if v_id is null then
    raise exception 'No active fiscal year is configured' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

create or replace function private.active_member_loan_limit(p_member_id bigint)
returns table(active boolean, eligible boolean, limit_amount numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_fy public.fiscal_years;
  v_assignment public.member_fiscal_years;
  v_tier public.tier_settings;
  v_paid numeric := 0;
  v_limit numeric := 0;
begin
  select * into v_fy from public.fiscal_years
  where status = 'active'
  order by id desc limit 1;
  if not found then return query select false, true, null::numeric; return; end if;

  select * into v_assignment from public.member_fiscal_years
  where fiscal_year_id = v_fy.id and member_id = p_member_id;
  if not found then return query select true, false, 0::numeric; return; end if;

  select * into v_tier from public.tier_settings
  where fiscal_year_id = v_fy.id and tier_code = v_assignment.tier_code;
  if not found or not v_tier.enabled or not v_tier.loan_eligible then
    return query select true, false, 0::numeric; return;
  end if;

  if v_tier.loan_limit_mode = 'member_contribution' then
    select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
    where wca.member_id = p_member_id and wca.fiscal_year_id = v_fy.id;
  else
    select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
    where wca.fiscal_year_id = v_fy.id;
  end if;
  v_limit := v_paid;
  return query select true, true, greatest(v_limit,0);
end;
$$;

create or replace function public.submit_loan_request(p_amount numeric, p_months integer)
returns public.loan_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid bigint;
  v_fy public.fiscal_years;
  v_tier public.tier_settings;
  v_assignment public.member_fiscal_years;
  v_paid numeric := 0;
  v_member_limit numeric := 0;
  v_available numeric := 0;
  v_req public.loan_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select id into v_mid from public.members
  where auth.uid() = members.auth_id and 'member' = any(roles) limit 1;
  if v_mid is null then raise exception 'Member profile not found' using errcode = '42501'; end if;

  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 500 or mod(p_amount, 500) <> 0
     or p_months is null or p_months not in (1,2,3,4,5,6,9,12,18,24) then
    raise exception 'Invalid amount or duration' using errcode = '22023';
  end if;

  select * into v_fy from public.fiscal_years
  where status = 'active'
  order by id desc limit 1;
  if not found then raise exception 'No active fiscal year is configured for loan requests' using errcode = '22023'; end if;

  select * into v_assignment from public.member_fiscal_years
  where fiscal_year_id = v_fy.id and member_id = v_mid;
  if not found then raise exception 'You have not been assigned a membership tier for the active fiscal year' using errcode = '22023'; end if;

  select * into v_tier from public.tier_settings
  where fiscal_year_id = v_fy.id and tier_code = v_assignment.tier_code;
  if not found or not v_tier.enabled then raise exception 'Your membership tier is not available for the active fiscal year' using errcode = '22023'; end if;
  if not v_tier.loan_eligible then raise exception 'Your membership tier is not eligible for loans in the active fiscal year' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(v_mid);
  if exists (select 1 from public.loans where borrower_id = v_mid and status <> 'Paid') then
    raise exception 'You already have an ongoing loan. Fully pay your current loan before requesting another one.' using errcode = '23505';
  end if;
  if exists (select 1 from public.loan_requests where member_id = v_mid and status = 'Pending') then
    raise exception 'You already have a pending loan request. Please wait for the administrator to review it.' using errcode = '23505';
  end if;

  if v_tier.loan_limit_mode = 'member_contribution' then
    select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
    where wca.member_id = v_mid and wca.fiscal_year_id = v_fy.id;
  else
    select coalesce(sum(wca.amount),0) into v_paid from public.weekly_contribution_allocations wca
    where wca.fiscal_year_id = v_fy.id;
  end if;
  v_member_limit := v_paid;
  if p_amount > greatest(v_member_limit, 0) then
    raise exception 'Requested amount exceeds the % tier loan limit of % based on the selected contribution basis', v_tier.display_name, v_member_limit using errcode = '22023';
  end if;

  v_available := private.available_fund_balance();
  if p_amount > greatest(v_available, 0) then
    raise exception 'Requested amount exceeds available sinking fund balance' using errcode = '22023';
  end if;

  insert into public.loan_requests(member_id, amount, months, fiscal_year_id)
  values (v_mid, p_amount, p_months, v_fy.id)
  returning * into v_req;
  return v_req;
end;
$$;
