
CREATE OR REPLACE FUNCTION public.serialize_fund_balance_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(731904, 1);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.serialize_fund_balance_mutations() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_serialize_payment_balance_mutations ON public.payments;
CREATE TRIGGER trg_serialize_payment_balance_mutations
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.serialize_fund_balance_mutations();

DROP TRIGGER IF EXISTS trg_serialize_loan_balance_updates ON public.loans;
CREATE TRIGGER trg_serialize_loan_balance_updates
BEFORE UPDATE OF amount, status, borrower_id ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.serialize_fund_balance_mutations();
