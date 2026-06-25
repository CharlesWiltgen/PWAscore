-- scripts/explore.sql — DuckDB curation-assist recipes for PWAscore
-- ===========================================================================
-- These are READ-ONLY research queries for evolving the curated feature set.
-- The JSON files remain the single source of truth:
--   • app/data/pwa-features.json          (the ~163 curated features + weights)
--   • app/data/manual-browser-support.json (hand-authored vendor support)
--   • node_modules/@mdn/browser-compat-data/data.json (full MDN BCD universe)
--   • public/data/caniuse-data.json        (full caniuse universe)
-- DuckDB is NOT a storage engine here — nothing it produces is committed. It
-- reads the raw files in place to answer editorial questions like "what should
-- we add/drop/reweight?" and "where is our curation drifting from upstream?".
--
-- PREREQUISITES
--   • BCD ships with the @mdn/browser-compat-data devDependency (pnpm install).
--   • caniuse is gitignored — fetch it first:  node scripts/download-caniuse.mjs
--     (or `pnpm update-caniuse`). Sections C/D error until it exists.
--   • Baseline status is NOT available: it lives in the `web-features` package,
--     which this project does not depend on. BCD only carries
--     experimental / standard_track / deprecated (see Section B).
--
-- HOW TO RUN  (no database file needed — DuckDB runs in-memory)
--   Whole cookbook:   duckdb -box -c ".read scripts/explore.sql"
--   One query:        run the SETUP block once in `duckdb -box`, then paste any
--                     later section (each depends only on the SETUP views).
--   MEMORY: Sections A/C/D (curated + caniuse) peak well under 1 GB. Section B
--   parses the 19 MB BCD doc into memory and peaks ~6 GB. `SET memory_limit`
--   does NOT help — parsed JSON is not spillable, so a low cap just fails
--   sooner. On a constrained machine, run Section B on its own (or skip it);
--   the rest is light.
-- ===========================================================================


-- ── SETUP ──────────────────────────────────────────────────────────────────
-- Reusable views over the raw files. Lazy: the caniuse view only touches disk
-- when a caniuse query runs, so this block succeeds even before downloading it.

CREATE OR REPLACE VIEW features AS
SELECT
  g.id        AS group_id,
  g.name      AS group_name,
  c.id        AS category_id,
  c.name      AS category_name,
  f.id        AS feature_id,
  f.name      AS feature_name,
  f.weight    AS weight,
  f.canIUseId AS caniuse_id,
  f.mdnBcdPath AS bcd_path
FROM read_json('app/data/pwa-features.json', format = 'array') AS g,
     UNNEST(g.categories) AS t(c),
     UNNEST(c.features)   AS u(f);

CREATE OR REPLACE VIEW bcd AS
SELECT content::JSON AS j
FROM read_text('node_modules/@mdn/browser-compat-data/data.json');

-- One row per caniuse feature (id + its small JSON object). Parsing the 4.4 MB
-- file into 554 small values up front keeps later json_extract calls cheap —
-- extracting repeatedly from the whole document instead exhausts memory.
CREATE OR REPLACE VIEW caniuse AS
SELECT e.key AS caniuse_id, e.value AS feat
FROM (
  SELECT unnest(map_entries(CAST(content::JSON -> '$.data' AS MAP(VARCHAR, JSON)))) AS e
  FROM read_text('public/data/caniuse-data.json')
) t;


-- ── A. The curated set at a glance ───────────────────────────────────────────
-- Flatten the 163 tracked features; confirm how many point at each upstream.
SELECT count(*)                AS total_features,
       count(caniuse_id)       AS with_caniuse,
       count(bcd_path)         AS with_bcd,
       count(*) FILTER (WHERE caniuse_id IS NULL AND bcd_path IS NULL) AS unsourced
FROM features;

-- Heaviest features that have NO upstream pointer (manual-only or unverifiable).
SELECT group_id, category_id, feature_id, weight
FROM features
WHERE caniuse_id IS NULL AND bcd_path IS NULL
ORDER BY weight DESC, feature_id
LIMIT 15;


