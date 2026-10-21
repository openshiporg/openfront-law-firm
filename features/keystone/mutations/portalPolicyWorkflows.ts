import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { sha256Digest } from "../lib/digests";
import { prismaWithoutGraphQLErrorConversion, runSerializableTransaction } from "../lib/transactions";
import {
  assertCurrentPortalActor, assertPortalAccountTarget, assertPortalMatterScope,
  currentPortalPolicy, normalizePortalPolicy, portalGrantProjection,
} from "../lib/portal-policy";
import { boundedReason, recordAuditEvent, requirePermission } from "./workflow-helpers";

export type PortalGrantCommand = {
  operation: "grant" | "revoke";
  idempotencyKey: string;
  policyRevision: number;
  expectedVersion: number;
  portalAccountId: string;
  contactId: string;
  matterId: string;
  grantId?: string | null;
  canReadDocuments?: boolean | null;
  canUploadDocuments?: boolean | null;
  canReadInvoices?: boolean | null;
  canReadMessages?: boolean | null;
  expiresAt?: string | null;
  reason: string;
};

function boundedId(value: string | null | undefined) {
  if (!value || value !== value.trim() || value.length > 200) throw new Error("An exact bounded target identifier is required.");
  return value;
}

export async function recordPortalDiscoveryPolicy(_root: unknown, args: {
  expectedRevision: number; mode: string; statuses: string[]; reason: string;
}, context: Context) {
  // Firm configuration authority is inherited from Firm update; not canManagePortal.
  const { firmId, userId } = requirePermission(context, "canManageFirm", { humanOnly: true });
  const policy = normalizePortalPolicy(args.mode, args.statuses);
  const reason = boundedReason(args.reason, "Policy review reason", 5, 2000);
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0 || args.expectedRevision >= 2_147_483_647) throw new Error("Invalid policy revision.");
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageFirm");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await assertCurrentPortalActor(tx, firmId, userId, ["canManageFirm"]);
    const latest = await tx.portalDiscoveryPolicy.findFirst({ where: { firmId }, orderBy: { revision: "desc" } });
    if ((latest?.revision ?? 0) !== args.expectedRevision) throw new Error("Policy changed; reload before recording a revision.");
    const data = { firmId, revision: args.expectedRevision + 1, ...policy, reasonDigest: sha256Digest(reason), recordedById: userId, recordedAt: new Date() };
    const recorded = await tx.portalDiscoveryPolicy.create({ data });
    await recordAuditEvent(tx, { firmId, actorUserId: userId, category: "authorization", eventType: "portal.discovery_policy_recorded", metadata: { revision: data.revision, mode: policy.mode, statuses: policy.statuses, admission: policy.admission, reasonDigest: data.reasonDigest } });
    return recorded;
  });
}

