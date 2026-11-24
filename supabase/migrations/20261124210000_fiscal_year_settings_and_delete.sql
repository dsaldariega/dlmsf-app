-- Atomic fiscal-year settings updates and explicit full fiscal-year deletion.
-- All destructive work is scoped to the selected FY and is protected by an exact phrase.

-- Some transaction tables were originally granted read-only access to authenticated users.
-- Add narrowly-scoped administrator delete policies; do not bypass RLS in the RPCs.
grant delete on table public.loan_request_audit_events, public.loan_requests,
  public.payment_submissions, public.weekly_contribution_allocations to authenticated;

drop policy if exists "Admins can delete loan request audit events" on public.loan_request_audit_events;
create policy "Admins can delete loan request audit events" on public.loan_request_audit_events
  for delete to authenticated using ((select private.is_admin()));
drop policy if exists "Admins can delete loan requests" on public.loan_requests;
create policy "Admins can delete loan requests" on public.loan_requests
  for delete to authenticated using ((select private.is_admin()));
drop policy if exists "Admins can delete payment submissions" on public.payment_submissions;
create policy "Admins can delete payment submissions" on public.payment_submissions
  for delete to authenticated using ((select private.is_admin()));
drop policy if exists "Admins can delete weekly contribution allocations" on public.weekly_contribution_allocations;
create policy "Admins can delete weekly contribution allocations" on public.weekly_contribution_allocations
  for delete to authenticated using ((select private.is_admin()));

create or replace function public.update_fiscal_year_settings(p_fiscal_year_id bigint, p_settings jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_fy public.fiscal_years; v_tier_count integer;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Only authenticated administrators can update fiscal-year settings' using errcode = '42501'; end if;
  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id for update;
  if not found then raise exception 'Fiscal year not found'; end if;
  if v_fy.status <> 'draft' then raise exception 'Only draft fiscal years can be edited. Activated and closed fiscal years are preserved as historical snapshots'; end if;
  if coalesce(trim(p_settings->>'code'), '') = '' or length(trim(p_settings->>'code')) > 40 then raise exception 'Enter a valid fiscal year code'; end if;
  if (p_settings->>'startDate') is null or (p_settings->>'endDate') is null then raise exception 'Fiscal year start and end dates are required'; end if;
  if (p_settings->>'startDate')::date > (p_settings->>'endDate')::date then raise exception 'Fiscal year start date must be on or before its end date'; end if;
  if coalesce((p_settings->>'retentionMonths')::integer, 0) not between 3 and 60 then raise exception 'Retention months must be between 3 and 60'; end if;
  update public.fiscal_years set code = trim(p_settings->>'code'), start_date = (p_settings->>'startDate')::date,
    end_date = (p_settings->>'endDate')::date, max_total_heads = nullif(p_settings->>'maxTotalHeads', '')::integer,
    retention_months = (p_settings->>'retentionMonths')::integer where id = p_fiscal_year_id;
  if jsonb_typeof(p_settings->'tiers') <> 'array' then raise exception 'Tier settings are required'; end if;
  select count(*) into v_tier_count from jsonb_to_recordset(p_settings->'tiers') as t(
    "tierCode" text, "displayName" text, enabled boolean, "maxHeadsPerMember" integer, "loanEligible" boolean, "loanLimitMode" text
  );
  if v_tier_count <> 3 then raise exception 'Bronze, Silver, and Gold tier settings are required'; end if;
  update public.tier_settings ts set display_name = t."displayName", enabled = true,
    max_heads_per_member = t."maxHeadsPerMember", loan_eligible = t."loanEligible", loan_limit_mode = t."loanLimitMode"
  from jsonb_to_recordset(p_settings->'tiers') as t(
    "tierCode" text, "displayName" text, enabled boolean, "maxHeadsPerMember" integer, "loanEligible" boolean, "loanLimitMode" text
  ) where ts.fiscal_year_id = p_fiscal_year_id and ts.tier_code = lower(t."tierCode");
  get diagnostics v_tier_count = row_count;
  if v_tier_count <> 3 then raise exception 'All three fiscal-year tiers must exist and be updated'; end if;
  return jsonb_build_object('fiscal_year_id', p_fiscal_year_id, 'updated_tiers', v_tier_count);
end;
$$;
revoke all on function public.update_fiscal_year_settings(bigint,jsonb) from public, anon;
grant execute on function public.update_fiscal_year_settings(bigint,jsonb) to authenticated;

create or replace function public.delete_fiscal_year(p_fiscal_year_id bigint, p_confirmation text)
returns jsonb language plpgsql set search_path = '' as $$
declare v_fy public.fiscal_years; v_counts jsonb := '{}'::jsonb; v_deleted integer;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Only authenticated administrators can delete a fiscal year' using errcode = '42501'; end if;
  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id for update;
  if not found then raise exception 'Fiscal year not found'; end if;
  if p_confirmation <> 'DELETE FY ' || v_fy.code then raise exception 'Delete confirmation phrase does not match'; end if;
  delete from public.loan_request_audit_events where fiscal_year_id = p_fiscal_year_id
    or loan_request_id in (select id from public.loan_requests where fiscal_year_id = p_fiscal_year_id);
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('loan_request_audit_events', v_deleted);
  delete from public.payment_submissions where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('payment_submissions', v_deleted);
  delete from public.loan_requests where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('loan_requests', v_deleted);
  delete from public.weekly_contribution_allocations where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('weekly_contribution_allocations', v_deleted);
  delete from public.payments where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('payments', v_deleted);
  delete from public.loan_payments where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('loan_payments', v_deleted);
  delete from public.loans_audit_log where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('loans_audit_log', v_deleted);
  delete from public.payments_audit_log where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('payments_audit_log', v_deleted);
  -- Repayments linked to an FY-originated loan cascade with that loan, even if received in a later FY.
  delete from public.loans where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('loans', v_deleted);
  delete from public.member_fiscal_years where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('member_fiscal_years', v_deleted);
  delete from public.tier_settings where fiscal_year_id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count; v_counts := v_counts || jsonb_build_object('tier_settings', v_deleted);
  delete from public.fiscal_years where id = p_fiscal_year_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'Fiscal year could not be deleted'; end if;
  return jsonb_build_object('fiscal_year_code', v_fy.code, 'deleted', v_counts, 'fiscal_year_deleted', true);
end;
$$;
revoke all on function public.delete_fiscal_year(bigint,text) from public, anon;
grant execute on function public.delete_fiscal_year(bigint,text) to authenticated;
