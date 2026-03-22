
-- Recreate finance_flows with correct schema
DROP TABLE IF EXISTS public.finance_flows;
CREATE TABLE public.finance_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "Ресторан" text NULL,
  "Период" text NULL,
  "Поток" text NULL,
  "ФинТип" text NULL,
  "БалансТип" text NULL,
  "СтатьяKey" text NULL,
  "Сумма" text NULL,
  "IsOpExp" text NULL,
  "Период (Год)" text NULL,
  "Период (Квартал)" text NULL,
  "Период (Индекс месяца)" text NULL,
  "Период (Месяц)" text NULL,
  CONSTRAINT finance_flows_pkey PRIMARY KEY (id)
);
ALTER TABLE public.finance_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for finance_flows" ON public.finance_flows FOR SELECT USING (true);
CREATE POLICY "Allow insert for finance_flows" ON public.finance_flows FOR INSERT WITH CHECK (true);

-- Recreate balance_fact with correct schema
DROP TABLE IF EXISTS public.balance_fact;
CREATE TABLE public.balance_fact (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "Ресторан" text NULL,
  "Период" text NULL,
  "БалансТип" text NULL,
  "СтатьяKey" text NULL,
  "Сумма" text NULL,
  CONSTRAINT balance_fact_pkey PRIMARY KEY (id)
);
ALTER TABLE public.balance_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for balance_fact" ON public.balance_fact FOR SELECT USING (true);
CREATE POLICY "Allow insert for balance_fact" ON public.balance_fact FOR INSERT WITH CHECK (true);

-- Recreate owners_fact with correct schema (add Ресторан)
DROP TABLE IF EXISTS public.owners_fact;
CREATE TABLE public.owners_fact (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "Ресторан" text NULL,
  "Период" text NULL,
  "Псевдо" text NULL,
  "Группа" text NULL,
  "Движение" text NULL,
  "Начислено" text NULL,
  "Оплачено" text NULL,
  CONSTRAINT owners_fact_pkey PRIMARY KEY (id)
);
ALTER TABLE public.owners_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for owners_fact" ON public.owners_fact FOR SELECT USING (true);
CREATE POLICY "Allow insert for owners_fact" ON public.owners_fact FOR INSERT WITH CHECK (true);
