-- If you previously created app.profiles with auth_user_id UUID, run this to support app.users id (numeric as text):
-- ALTER TABLE app.profiles ALTER COLUMN auth_user_id TYPE TEXT USING auth_user_id::TEXT;
-- ALTER TABLE app.quotes ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;

-- If creating profiles from scratch with email/password auth (app.users), use TEXT for auth_user_id:
-- CREATE TABLE IF NOT EXISTS app.profiles (
--   id BIGSERIAL PRIMARY KEY,
--   auth_user_id TEXT UNIQUE NOT NULL,
--   ...
-- );
