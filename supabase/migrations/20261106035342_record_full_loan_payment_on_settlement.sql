
CREATE OR REPLACE FUNCTION public.record_full_loan_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status = 'Paid' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.loan_payments (loan_id, member_id, amount, paid_at)
    SELECT NEW.id, NEW.borrower_id, NEW.total, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.loan_payments lp WHERE lp.loan_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.record_full_loan_payment() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_record_full_loan_payment ON public.loans;
CREATE TRIGGER trg_record_full_loan_payment
AFTER UPDATE OF status ON public.loans
FOR EACH ROW
WHEN (NEW.status = 'Paid' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.record_full_loan_payment();
