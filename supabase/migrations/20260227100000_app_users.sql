-- Auth users (email + password, no Supabase Auth)
CREATE TABLE IF NOT EXISTS app.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: first admin (run manually and set password)
-- INSERT INTO app.users (email, password_hash, role) VALUES ('admin@example.com', '<bcrypt_hash>', 'admin');
