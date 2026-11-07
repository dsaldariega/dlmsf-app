
-- Performance: cover the four unindexed foreign keys.
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON public.loan_payments (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_member_id ON public.loan_payments (member_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans (borrower_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments (member_id);

-- Remove anonymous table access. Authenticated application access is retained.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Keep the audit reference counter internal; its trigger function accesses it as its owner.
REVOKE ALL PRIVILEGES ON TABLE public.audit_ref_counters FROM PUBLIC, anon, authenticated, service_role;

-- Restrict helper-function execution. Trigger functions remain attached to their existing triggers.
REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.generate_audit_ref_id() FROM PUBLIC, anon, authenticated, service_role;

-- Harden is_admin's search path without changing its authorization rule.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.members
    WHERE auth_id = auth.uid()
      AND 'admin' = ANY(roles)
  );
$function$;

-- Consolidate overlapping SELECT policies while preserving member-own and admin access.
DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
DROP POLICY IF EXISTS "Members can view own profile" ON public.members;

CREATE POLICY "Members can view own profile or admins can view all"
ON public.members FOR SELECT TO authenticated
USING ((SELECT public.is_admin()) OR ((SELECT auth.uid()) = auth_id));

CREATE POLICY "Admins can insert members"
ON public.members FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update members"
ON public.members FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete members"
ON public.members FOR DELETE TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage loans" ON public.loans;
DROP POLICY IF EXISTS "Members can view own loans" ON public.loans;

CREATE POLICY "Members can view own loans or admins can view all"
ON public.loans FOR SELECT TO authenticated
USING (
  (SELECT public.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = loans.borrower_id
      AND m.auth_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Admins can insert loans"
ON public.loans FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update loans"
ON public.loans FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete loans"
ON public.loans FOR DELETE TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin can view all loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Members can view their own loan payments" ON public.loan_payments;

CREATE POLICY "Members can view own loan payments or admins can view all"
ON public.loan_payments FOR SELECT TO authenticated
USING (
  (SELECT public.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.loans l
    JOIN public.members m ON m.id = l.borrower_id
    WHERE l.id = loan_payments.loan_id
      AND m.auth_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Admins can insert loan payments"
ON public.loan_payments FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update loan payments"
ON public.loan_payments FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete loan payments"
ON public.loan_payments FOR DELETE TO authenticated
USING ((SELECT public.is_admin()));

-- This policy previously targeted PUBLIC; anon is no longer a valid audit-log actor.
ALTER POLICY "Admin can view payments audit log"
ON public.payments_audit_log TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- Optimize remaining admin-only policies by caching the stable function result per statement.
ALTER POLICY "Admin can view audit log"
ON public.loans_audit_log
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

ALTER POLICY "Admins can manage payments"
ON public.payments
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- Serialize all loan inserts and enforce the current dashboard's available-funds formula.
CREATE OR REPLACE FUNCTION public.enforce_loan_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_collected numeric;
  v_outstanding numeric;
  v_available numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(731904, 1);

  IF NEW.amount IS NULL OR NEW.amount < 500 OR mod(NEW.amount, 500) <> 0 THEN
    RAISE EXCEPTION 'Loan amount must be at least PHP 500 and in PHP 500 increments'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.months IS NULL OR NEW.months NOT IN (1, 2, 3, 4, 5, 6, 9, 12, 18, 24) THEN
    RAISE EXCEPTION 'Unsupported loan duration'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.loans l
    WHERE l.borrower_id = NEW.borrower_id
      AND COALESCE(l.status, 'Ongoing') <> 'Paid'
  ) THEN
    RAISE EXCEPTION 'This member already has an outstanding loan'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(sum(p.amount), 0)
  INTO v_collected
  FROM public.payments p;

  SELECT COALESCE(sum(l.amount), 0)
  INTO v_outstanding
  FROM public.loans l
  WHERE COALESCE(l.status, 'Ongoing') <> 'Paid';

  v_available := v_collected - v_outstanding;

  IF NEW.amount > v_available THEN
    RAISE EXCEPTION 'Insufficient available funds. Available: PHP %', v_available
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_loan_eligibility() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_loan_eligibility ON public.loans;
CREATE TRIGGER trg_enforce_loan_eligibility
BEFORE INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_loan_eligibility();

-- Atomic loan creation: loan row and audit row commit or roll back together.
CREATE OR REPLACE FUNCTION public.create_loan(
  p_borrower_id bigint,
  p_amount numeric,
  p_months integer
)
RETURNS public.loans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_loan public.loans;
  v_borrower_name text;
  v_interest numeric(12,2);
  v_total numeric(12,2);
  v_monthly numeric(12,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only authenticated administrators can create loans'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.name
  INTO v_borrower_name
  FROM public.members m
  WHERE m.id = p_borrower_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrower does not exist'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_amount IS NULL OR p_months IS NULL THEN
    RAISE EXCEPTION 'Borrower, amount, and duration are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_interest := round(p_amount * 0.05 * p_months, 2);
  v_total := round(p_amount + v_interest, 2);
  v_monthly := round(v_total / p_months, 2);

  INSERT INTO public.loans (
    borrower_id, amount, interest, total, monthly, months, status
  )
  VALUES (
    p_borrower_id, p_amount, v_interest, v_total, v_monthly, p_months, 'Ongoing'
  )
  RETURNING * INTO v_loan;

  INSERT INTO public.loans_audit_log (
    borrower_name, amount, interest, total, monthly, action, remarks, created_date
  )
  VALUES (
    v_borrower_name,
    v_loan.amount,
    v_loan.interest,
    v_loan.total,
    v_loan.monthly,
    'New Loan Created',
    format('New loan created for %s %s', p_months, CASE WHEN p_months = 1 THEN 'month' ELSE 'months' END),
    CURRENT_DATE
  );

  RETURN v_loan;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_loan(bigint, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan(bigint, numeric, integer) TO authenticated;
