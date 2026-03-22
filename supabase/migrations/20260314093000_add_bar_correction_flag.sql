ALTER TABLE public.bar_transactions
ADD COLUMN IF NOT EXISTS "Исправление" text NOT NULL DEFAULT 'Нет';

UPDATE public.bar_transactions
SET "Исправление" = 'Нет'
WHERE "Исправление" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bar_transactions_correction_check'
  ) THEN
    ALTER TABLE public.bar_transactions
    ADD CONSTRAINT bar_transactions_correction_check
    CHECK ("Исправление" IN ('Да', 'Нет'));
  END IF;
END $$;
