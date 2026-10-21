export const permissionKeys = [
  "canAccessDashboard",
  "canManageOnboarding",
  "canReadPeople",
  "canManagePeople",
  "canManageRoles",
  "canManageFirm",
  "canReadIntake",
  "canManageIntake",
  "canRunConflictChecks",
  "canResolveConflicts",
  "canReadMatters",
  "canManageMatters",
  "canManageEthicalWalls",
  "canReadCalendar",
  "canManageCalendar",
  "canReadTasks",
  "canManageTasks",
  "canReadCommunications",
  "canManageCommunications",
  "canReadDocuments",
  "canManageDocuments",
  "canReadBilling",
  "canManageBilling",
  "canReadTrust",
  "canManageTrust",
  "canReadPayments",
  "canManagePayments",
  "canReadPortal",
  "canManagePortal",
  "canReadIntegrations",
  "canManageIntegrations",
  "canReadMachineCredentials",
  "canManageMachineCredentials",
  "canReadRetention",
  "canManageRetention",
  "canViewAudit",
  "canReadAgents",
  "canManageAgents",
  "canApproveAgentActions",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

type SessionRole = {
  id: string;
  name: string;
  status?: string;
  firm?: { id: string } | null;
} & Partial<Record<PermissionKey, boolean>>;

type SessionMembership = {
  id: string;
  status: string;
  firm?: { id: string } | null;
  role?: SessionRole | null;
};

export type Session = {
  itemId: string;
  listKey: string;
  authenticationType?: "human" | "api_key" | "oauth" | "agent";
  machineScopes?: string[];
  credentialId?: string;
  oauthClientId?: string;
  agentPrincipalId?: string;
  agentCapabilities?: string[];
  agentExecution?: unknown;
  data: {
    name: string;
    status?: string;
    activeFirm?: { id: string; name: string; displayName?: string; shortName?: string; brandTagline?: string; brandColor?: string; supportEmail?: string; status?: string } | null;
    role?: SessionRole | null;
    firmMemberships?: SessionMembership[];
  };
};

export type AccessArgs = {
  session?: Session | null;
};

const bootstrapPermissions = new Set<PermissionKey>([
  "canAccessDashboard",
  "canManageOnboarding",
  "canManageFirm",
]);

export const machineScopePermissionMap: Readonly<Record<string, readonly PermissionKey[]>> = {
  "people:read": ["canReadPeople"],
  "intake:read": ["canReadIntake"],
  "intake:write": ["canReadIntake", "canManageIntake"],
  "conflicts:run": ["canRunConflictChecks"],
  "matters:read": ["canReadMatters"],
  "calendar:read": ["canReadCalendar"],
  "tasks:read": ["canReadTasks"],
  "tasks:write": ["canReadTasks", "canManageTasks"],
  "communications:read": ["canReadCommunications"],
  "communications:write": ["canReadCommunications", "canManageCommunications"],
  "documents:read": ["canReadDocuments"],
  "documents:write": ["canReadDocuments", "canManageDocuments"],
  "billing:read": ["canReadBilling"],
  "portal:read": ["canReadPortal"],
  "portal:write": ["canReadPortal", "canManagePortal"],
  "integrations:read": ["canReadIntegrations"],
  "integrations:write": ["canReadIntegrations", "canManageIntegrations"],
} as const;

export function activeFirmId(session?: Session | null) {
  return session?.data.activeFirm?.id ?? null;
}

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session?.itemId);
}

/** A person signed in with their own cookie session: not an API key, OAuth token,
 * agent credential or agent execution acting on that person's behalf. */
export function isHumanIdentitySession(session?: Session | null): session is Session {
  return Boolean(session?.itemId) &&
    (!session?.authenticationType || session.authenticationType === "human") &&
    !session?.credentialId &&
    !session?.oauthClientId &&
    !session?.agentPrincipalId &&
    !session?.agentExecution;
}

/** Mutation admission additionally requires the currently hydrated active user.
 * Identity-only projection may still return explicit denied flags for a revoked
 * human, without granting that identity permission to write its credentials. */
export function isInteractiveHumanSession(session?: Session | null): session is Session {
  return isHumanIdentitySession(session) && session.data.status === "active";
}

