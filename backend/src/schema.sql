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

CREATE TABLE IF NOT EXISTS ingest_runs (
  id SERIAL PRIMARY KEY,
  source TEXT,
  fetched INT,
  upserted INT,
  error TEXT,
  ran_at TIMESTAMPTZ DEFAULT now()
);
