-- Convert users_translations.biography (HTML) into the editor.js JSON shape
-- consumed by the custom block editor, storing it in `bio`.
--
-- PREREQUISITE: create the `bio` field in the Directus UI first
--   (Type: JSON, Interface: custom block editor). That both registers the
--   field in directus_fields AND creates the users_translations.bio column.
--
-- Conversion rules:
--   * Block boundaries (</p>, <br>, </div>, </h1-6>, </li>) -> paragraph breaks.
--   * Every remaining HTML tag is stripped.
--   * &nbsp; -> space; other entities (&amp;, &lt;, …) are kept as-is (valid HTML).
--   * Blank lines are dropped.
-- Safe to re-run: only fills rows where bio is still empty.

WITH lines AS (
    SELECT tr.id,
           ord,
           btrim(part) AS line
    FROM users_translations tr,
         LATERAL regexp_split_to_table(
             -- 2) strip every remaining tag
             regexp_replace(
                 -- 1) turn block-level boundaries into newlines
                 regexp_replace(
                     replace(tr.biography, '&nbsp;', ' '),
                     '</p>|<br\s*/?>|</div>|</h[1-6]>|</li>', E'\n', 'gi'
                 ),
                 '<[^>]+>', '', 'g'
             ),
             E'\r\n|\n|\r'
         ) WITH ORDINALITY AS s(part, ord)
    WHERE tr.biography IS NOT NULL
      AND tr.biography <> ''
),
blocks AS (
    SELECT id,
           json_agg(
               json_build_object(
                   'type', 'paragraph',
                   'data', json_build_object('text', line)
               ) ORDER BY ord
           ) FILTER (WHERE line <> '') AS blocks
    FROM lines
    GROUP BY id
)
UPDATE users_translations AS t
SET bio = json_build_object(
    'time',    (extract(epoch from now()) * 1000)::bigint,
    'blocks',  b.blocks,
    'version', '2.30.7'
)
FROM blocks b
WHERE t.id = b.id
  AND b.blocks IS NOT NULL   -- skip rows that stripped down to nothing
  AND t.bio IS NULL;         -- never clobber an already-authored bio

-- Verify:
--   SELECT id, bio FROM users_translations WHERE bio IS NOT NULL;
