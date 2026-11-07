-- SECURITY DEFINER trigger uses fully qualified references; remove user-writable schemas from its search path.
alter function private.capture_loan_request_audit_event()
  set search_path = pg_catalog;
