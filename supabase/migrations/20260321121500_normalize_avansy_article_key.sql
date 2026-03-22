-- Unify historical article key naming so balances and flows accumulate under one article.
UPDATE public.balance_fact
SET "СтатьяKey" = 'ЗП нач'
WHERE btrim(coalesce("СтатьяKey", '')) = 'Авансы';

UPDATE public.finance_flows
SET "СтатьяKey" = 'ЗП нач'
WHERE btrim(coalesce("СтатьяKey", '')) = 'Авансы';
