-- Шаблон заполнения доступов.
-- 1. Сначала создайте всех пользователей в Supabase Authentication -> Users.
-- 2. Убедитесь, что email в auth.users совпадают с email ниже.
-- 3. При необходимости замените ФИО и email на реальные.
-- 4. Затем выполните этот скрипт в SQL Editor.

begin;

with user_source(full_name, email, role_name) as (
  values
    ('Бармен 1 Долгоруковская', 'bartender1.dolgorukovskaya@example.com', 'Бармен'),
    ('Бармен 2 Долгоруковская', 'bartender2.dolgorukovskaya@example.com', 'Бармен'),
    ('Менеджер 1 Долгоруковская', 'manager1.dolgorukovskaya@example.com', 'Менеджер'),
    ('Менеджер 2 Долгоруковская', 'manager2.dolgorukovskaya@example.com', 'Менеджер'),

    ('Бармен 1 РестПрМ', 'bartender1.restprm@example.com', 'Бармен'),
    ('Бармен 2 РестПрМ', 'bartender2.restprm@example.com', 'Бармен'),
    ('Менеджер 1 РестПрМ', 'manager1.restprm@example.com', 'Менеджер'),
    ('Менеджер 2 РестПрМ', 'manager2.restprm@example.com', 'Менеджер'),

    ('Бармен 1 Солнцево', 'bartender1.solntsevo@example.com', 'Бармен'),
    ('Бармен 2 Солнцево', 'bartender2.solntsevo@example.com', 'Бармен'),
    ('Менеджер 1 Солнцево', 'manager1.solntsevo@example.com', 'Менеджер'),
    ('Менеджер 2 Солнцево', 'manager2.solntsevo@example.com', 'Менеджер'),

    ('Собственник 1 Все рестораны', 'owner1.all@example.com', 'Собственник'),
    ('Собственник 2 Все рестораны', 'owner2.all@example.com', 'Собственник'),
    ('Собственник 3 Долгоруковская', 'owner3.dolgorukovskaya@example.com', 'Собственник'),
    ('Собственник 4 Солнцево', 'owner4.solntsevo@example.com', 'Собственник'),

    ('Управляющий', 'supervisor@example.com', 'Управляющий'),
    ('Админ', 'admin@example.com', 'Админ')
),
resolved_users as (
  select
    au.id,
    us.full_name,
    us.email,
    us.role_name
  from user_source us
  join auth.users au
    on lower(au.email) = lower(us.email)
),
upsert_profiles as (
  insert into public.user_profiles (id, full_name, role, email)
  select
    id,
    full_name,
    role_name,
    email
  from resolved_users
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role,
    email = excluded.email
  returning id, email, role
),
access_source(email, restaurant_name) as (
  values
    ('bartender1.dolgorukovskaya@example.com', 'Долгоруковская'),
    ('bartender2.dolgorukovskaya@example.com', 'Долгоруковская'),
    ('manager1.dolgorukovskaya@example.com', 'Долгоруковская'),
    ('manager2.dolgorukovskaya@example.com', 'Долгоруковская'),

    ('bartender1.restprm@example.com', 'РестПрМ'),
    ('bartender2.restprm@example.com', 'РестПрМ'),
    ('manager1.restprm@example.com', 'РестПрМ'),
    ('manager2.restprm@example.com', 'РестПрМ'),

    ('bartender1.solntsevo@example.com', 'Солнцево'),
    ('bartender2.solntsevo@example.com', 'Солнцево'),
    ('manager1.solntsevo@example.com', 'Солнцево'),
    ('manager2.solntsevo@example.com', 'Солнцево'),

    ('owner1.all@example.com', 'Долгоруковская'),
    ('owner1.all@example.com', 'РестПрМ'),
    ('owner1.all@example.com', 'Солнцево'),

    ('owner2.all@example.com', 'Долгоруковская'),
    ('owner2.all@example.com', 'РестПрМ'),
    ('owner2.all@example.com', 'Солнцево'),

    ('owner3.dolgorukovskaya@example.com', 'Долгоруковская'),
    ('owner4.solntsevo@example.com', 'Солнцево')
),
resolved_access as (
  select
    ru.id as user_id,
    r.id as restaurant_id
  from access_source ac
  join resolved_users ru
    on lower(ru.email) = lower(ac.email)
  join public.restaurants r
    on r.name = ac.restaurant_name
),
cleanup_access as (
  delete from public.user_restaurants ur
  using resolved_users ru
  where ur.user_id = ru.id
    and ru.role_name not in ('Управляющий', 'Админ')
  returning ur.user_id
)
insert into public.user_restaurants (user_id, restaurant_id)
select distinct
  user_id,
  restaurant_id
from resolved_access
on conflict (user_id, restaurant_id) do nothing;

commit;

-- Проверка результата:
-- select up.full_name, up.role, up.email, r.name as restaurant
-- from public.user_profiles up
-- left join public.user_restaurants ur on ur.user_id = up.id
-- left join public.restaurants r on r.id = ur.restaurant_id
-- order by up.role, up.full_name, r.name;
