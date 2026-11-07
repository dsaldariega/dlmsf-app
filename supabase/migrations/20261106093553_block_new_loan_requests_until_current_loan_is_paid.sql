create or replace function public.submit_loan_request(p_amount numeric, p_months integer)
returns public.loan_requests
language plpgsql
security definer
set search_path = pg_catalog
as $function$
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

  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 500
     or mod(p_amount, 500) <> 0 or p_months is null
     or p_months not in (1,2,3,4,5,6,9,12,18,24) then
    raise exception 'Invalid amount or duration' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(v_mid);

  if exists (
    select 1 from public.loans
    where borrower_id = v_mid and status <> 'Paid'
  ) then
    raise exception 'You already have an ongoing loan. Fully pay your current loan before requesting another one.'
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.loan_requests
    where member_id = v_mid and status = 'Pending'
  ) then
    raise exception 'You already have a pending loan request. Please wait for the administrator to review it.'
      using errcode = '23505';
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
$function$;

revoke all on function public.submit_loan_request(numeric, integer) from public, anon;
grant execute on function public.submit_loan_request(numeric, integer) to authenticated;