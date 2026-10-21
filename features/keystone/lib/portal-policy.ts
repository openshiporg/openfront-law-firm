import type { PermissionKey } from "../access";
import { lockCurrentFirmMember } from "../mutations/command-authority";

export const PORTAL_POLICY_STATUSES = ["open", "on_hold", "closing"] as const;
export const PORTAL_POLICY_REVIEW_STATUSES = ["proposed", "pending_conflict", ...PORTAL_POLICY_STATUSES, "closed", "declined"] as const;
export const PORTAL_POLICY_MODES = ["read_intersection", "manager_discovery_review", "live_team_only_review"] as const;

// Policy is configuration, never an implied role grant or legal disclosure approval.
export function normalizePortalPolicy(mode: string, statuses: string[]) {
  if (!(PORTAL_POLICY_MODES as readonly string[]).includes(mode)) throw new Error("Unsupported discovery policy choice.");
  const normalized = [...new Set(statuses)].sort();
  if (!normalized.length || normalized.some((status) => !(PORTAL_POLICY_REVIEW_STATUSES as readonly string[]).includes(status))) {
    throw new Error("Choose explicit known Matter statuses.");
  }
  const conservativeStatuses = normalized.every((status) => (PORTAL_POLICY_STATUSES as readonly string[]).includes(status));
  return { mode, statuses: normalized, admission: mode === "read_intersection" && conservativeStatuses ? "admitted" : "review_required" };
}

// Session identifies the human/firm, but consequential operations reload current authority.
export async function assertCurrentPortalActor(tx: any, firmId: string, userId: string, required: PermissionKey[]) {
  // Consequential callers use their enclosing transaction: the issuer's actual
  // User/member/Role/Firm rows participate with revocation, not just the recipient.
  await lockCurrentFirmMember(tx, userId, firmId);
  const actor = await tx.user.findFirst({
    where: { id: userId, status: "active", activeFirmId: firmId, firmMemberships: { some: {
      firmId, status: "active", firm: { status: "active" },
      role: { status: "active", firmId, ...Object.fromEntries(required.map((key) => [key, true])) },
    } } },
    select: { id: true },
  });
  if (!actor) {
    throw new Error("Current human authority in the active firm is required.");
  }
}

export async function currentPortalPolicy(tx: any, firmId: string) {
  const policy = await tx.portalDiscoveryPolicy.findFirst({
    where: { firmId, admission: "admitted" }, orderBy: { revision: "desc" },
  });
  if (!policy) return null;
  const normalized = normalizePortalPolicy(policy.mode, policy.statuses);
  if (normalized.admission !== "admitted") throw new Error("Portal policy is not executable.");
  return policy;
}

export function portalGrantProjection(grant: any) {
  return {
    id: grant.id, status: grant.status, version: grant.version ?? 0,
    policyRevision: grant.policyRevision ?? 0,
    canReadDocuments: grant.canReadDocuments, canUploadDocuments: grant.canUploadDocuments,
    canReadInvoices: grant.canReadInvoices, canReadMessages: grant.canReadMessages,
    expiresAt: grant.expiresAt,
  };
}

// No projection is returned before both representations authorize the target.
export async function assertPortalMatterScope(tx: any, firmId: string, matterId: string, userId: string) {
  const matter = await tx.matter.findFirst({
    where: { id: matterId, firmId, AND: [
      { OR: [{ confidentiality: { not: "restricted" } }, { AND: [
        { authorizedUsers: { some: { id: userId } } },
        { teamMembers: { some: { firmId, userId, status: "active", canAccessRestricted: true } } },
      ] }] },
      { blockedUsers: { none: { id: userId } } },
      { ethicalWalls: { none: { status: "active", members: { some: { userId, status: "active", decision: "blocked" } } } } },
    ] }, select: { id: true, status: true },
  });
  if (!matter) throw new Error("Matter is unavailable in the current read/team/wall scope.");
  return matter;
}

export async function assertPortalAccountTarget(tx: any, firmId: string, accountId: string, contactId: string, active: boolean) {
  const account = await tx.portalAccount.findFirst({
    where: { id: accountId, firmId, contactId, ...(active ? { status: "active" } : {}),
      contact: { id: contactId, firmId, status: { not: "archived" } } },
    select: { id: true, contactId: true, status: true },
  });
  if (!account) throw new Error("Exact portal account/contact target is unavailable.");
  return account;
}

// New grants fail closed at customer read/share if issuer authority or policy changed.
// revision 0 explicitly preserves historical grants; no migration/backfill infers new approval.
export async function policyGrantIsCurrent(tx: any, grant: any) {
  try {
    if (!Number.isSafeInteger(grant.policyRevision) || grant.policyRevision < 0) return false;
    await assertCurrentPortalActor(tx, grant.firmId, grant.grantedById, ["canManagePortal", "canReadMatters", "canReadPortal"]);
    const matter = await assertPortalMatterScope(tx, grant.firmId, grant.matterId, grant.grantedById);
    // Legacy keeps its explicit capability/provenance, not inferred policy
    // admission. Current issuer/team/wall authority is still required.
    if (grant.policyRevision === 0) return true;
    const policy = await currentPortalPolicy(tx, grant.firmId);
    if (!policy || policy.revision !== grant.policyRevision) return false;
    if (!policy.statuses.includes(matter.status)) return false;
    await assertPortalAccountTarget(tx, grant.firmId, grant.portalAccountId, grant.contactId, true);
    return true;
  } catch {
    return false;
  }
}
