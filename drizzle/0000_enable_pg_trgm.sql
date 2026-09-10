-- Custom SQL migration file, put your code below! --
-- Fuzzy matching for region/publisher names. Required before regions_name_trgm_idx.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
