-- Remove trailing .00 from existing payment-audit remarks.
update public.payments_audit_log
set remarks = regexp_replace(
  regexp_replace(remarks, '(PHP [0-9,]+)\\.00', '\\1', 'g'),
  '(₱[0-9,]+)\\.00',
  '\\1',
  'g'
)
where remarks ~ '(PHP [0-9,]+)\\.00|₱[0-9,]+\\.00';