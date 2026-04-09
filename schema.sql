-- =====================================================
-- love-crm PostgreSQL スキーマ
-- Supabase / Neon の SQL Editor で実行してください
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  display_name   TEXT,
  contact        TEXT,
  status         TEXT NOT NULL DEFAULT 'new_reg',
  tags           TEXT NOT NULL DEFAULT '[]',
  notes          TEXT,
  line_id        TEXT,
  line_user_id   TEXT UNIQUE,
  picture_url    TEXT,
  status_message TEXT,
  category       TEXT NOT NULL DEFAULT '片思い',
  crisis_level   INTEGER NOT NULL DEFAULT 1,
  temperature    TEXT NOT NULL DEFAULT 'cool',
  next_action    TEXT,
  total_amount   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  source      TEXT NOT NULL DEFAULT 'line',
  direction   TEXT NOT NULL DEFAULT 'inbound',
  text        TEXT NOT NULL DEFAULT '',
  raw_type    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);

CREATE TABLE IF NOT EXISTS appraisals (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  type         TEXT NOT NULL DEFAULT '恋愛鑑定',
  status       TEXT NOT NULL DEFAULT '受付中',
  price        INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
