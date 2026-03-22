
-- Table for prepayments (managed by managers)
CREATE TABLE public.prepayments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL,
  prepayment_date DATE NOT NULL,
  banquet_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Активен',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prepayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for prepayments" ON public.prepayments FOR ALL USING (true) WITH CHECK (true);

-- Table for bar entries
CREATE TABLE public.bar_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL, -- Приход/Расход
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bar_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for bar_entries" ON public.bar_entries FOR ALL USING (true) WITH CHECK (true);

-- Analytics tables (TEXT columns for CSV import)
CREATE TABLE public.finance_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "Период" TEXT,
  "Статья" TEXT,
  "Тип" TEXT, -- Доход/Расход
  "Сумма" TEXT
);

ALTER TABLE public.finance_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for finance_flows" ON public.finance_flows FOR SELECT USING (true);
CREATE POLICY "Allow insert for finance_flows" ON public.finance_flows FOR INSERT WITH CHECK (true);

CREATE TABLE public.balance_fact (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "Период" TEXT,
  "Статья" TEXT,
  "Тип" TEXT, -- Актив/Обязательство
  "Сумма" TEXT
);

ALTER TABLE public.balance_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for balance_fact" ON public.balance_fact FOR SELECT USING (true);
CREATE POLICY "Allow insert for balance_fact" ON public.balance_fact FOR INSERT WITH CHECK (true);

CREATE TABLE public.owners_fact (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "Период" TEXT,
  "Группа" TEXT,
  "Псевдо" TEXT,
  "Движение" TEXT,
  "Начислено" TEXT,
  "Оплачено" TEXT
);

ALTER TABLE public.owners_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for owners_fact" ON public.owners_fact FOR SELECT USING (true);
CREATE POLICY "Allow insert for owners_fact" ON public.owners_fact FOR INSERT WITH CHECK (true);

-- Trigger for prepayments updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_prepayments_updated_at
  BEFORE UPDATE ON public.prepayments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