-- ── B. BCD status enrichment (experimental / standard / deprecated) ──────────
-- Mirrors the very flags the scoring logic filters on. version_added = 'false'
-- means unsupported; NULL means a complex/ranged support shape worth a look.
-- (data integrity bonus: a NULL __compat here = a broken mdnBcdPath pointer.)
-- Pull each __compat node out of the 19 MB doc ONCE (MATERIALIZED), then read
-- sub-fields from the small node — re-extracting from the whole doc per field
-- balloons memory.
WITH compat AS MATERIALIZED (
  SELECT f.feature_id,
         json_extract(b.j, '$.' || f.bcd_path || '.__compat') AS c
  FROM features f, bcd b
  WHERE f.bcd_path IS NOT NULL
)
SELECT
  feature_id,
  json_extract_string(c, '$.status.experimental')         AS experimental,
  json_extract_string(c, '$.status.standard_track')        AS standard_track,
  json_extract_string(c, '$.status.deprecated')            AS deprecated,
  json_extract_string(c, '$.support.chrome.version_added') AS chrome_added,
  json_extract_string(c, '$.support.safari.version_added') AS safari_added
FROM compat
WHERE json_extract_string(c, '$.status.experimental') = 'true'
ORDER BY feature_id;

-- Pointer health + status mix across every tracked BCD path.
WITH compat AS MATERIALIZED (
  SELECT json_extract(b.j, '$.' || f.bcd_path || '.__compat') AS c
  FROM features f, bcd b
  WHERE f.bcd_path IS NOT NULL
)
SELECT
  count(*)                                                                       AS tracked_bcd_paths,
  count(*) FILTER (WHERE c IS NULL)                                              AS broken_pointers,
  count(*) FILTER (WHERE json_extract_string(c, '$.status.experimental') = 'true') AS experimental,
  count(*) FILTER (WHERE json_extract_string(c, '$.status.deprecated')   = 'true') AS deprecated
FROM compat;


-- ── C. caniuse discovery: what we DON'T track yet ────────────────────────────
-- (requires public/data/caniuse-data.json — see PREREQUISITES)
-- Every caniuse feature not referenced by our curation, ranked by global
-- "fully supported" usage %. Surface `categories` so you can ignore the generic
-- CSS/Canvas noise and zero in on PWA-relevant APIs.
WITH tracked AS (SELECT DISTINCT caniuse_id FROM features WHERE caniuse_id IS NOT NULL)
SELECT
  ci.caniuse_id,
  json_extract_string(ci.feat, '$.title')                AS title,
  json_extract_string(ci.feat, '$.categories')           AS categories,
  json_extract_string(ci.feat, '$.usage_perc_y')::DOUBLE AS pct_full_support
FROM caniuse ci
WHERE ci.caniuse_id NOT IN (SELECT caniuse_id FROM tracked)
ORDER BY pct_full_support DESC NULLS LAST
LIMIT 25;


-- ── D. Audits: drift between curation and upstream ───────────────────────────
-- D1. Manual entries that ALSO carry a caniuse/BCD pointer in pwa-features.json:
-- these are double-sourced, so manual support can silently drift from upstream.
WITH manual AS (
  SELECT unnest(json_keys(content::JSON)) AS feature_id
  FROM read_text('app/data/manual-browser-support.json')
)
SELECT f.feature_id, f.caniuse_id, f.bcd_path
FROM manual m JOIN features f USING (feature_id)
WHERE f.caniuse_id IS NOT NULL OR f.bcd_path IS NOT NULL
ORDER BY f.feature_id;

-- D2. Tracked caniuse pointers that no longer resolve in the current download
-- (a renamed/removed caniuse id — the pointer needs updating). Requires caniuse.
SELECT DISTINCT f.feature_id, f.caniuse_id
FROM features f
WHERE f.caniuse_id IS NOT NULL
  AND f.caniuse_id NOT IN (SELECT caniuse_id FROM caniuse)
ORDER BY f.feature_id;
