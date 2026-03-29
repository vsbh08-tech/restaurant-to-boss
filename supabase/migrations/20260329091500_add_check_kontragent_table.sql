CREATE TABLE public."Check_Kontragent" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "Ресторан" text NULL,
  "Дата" text NULL,
  "Период" text NULL,
  "Псевдо" text NULL,
  "Группа" text NULL,
  "Движение" text NULL,
  "Начислено" text NULL,
  "Оплачено" text NULL,
  CONSTRAINT "Check_Kontragent_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."Check_Kontragent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for Check_Kontragent"
ON public."Check_Kontragent"
FOR SELECT
USING (true);

CREATE POLICY "Allow insert for Check_Kontragent"
ON public."Check_Kontragent"
FOR INSERT
WITH CHECK (true);