export async function executePortalGrant(_root: unknown, args: PortalGrantCommand, context: Context) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  requirePermission(context, "canReadMatters", { humanOnly: true });
  requirePermission(context, "canReadPortal", { humanOnly: true });
  if (!["grant", "revoke"].includes(args.operation)) throw new Error("Unsupported matter-grant command.");
  const reason = boundedReason(args.reason, "Grant intent reason", 5, 2000);
  const key = boundedId(args.idempotencyKey);
  const portalAccountId = boundedId(args.portalAccountId);
  const matterId = boundedId(args.matterId);
  const contactId = boundedId(args.contactId);
  const grantId = args.grantId ? boundedId(args.grantId) : null;
  if (!Number.isSafeInteger(args.policyRevision) || args.policyRevision < 1 || !Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0 || args.expectedVersion >= 2_147_483_647) throw new Error("Explicit policy revision and grant version are required.");
  const capabilities = {
    canReadDocuments: args.canReadDocuments === true, canUploadDocuments: args.canUploadDocuments === true,
    canReadInvoices: args.canReadInvoices === true, canReadMessages: args.canReadMessages === true,
  };
  if (args.operation === "revoke" && (Object.values(capabilities).some(Boolean) || args.expiresAt || !grantId)) throw new Error("Revocation requires only an exact grant and reason.");
  if (args.operation === "grant" && !Object.values(capabilities).some(Boolean)) throw new Error("At least one explicit capability is required.");
  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Invalid expiration.");
  const intentDigest = sha256Digest({ operation: args.operation, firmId, actorId: userId, portalAccountId, contactId, matterId, grantId, policyRevision: args.policyRevision, expectedVersion: args.expectedVersion, capabilities, expiresAt: expiresAt?.toISOString() ?? null, reason });
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    // All policy-backed commands serialize on policy, then account/target. SSI also
    // conflicts with direct status/team/wall writers; no lock-only authorization claim.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${portalAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access:${firmId}:${portalAccountId}:${matterId}`}))`;
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal", "canReadMatters", "canReadPortal"]);
    const policy = await currentPortalPolicy(tx, firmId);
    if (!policy || policy.revision !== args.policyRevision) throw new Error("Admitted policy changed or is missing; reload the directory.");
    const matter = await assertPortalMatterScope(tx, firmId, matterId, userId);
    await assertPortalAccountTarget(tx, firmId, portalAccountId, contactId, args.operation === "grant");
    if (args.operation === "grant" && !policy.statuses.includes(matter.status)) throw new Error("Current matter status is not grantable under this policy.");
    const prior = await tx.portalGrantIntent.findUnique({ where: { firmId_actorId_idempotencyKey: { firmId, actorId: userId, idempotencyKey: key } } });
    if (prior && prior.intentDigest !== intentDigest) throw new Error("Idempotency key belongs to a different exact intent.");
    if (prior) {
      const grant = await tx.portalMatterAccess.findFirst({ where: { id: prior.grantId, firmId, portalAccountId, matterId } });
      if (!grant || grant.version !== prior.resultVersion || grant.status !== (args.operation === "grant" ? "active" : "revoked")) throw new Error("Intent completed but current grant changed; inspect history instead of replaying.");
      if (args.operation === "grant" && grant.expiresAt && grant.expiresAt <= new Date()) throw new Error("Completed grant has expired; create a new reviewed intent.");
      return { grant: portalGrantProjection(grant), replayed: true, intentId: prior.id };
    }
    if (expiresAt && (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 366 * 86_400_000)) throw new Error("Expiration must be future and within 366 days.");
    const existing = await tx.portalMatterAccess.findFirst({ where: { firmId, portalAccountId, matterId }, orderBy: [{ grantedAt: "desc" }, { id: "asc" }] });
    const activeCount = await tx.portalMatterAccess.count({ where: { firmId, portalAccountId, matterId, status: "active" } });
    if (activeCount > 1 || (activeCount === 1 && existing?.status !== "active")) throw new Error("Legacy grant set is inconsistent; explicitly review/revoke account access before regranting.");
    if ((existing?.id ?? null) !== grantId || (existing?.version ?? 0) !== args.expectedVersion) throw new Error("Grant target/version changed; reload before retrying.");
    // Ensure replacement sorting remains unambiguous even in the same millisecond.
    const now = new Date(Math.max(Date.now(), (existing?.grantedAt?.getTime() ?? 0) + 1));
    let grant;
    if (args.operation === "revoke") {
      if (!existing || !["active", "expired"].includes(existing.status)) throw new Error("Grant is not revocable in its current state.");
      const changed = await tx.portalMatterAccess.updateMany({ where: { id: existing.id, version: args.expectedVersion, status: existing.status }, data: { status: "revoked", version: args.expectedVersion + 1, revokedById: userId, revokedAt: now, revocationReason: reason, updatedAt: now } });
      if (changed.count !== 1) throw new Error("Grant changed concurrently.");
      await tx.portalShare.updateMany({ where: { firmId, matterAccessId: existing.id, status: "active" }, data: { status: "revoked", revokedById: userId, revokedAt: now, updatedAt: now } });
      grant = await tx.portalMatterAccess.findUnique({ where: { id: existing.id } });
    } else {
      // Capability corrections retire the original rather than silently rewriting it.
      if (existing?.status === "active") {
        const retired = await tx.portalMatterAccess.updateMany({ where: { id: existing.id, version: args.expectedVersion, status: "active" }, data: { status: "revoked", version: args.expectedVersion + 1, revokedById: userId, revokedAt: now, revocationReason: reason, updatedAt: now } });
        if (retired.count !== 1) throw new Error("Grant changed concurrently.");
        await tx.portalShare.updateMany({ where: { firmId, matterAccessId: existing.id, status: "active" }, data: { status: "revoked", revokedById: userId, revokedAt: now, updatedAt: now } });
      }
      grant = await tx.portalMatterAccess.create({ data: { firmId, matterId, portalAccountId, contactId, policyRevision: policy.revision, version: 1, status: "active", ...capabilities, grantedById: userId, grantedAt: now, expiresAt } });
    }
    const intent = await tx.portalGrantIntent.create({ data: { firmId, actorId: userId, matterId, portalAccountId, contactId, grantId: grant.id, idempotencyKey: key, intentDigest, operation: args.operation, policyRevision: policy.revision, resultVersion: grant.version, completedAt: now } });
    await recordAuditEvent(tx, { firmId, actorUserId: userId, matterId, contactId, category: "authorization", eventType: `portal.matter_access_${args.operation === "grant" ? "granted" : "revoked"}`, metadata: { intentId: intent.id, intentDigest, portalMatterAccessId: grant.id, previousGrantId: existing?.id ?? null, policyRevision: policy.revision, resultVersion: grant.version } });
    return { grant: portalGrantProjection(grant), replayed: false, intentId: intent.id };
  });
}

