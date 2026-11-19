-- ============================================================
-- NEXT STAGE TALENT - SUPABASE SCHEMA
-- Add to existing ftmmanagement Supabase project
-- All tables prefixed with nst_ to avoid conflicts
-- ============================================================
-- Run in: ftmmanagement project > SQL Editor > New query
-- ============================================================

-- ============================================================
-- CLEANUP (safe to re-run)
-- ============================================================
DROP TABLE IF EXISTS nst_sessions        CASCADE;
DROP TABLE IF EXISTS nst_settings        CASCADE;
DROP TABLE IF EXISTS nst_leads           CASCADE;
DROP TABLE IF EXISTS nst_applications    CASCADE;
DROP TABLE IF EXISTS nst_talent_register CASCADE;
DROP TABLE IF EXISTS nst_contacts        CASCADE;
DROP TABLE IF EXISTS nst_faqs            CASCADE;
DROP TABLE IF EXISTS nst_jobs            CASCADE;
DROP TABLE IF EXISTS nst_testimonials    CASCADE;
DROP TABLE IF EXISTS nst_success_stories CASCADE;
DROP TABLE IF EXISTS nst_talent          CASCADE;

-- ============================================================
-- TABLE: nst_talent
-- ============================================================
CREATE TABLE nst_talent (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  age          TEXT,
  height       TEXT,
  measurements TEXT,
  category     TEXT,
  bio          TEXT,
  skills       TEXT,
  instagram    TEXT,
  photo        TEXT,
  featured     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_success_stories
-- ============================================================
CREATE TABLE nst_success_stories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  title      TEXT,
  brand      TEXT,
  story      TEXT,
  photo      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_testimonials
-- ============================================================
CREATE TABLE nst_testimonials (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,
  quote      TEXT,
  rating     INTEGER DEFAULT 5,
  photo      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_jobs
-- ============================================================
CREATE TABLE nst_jobs (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  company      TEXT,
  location     TEXT,
  job_type     TEXT,
  category     TEXT,
  description  TEXT,
  requirements TEXT,
  rate         TEXT,
  deadline     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_faqs
-- ============================================================
CREATE TABLE nst_faqs (
  id         BIGSERIAL PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_contacts
-- ============================================================
CREATE TABLE nst_contacts (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  subject    TEXT,
  message    TEXT,
  status     TEXT DEFAULT 'New',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_talent_register
-- ============================================================
CREATE TABLE nst_talent_register (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT,
  age        TEXT,
  phone      TEXT,
  email      TEXT,
  category   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_applications
-- ============================================================
CREATE TABLE nst_applications (
  id                 BIGSERIAL PRIMARY KEY,
  first_name         TEXT,
  last_name          TEXT,
  dob                TEXT,
  age                TEXT,
  mobile             TEXT,
  landline           TEXT,
  email              TEXT,
  sex                TEXT,
  nationality        TEXT,
  ethnic_origin      TEXT,
  address            TEXT,
  postcode           TEXT,
  website            TEXT,
  social_media       TEXT,
  spotlight_pin      TEXT,
  equity_number      TEXT,
  current_employment TEXT,
  availability       TEXT,
  height             TEXT,
  weight             TEXT,
  bust_chest         TEXT,
  waist              TEXT,
  hips               TEXT,
  shoe_size          TEXT,
  eye_color          TEXT,
  hair_color         TEXT,
  complexion         TEXT,
  suit_dress_size    TEXT,
  languages          TEXT,
  skills             TEXT,
  interests          TEXT,
  experience         TEXT,
  has_portfolio      TEXT,
  other_agency       TEXT,
  other_agency_name  TEXT,
  additional_info    TEXT,
  imdb_link          TEXT,
  signature          TEXT,
  source             TEXT,
  status             TEXT DEFAULT 'New',
  interviewed_by     TEXT,
  interview_date     TEXT,
  outcome            TEXT,
  admin_notes        TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_leads
-- ============================================================
CREATE TABLE nst_leads (
  id                     BIGSERIAL PRIMARY KEY,
  full_name              TEXT,
  email                  TEXT,
  phone                  TEXT,
  location               TEXT,
  gender                 TEXT,
  age                    TEXT,
  experience             TEXT,
  booked_by              TEXT,
  shoot_booked           TEXT,
  notes                  TEXT,
  source                 TEXT,
  status                 TEXT DEFAULT 'New',
  invited                TEXT,
  year_applied           TEXT,
  invite_status          TEXT,
  invite_sent_at         TIMESTAMPTZ,
  date_1st_interview     TEXT,
  date_2nd_interview     TEXT,
  date_final_interview   TEXT,
  date_interview_done    TEXT,
  date_shoot_booked      TEXT,
  interview_confirm      TEXT,
  date_interview_confirm TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: nst_settings
-- ============================================================
CREATE TABLE nst_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE nst_talent          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_success_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_testimonials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_faqs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_talent_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nst_settings        ENABLE ROW LEVEL SECURITY;

-- Public can read
CREATE POLICY "Public read nst_talent"          ON nst_talent          FOR SELECT USING (true);
CREATE POLICY "Public read nst_success_stories" ON nst_success_stories FOR SELECT USING (true);
CREATE POLICY "Public read nst_testimonials"    ON nst_testimonials    FOR SELECT USING (true);
CREATE POLICY "Public read nst_jobs"            ON nst_jobs            FOR SELECT USING (true);
CREATE POLICY "Public read nst_faqs"            ON nst_faqs            FOR SELECT USING (true);

-- Public can submit forms
CREATE POLICY "Public insert nst_contacts"        ON nst_contacts        FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert nst_talent_register" ON nst_talent_register FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert nst_applications"    ON nst_applications    FOR INSERT WITH CHECK (true);
