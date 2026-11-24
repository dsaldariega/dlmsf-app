-- Make FY-specific member head assignments authoritative for weekly contribution workflows.
-- Existing members receive a default assignment when their FY is activated.
create or replace function public.assign_members_to_fiscal_year_on_activation()
returns trigger language plpgsql set search_path = '' as $$
declare v_tier_code text;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select tier_code into v_tier_code from public.tier_settings
    where fiscal_year_id = new.id and enabled
    order by case tier_code when 'bronze' then 1 when 'silver' then 2 when 'gold' then 3 else 4 end limit 1;
    if v_tier_code is null then raise exception 'Enable at least one membership tier before activating this fiscal year'; end if;
    insert into public.member_fiscal_years(fiscal_year_id,member_id,tier_code,assigned_heads)
    select new.id,m.id,v_tier_code,coalesce(m.heads,1) from public.members m
    on conflict (fiscal_year_id,member_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists fiscal_year_assign_existing_members on public.fiscal_years;
create trigger fiscal_year_assign_existing_members after update of status on public.fiscal_years
for each row execute function public.assign_members_to_fiscal_year_on_activation();

create or replace function public.admin_record_weekly_contribution(
  p_member_id bigint,p_week_start date,p_amount numeric,p_paid_on date default current_date,p_reference text default null
) returns public.payment_submissions
language plpgsql security definer set search_path = 'pg_catalog','public','private','auth' as $$
declare
  v_member public.members; v_heads integer; v_fy_id bigint;
  v_paid numeric(12,2); v_due numeric(12,2); v_submission public.payment_submissions;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_member_id is null or p_week_start is null or extract(dow from p_week_start)<>0 then raise exception 'Choose a valid member and Sunday collection week' using errcode='22023'; end if;
  if p_amount is null or p_amount='NaN'::numeric or p_amount<=0 then raise exception 'Contribution amount must be greater than zero' using errcode='22023'; end if;
  if p_paid_on is null or p_paid_on>current_date then raise exception 'Payment date cannot be in the future' using errcode='22023'; end if;
  v_fy_id:=public.require_active_fiscal_year_id(p_week_start);
  perform pg_advisory_xact_lock(hashtextextended('weekly-contribution:'||p_member_id::text||':'||p_week_start::text,0));
  select * into v_member from public.members where id=p_member_id;
  if not found then raise exception 'Member not found' using errcode='P0002'; end if;
  select assigned_heads into v_heads from public.member_fiscal_years where fiscal_year_id=v_fy_id and member_id=p_member_id;
  if not found then raise exception 'Assign this member to the active fiscal year before recording contributions' using errcode='22023'; end if;
  v_due:=coalesce(v_heads,0)*50;
  select coalesce(sum(amount),0) into v_paid from public.weekly_contribution_allocations
  where member_id=p_member_id and week_start=p_week_start and fiscal_year_id=v_fy_id;
  if v_due<=0 then raise exception 'Member weekly contribution is not configured' using errcode='22023'; end if;
  if p_amount>v_due-v_paid then raise exception 'Amount exceeds the remaining weekly contribution of PHP %',greatest(v_due-v_paid,0) using errcode='22023'; end if;
  insert into public.payment_submissions(member_id,payment_type,amount,paid_on,week_start,reference,status,submitted_at,reviewed_at,reviewed_by,admin_remarks,fiscal_year_id)
  values(p_member_id,'Weekly',p_amount,p_paid_on,p_week_start,nullif(trim(coalesce(p_reference,'')),''),'Confirmed',now(),now(),auth.uid(),'Recorded directly by administrator.',v_fy_id)
  returning * into v_submission;
  insert into public.weekly_contribution_allocations(payment_submission_id,member_id,week_start,amount,fiscal_year_id)
  values(v_submission.id,p_member_id,p_week_start,p_amount,v_fy_id);
  insert into public.payments_audit_log(member_id,amount,week_start,action,remarks,created_date,fiscal_year_id)
  values(p_member_id,p_amount,p_week_start,'Weekly Contribution Recorded',format('%s paid weekly dues of PHP %s.',v_member.name,to_char(p_amount,'FM999,999,990')),now(),v_fy_id);
  return v_submission;
end;
$$;
revoke execute on function public.admin_record_weekly_contribution(bigint,date,numeric,date,text) from public,anon;
grant execute on function public.admin_record_weekly_contribution(bigint,date,numeric,date,text) to authenticated;

create or replace function public.admin_generate_all_weekly_contributions(p_week_start date,p_paid_on date default current_date)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth' as $$
declare
  v_member record; v_fy_id bigint; v_due numeric(12,2); v_paid numeric(12,2);
  v_remaining numeric(12,2); v_submission public.payment_submissions;
  v_members_updated integer:=0; v_total_generated numeric(12,2):=0;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_week_start is null or extract(dow from p_week_start)<>0 then raise exception 'Choose a valid Sunday collection week' using errcode='22023'; end if;
  if p_paid_on is null or p_paid_on>current_date then raise exception 'Payment date cannot be in the future' using errcode='22023'; end if;
  v_fy_id:=public.require_active_fiscal_year_id(p_week_start);
  perform pg_advisory_xact_lock(hashtextextended('weekly-contribution-all:'||p_week_start::text,0));
  if exists(select 1 from public.members m where not exists(select 1 from public.member_fiscal_years a where a.member_id=m.id and a.fiscal_year_id=v_fy_id)) then
    raise exception 'Assign every member to the active fiscal year before generating weekly contributions';
  end if;
  for v_member in select m.id,m.name,a.assigned_heads from public.members m
    join public.member_fiscal_years a on a.member_id=m.id and a.fiscal_year_id=v_fy_id order by m.id
  loop
    v_due:=coalesce(v_member.assigned_heads,0)*50;
    select coalesce(sum(amount),0) into v_paid from public.weekly_contribution_allocations
    where member_id=v_member.id and week_start=p_week_start and fiscal_year_id=v_fy_id;
    v_remaining:=greatest(v_due-v_paid,0);
    if v_remaining>0 then
      insert into public.payment_submissions(member_id,payment_type,amount,paid_on,week_start,reference,status,submitted_at,reviewed_at,reviewed_by,admin_remarks,fiscal_year_id)
      values(v_member.id,'Weekly',v_remaining,p_paid_on,p_week_start,'Generated for all members','Confirmed',now(),now(),auth.uid(),'Generated by administrator for the full weekly collection.',v_fy_id)
      returning * into v_submission;
      insert into public.weekly_contribution_allocations(payment_submission_id,member_id,week_start,amount,fiscal_year_id)
      values(v_submission.id,v_member.id,p_week_start,v_remaining,v_fy_id);
      insert into public.payments_audit_log(member_id,amount,week_start,action,remarks,created_date,fiscal_year_id)
      values(v_member.id,v_remaining,p_week_start,'Weekly Contribution Recorded',format('%s paid weekly dues of PHP %s.',v_member.name,to_char(v_remaining,'FM999,999,990')),now(),v_fy_id);
      v_members_updated:=v_members_updated+1; v_total_generated:=v_total_generated+v_remaining;
    end if;
  end loop;
  return jsonb_build_object('weekStart',p_week_start,'fiscalYearId',v_fy_id,'membersUpdated',v_members_updated,'totalGenerated',v_total_generated);
end;
$$;
revoke execute on function public.admin_generate_all_weekly_contributions(date,date) from public,anon;
grant execute on function public.admin_generate_all_weekly_contributions(date,date) to authenticated;
