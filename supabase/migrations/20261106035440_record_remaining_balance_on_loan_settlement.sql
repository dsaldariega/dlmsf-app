
CREATE OR REPLACE FUNCTION public.record_full_loan_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
BEGIN
  IF NEW.status = 'Paid' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT COALESCE(sum(lp.amount), 0)
    INTO v_paid
    FROM public.loan_payments lp
    WHERE lp.loan_id = NEW.id;

    v_remaining := GREATEST(COALESCE(NEW.total, 0) - v_paid, 0);

    IF v_remaining > 0 THEN
      INSERT INTO public.loan_payments (loan_id, member_id, amount, paid_at)
      VALUES (NEW.id, NEW.borrower_id, v_remaining, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