export function isInteractiveHuman({ session }: AccessArgs) {
  return isInteractiveHumanSession(session);
}

function machineHasPermission(session: Session, permission: PermissionKey) {
  return (session.machineScopes ?? []).some((scope) =>
    machineScopePermissionMap[scope]?.includes(permission),
  );
}

export function hasPermission(
  { session }: AccessArgs,
  permission: PermissionKey,
): boolean {
  if (!session?.itemId || (session.data.status ?? "active") !== "active") return false;
  const firmId = activeFirmId(session);
  const isMachine = Boolean(
    session.authenticationType && session.authenticationType !== "human",
  );
  if (!firmId) {
    if (isMachine) return false;
    return session.data.role?.firm === null && bootstrapPermissions.has(permission) &&
      (session.data.role?.status ?? "active") === "active" &&
      Boolean(session.data.role?.[permission]);
  }

  if (!["onboarding", "active"].includes(session.data.activeFirm?.status ?? "active")) return false;

  const memberships = session.data.firmMemberships ?? [];
  const activeMembership = memberships.find((membership) =>
    membership.status === "active" && membership.firm?.id === firmId,
  );
  if (activeMembership?.role?.firm?.id === firmId && activeMembership.role.status === "active") {
    // A credential narrows the CURRENT owner role; it never supplies a missing
    // role permission, including after a role downgrade on an unchanged key.
    return activeMembership.role[permission] === true &&
      (!isMachine || machineHasPermission(session, permission));
  }

  if (isMachine) return false;
  const isUnboundBootstrap =
    session.data.activeFirm?.status === "onboarding" &&
    bootstrapPermissions.has(permission) &&
    session.data.role?.firm === null &&
    memberships.every((membership) =>
      membership.status === "invited" && membership.firm?.id === firmId,
    );
  return isUnboundBootstrap &&
    (session.data.role?.status ?? "active") === "active" &&
    Boolean(session.data.role?.[permission]);
}

export const permissions = Object.fromEntries(
  permissionKeys.map((permission) => [
    permission,
    (args: AccessArgs) => hasPermission(args, permission),
  ]),
) as Record<PermissionKey, (args: AccessArgs) => boolean>;

function activeFirmFilter(session?: Session | null) {
  const firmId = activeFirmId(session);
  return firmId ? { firm: { id: { equals: firmId } } } : false;
}

function firmPermissionFilter(args: AccessArgs, permission: PermissionKey) {
  if (!hasPermission(args, permission)) return false;
  return activeFirmFilter(args.session);
}

function hasAnyPermission(args: AccessArgs, required: readonly PermissionKey[]) {
  return required.some((permission) => hasPermission(args, permission));
}

function ethicalWallFilter(userId: string) {
  return {
    blockedUsers: { none: { id: { equals: userId } } },
  };
}

function accessibleMatterFilter(userId: string) {
  return {
    AND: [
      {
        OR: [
          { confidentiality: { not: { equals: "restricted" } } },
          { AND: [
            { authorizedUsers: { some: { id: { equals: userId } } } },
            { teamMembers: { some: { user: { id: { equals: userId } }, status: { equals: "active" }, canAccessRestricted: { equals: true } } } },
          ] },
        ],
      },
      ethicalWallFilter(userId),
      { ethicalWalls: { none: { status: { equals: "active" }, members: { some: { user: { id: { equals: userId } }, status: { equals: "active" }, decision: { equals: "blocked" } } } } } },
    ],
  };
}

function matterFilter(args: AccessArgs, required: readonly PermissionKey[]) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;

  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      accessibleMatterFilter(session.itemId),
    ],
  };
}

function matterRecordFilter(args: AccessArgs, required: readonly PermissionKey[]) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;

  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      { matter: accessibleMatterFilter(session.itemId) },
    ],
  };
}

function optionalMatterRecordFilter(args: AccessArgs, required: readonly PermissionKey[]) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;

  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      {
        OR: [
          { matter: null },
          { matter: accessibleMatterFilter(session.itemId) },
        ],
      },
    ],
  };
}

const conflictPermissions: readonly PermissionKey[] = ["canReadIntake", "canRunConflictChecks", "canResolveConflicts"];

