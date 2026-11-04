-- Same bootstrap as the real deployment (ecommerce-deploy/db/roles.sql), with the local dev password.
ALTER USER authenticator WITH PASSWORD 'devonly-local-password';
ALTER USER supabase_auth_admin WITH PASSWORD 'devonly-local-password';
ALTER USER supabase_storage_admin WITH PASSWORD 'devonly-local-password';
