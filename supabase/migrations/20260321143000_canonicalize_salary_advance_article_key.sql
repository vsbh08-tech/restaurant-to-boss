-- Collapse legacy and mixed-case article names into one canonical key.
UPDATE public.balance_fact
SET "СтатьяKey" = 'ЗП нач'
WHERE lower(regexp_replace(btrim(coalesce("СтатьяKey", '')), '\s+', ' ', 'g')) IN ('авансы', 'зп нач', 'зп. нач');

UPDATE public.finance_flows
SET "СтатьяKey" = 'ЗП нач'
WHERE lower(regexp_replace(btrim(coalesce("СтатьяKey", '')), '\s+', ' ', 'g')) IN ('авансы', 'зп нач', 'зп. нач');
