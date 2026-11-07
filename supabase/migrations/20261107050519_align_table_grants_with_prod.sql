-- Align dev table privileges with prod.
-- anon must have no direct table access; the app only uses authenticated sessions.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- weekly_contribution_allocations is written only through SECURITY DEFINER RPCs.
revoke insert, update, delete, truncate, references, trigger
  on public.weekly_contribution_allocations from authenticated;