export async function portalPolicyWorkspace(_root: unknown, args: { search?: string | null; status?: string | null; page?: number | null; matterId?: string | null; portalAccountId?: string | null }, context: Context) {
  const canReadPortal = permissions.canReadPortal({ session: context.session as any });
  const entryPermission = canReadPortal ? "canReadPortal" : "canManageFirm";
  const { firmId, userId } = requirePermission(context, entryPermission, { humanOnly: true });
  const tx = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  await assertCurrentPortalActor(tx, firmId, userId, [entryPermission]);
  const policy = await currentPortalPolicy(tx, firmId);
  const latest = await tx.portalDiscoveryPolicy.findFirst({ where: { firmId }, orderBy: { revision: "desc" } });
  const policyHistory = await tx.portalDiscoveryPolicy.findMany({ where: { firmId }, orderBy: { revision: "desc" }, take: 12, select: { revision: true, mode: true, statuses: true, admission: true } });
  const currentCapability = async (key: "canManageFirm" | "canManagePortal") => {
    if (!permissions[key]({ session: context.session as any })) return false;
    try { await assertCurrentPortalActor(tx, firmId, userId, [key]); return true; } catch { return false; }
  };
  const canConfigure = await currentCapability("canManageFirm");
  const canManage = await currentCapability("canManagePortal");
  const base = { policy, policyHistory, latestRevision: latest?.revision ?? 0, latestChoice: latest?.mode ?? "legacy_unconfigured", latestAdmission: latest?.admission ?? "unconfigured", canConfigure, canManage, items: [], total: 0, page: 1, hasNext: false, accounts: [], grants: [], history: [], selection: null };
  if (!canReadPortal) return { ...base, state: "portal_read_denied" };
  if (!policy) return { ...base, state: "unconfigured" };
  if (!permissions.canReadMatters({ session: context.session as any })) return { ...base, state: "matter_read_denied" };
  await assertCurrentPortalActor(tx, firmId, userId, ["canReadPortal", "canReadMatters"]);
  const search = args.search?.trim() ?? "";
  if (search.length > 100 || (args.status && !policy.statuses.includes(args.status))) throw new Error("Invalid directory search or policy status.");
  const page = args.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1 || (page - 1) * 12 > 2_147_483_647) throw new Error("Invalid bounded directory page.");
  const where = { status: { in: args.status ? [args.status] : policy.statuses }, ...(search ? { matterNumber: { contains: search, mode: "insensitive" } } : {}) };
  const api = (context.query as any).Matter;
  const [total, items, accounts] = await Promise.all([
    api.count({ where }),
    api.findMany({ where, orderBy: [{ matterNumber: "asc" }, { id: "asc" }], take: 12, skip: (page - 1) * 12, query: "id matterNumber status" }),
    (context.query as any).PortalAccount.findMany({ where: { status: { equals: "active" } }, orderBy: [{ id: "asc" }], take: 12, query: "id status contact { id }" }),
  ]);
  let grants: any[] = [], history: any[] = [];
  let selection: any = null;
  if (args.matterId && args.portalAccountId) {
    // Exact selection may be off-page. Reapply List/field scope; never echo denied IDs.
    const selected = await api.findOne({ where: { id: boundedId(args.matterId) }, query: "id matterNumber status" });
    if (!selected) throw new Error("Selected target is unavailable.");
    selection = { id: selected.id, matterNumber: selected.matterNumber, status: selected.status };
    grants = await (context.query as any).PortalMatterAccess.findMany({ where: { matter: { id: { equals: selected.id } }, portalAccount: { id: { equals: boundedId(args.portalAccountId) } } }, orderBy: [{ grantedAt: "desc" }, { id: "asc" }], take: 12, query: "id status version policyRevision canReadDocuments canUploadDocuments canReadInvoices canReadMessages expiresAt" });
    history = await (context.query as any).PortalGrantIntent.findMany({ where: { matter: { id: { equals: selected.id } }, portalAccount: { id: { equals: args.portalAccountId } }, actor: { id: { equals: userId } } }, orderBy: [{ completedAt: "desc" }, { id: "asc" }], take: 12, query: "id operation policyRevision resultVersion completedAt grant { id }" });
  }
  return { ...base, state: "ready", selection, items, total, page, hasNext: page * 12 < total, accounts: accounts.filter((account: any) => account.contact?.id).map((account: any) => ({ id: account.id, contactId: account.contact.id })), grants, history };
}
