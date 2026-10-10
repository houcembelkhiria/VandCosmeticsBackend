-- security-hardening-2026-10-10.sql
-- Run AFTER supabase-schema.sql (and again after any rebuild of the database volume).
-- Already applied to production on 2026-10-10.
--
-- Why: the shop backend decides who is an admin from auth.users.raw_user_meta_data->>'role' ("user_metadata.role"), which the
-- ACCOUNT OWNER can set at signup and edit later through GoTrue (PUT /auth/v1/user). With GoTrue and PostgREST reachable from
-- the internet and signup open with auto-confirm, anyone could make themselves an admin. Also user_profiles.role was writable by
-- any authenticated user, and handle_new_user() copied the role from signup metadata.
-- GoTrue setting that goes with it (docker-compose.yml, service ecom-auth): GOTRUE_DISABLE_SIGNUP: "true". The shop registers
-- customers through the admin API (authController.register), which is not affected.
-- To promote an admin: run psql as postgres (or supabase_admin) and set raw_user_meta_data to include {"role":"admin"} AND set
-- public.user_profiles.role = 'admin'; the trigger below lets only those two database roles change the role.

BEGIN;

-- 1. A new account's profile role never comes from client-supplied metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'user');
    RETURN NEW;
END;
$function$;

-- 2. user_metadata.role is editable by the account owner through GoTrue (PUT /auth/v1/user) and is set freely at signup,
--    and the shop backend reads it to decide who is admin. Only a superuser session (psql as postgres / supabase_admin)
--    may set or change it; API-originated writes get 'user' on insert and keep the old value on update.
CREATE OR REPLACE FUNCTION auth.protect_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = pg_catalog
AS $function$
BEGIN
    IF current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.raw_user_meta_data := jsonb_set(coalesce(NEW.raw_user_meta_data, '{}'::jsonb), '{role}', '"user"'::jsonb);
    ELSIF (NEW.raw_user_meta_data ->> 'role') IS DISTINCT FROM (OLD.raw_user_meta_data ->> 'role') THEN
        IF OLD.raw_user_meta_data ? 'role' THEN
            NEW.raw_user_meta_data := jsonb_set(coalesce(NEW.raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(OLD.raw_user_meta_data ->> 'role'));
        ELSE
            NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb) - 'role';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_user_role ON auth.users;
CREATE TRIGGER protect_user_role
    BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth.protect_user_role();

-- 3. The profile row: users may read it and change only their own name.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_profiles FROM anon, authenticated;
GRANT UPDATE (name) ON public.user_profiles TO authenticated;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

COMMIT;
