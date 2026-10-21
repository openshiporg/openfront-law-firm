-- CreateTable
CREATE TABLE "_Matter_authorizedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Matter_authorizedUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Matter_blockedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Matter_blockedUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- Materialize existing active restricted-team grants and ethical-wall blocks.
-- These relations are query-time authorization indexes; source evidence remains
-- in MatterTeamMember and EthicalWallMember and is never deleted here.
INSERT INTO "_Matter_authorizedUsers" ("A", "B")
SELECT "matter", "user"
FROM "MatterTeamMember"
WHERE "status" = 'active' AND "canAccessRestricted" = true
ON CONFLICT DO NOTHING;

INSERT INTO "_Matter_blockedUsers" ("A", "B")
SELECT member."matter", member."user"
FROM "EthicalWallMember" AS member
JOIN "EthicalWall" AS wall ON wall."id" = member."wall"
WHERE member."status" = 'active'
  AND member."decision" = 'blocked'
  AND wall."status" = 'active'
  AND wall."matter" = member."matter"
  AND wall."firm" = member."firm"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "_Matter_authorizedUsers_B_index" ON "_Matter_authorizedUsers"("B");

-- CreateIndex
CREATE INDEX "_Matter_blockedUsers_B_index" ON "_Matter_blockedUsers"("B");

-- AddForeignKey
ALTER TABLE "_Matter_authorizedUsers" ADD CONSTRAINT "_Matter_authorizedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Matter_authorizedUsers" ADD CONSTRAINT "_Matter_authorizedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Matter_blockedUsers" ADD CONSTRAINT "_Matter_blockedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Matter_blockedUsers" ADD CONSTRAINT "_Matter_blockedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
