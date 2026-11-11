-- Idempotent schema; runs on every boot.
-- array_to_string isn't marked IMMUTABLE, which generated columns require.
CREATE OR REPLACE FUNCTION jr_tags_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT NOT NULL,
  cv_text       TEXT,
  skills        TEXT[] DEFAULT '{}',
  titles        TEXT[] DEFAULT '{}',
  experience_years INT,
  pref_locations TEXT[] DEFAULT '{}',   -- e.g. {'Islamabad','Remote'}
  pref_categories TEXT[] DEFAULT '{}',  -- govt, private, remote, freelance
  email_alerts  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  source       TEXT NOT NULL,          -- remotive, remoteok, reddit, fpsc, ...
  external_id  TEXT NOT NULL,
  title        TEXT NOT NULL,
  company      TEXT,
  location     TEXT,
  country      TEXT,                   -- 'PK', 'INTL'
  category     TEXT NOT NULL,          -- govt | private | remote | freelance
  is_remote    BOOLEAN DEFAULT FALSE,
  description  TEXT,
  tags         TEXT[] DEFAULT '{}',
  salary       TEXT,
  url          TEXT NOT NULL,
  posted_at    TIMESTAMPTZ,
  deadline     DATE,
  deadline_estimated BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  search       TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(company,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(jr_tags_text(tags), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(left(description, 5000),'')), 'C')
  ) STORED,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS jobs_search_idx   ON jobs USING GIN (search);
CREATE INDEX IF NOT EXISTS jobs_deadline_idx ON jobs (deadline);
CREATE INDEX IF NOT EXISTS jobs_posted_idx   ON jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON jobs (category);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id  INT REFERENCES users(id) ON DELETE CASCADE,
  job_id   INT REFERENCES jobs(id) ON DELETE CASCADE,
  status   TEXT DEFAULT 'saved',       -- saved | applied | interview | rejected | offer
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS reminders_sent (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  job_id  INT REFERENCES jobs(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL,               -- 'deadline-3d', 'deadline-1d', 'digest-YYYY-MM-DD'
  sent_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, job_id, kind)
);

-- Paid-API credit tracking (e.g. JSearch), per calendar month
CREATE TABLE IF NOT EXISTS api_usage (
  source TEXT NOT NULL,
  month  TEXT NOT NULL,                -- 'YYYY-MM'
  calls  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (source, month)
);

-- When each search query last ran, so the same query isn't paid for twice in a day
CREATE TABLE IF NOT EXISTS search_queries (
  source  TEXT NOT NULL,
  q       TEXT NOT NULL,
  last_run TIMESTAMPTZ,
  PRIMARY KEY (source, q)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id SERIAL PRIMARY KEY,
  source TEXT,
  fetched INT,
  upserted INT,
  error TEXT,
  ran_at TIMESTAMPTZ DEFAULT now()
);

-- ── Accounts, roles, subscriptions ─────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';      -- user | admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;  -- admin granted free access
ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;     -- bump to log a user out everywhere
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_uid_idx ON users (google_uid) WHERE google_uid IS NOT NULL;

-- Admin-editable settings (price, payment accounts, AI key, email…). Secrets never leave the server unmasked.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method        TEXT NOT NULL,
  amount        INT NOT NULL,
  txn_id        TEXT NOT NULL,
  sender_number TEXT,
  screenshot    BYTEA NOT NULL,
  screenshot_mime TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note    TEXT,
  days_granted  INT,
  reviewed_by   INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('easypaisa','jazzcash','bank'));
-- The same transaction ID can never be used twice (stops re-using one payment for many accounts)
CREATE UNIQUE INDEX IF NOT EXISTS payments_txn_idx ON payments (method, upper(txn_id));
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI results are cached so the same insight isn't paid for twice
CREATE TABLE IF NOT EXISTS ai_cache (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  job_id  INT REFERENCES jobs(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, job_id, kind)
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  calls INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- One-time codes emailed to users to confirm deleting their own account
CREATE TABLE IF NOT EXISTS account_deletion_codes (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0
);