function optionalAccessibleRelation(relation: string, matterFilter: Record<string, unknown>) {
  return { OR: [{ [relation]: null }, { [relation]: matterFilter }] };
}

function conflictMatchSourceFilter(userId: string, canReadPeople: boolean) {
  const matter = accessibleMatterFilter(userId);
  return {
    AND: [
      optionalAccessibleRelation("matter", matter),
      { check: { OR: [{ matter: null }, { matter }] } },
      optionalAccessibleRelation("matchedMatter", matter),
      { OR: [{ matchedMatterParty: null }, { matchedMatterParty: { matter } }] },
      ...(canReadPeople ? [] : [{ matchedContact: null }]),
      {
        OR: [
          { matchedMatter: { id: { notIn: [] } } },
          { matchedMatterParty: { id: { notIn: [] } } },
          { matchedContact: { id: { notIn: [] } } },
        ],
      },
    ],
  };
}

function conflictTermSourceFilter(userId: string, canReadPeople: boolean) {
  const matter = accessibleMatterFilter(userId);
  return {
    AND: [
      optionalAccessibleRelation("matter", matter),
      { check: { OR: [{ matter: null }, { matter }] } },
      ...(canReadPeople ? [] : [{ sourceContact: null }]),
    ],
  };
}

function conflictRecordFilter(args: AccessArgs) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, conflictPermissions)) return false;
  const canReadPeople = hasPermission(args, "canReadPeople");
  const matter = accessibleMatterFilter(session.itemId);
  const conflictMatch = conflictMatchSourceFilter(session.itemId, canReadPeople);
  const conflictTerm = conflictTermSourceFilter(session.itemId, canReadPeople);
  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      optionalAccessibleRelation("matter", matter),
      { matches: { every: conflictMatch } },
      { terms: { every: conflictTerm } },
      {
        dispositions: {
          every: {
            AND: [
              optionalAccessibleRelation("matter", matter),
              { OR: [{ match: null }, { match: conflictMatch }] },
            ],
          },
        },
      },
    ],
  };
}

function conflictChildRecordFilter(args: AccessArgs, child: "term" | "match" | "disposition") {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, conflictPermissions)) return false;
  const matter = accessibleMatterFilter(session.itemId);
  const canReadPeople = hasPermission(args, "canReadPeople");
  const scope = child === "term"
    ? conflictTermSourceFilter(session.itemId, canReadPeople)
    : child === "match"
      ? conflictMatchSourceFilter(session.itemId, canReadPeople)
      : {
          AND: [
            optionalAccessibleRelation("matter", matter),
            { check: { OR: [{ matter: null }, { matter }] } },
            { OR: [{ match: null }, { match: conflictMatchSourceFilter(session.itemId, canReadPeople) }] },
          ],
        };
  return { AND: [{ firm: { id: { equals: firmId } } }, scope] };
}

function trustTransactionFilter(args: AccessArgs) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, ["canReadTrust", "canManageTrust"])) return false;
  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      {
        entries: {
          every: {
            OR: [
              { matter: null },
              { matter: accessibleMatterFilter(session.itemId) },
            ],
          },
        },
      },
    ],
  };
}

function trustEntryFilter(args: AccessArgs) {
  const transaction = trustTransactionFilter(args);
  if (transaction === false) return false;
  const [firm, entryScope] = (transaction as any).AND;
  return { AND: [firm, { transaction: entryScope }] };
}

