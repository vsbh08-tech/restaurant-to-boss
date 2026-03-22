ALTER TABLE public.prepayments
ADD COLUMN IF NOT EXISTS "Сотрудник_Создал" text NULL;

ALTER TABLE public.prepayments
ADD COLUMN IF NOT EXISTS "Сотрудник_Изменил" text NULL;

ALTER TABLE public.prepayments
ADD COLUMN IF NOT EXISTS "Дата_Изменения" timestamp with time zone NULL;

ALTER TABLE public.prepayments
ADD COLUMN IF NOT EXISTS "Комментарий" text NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prepayments'
      AND column_name = 'Сотрудник'
  ) THEN
    EXECUTE '
      UPDATE public.prepayments
      SET "Сотрудник_Создал" = COALESCE("Сотрудник_Создал", "Сотрудник")
      WHERE "Сотрудник" IS NOT NULL
    ';
  END IF;
END $$;
