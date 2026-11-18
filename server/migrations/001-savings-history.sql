DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS savings_history (
    owner_key text NOT NULL CHECK (owner_key ~ '^[0-9a-f]{64}$'),
    audit_id uuid NOT NULL,
    saved_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    providers text[] NOT NULL CHECK (
      cardinality(providers) BETWEEN 1 AND 8
      AND providers <@ ARRAY['Google Workspace', 'Slack', 'Jira', 'Trello', 'Figma', 'Zoom', 'Notion', 'Otro']::text[]
    ),
    potential_savings_cents bigint NOT NULL CHECK (potential_savings_cents BETWEEN 0 AND 9007199254740991),
    selected_savings_cents bigint NOT NULL CHECK (selected_savings_cents BETWEEN 0 AND potential_savings_cents),
    candidate_count integer NOT NULL CHECK (candidate_count BETWEEN 0 AND 1000),
    selected_count integer NOT NULL CHECK (selected_count BETWEEN 0 AND candidate_count),
    unknown_cost_count integer NOT NULL CHECK (unknown_cost_count BETWEEN 0 AND candidate_count),
    selected_unknown_cost_count integer NOT NULL CHECK (
      selected_unknown_cost_count BETWEEN 0 AND least(selected_count, unknown_cost_count)
    ),
    PRIMARY KEY (owner_key, audit_id),
    CHECK (unknown_cost_count - selected_unknown_cost_count <= candidate_count - selected_count),
    CHECK (candidate_count > unknown_cost_count OR potential_savings_cents = 0),
    CHECK (selected_count > selected_unknown_cost_count OR selected_savings_cents = 0)
  );

  CREATE INDEX IF NOT EXISTS savings_history_owner_date_idx
    ON savings_history (owner_key, saved_at DESC, audit_id DESC);
END $$;
