-- Preserve the legacy ethical-wall relationship semantics even if a historical
-- member row's duplicated firm/matter columns predate current ownership hooks.
-- The wall relationship is authoritative for the matter being blocked.
INSERT INTO "_Matter_blockedUsers" ("A", "B")
SELECT DISTINCT wall."matter", member."user"
FROM "EthicalWallMember" AS member
JOIN "EthicalWall" AS wall ON wall."id" = member."wall"
WHERE member."status" = 'active'
  AND member."decision" = 'blocked'
  AND wall."status" = 'active'
ON CONFLICT DO NOTHING;
