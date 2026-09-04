-- Track which Gemini model & thinking level produced each AI Story Analysis
ALTER TABLE agent_stories ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE agent_stories ADD COLUMN IF NOT EXISTS thinking_level TEXT;

-- Comment for documentation
COMMENT ON COLUMN agent_stories.model IS 'Gemini model used for this analysis (e.g. gemini-3-flash-preview)';
COMMENT ON COLUMN agent_stories.thinking_level IS 'Gemini thinking level used for this analysis (MINIMAL/LOW/MEDIUM/HIGH)';
