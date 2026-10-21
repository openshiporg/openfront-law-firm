/** Prisma form of access.ts `accessibleMatterFilter`, for privileged storage reads
 * that must not see more than the viewer's ordinary matter scope: restricted matters
 * need BOTH the materialized authorization and an active restricted-access team
 * membership, and live blocked ethical-wall membership always excludes the matter.
 * Apply it in the query itself, before any title, description or amount is selected. */
export function accessibleMatterStorageWhere(firmId: string, userId: string) {
  return {
    firmId,
    AND: [
      {
        OR: [
          { confidentiality: { not: "restricted" } },
          {
            AND: [
              { authorizedUsers: { some: { id: userId } } },
              { teamMembers: { some: { firmId, userId, status: "active", canAccessRestricted: true } } },
            ],
          },
        ],
      },
      { blockedUsers: { none: { id: userId } } },
      { ethicalWalls: { none: { status: "active", members: { some: { userId, status: "active", decision: "blocked" } } } } },
    ],
  };
}
