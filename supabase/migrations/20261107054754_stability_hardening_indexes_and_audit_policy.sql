-- Harden the weekly contribution SECURITY DEFINER functions and reduce avoidable query work.
alter function public.admin_record_weekly_contribution(bigint,date,numeric,date,text)
  set search_path = pg_catalog;
alter function private.guard_member_weekly_submission()
  set search_path = pg_catalog;

-- Cover foreign keys used for joins and parent-row maintenance.
create index if not exists loan_requests_loan_id_idx
  on public.loan_requests (loan_id);
create index if not exists loans_audit_log_member_id_idx
  on public.loans_audit_log (member_id);
create index if not exists payment_submissions_loan_id_idx
  on public.payment_submissions (loan_id);

-- Replace overlapping loan-audit SELECT policies with one equivalent read policy.
-- Admin write access remains limited to administrators.
drop policy if exists "Admin can view audit log" on public.loans_audit_log;
drop policy if exists "Members can view own loan audit rows" on public.loans_audit_log;

create policy "Admins and members can view own loan audit rows"
on public.loans_audit_log
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.members m
    where m.id = loans_audit_log.member_id
      and m.auth_id = (select auth.uid())
  )
);

create policy "Admins can insert loan audit rows"
on public.loans_audit_log
for insert to authenticated
with check ((select private.is_admin()));

create policy "Admins can update loan audit rows"
on public.loans_audit_log
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete loan audit rows"
on public.loans_audit_log
for delete to authenticated
using ((select private.is_admin()));
