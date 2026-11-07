
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
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

REVOKE ALL PRIVILEGES ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- Policies now call the non-API-exposed helper.
DROP POLICY IF EXISTS "Members can view own profile or admins can view all" ON public.members;
DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
DROP POLICY IF EXISTS "Admins can update members" ON public.members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Members can view own profile or admins can view all"
ON public.members FOR SELECT TO authenticated
USING ((SELECT private.is_admin()) OR ((SELECT auth.uid()) = auth_id));
CREATE POLICY "Admins can insert members" ON public.members FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can update members" ON public.members FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can delete members" ON public.members FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Members can view own loans or admins can view all" ON public.loans;
DROP POLICY IF EXISTS "Admins can insert loans" ON public.loans;
DROP POLICY IF EXISTS "Admins can update loans" ON public.loans;
DROP POLICY IF EXISTS "Admins can delete loans" ON public.loans;
CREATE POLICY "Members can view own loans or admins can view all"
ON public.loans FOR SELECT TO authenticated
USING (
 (SELECT private.is_admin())
 OR EXISTS (SELECT 1 FROM public.members m
            WHERE m.id=loans.borrower_id AND m.auth_id=(SELECT auth.uid()))
);
CREATE POLICY "Admins can insert loans" ON public.loans FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can update loans" ON public.loans FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can delete loans" ON public.loans FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Members can view own loan payments or admins can view all" ON public.loan_payments;
DROP POLICY IF EXISTS "Admins can insert loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Admins can update loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Admins can delete loan payments" ON public.loan_payments;
CREATE POLICY "Members can view own loan payments or admins can view all"
ON public.loan_payments FOR SELECT TO authenticated
USING (
 (SELECT private.is_admin())
 OR EXISTS (SELECT 1 FROM public.loans l JOIN public.members m ON m.id=l.borrower_id
            WHERE l.id=loan_payments.loan_id AND m.auth_id=(SELECT auth.uid()))
);
CREATE POLICY "Admins can insert loan payments" ON public.loan_payments FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can update loan payments" ON public.loan_payments FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can delete loan payments" ON public.loan_payments FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

ALTER POLICY "Admins can manage payments" ON public.payments
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
ALTER POLICY "Admin can view audit log" ON public.loans_audit_log
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
ALTER POLICY "Admin can view payments audit log" ON public.payments_audit_log TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));

-- The RPC is callable by authenticated clients but uses their RLS privileges;
-- the table policies above provide the admin authorization and write boundary.
CREATE OR REPLACE FUNCTION public.create_loan(
  p_borrower_id bigint,
  p_amount numeric,
  p_months integer
)
RETURNS public.loans
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_loan public.loans;
  v_borrower_name text;
  v_interest numeric(12,2);
  v_total numeric(12,2);
  v_monthly numeric(12,2);
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only authenticated administrators can create loans'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.name INTO v_borrower_name
  FROM public.members m WHERE m.id = p_borrower_id;
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

  INSERT INTO public.loans (borrower_id, amount, interest, total, monthly, months, status)
  VALUES (p_borrower_id, p_amount, v_interest, v_total, v_monthly, p_months, 'Ongoing')
  RETURNING * INTO v_loan;

  INSERT INTO public.loans_audit_log
    (borrower_name, amount, interest, total, monthly, action, remarks, created_date)
  VALUES (
    v_borrower_name, v_loan.amount, v_loan.interest, v_loan.total, v_loan.monthly,
    'New Loan Created',
    format('New loan created for %s %s', p_months, CASE WHEN p_months = 1 THEN 'month' ELSE 'months' END),
    CURRENT_DATE
  );

  RETURN v_loan;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_loan(bigint, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_loan(bigint, numeric, integer) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.is_admin();
