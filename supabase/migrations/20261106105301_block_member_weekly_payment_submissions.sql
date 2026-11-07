
create or replace function private.guard_member_weekly_submission()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if new.payment_type = 'Weekly' and not private.is_admin() then
    raise exception 'Weekly contributions are recorded by administrators. Please contact an administrator.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_member_weekly_submission_trigger on public.payment_submissions;
create trigger guard_member_weekly_submission_trigger
before insert on public.payment_submissions
for each row execute function private.guard_member_weekly_submission();

revoke all on function private.guard_member_weekly_submission() from public, anon, authenticated;
