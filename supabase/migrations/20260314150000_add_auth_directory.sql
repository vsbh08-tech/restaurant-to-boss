ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_unique_idx
ON public.user_profiles (lower(email))
WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_restaurants (
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_restaurants_pkey PRIMARY KEY (user_id, restaurant_id),
  CONSTRAINT user_restaurants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_restaurants_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants (id) ON DELETE CASCADE
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_restaurants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Allow select for user_profiles'
  ) THEN
    CREATE POLICY "Allow select for user_profiles"
    ON public.user_profiles
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_restaurants'
      AND policyname = 'Allow select for user_restaurants'
  ) THEN
    CREATE POLICY "Allow select for user_restaurants"
    ON public.user_restaurants
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

INSERT INTO public.user_restaurants (user_id, restaurant_id)
SELECT id, restaurant_id
FROM public.user_profiles
WHERE restaurant_id IS NOT NULL
ON CONFLICT (user_id, restaurant_id) DO NOTHING;
