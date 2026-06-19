-- Migration: create dhl_pitstops table to store DHL fastest pit stop data
CREATE TABLE IF NOT EXISTS dhl_pitstops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season text NOT NULL,
  event text,
  time_raw text,
  time_seconds numeric,
  raw jsonb,
  source text,
  fetched_at timestamptz
);

-- Optional unique constraint to allow upsert by season+event
CREATE UNIQUE INDEX IF NOT EXISTS dhl_pitstops_season_event_idx ON dhl_pitstops (season, event);

-- Enable public read (adjust policies as needed for your project security)
ALTER TABLE dhl_pitstops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON dhl_pitstops FOR SELECT USING (true);
