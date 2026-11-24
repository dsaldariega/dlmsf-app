-- Standardize loan limits across Bronze, Silver, and Gold.
-- Member contribution = the individual borrower's paid FY contributions.
-- Total contribution = all paid FY contributions collected across the fiscal year.
alter table public.tier_settings drop constraint if exists tier_settings_loan_limit_mode_check;
update public.tier_settings
set loan_limit_mode = case
  when loan_limit_mode = 'contributions_only' then 'member_contribution'
  else 'total_contribution'
end,
contribution_multiplier = 1,
max_loan_amount = null;
alter table public.tier_settings
  add constraint tier_settings_loan_limit_mode_check
  check (loan_limit_mode in ('member_contribution', 'total_contribution'));

create or replace function public.validate_member_fiscal_year_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fy public.fiscal_years;
  v_tier public.tier_settings;
  v_total integer;
begin
  select * into v_fy from public.fiscal_years where id = new.fiscal_year_id;
  if not found then raise exception 'Fiscal year not found'; end if;

  select * into v_tier from public.tier_settings
    where fiscal_year_id = new.fiscal_year_id and tier_code = new.tier_code;
  if not found then raise exception 'Tier setting not found for this fiscal year'; end if;
  if not v_tier.enabled then raise exception 'The selected tier is disabled for this fiscal year'; end if;

  if v_tier.max_heads_per_member is not null and new.assigned_heads > v_tier.max_heads_per_member then
    raise exception 'Assigned heads exceed the % tier maximum of %', v_tier.display_name, v_tier.max_heads_per_member;
  end if;

  if v_fy.max_total_heads is not null then
    select coalesce(sum(assigned_heads),0) into v_total
    from public.member_fiscal_years
    where fiscal_year_id = new.fiscal_year_id and id <> coalesce(new.id, 0);
    if v_total + new.assigned_heads > v_fy.max_total_heads then
      raise exception 'Total assigned heads would exceed the fiscal year limit of %', v_fy.max_total_heads;
    end if;
  end if;
  return new;
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
  where status = 'active' and current_date between start_date and end_date
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
    select coalesce(sum(wca.amount),0) into v_paid
    from public.weekly_contribution_allocations wca
    where wca.member_id = p_member_id and wca.fiscal_year_id = v_fy.id;
  else
    select coalesce(sum(wca.amount),0) into v_paid
    from public.weekly_contribution_allocations wca
    where wca.fiscal_year_id = v_fy.id;
  end if;
  v_limit := v_paid;

  return query select true, true, greatest(v_limit,0);
end;
$$;

revoke execute on function private.active_member_loan_limit(bigint) from public, anon, authenticated;

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
  where status = 'active' and current_date between start_date and end_date
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
    select coalesce(sum(wca.amount),0) into v_paid
    from public.weekly_contribution_allocations wca
    where wca.member_id = v_mid and wca.fiscal_year_id = v_fy.id;
  else
    select coalesce(sum(wca.amount),0) into v_paid
    from public.weekly_contribution_allocations wca
    where wca.fiscal_year_id = v_fy.id;
  end if;
  v_member_limit := v_paid;

  if p_amount > greatest(v_member_limit, 0) then
    raise exception 'Requested amount exceeds the % tier loan limit of % based on paid contributions and tier settings', v_tier.display_name, v_member_limit using errcode = '22023';
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

revoke execute on function public.submit_loan_request(numeric,integer) from public, anon;
grant execute on function public.submit_loan_request(numeric,integer) to authenticated;
