-- Align member read access for loan repayment history with the member_id relationship.
drop policy if exists "Members can view own loan payments or admins can view all" on public.loan_payments;
drop policy if exists "Members view own loan payments by member ID" on public.loan_payments;
create policy "Members view own loan payments by member ID" on public.loan_payments
for select to authenticated using (
  (select private.is_admin()) or exists (
    select 1 from public.members m
    where m.id = loan_payments.member_id and m.auth_id = (select auth.uid())
  )
);
