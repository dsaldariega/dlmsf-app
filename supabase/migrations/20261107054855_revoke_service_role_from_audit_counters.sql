-- Counter tables are used only by the SECURITY DEFINER trigger owned by postgres.
-- The service-role key is not needed for direct counter-table access.
revoke all on table public.audit_ref_counters from public, anon, authenticated, service_role;
revoke all on table public.audit_ref_loan_counters from public, anon, authenticated, service_role;
revoke all on table public.audit_ref_payment_counters from public, anon, authenticated, service_role;
