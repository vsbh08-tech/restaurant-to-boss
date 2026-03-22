
-- Create restaurants table for FK references
CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for restaurants" ON public.restaurants FOR ALL USING (true) WITH CHECK (true);

-- Drop old prepayments table and recreate with Russian columns
DROP TABLE IF EXISTS public.prepayments;
CREATE TABLE public.prepayments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NULL DEFAULT now(),
  restaurant_id uuid NULL,
  "Клиент" text NULL,
  "Способ оплаты" text NULL,
  "Дата предоплаты" date NULL,
  "Дата банкета" date NULL,
  "Сумма" numeric NULL,
  "Статус" text NULL DEFAULT 'Открыт'::text,
  CONSTRAINT prepayments_pkey PRIMARY KEY (id),
  CONSTRAINT prepayments_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
);
ALTER TABLE public.prepayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for prepayments" ON public.prepayments FOR ALL USING (true) WITH CHECK (true);

-- Create bar_transactions table
CREATE TABLE public.bar_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NULL DEFAULT now(),
  restaurant_id uuid NULL,
  "Дата" date NULL DEFAULT CURRENT_DATE,
  "Бармен" text NULL,
  "Тип" text NULL,
  "Категория" text NULL,
  "Сумма" numeric NULL,
  CONSTRAINT bar_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT bar_transactions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
);
ALTER TABLE public.bar_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for bar_transactions" ON public.bar_transactions FOR ALL USING (true) WITH CHECK (true);
