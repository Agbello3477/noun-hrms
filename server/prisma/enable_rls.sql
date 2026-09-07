-- Enable Row Level Security (RLS) on all public tables in PostgreSQL / Neon / Supabase
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        -- 1. Enable RLS on each table
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        
        -- 2. Create an idempotent permissive policy so standard database operations continue without interruption
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = r.tablename 
              AND policyname = 'app_full_access_policy'
        ) THEN
            EXECUTE format('CREATE POLICY app_full_access_policy ON public.%I FOR ALL TO PUBLIC USING (true) WITH CHECK (true);', r.tablename);
        END IF;
    END LOOP;
END
$$;

-- Verification Query
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
ORDER BY c.relname ASC;