export const rules = {
  activeFirmOwned: ({ session }: AccessArgs) => activeFirmFilter(session),
  canReadPeople: (args: AccessArgs) => {
    const { session } = args;
    if (!session?.itemId) return false;
    const firmId = activeFirmId(session);
    if (firmId && hasPermission(args, "canReadPeople")) {
      return {
        OR: [
          { id: { equals: session.itemId } },
          {
            firmMemberships: {
              some: {
                firm: { id: { equals: firmId } },
                status: { equals: "active" },
              },
            },
          },
        ],
      };
    }
    return { id: { equals: session.itemId } };
  },
  // User is one global identity that can hold memberships in several firms, so a firm's
  // people managers do not edit it. Generated updates are limited to the person's own
  // record from an interactive session; firm administration uses the membership commands.
  canUpdateOwnIdentity: ({ session }: AccessArgs) =>
    isInteractiveHumanSession(session) ? { id: { equals: session.itemId } } : false,
  canReadContact: (args: AccessArgs) => firmPermissionFilter(args, "canReadPeople"),
  canManageContact: (args: AccessArgs) => firmPermissionFilter(args, "canManagePeople"),
  canReadIntake: (args: AccessArgs) => firmPermissionFilter(args, "canReadIntake"),
  canManageIntake: (args: AccessArgs) => firmPermissionFilter(args, "canManageIntake"),
  canReadMatter: (args: AccessArgs) => matterFilter(args, ["canReadMatters"]),
  canManageMatter: (args: AccessArgs) => matterFilter(args, ["canManageMatters"]),
  canReadMatterRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadMatters"]),
  canManageMatterRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManageMatters"]),
  canReadConflictRecord: conflictRecordFilter,
  canReadConflictTerm: (args: AccessArgs) => conflictChildRecordFilter(args, "term"),
  canReadConflictMatch: (args: AccessArgs) => conflictChildRecordFilter(args, "match"),
  canReadConflictDisposition: (args: AccessArgs) => conflictChildRecordFilter(args, "disposition"),
  canResolveConflictRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canResolveConflicts"]),
  canReadEthicalWallRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadMatters"]),
  canManageEthicalWallRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManageEthicalWalls"]),
  canReadCalendarRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadCalendar", "canReadMatters"]),
  canManageCalendarRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManageCalendar"]),
  canReadTaskRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadTasks", "canReadMatters"]),
  canManageTaskRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManageTasks"]),
  canReadCommunicationRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadCommunications", "canManageCommunications"]),
  canManageCommunicationRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageCommunications"]),
  canReadDocumentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadDocuments", "canManageDocuments"]),
  canManageDocumentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageDocuments"]),
  canReadBillingRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadBilling", "canManageBilling"]),
  canManageBillingRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManageBilling"]),
  canReadOptionalBillingRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadBilling", "canManageBilling"]),
  canManageOptionalBillingRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageBilling"]),
  canReadTrustRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadTrust", "canManageTrust"]),
  canReadTrustTransaction: trustTransactionFilter,
  canReadTrustEntry: trustEntryFilter,
  canManageTrustRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageTrust"]),
  canReadPaymentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadPayments", "canManagePayments", "canReadBilling", "canReadTrust"]),
  canManagePaymentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManagePayments"]),
  canReadPortalRecord: (args: AccessArgs) => matterRecordFilter(args, ["canReadPortal", "canManagePortal"]),
  canManagePortalRecord: (args: AccessArgs) => matterRecordFilter(args, ["canManagePortal"]),
  canReadIntegrationRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadIntegrations", "canManageIntegrations"]),
  canManageIntegrationRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageIntegrations"]),
  canReadRetentionRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadRetention", "canManageRetention"]),
  canManageRetentionRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageRetention"]),
  canReadAgentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canReadAgents", "canManageAgents"]),
  canManageAgentRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canManageAgents"]),
  canReadAuditRecord: (args: AccessArgs) => optionalMatterRecordFilter(args, ["canViewAudit"]),
  canReadBilling: (args: AccessArgs) => firmPermissionFilter(args, "canReadBilling"),
  canManageBilling: (args: AccessArgs) => firmPermissionFilter(args, "canManageBilling"),
  canManageTrust: (args: AccessArgs) => firmPermissionFilter(args, "canManageTrust"),
  canManagePayments: (args: AccessArgs) => firmPermissionFilter(args, "canManagePayments"),
  canManagePortal: (args: AccessArgs) => firmPermissionFilter(args, "canManagePortal"),
  canManageIntegrations: (args: AccessArgs) => firmPermissionFilter(args, "canManageIntegrations"),
  canManageRetention: (args: AccessArgs) => firmPermissionFilter(args, "canManageRetention"),
  canViewAudit: (args: AccessArgs) => firmPermissionFilter(args, "canViewAudit"),
  canManageAgents: (args: AccessArgs) => firmPermissionFilter(args, "canManageAgents"),
};
