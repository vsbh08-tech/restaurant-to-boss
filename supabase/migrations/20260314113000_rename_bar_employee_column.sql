DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bar_transactions'
      AND column_name = 'Бармен'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bar_transactions'
      AND column_name = 'Сотрудник'
  ) THEN
    UPDATE public.bar_transactions
    SET "Сотрудник" = COALESCE("Сотрудник", "Бармен")
    WHERE "Бармен" IS NOT NULL;

    ALTER TABLE public.bar_transactions
    DROP COLUMN "Бармен";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bar_transactions'
      AND column_name = 'Бармен'
  ) THEN
    ALTER TABLE public.bar_transactions
    RENAME COLUMN "Бармен" TO "Сотрудник";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bar_transactions'
      AND column_name = 'Сотрудник'
  ) THEN
    ALTER TABLE public.bar_transactions
    ADD COLUMN "Сотрудник" text NULL;
  END IF;
END $$;
