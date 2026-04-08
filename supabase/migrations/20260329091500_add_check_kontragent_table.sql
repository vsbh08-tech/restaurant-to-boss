CREATE TABLE public.check_kontragent (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "Ресторан" text NULL,
  "Дата" text NULL,
  "Период" text NULL,
  "Псевдо" text NULL,
  "Группа" text NULL,
  "Движение" text NULL,
  "Начислено" text NULL,
  "Оплачено" text NULL,
  CONSTRAINT check_kontragent_pkey PRIMARY KEY (id)
);

ALTER TABLE public.check_kontragent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for check_kontragent"
ON public.check_kontragent
FOR SELECT
USING (true);

CREATE POLICY "Allow insert for check_kontragent"
ON public.check_kontragent
FOR INSERT
WITH CHECK (true);
