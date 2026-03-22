# Выгрузка бара в Google Sheets

## Что уже подготовлено

- В `src/pages/BarPage.tsx` добавлен режим `Исправление`.
- В `supabase/migrations/20260314093000_add_bar_correction_flag.sql` добавлен столбец `Исправление`.
- В `supabase/migrations/20260314113000_rename_bar_employee_column.sql` поле `Бармен` переименовывается в `Сотрудник`.
- В `supabase/functions/export-bar-daily/index.ts` добавлена Edge Function `export-bar-daily`.

Логика экспорта сейчас такая:

- каждый запуск берет полный срез за один день, а не просто дописывает строки;
- по умолчанию выгружается предыдущий день;
- данные пишутся в помесячную вкладку Google Sheets с названием `YYYY-MM`;
- если функцию запустить повторно на ту же дату, строки за эту дату будут перезаписаны без дублей;
- остальные даты этого месяца во вкладке сохраняются.

Это хорошо совпадает с вашим правилом: исправления по бару разрешены только до `08:00` для прошлого дня, а после `08:00` уже для текущего дня, при этом ежедневная выгрузка в `12:00` берет уже стабилизированный предыдущий день.

## 1. Применить изменение в Supabase

Сначала нужно выполнить SQL из файла `supabase/migrations/20260314093000_add_bar_correction_flag.sql` в `SQL Editor` Supabase.

```sql
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
```

Без этого обычный раздел `Бар` еще будет работать, но режим `Исправление` не сможет сохранить сторнирующую запись.

После этого выполните SQL из файла `supabase/migrations/20260314113000_rename_bar_employee_column.sql`.

```sql
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
```

## 2. Подготовить Google Sheets

1. В Google Cloud включите `Google Sheets API`.
2. Создайте `Service Account`.
3. Скопируйте `client_email` и `private_key`.
4. Создайте Google Sheet для выгрузок.
5. Дайте сервисному аккаунту доступ к таблице через `Поделиться`.

## 3. Добавить секреты в Supabase Edge Functions

Нужны секреты:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `BAR_EXPORT_CRON_SECRET`

Если будете делать через CLI:

```bash
supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com" \
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
  GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id" \
  BAR_EXPORT_CRON_SECRET="long-random-secret"
```

Если делаете через Dashboard, добавьте эти же ключи в `Edge Functions -> Secrets`.

## 4. Деплой функции

```bash
supabase functions deploy export-bar-daily
```

## 5. Настроить ежедневный запуск в 12:00 по Москве

На `14 марта 2026` время `12:00 Europe/Moscow` равно `09:00 UTC`. Так как Москва сейчас живет в `UTC+3`, cron-выражение для ежедневного запуска будет:

```sql
0 9 * * *
```

Сначала сохраните в Vault значения для вызова функции:

```sql
select vault.create_secret('https://gajsyhkasysyynpbqsuq.supabase.co', 'project_url');
select vault.create_secret('sb_publishable_...', 'publishable_key');
select vault.create_secret('long-random-secret', 'bar_export_cron_secret');
```

Потом создайте cron-задачу:

```sql
select cron.schedule(
  'export-bar-daily-to-google-sheets',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/export-bar-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-bar-export-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bar_export_cron_secret')
    ),
    body := jsonb_build_object(
      'timezone', 'Europe/Moscow'
    )
  );
  $$
);
```

Если задачу нужно пересоздать:

```sql
select cron.unschedule('export-bar-daily-to-google-sheets');
```

## 6. Ручная проверка

Можно вручную вызвать функцию на конкретную дату:

```json
{
  "date": "2026-03-13",
  "timezone": "Europe/Moscow"
}
```

Функция создаст или обновит вкладку `2026-03` и заменит в ней только строки за `2026-03-13`.

## Что именно выгружается

Во вкладку Google Sheets пишутся колонки:

- `Дата`
- `Тип`
- `Категория`
- `Сумма`
- `Исправление`
- `Ресторан`
- `Сотрудник`
- `Создано`
- `ID`

Для исправлений в таблице будет отдельная сторнирующая строка с `Исправление = Да` и отрицательной суммой. Это значит, что выгрузка хранит полную историю движений без физического удаления строк.
