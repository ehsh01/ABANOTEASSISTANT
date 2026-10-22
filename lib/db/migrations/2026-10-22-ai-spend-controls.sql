CREATE TABLE IF NOT EXISTS abanote.ai_usage (
  id serial PRIMARY KEY,
  feature text NOT NULL,
  user_id integer REFERENCES abanote.users(id) ON DELETE SET NULL,
  company_id integer REFERENCES abanote.companies(id) ON DELETE SET NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx
  ON abanote.ai_usage (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_feature_user_created_idx
  ON abanote.ai_usage (feature, user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_feature_company_created_idx
  ON abanote.ai_usage (feature, company_id, created_at);

CREATE TABLE IF NOT EXISTS abanote.ai_response_cache (
  id serial PRIMARY KEY,
  feature text NOT NULL,
  company_id integer NOT NULL REFERENCES abanote.companies(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  model text NOT NULL,
  response jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_response_cache_feature_company_key_uniq
  ON abanote.ai_response_cache (feature, company_id, cache_key);
CREATE INDEX IF NOT EXISTS ai_response_cache_expires_at_idx
  ON abanote.ai_response_cache (expires_at);
