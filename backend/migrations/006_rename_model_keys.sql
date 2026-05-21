-- Rename per-integration model config keys now that we have a provider-agnostic
-- llm helper. Also fix on-this-day's prefix to match the frontend ID (hyphen).
UPDATE config SET key = 'sports.model' WHERE key = 'sports.ollama_model';
UPDATE config SET key = 'on-this-day.model' WHERE key = 'on_this_day.ollama_model';
UPDATE config SET key = 'on-this-day.model' WHERE key = 'on-this-day.ollama_model';
