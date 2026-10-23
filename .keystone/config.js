"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core21 = require("@keystone-6/core");
var import_session = require("@keystone-6/core/session");
var import_config = require("dotenv/config");

// features/keystone/access.ts
var permissionKeys = [
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
  "canApproveAgentActions"
];
var bootstrapPermissions = /* @__PURE__ */ new Set([
  "canAccessDashboard",
  "canManageOnboarding",
  "canManageFirm"
]);
var machineScopePermissionMap = {
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
  "integrations:write": ["canReadIntegrations", "canManageIntegrations"]
};
function activeFirmId(session) {
  return session?.data.activeFirm?.id ?? null;
}
function isSignedIn({ session }) {
  return Boolean(session?.itemId);
}
function isHumanIdentitySession(session) {
  return Boolean(session?.itemId) && (!session?.authenticationType || session.authenticationType === "human") && !session?.credentialId && !session?.oauthClientId && !session?.agentPrincipalId && !session?.agentExecution;
}
function isInteractiveHumanSession(session) {
  return isHumanIdentitySession(session) && session.data.status === "active";
}
function isInteractiveHuman({ session }) {
  return isInteractiveHumanSession(session);
}
function machineHasPermission(session, permission) {
  return (session.machineScopes ?? []).some(
    (scope) => machineScopePermissionMap[scope]?.includes(permission)
  );
}
function hasPermission({ session }, permission) {
  if (!session?.itemId || (session.data.status ?? "active") !== "active") return false;
  const firmId = activeFirmId(session);
  const isMachine = Boolean(
    session.authenticationType && session.authenticationType !== "human"
  );
  if (!firmId) {
    if (isMachine) return false;
    return session.data.role?.firm === null && bootstrapPermissions.has(permission) && (session.data.role?.status ?? "active") === "active" && Boolean(session.data.role?.[permission]);
  }
  if (!["onboarding", "active"].includes(session.data.activeFirm?.status ?? "active")) return false;
  const memberships = session.data.firmMemberships ?? [];
  const activeMembership = memberships.find(
    (membership) => membership.status === "active" && membership.firm?.id === firmId
  );
  if (activeMembership?.role?.firm?.id === firmId && activeMembership.role.status === "active") {
    return activeMembership.role[permission] === true && (!isMachine || machineHasPermission(session, permission));
  }
  if (isMachine) return false;
  const isUnboundBootstrap = session.data.activeFirm?.status === "onboarding" && bootstrapPermissions.has(permission) && session.data.role?.firm === null && memberships.every(
    (membership) => membership.status === "invited" && membership.firm?.id === firmId
  );
  return isUnboundBootstrap && (session.data.role?.status ?? "active") === "active" && Boolean(session.data.role?.[permission]);
}
var permissions = Object.fromEntries(
  permissionKeys.map((permission) => [
    permission,
    (args) => hasPermission(args, permission)
  ])
);
function activeFirmFilter(session) {
  const firmId = activeFirmId(session);
  return firmId ? { firm: { id: { equals: firmId } } } : false;
}
function firmPermissionFilter(args, permission) {
  if (!hasPermission(args, permission)) return false;
  return activeFirmFilter(args.session);
}
function hasAnyPermission(args, required) {
  return required.some((permission) => hasPermission(args, permission));
}
function ethicalWallFilter(userId) {
  return {
    blockedUsers: { none: { id: { equals: userId } } }
  };
}
function accessibleMatterFilter(userId) {
  return {
    AND: [
      {
        OR: [
          { confidentiality: { not: { equals: "restricted" } } },
          { AND: [
            { authorizedUsers: { some: { id: { equals: userId } } } },
            { teamMembers: { some: { user: { id: { equals: userId } }, status: { equals: "active" }, canAccessRestricted: { equals: true } } } }
          ] }
        ]
      },
      ethicalWallFilter(userId),
      { ethicalWalls: { none: { status: { equals: "active" }, members: { some: { user: { id: { equals: userId } }, status: { equals: "active" }, decision: { equals: "blocked" } } } } } }
    ]
  };
}
function matterFilter(args, required) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;
  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      accessibleMatterFilter(session.itemId)
    ]
  };
}
function matterRecordFilter(args, required) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;
  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      { matter: accessibleMatterFilter(session.itemId) }
    ]
  };
}
function optionalMatterRecordFilter(args, required) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, required)) return false;
  return {
    AND: [
      { firm: { id: { equals: firmId } } },
      {
        OR: [
          { matter: null },
          { matter: accessibleMatterFilter(session.itemId) }
        ]
      }
    ]
  };
}
var conflictPermissions = ["canReadIntake", "canRunConflictChecks", "canResolveConflicts"];
function optionalAccessibleRelation(relation, matterFilter2) {
  return { OR: [{ [relation]: null }, { [relation]: matterFilter2 }] };
}
function conflictMatchSourceFilter(userId, canReadPeople) {
  const matter = accessibleMatterFilter(userId);
  return {
    AND: [
      optionalAccessibleRelation("matter", matter),
      { check: { OR: [{ matter: null }, { matter }] } },
      optionalAccessibleRelation("matchedMatter", matter),
      { OR: [{ matchedMatterParty: null }, { matchedMatterParty: { matter } }] },
      ...canReadPeople ? [] : [{ matchedContact: null }],
      {
        OR: [
          { matchedMatter: { id: { notIn: [] } } },
          { matchedMatterParty: { id: { notIn: [] } } },
          { matchedContact: { id: { notIn: [] } } }
        ]
      }
    ]
  };
}
function conflictTermSourceFilter(userId, canReadPeople) {
  const matter = accessibleMatterFilter(userId);
  return {
    AND: [
      optionalAccessibleRelation("matter", matter),
      { check: { OR: [{ matter: null }, { matter }] } },
      ...canReadPeople ? [] : [{ sourceContact: null }]
    ]
  };
}
function conflictRecordFilter(args) {
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
              { OR: [{ match: null }, { match: conflictMatch }] }
            ]
          }
        }
      }
    ]
  };
}
function conflictChildRecordFilter(args, child) {
  const { session } = args;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !hasAnyPermission(args, conflictPermissions)) return false;
  const matter = accessibleMatterFilter(session.itemId);
  const canReadPeople = hasPermission(args, "canReadPeople");
  const scope = child === "term" ? conflictTermSourceFilter(session.itemId, canReadPeople) : child === "match" ? conflictMatchSourceFilter(session.itemId, canReadPeople) : {
    AND: [
      optionalAccessibleRelation("matter", matter),
      { check: { OR: [{ matter: null }, { matter }] } },
      { OR: [{ match: null }, { match: conflictMatchSourceFilter(session.itemId, canReadPeople) }] }
    ]
  };
  return { AND: [{ firm: { id: { equals: firmId } } }, scope] };
}
function trustTransactionFilter(args) {
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
              { matter: accessibleMatterFilter(session.itemId) }
            ]
          }
        }
      }
    ]
  };
}
function trustEntryFilter(args) {
  const transaction = trustTransactionFilter(args);
  if (transaction === false) return false;
  const [firm, entryScope] = transaction.AND;
  return { AND: [firm, { transaction: entryScope }] };
}
var rules = {
  activeFirmOwned: ({ session }) => activeFirmFilter(session),
  canReadPeople: (args) => {
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
                status: { equals: "active" }
              }
            }
          }
        ]
      };
    }
    return { id: { equals: session.itemId } };
  },
  // User is one global identity that can hold memberships in several firms, so a firm's
  // people managers do not edit it. Generated updates are limited to the person's own
  // record from an interactive session; firm administration uses the membership commands.
  canUpdateOwnIdentity: ({ session }) => isInteractiveHumanSession(session) ? { id: { equals: session.itemId } } : false,
  canReadContact: (args) => firmPermissionFilter(args, "canReadPeople"),
  canManageContact: (args) => firmPermissionFilter(args, "canManagePeople"),
  canReadIntake: (args) => firmPermissionFilter(args, "canReadIntake"),
  canManageIntake: (args) => firmPermissionFilter(args, "canManageIntake"),
  canReadMatter: (args) => matterFilter(args, ["canReadMatters"]),
  canManageMatter: (args) => matterFilter(args, ["canManageMatters"]),
  canReadMatterRecord: (args) => matterRecordFilter(args, ["canReadMatters"]),
  canManageMatterRecord: (args) => matterRecordFilter(args, ["canManageMatters"]),
  canReadConflictRecord: conflictRecordFilter,
  canReadConflictTerm: (args) => conflictChildRecordFilter(args, "term"),
  canReadConflictMatch: (args) => conflictChildRecordFilter(args, "match"),
  canReadConflictDisposition: (args) => conflictChildRecordFilter(args, "disposition"),
  canResolveConflictRecord: (args) => optionalMatterRecordFilter(args, ["canResolveConflicts"]),
  canReadEthicalWallRecord: (args) => matterRecordFilter(args, ["canReadMatters"]),
  canManageEthicalWallRecord: (args) => matterRecordFilter(args, ["canManageEthicalWalls"]),
  canReadCalendarRecord: (args) => matterRecordFilter(args, ["canReadCalendar", "canReadMatters"]),
  canManageCalendarRecord: (args) => matterRecordFilter(args, ["canManageCalendar"]),
  canReadTaskRecord: (args) => matterRecordFilter(args, ["canReadTasks", "canReadMatters"]),
  canManageTaskRecord: (args) => matterRecordFilter(args, ["canManageTasks"]),
  canReadCommunicationRecord: (args) => optionalMatterRecordFilter(args, ["canReadCommunications", "canManageCommunications"]),
  canManageCommunicationRecord: (args) => optionalMatterRecordFilter(args, ["canManageCommunications"]),
  canReadDocumentRecord: (args) => optionalMatterRecordFilter(args, ["canReadDocuments", "canManageDocuments"]),
  canManageDocumentRecord: (args) => optionalMatterRecordFilter(args, ["canManageDocuments"]),
  canReadBillingRecord: (args) => matterRecordFilter(args, ["canReadBilling", "canManageBilling"]),
  canManageBillingRecord: (args) => matterRecordFilter(args, ["canManageBilling"]),
  canReadOptionalBillingRecord: (args) => optionalMatterRecordFilter(args, ["canReadBilling", "canManageBilling"]),
  canManageOptionalBillingRecord: (args) => optionalMatterRecordFilter(args, ["canManageBilling"]),
  canReadTrustRecord: (args) => optionalMatterRecordFilter(args, ["canReadTrust", "canManageTrust"]),
  canReadTrustTransaction: trustTransactionFilter,
  canReadTrustEntry: trustEntryFilter,
  canManageTrustRecord: (args) => optionalMatterRecordFilter(args, ["canManageTrust"]),
  canReadPaymentRecord: (args) => optionalMatterRecordFilter(args, ["canReadPayments", "canManagePayments", "canReadBilling", "canReadTrust"]),
  canManagePaymentRecord: (args) => optionalMatterRecordFilter(args, ["canManagePayments"]),
  canReadPortalRecord: (args) => matterRecordFilter(args, ["canReadPortal", "canManagePortal"]),
  canManagePortalRecord: (args) => matterRecordFilter(args, ["canManagePortal"]),
  canReadIntegrationRecord: (args) => optionalMatterRecordFilter(args, ["canReadIntegrations", "canManageIntegrations"]),
  canManageIntegrationRecord: (args) => optionalMatterRecordFilter(args, ["canManageIntegrations"]),
  canReadRetentionRecord: (args) => optionalMatterRecordFilter(args, ["canReadRetention", "canManageRetention"]),
  canManageRetentionRecord: (args) => optionalMatterRecordFilter(args, ["canManageRetention"]),
  canReadAgentRecord: (args) => optionalMatterRecordFilter(args, ["canReadAgents", "canManageAgents"]),
  canManageAgentRecord: (args) => optionalMatterRecordFilter(args, ["canManageAgents"]),
  canReadAuditRecord: (args) => optionalMatterRecordFilter(args, ["canViewAudit"]),
  canReadBilling: (args) => firmPermissionFilter(args, "canReadBilling"),
  canManageBilling: (args) => firmPermissionFilter(args, "canManageBilling"),
  canManageTrust: (args) => firmPermissionFilter(args, "canManageTrust"),
  canManagePayments: (args) => firmPermissionFilter(args, "canManagePayments"),
  canManagePortal: (args) => firmPermissionFilter(args, "canManagePortal"),
  canManageIntegrations: (args) => firmPermissionFilter(args, "canManageIntegrations"),
  canManageRetention: (args) => firmPermissionFilter(args, "canManageRetention"),
  canViewAudit: (args) => firmPermissionFilter(args, "canViewAudit"),
  canManageAgents: (args) => firmPermissionFilter(args, "canManageAgents")
};

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  throw new Error("Email link origin is not configured.");
}
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function passwordResetPurpose(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bootstrapKey: true, firmMemberships: { select: { id: true }, take: 1 } }
  });
  return !user || user.bootstrapKey || user.firmMemberships?.length ? "staff" : "customer";
}
var resetPaths = { staff: "/dashboard/reset", customer: "/account/reset" };
async function sendPasswordResetEmail(resetToken, to, baseUrl, purpose = "staff") {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Email delivery is not configured.");
  }
  if (to.length > 254 || !/^[^\s@<>,;()]+@[^\s@<>,;()]+\.[^\s@<>,;()]+$/.test(to)) {
    throw new Error("A single valid recipient is required.");
  }
  const origin = new URL(baseUrl || getBaseUrlForEmails());
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) throw new Error("Email link origin is invalid.");
  const resetUrl = new URL(resetPaths[purpose], origin.origin);
  resetUrl.searchParams.set("token", resetToken);
  const transport = (0, import_nodemailer.createTransport)({ host, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({
    to,
    from,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: resetUrl.href
    })
  });
}

// features/keystone/models/User.ts
var import_node_crypto3 = require("node:crypto");
var import_core = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");

// features/keystone/tenancy.ts
var import_node_crypto = require("node:crypto");
var import_client = require("@prisma/client");

// features/keystone/lib/matter-access.ts
function accessibleMatterStorageWhere(firmId, userId) {
  return {
    firmId,
    AND: [
      {
        OR: [
          { confidentiality: { not: "restricted" } },
          {
            AND: [
              { authorizedUsers: { some: { id: userId } } },
              { teamMembers: { some: { firmId, userId, status: "active", canAccessRestricted: true } } }
            ]
          }
        ]
      },
      { blockedUsers: { none: { id: userId } } },
      { ethicalWalls: { none: { status: "active", members: { some: { userId, status: "active", decision: "blocked" } } } } }
    ]
  };
}

// features/keystone/lib/lifecycles.ts
var lifecycles = {
  firm: {
    onboarding: ["active", "closed"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    closed: []
  },
  user: {
    invited: ["active", "deactivated"],
    active: ["suspended", "deactivated"],
    suspended: ["active", "deactivated"],
    deactivated: []
  },
  membership: {
    invited: ["active", "ended"],
    active: ["suspended", "ended"],
    suspended: ["active", "ended"],
    ended: []
  },
  intake: {
    new: ["screening", "withdrawn"],
    screening: ["conflict_review", "declined", "withdrawn"],
    conflict_review: ["consultation", "decision", "declined", "withdrawn"],
    consultation: ["decision", "declined", "withdrawn"],
    decision: ["converted", "declined", "withdrawn"],
    converted: [],
    declined: [],
    withdrawn: []
  },
  intakeSubmission: {
    submitted: ["under_review", "superseded"],
    under_review: ["accepted", "superseded"],
    accepted: ["superseded"],
    superseded: []
  },
  consultation: {
    requested: ["scheduled", "cancelled"],
    scheduled: ["completed", "cancelled", "no_show"],
    completed: [],
    cancelled: [],
    no_show: []
  },
  conflictCheck: {
    requested: ["running", "cancelled"],
    running: ["review_required", "failed", "cancelled"],
    review_required: ["cleared", "conflict_found", "failed", "cancelled"],
    cleared: [],
    conflict_found: [],
    failed: [],
    cancelled: []
  },
  conflictMatch: {
    potential: ["reviewing", "cleared", "escalated"],
    reviewing: ["cleared", "escalated"],
    cleared: [],
    escalated: []
  },
  matter: {
    proposed: ["pending_conflict", "declined"],
    pending_conflict: ["open", "declined"],
    open: ["on_hold", "closing"],
    on_hold: ["open", "closing"],
    closing: ["closed", "open"],
    closed: [],
    declined: []
  },
  ethicalWall: {
    draft: ["active"],
    active: ["lifted"],
    lifted: []
  },
  docket: {
    active: ["stayed", "closed", "appealed"],
    stayed: ["active", "closed"],
    appealed: ["active", "closed"],
    closed: []
  },
  docketEntry: {
    draft: ["filed", "entered", "rejected", "withdrawn"],
    filed: ["entered", "rejected", "withdrawn"],
    entered: [],
    rejected: [],
    withdrawn: []
  },
  deadline: {
    draft: ["pending", "cancelled"],
    pending: ["completed", "missed", "waived", "cancelled"],
    completed: [],
    missed: ["completed", "waived"],
    waived: [],
    cancelled: []
  },
  legalTask: {
    open: ["in_progress", "blocked", "completed", "cancelled"],
    in_progress: ["blocked", "completed", "cancelled"],
    blocked: ["open", "in_progress", "cancelled"],
    completed: [],
    cancelled: []
  },
  communicationThread: {
    open: ["archived", "closed"],
    archived: ["open", "closed"],
    closed: []
  },
  communicationMessage: {
    draft: ["queued", "cancelled"],
    queued: ["sent", "failed", "cancelled"],
    sent: ["delivered", "failed"],
    delivered: [],
    failed: ["queued"],
    received: [],
    cancelled: []
  },
  communicationDelivery: {
    pending: ["sent", "failed"],
    sent: ["delivered", "failed", "bounced"],
    delivered: [],
    failed: ["pending"],
    bounced: []
  },
  document: {
    draft: ["active", "archived"],
    active: ["archived"],
    archived: ["active", "disposed"],
    disposed: []
  },
  signatureRequest: {
    draft: ["sent", "cancelled"],
    sent: ["partially_signed", "completed", "declined", "expired", "cancelled"],
    partially_signed: ["completed", "declined", "expired", "cancelled"],
    completed: [],
    declined: [],
    expired: [],
    cancelled: []
  },
  signer: {
    pending: ["viewed", "signed", "declined"],
    viewed: ["signed", "declined"],
    signed: [],
    declined: []
  },
  rateCard: {
    draft: ["active", "retired"],
    active: ["retired"],
    retired: []
  },
  timeEntry: {
    draft: ["submitted", "written_off"],
    submitted: ["approved", "draft", "written_off"],
    approved: ["billed", "written_off"],
    billed: [],
    written_off: []
  },
  expense: {
    draft: ["submitted", "written_off"],
    submitted: ["approved", "draft", "written_off"],
    approved: ["billed", "reimbursed", "written_off"],
    billed: ["reimbursed"],
    reimbursed: [],
    written_off: []
  },
  retainer: {
    draft: ["sent", "terminated"],
    sent: ["accepted", "terminated"],
    accepted: ["active", "terminated"],
    active: ["completed", "terminated"],
    completed: [],
    terminated: []
  },
  invoice: {
    draft: ["approved", "void"],
    approved: ["issued", "void"],
    issued: ["partially_paid", "paid", "overdue", "void"],
    partially_paid: ["paid", "overdue", "void"],
    overdue: ["partially_paid", "paid", "void"],
    paid: ["partially_paid", "overdue"],
    void: []
  },
  trustAccount: {
    pending: ["active", "closed"],
    active: ["frozen", "closed"],
    frozen: ["active", "closed"],
    closed: []
  },
  trustLedgerAccount: {
    active: ["frozen", "closed"],
    frozen: ["active", "closed"],
    closed: []
  },
  trustReconciliation: {
    draft: ["in_review"],
    in_review: ["completed", "draft"],
    completed: ["reopened"],
    reopened: ["in_review"]
  },
  payment: {
    pending: ["authorized", "failed", "cancelled"],
    authorized: ["captured", "failed", "cancelled"],
    captured: ["settled", "failed"],
    settled: [],
    failed: [],
    cancelled: []
  },
  refund: {
    requested: ["approved", "cancelled"],
    approved: ["processing", "cancelled"],
    processing: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
    cancelled: []
  },
  portalAccount: {
    invited: ["active", "closed"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    closed: []
  },
  portalMatterAccess: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: []
  },
  portalShare: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: []
  },
  integrationConnection: {
    pending: ["active", "disabled", "revoked"],
    active: ["needs_reauth", "disabled", "revoked"],
    needs_reauth: ["active", "disabled", "revoked"],
    disabled: ["active", "revoked"],
    revoked: []
  },
  webhookDelivery: {
    pending: ["processing", "failed"],
    processing: ["succeeded", "failed"],
    failed: ["pending", "dead_letter"],
    succeeded: [],
    dead_letter: []
  },
  retentionPolicy: {
    draft: ["active", "retired"],
    active: ["retired"],
    retired: []
  },
  retentionHold: {
    active: ["released"],
    released: []
  },
  agentPrincipal: {
    draft: ["active", "revoked"],
    active: ["suspended", "revoked"],
    suspended: ["active", "revoked"],
    revoked: []
  },
  agentCredential: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: []
  },
  agentGrant: {
    proposed: ["active", "revoked"],
    active: ["suspended", "revoked", "expired"],
    suspended: ["active", "revoked", "expired"],
    revoked: [],
    expired: []
  },
  agentAction: {
    requested: ["awaiting_approval", "approved", "cancelled"],
    awaiting_approval: ["approved", "rejected", "cancelled"],
    approved: ["executing", "cancelled"],
    rejected: [],
    executing: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
    cancelled: []
  }
};
function initialLifecycleState(lifecycle) {
  return Object.keys(lifecycles[lifecycle])[0];
}
function canTransition(lifecycle, from, to) {
  const definition = lifecycles[lifecycle];
  return definition?.[from]?.includes(to) ?? false;
}
function lifecycleLabel(value) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}
function assertInitialLifecycleState(lifecycle, status) {
  const initial = initialLifecycleState(lifecycle);
  if (status !== initial) {
    throw new Error(`${lifecycleLabel(lifecycle)} must be created in ${initial} status.`);
  }
  return status;
}
function assertCommandTarget(command, target, allowedTargets) {
  if (typeof target !== "string" || !allowedTargets.includes(target)) {
    throw new Error(`The requested state is not available through the ${command} command.`);
  }
  return target;
}
function assertLifecycleTransition(lifecycle, from, to) {
  if (!(lifecycle in lifecycles)) throw new Error(`Unknown lifecycle: ${lifecycle}`);
  if (!canTransition(lifecycle, from, to)) {
    throw new Error(`${lifecycleLabel(lifecycle)} cannot transition from ${from} to ${to}.`);
  }
  return to;
}

// features/keystone/lib/transactions.ts
function prismaWithoutGraphQLErrorConversion(prisma) {
  const parent = prisma?.$parent;
  return parent && parent !== prisma ? parent : prisma;
}
function isRetryableSerializableConflict(error) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2034"
  );
}
async function runSerializableTransaction(prisma, callback, maxAttempts = 4) {
  let lastError;
  const transactionClient = prismaWithoutGraphQLErrorConversion(prisma);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await transactionClient.$transaction(callback, {
        isolationLevel: "Serializable",
        maxWait: 1e4,
        timeout: 2e4
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableSerializableConflict(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve2) => setTimeout(resolve2, attempt * 10));
    }
  }
  throw lastError;
}

// features/keystone/tenancy.ts
var denyAll = () => false;
function assignActiveFirm(resolvedData, context) {
  const firmId = activeFirmId(context.session);
  if (!firmId) return resolvedData;
  return {
    ...resolvedData,
    firm: { connect: { id: firmId } }
  };
}
function objects(value) {
  if (Array.isArray(value)) return value.filter((item) => Boolean(item) && typeof item === "object");
  return value && typeof value === "object" ? [value] : [];
}
function relationshipConnectionIds(value) {
  if (!value || typeof value !== "object") return [];
  const input = value;
  const candidates = [...objects(input.connect), ...objects(input.set)];
  return [...new Set(candidates.flatMap(
    (candidate) => typeof candidate.id === "string" ? [candidate.id] : []
  ))];
}
function connectedId(value) {
  return relationshipConnectionIds(value)[0] ?? null;
}
function validateActiveFirm({
  resolvedData,
  item,
  context,
  addValidationError
}) {
  const firmId = activeFirmId(context.session);
  if (!firmId) {
    addValidationError("An active firm is required.");
    return;
  }
  const inputFirmId = connectedId(resolvedData?.firm);
  const storedFirmId = typeof item?.firmId === "string" ? item.firmId : null;
  if (inputFirmId && inputFirmId !== firmId) {
    addValidationError("The record must belong to the active firm.");
  }
  if (storedFirmId && storedFirmId !== firmId) {
    addValidationError("The record does not belong to the active firm.");
  }
}
var modelMetadata = new Map(
  import_client.Prisma.dmmf.datamodel.models.map((model) => [model.name, model])
);
var financialAuditLists = /* @__PURE__ */ new Set([
  "RateCard",
  "RateRule",
  "TimeEntry",
  "Expense",
  "RetainerAgreement",
  "Invoice",
  "InvoiceLine",
  "TrustAccount",
  "TrustLedgerAccount",
  "TrustReconciliation",
  "Payment"
]);
var integrationAuditLists = /* @__PURE__ */ new Set([
  "IntegrationConnection",
  "ExternalRecordLink",
  "WebhookSubscription",
  "WebhookDelivery"
]);
function delegateName(modelName) {
  return `${modelName[0].toLowerCase()}${modelName.slice(1)}`;
}
function modelHasField(modelName, fieldName) {
  return modelMetadata.get(modelName)?.fields.some((field) => field.name === fieldName) ?? false;
}
async function validateMatterAccess({
  matterId,
  firmId,
  context,
  addValidationError
}) {
  const userId = context.session?.itemId;
  if (!userId) {
    addValidationError("An authenticated firm member is required for matter-scoped data.");
    return;
  }
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma);
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      ...accessibleMatterStorageWhere(firmId, userId)
    },
    select: { id: true }
  });
  if (!matter) addValidationError("The selected matter is not accessible in the active firm.");
}
async function validateConnectedRelationships(args) {
  const { listKey, resolvedData, item, context, addValidationError, operation } = args;
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma);
  const firmId = activeFirmId(context.session);
  if (!firmId || !resolvedData) return;
  const sourceModel = modelMetadata.get(listKey);
  if (!sourceModel) {
    addValidationError("Relationship ownership metadata is unavailable.");
    return;
  }
  if (listKey === "Matter" && resolvedData.confidentiality === "restricted") {
    if (operation === "create") {
      addValidationError("Create the matter, assign an authorized team, then restrict its confidentiality.");
    } else if (item?.confidentiality !== "restricted") {
      const teamMember = await prisma.matterTeamMember.findFirst({
        where: {
          firmId,
          matterId: item?.id,
          userId: context.session?.itemId,
          status: "active",
          canAccessRestricted: true
        },
        select: { id: true }
      });
      if (!teamMember) {
        addValidationError("An explicit restricted-access team assignment is required before restricting a matter.");
      }
    }
  }
  const sourceHasMatter = sourceModel.fields.some((field) => field.name === "matterId");
  const matterWasSupplied = Object.prototype.hasOwnProperty.call(resolvedData, "matter");
  const suppliedMatterId = connectedId(resolvedData.matter);
  const storedMatterId = typeof item?.matterId === "string" ? item.matterId : null;
  const ownerMatterId = suppliedMatterId ?? storedMatterId;
  if (operation === "update" && sourceHasMatter && matterWasSupplied && storedMatterId) {
    if (!suppliedMatterId || suppliedMatterId !== storedMatterId) {
      addValidationError("Matter scope cannot be removed or moved after creation.");
    }
  }
  if (ownerMatterId) {
    await validateMatterAccess({ matterId: ownerMatterId, firmId, context, addValidationError });
  }
  for (const relation of sourceModel.fields.filter((field) => field.kind === "object")) {
    if (!Object.prototype.hasOwnProperty.call(resolvedData, relation.name)) continue;
    const ids = relationshipConnectionIds(resolvedData[relation.name]);
    if (ids.length === 0) continue;
    if (relation.type === "Firm") {
      if (ids.some((id2) => id2 !== firmId)) {
        addValidationError(`Relationship ${relation.name} must belong to the active firm.`);
      }
      continue;
    }
    const targetDelegate = prisma[delegateName(relation.type)];
    if (!targetDelegate?.findMany) {
      addValidationError(`Relationship ${relation.name} cannot be ownership-validated.`);
      continue;
    }
    if (relation.type === "User") {
      const userWhere = listKey === "FirmMembership" && relation.name === "user" ? { id: { in: ids } } : {
        id: { in: ids },
        status: "active",
        firmMemberships: { some: { firmId, status: "active" } }
      };
      const users = await targetDelegate.findMany({ where: userWhere, select: { id: true } });
      if (users.length !== ids.length) {
        addValidationError(`Every ${relation.name} user must be active in the selected firm.`);
      }
      continue;
    }
    if (!modelHasField(relation.type, "firmId")) {
      addValidationError(`Relationship ${relation.name} has no firm ownership boundary.`);
      continue;
    }
    const targetHasMatter = modelHasField(relation.type, "matterId");
    const select20 = targetHasMatter ? { id: true, matterId: true } : { id: true };
    const targets = await targetDelegate.findMany({
      where: { id: { in: ids }, firmId },
      select: select20
    });
    if (targets.length !== ids.length) {
      addValidationError(`Every ${relation.name} relationship must belong to the active firm.`);
      continue;
    }
    if (sourceHasMatter && relation.name !== "matter" && targetHasMatter) {
      for (const target of targets) {
        if (target.matterId && target.matterId !== ownerMatterId) {
          addValidationError(`Relationship ${relation.name} must use the same matter scope.`);
          break;
        }
      }
    }
  }
}
function activeFirmRelationshipHooks(options = {}) {
  const validate = async (args) => {
    await validateConnectedRelationships(args);
    const nextStatus = args.resolvedData?.status;
    const currentStatus = args.item?.status;
    const isBootstrapCreate = options.allowBootstrapCreate && args.operation === "create" && !args.context.session?.itemId;
    if (options.lifecycle && args.operation === "create" && typeof nextStatus === "string" && !isBootstrapCreate) {
      try {
        assertInitialLifecycleState(options.lifecycle, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid initial lifecycle state.");
      }
    }
    if (options.lifecycle && args.operation === "update" && typeof nextStatus === "string" && typeof currentStatus === "string" && nextStatus !== currentStatus) {
      try {
        assertLifecycleTransition(options.lifecycle, currentStatus, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid lifecycle transition.");
      }
    }
  };
  return { validate: { create: validate, update: validate } };
}
function firmOwnedHooks(options = {}) {
  const validate = async (args) => {
    const isBootstrapCreate = options.allowBootstrapCreate && args.operation === "create" && !args.context.session?.itemId && !activeFirmId(args.context.session);
    if (!isBootstrapCreate) {
      validateActiveFirm(args);
      await validateConnectedRelationships(args);
    }
    const nextStatus = args.resolvedData?.status;
    const currentStatus = args.item?.status;
    if (options.lifecycle && args.operation === "create" && typeof nextStatus === "string" && !isBootstrapCreate) {
      try {
        assertInitialLifecycleState(options.lifecycle, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid initial lifecycle state.");
      }
    }
    if (options.lifecycle && args.operation === "update" && typeof nextStatus === "string" && typeof currentStatus === "string" && nextStatus !== currentStatus) {
      if (options.controlledStatus) {
        args.addValidationError("Status changes for this record require a controlled domain operation.");
      }
      try {
        assertLifecycleTransition(options.lifecycle, currentStatus, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid lifecycle transition.");
      }
    }
  };
  const beforeOperation = (args) => {
    const isBootstrapCreate = options.allowBootstrapCreate && args.operation === "create" && !args.context.session?.itemId;
    if (isBootstrapCreate) return;
    const firmId = activeFirmId(args.context.session);
    const recordFirmId = args.item?.firmId;
    if (!firmId || recordFirmId && recordFirmId !== firmId) {
      throw new Error("The operation requires the record's active firm context.");
    }
  };
  const afterOperation = async (args) => {
    const firmId = activeFirmId(args.context.session);
    const actorUserId = args.context.session?.itemId;
    const record = args.item ?? args.originalItem;
    if (!firmId || !actorUserId || !record?.id || args.listKey === "AuditEvent") return;
    const audit2 = prismaWithoutGraphQLErrorConversion(args.context.prisma)?.auditEvent;
    if (!audit2?.create) return;
    const matterId = args.listKey === "Matter" ? record.id : record.matterId ?? null;
    const authenticationType = args.context.session?.authenticationType ?? "human";
    try {
      await audit2.create({
        data: {
          firmId,
          eventId: (0, import_node_crypto.randomUUID)(),
          eventType: `record.${args.operation}`,
          category: financialAuditLists.has(args.listKey) ? "financial" : integrationAuditLists.has(args.listKey) ? "integration" : "legal_workflow",
          outcome: "succeeded",
          actorUserId: authenticationType === "agent" ? null : actorUserId,
          actorAgentId: args.context.session?.agentPrincipalId ?? null,
          actorType: authenticationType === "human" ? "user" : authenticationType,
          matterId,
          occurredAt: /* @__PURE__ */ new Date(),
          metadata: {
            listKey: args.listKey,
            recordId: record.id,
            operation: args.operation,
            credentialId: args.context.session?.credentialId ?? null,
            oauthClientId: args.context.session?.oauthClientId ?? null
          }
        }
      });
    } catch {
      console.error("Low-risk audit telemetry persistence failed", {
        listKey: args.listKey,
        operation: args.operation
      });
    }
  };
  return {
    resolveInput: {
      create: ({ resolvedData, context }) => assignActiveFirm(resolvedData, context)
    },
    validate: {
      create: validate,
      update: validate
    },
    beforeOperation: {
      create: beforeOperation,
      update: beforeOperation,
      delete: beforeOperation
    },
    afterOperation: {
      create: afterOperation,
      update: afterOperation,
      delete: afterOperation
    }
  };
}

// features/keystone/lib/digests.ts
var import_node_crypto2 = require("node:crypto");
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value;
  const properties = Object.keys(record).sort().flatMap(
    (key) => record[key] === void 0 ? [] : [`${JSON.stringify(key)}:${canonicalJson(record[key])}`]
  );
  return `{${properties.join(",")}}`;
}
function sha256Digest(value) {
  return (0, import_node_crypto2.createHash)("sha256").update(canonicalJson(value)).digest("hex");
}

// features/keystone/models/fields.ts
var import_fields = require("@keystone-6/core/fields");
function uniqueConstraints(...constraints) {
  return {
    extendPrismaSchema(schema) {
      const closingBrace = schema.lastIndexOf("}");
      if (closingBrace < 0) throw new Error("Unable to add Prisma unique constraints.");
      const directives = constraints.map((fields) => `  @@unique([${fields.join(", ")}])`).join("\n");
      return `${schema.slice(0, closingBrace)}${directives}
${schema.slice(closingBrace)}`;
    }
  };
}
var permissionFields = Object.fromEntries(
  permissionKeys.map((permission) => [permission, (0, import_fields.checkbox)({ defaultValue: false, access: { update: denyAll } })])
);
function requireRelationshipPrismaField(field) {
  return field.replaceAll("?", "");
}
function requiredRelationship(ref) {
  return (0, import_fields.relationship)({
    ref,
    db: {
      foreignKey: true,
      extendPrismaSchema: requireRelationshipPrismaField
    }
  });
}
function readOnlyRelationship(ref, many = false) {
  const config2 = {
    ref,
    access: { create: denyAll, update: denyAll },
    graphql: { omit: { create: true, update: true } },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  };
  return many ? (0, import_fields.relationship)({ ...config2, many: true }) : (0, import_fields.relationship)(config2);
}
function firmRelationship(ref = "Firm") {
  return (0, import_fields.relationship)({
    ref,
    db: {
      foreignKey: true,
      extendPrismaSchema: requireRelationshipPrismaField
    },
    access: { create: denyAll, update: denyAll },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  });
}
function scopedAccess(readPermission, managePermission, filter = rules.activeFirmOwned, options = {}) {
  return {
    operation: {
      query: permissions[readPermission],
      create: permissions[managePermission],
      update: permissions[managePermission],
      delete: options.allowDelete ? permissions[managePermission] : denyAll
    },
    filter: {
      query: filter,
      update: filter,
      delete: filter
    }
  };
}
var immutableUpdateDeleteGraphql = {
  omit: { update: true, delete: true }
};
var systemEvidenceGraphql = {
  omit: { create: true, update: true, delete: true }
};
function secretText(label, required = false) {
  return (0, import_fields.text)({
    label,
    validation: required ? { isRequired: true } : void 0,
    graphql: { omit: { read: true } },
    access: { read: denyAll, create: denyAll, update: denyAll },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "hidden" },
      listView: { fieldMode: "hidden" }
    }
  });
}

// features/keystone/models/trackingFields.ts
var import_fields2 = require("@keystone-6/core/fields");
var denyWrite = () => false;
var trackingFields = {
  createdAt: (0, import_fields2.timestamp)({
    access: { create: denyWrite, update: denyWrite },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields2.timestamp)({
    access: { create: denyWrite, update: denyWrite },
    db: { updatedAt: true },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/User.ts
var userRelationshipHooks = activeFirmRelationshipHooks({ lifecycle: "user", allowBootstrapCreate: true });
var DashboardAdmission = import_core.graphql.object()({
  name: "UserDashboardAdmission",
  fields: {
    canAccessDashboard: import_core.graphql.field({ type: import_core.graphql.nonNull(import_core.graphql.Boolean) }),
    canManageOnboarding: import_core.graphql.field({ type: import_core.graphql.nonNull(import_core.graphql.Boolean) })
  }
});
function viewerDashboardAdmission(session, userId) {
  if (!isHumanIdentitySession(session) || session.itemId !== userId) return null;
  return {
    canAccessDashboard: permissions.canAccessDashboard({ session }),
    canManageOnboarding: permissions.canManageOnboarding({ session })
  };
}
var User = (0, import_core.list)({
  // createAuth.initFirstItem requires UserCreateInput to exist; operation access
  // denies ordinary generated creates and the controlled staff workflow uses sudo db API.
  access: {
    operation: {
      query: isSignedIn,
      create: import_access3.denyAll,
      update: isInteractiveHuman,
      delete: import_access3.denyAll
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdateOwnIdentity,
      delete: () => false
    }
  },
  hooks: {
    ...userRelationshipHooks,
    async afterOperation(args) {
      if (args.operation !== "update" || !args.resolvedData?.password || args.originalItem?.status !== "invited") return;
      const userId = String(args.item.id);
      const invitedMembership = await args.context.prisma.firmMembership.findFirst({
        where: { userId, status: "invited" },
        orderBy: { createdAt: "asc" },
        select: { firmId: true }
      });
      const firmId = String(
        args.item.activeFirmId ?? args.originalItem.activeFirmId ?? invitedMembership?.firmId ?? ""
      );
      if (!firmId) return;
      const now = /* @__PURE__ */ new Date();
      await args.context.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { status: "active" } });
        await tx.firmMembership.updateMany({
          where: { userId, firmId, status: "invited" },
          data: { status: "active", startedAt: now, endedAt: null, updatedAt: now }
        });
        await tx.auditEvent.create({
          data: {
            firmId,
            eventId: (0, import_node_crypto3.randomUUID)(),
            actorUserId: userId,
            actorType: "user",
            eventType: "staff.invitation_accepted",
            category: "authentication",
            outcome: "succeeded",
            occurredAt: now,
            metadata: {
              acceptanceDigest: sha256Digest({ userId, firmId, acceptedAt: now.toISOString() })
            }
          }
        });
      });
    }
  },
  ui: {
    // Generated creates are always denied; staff join through People & access invitations.
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "email", "status", "activeFirm"]
    }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    // Login email is a global credential. Generated updates cannot change it, even for
    // the owner, until a verified change flow exists; recovery goes to the current address.
    email: (0, import_fields3.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      isFilterable: false,
      isOrderable: false,
      access: { update: import_access3.denyAll }
    }),
    password: (0, import_fields3.password)({
      access: {
        read: import_access3.denyAll,
        // Only the person themselves, from an interactive session. Setup, reset and
        // init flows use Keystone's one-use tokens through sudo and are unaffected.
        update: ({ session, item }) => isInteractiveHumanSession(session) && session.itemId === String(item.id)
      },
      validation: {
        isRequired: true,
        length: { min: 12, max: 1e3 },
        rejectCommon: true
      }
    }),
    bootstrapKey: (0, import_fields3.text)({
      isIndexed: "unique",
      defaultValue: null,
      db: { isNullable: true },
      graphql: { omit: { read: true } },
      access: { read: import_access3.denyAll, create: import_access3.denyAll, update: import_access3.denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" }
      }
    }),
    status: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Deactivated", value: "deactivated" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true },
      access: { update: import_access3.denyAll }
    }),
    onboardingStatus: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      validation: { isRequired: true }
    }),
    bootstrapRole: (0, import_fields3.relationship)({
      ref: "Role.assignedTo",
      // Legacy top-level role is reserved for the one-time bootstrap principal.
      // Ongoing firm authority comes only from FirmMembership.role.
      db: { foreignKey: { map: "role" } },
      access: { create: import_access3.denyAll, update: import_access3.denyAll }
    }),
    // The shared Openfront dashboard admits viewers through `authenticatedItem.role`.
    // This projects only the viewer's own current admission flags, derived per request
    // from the same membership authority Keystone access uses; it carries no firm powers.
    role: (0, import_fields3.virtual)({
      field: import_core.graphql.field({
        type: DashboardAdmission,
        resolve: (item, _args, context) => viewerDashboardAdmission(context.session, String(item.id))
      }),
      ui: {
        query: "{ canAccessDashboard canManageOnboarding }",
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" }
      }
    }),
    activeFirm: (0, import_fields3.relationship)({
      ref: "Firm.activeUsers",
      // Selection changes affect current administrator viability. Generated
      // nested/bulk/self writes cannot bypass the controlled setup/join path.
      access: { create: permissions.canManageFirm, update: import_access3.denyAll }
    }),
    firmMemberships: readOnlyRelationship("FirmMembership.user", true),
    consultations: readOnlyRelationship("Consultation.account", true),
    apiKeys: readOnlyRelationship("ApiKey.owner", true),
    oauthClients: readOnlyRelationship("OAuthClient.owner", true),
    oauthConsents: readOnlyRelationship("OAuthConsent.user", true),
    oauthTokens: readOnlyRelationship("OAuthToken.user", true),
    authorizedMatters: readOnlyRelationship("Matter.authorizedUsers", true),
    blockedMatters: readOnlyRelationship("Matter.blockedUsers", true),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: denyAll
    },
    filter: {
      query: ({ session }) => {
        if (!session?.itemId) return false;
        const firmId = activeFirmId(session);
        const ownRoles = {
          OR: [
            { assignedTo: { some: { id: { equals: session.itemId } } } },
            ...firmId ? [{
              memberships: {
                some: {
                  user: { id: { equals: session.itemId } },
                  firm: { id: { equals: firmId } },
                  status: { equals: "active" }
                }
              }
            }] : []
          ]
        };
        if (!firmId || !permissions.canManageRoles({ session })) return ownRoles;
        return { OR: [{ firm: { id: { equals: firmId } } }, ownRoles] };
      },
      update: ({ session }) => {
        const firmId = activeFirmId(session);
        return firmId ? { firm: { id: { equals: firmId } } } : false;
      },
      delete: () => false
    }
  },
  hooks: firmOwnedHooks({ allowBootstrapCreate: true }),
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: true,
    listView: { initialColumns: ["name", "status", "firm", "assignedTo"] }
  },
  fields: {
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    status: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active",
      validation: { isRequired: true },
      // Archiving can strand administrators; use updateFirmRoleAuthority.
      access: { update: denyAll }
    }),
    // Null only for the one-time bootstrap role; normal creates are bound by the role hook.
    firm: (0, import_fields5.relationship)({
      ref: "Firm.roles",
      db: { foreignKey: true },
      access: { create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    ...permissionFields,
    assignedTo: (0, import_fields5.relationship)({
      ref: "User.bootstrapRole",
      many: true,
      access: { create: denyAll, update: denyAll }
    }),
    memberships: readOnlyRelationship("FirmMembership.role", true),
    ...trackingFields
  }
});

// features/keystone/models/tenancy.ts
var import_core3 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// features/platform/store-settings/lib/untitled-logo-registry.ts
var LOGO_ICONS = [
  {
    id: "3portals",
    name: "3Portals",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" fill="#8098f9"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#6172f3"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#444ce7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" opacity=".5"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" opacity=".7"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z"/></g></svg>`
  },
  {
    id: "45-degrees",
    name: "45 Degrees",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`
  },
  {
    id: "acme-corp",
    name: "Acme Corp",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "alphawave",
    name: "AlphaWave",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`
  },
  {
    id: "alt-shift",
    name: "Alt+Shift",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2727-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2728-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`
  },
  {
    id: "biosynthesis",
    name: "Biosynthesis",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" fill="#a4bcfd"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" fill="#6172f3"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" fill="#a4bcfd"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" fill="#6172f3"/><g fill="#444ce7"><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/></g><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" fill="#6172f3"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" fill="#a4bcfd"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" opacity=".5"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" opacity=".7"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" opacity=".5"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" opacity=".7"/><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" opacity=".7"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" opacity=".5"/></g></svg>`
  },
  {
    id: "boltshift",
    name: "Boltshift",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "buildingblocks",
    name: "BuildingBlocks",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "calescence",
    name: "Calescence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#1570ef" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`
  },
  {
    id: "capsule",
    name: "Capsule",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="18" fill="#1570ef" r="14"/><circle cx="26" cy="30" fill="#53b1fd" r="14"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><circle cx="14" cy="18" opacity=".7" r="14"/><circle cx="26" cy="30" opacity=".7" r="14"/></g></svg>`
  },
  {
    id: "constellation",
    name: "Constellation",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`
  },
  {
    id: "codecraft",
    name: "Codecraft",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`
  },
  {
    id: "command-r",
    name: "Command+R",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" fill="#155eef"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" fill="#2e90fa"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" fill="#53b1fd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" opacity=".7"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" opacity=".7"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" opacity=".7"/></g></svg>`
  },
  {
    id: "contrast-ai",
    name: "ContrastAI",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "convergence",
    name: "Convergence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "core-os",
    name: "CoreOS",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "cubekit",
    name: "Cubekit",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" fill="#155eef" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" fill="#155eef" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" opacity=".5"/></g></svg>`
  },
  {
    id: "europa",
    name: "Europa",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`
  },
  {
    id: "feather-dev",
    name: "FeatherDev",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" fill="#53b1fd"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" fill="#2e90fa"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z" fill="#1570ef"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3831 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" fill="#53b1fd"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" fill="#2e90fa"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z" fill="#1570ef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" opacity=".5"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" opacity=".7"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3832 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" opacity=".5"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" opacity=".7"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z"/></g></svg>`
  },
  {
    id: "flora-fauna",
    name: "Flora&Fauna",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "focal-point",
    name: "FocalPoint",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13175 8.8884c-.3177-.2034-.62928-.4156-.9344-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613487-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13174 8.8884c-.31771-.2034-.62929-.4156-.93441-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613486-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#fff"/></svg>`
  },
  {
    id: "foresight",
    name: "Foresight",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#444ce7"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`
  },
  {
    id: "galileo",
    name: "Galileo",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" fill="#6172f3"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z" fill="#444ce7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" opacity=".7"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z"/></g></svg>`
  },
  {
    id: "global-bank",
    name: "GlobalBank",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#444ce7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#fff"/></svg>`
  },
  {
    id: "hexsmith",
    name: "Hexsmith",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1014.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0021z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1013.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0022z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`
  },
  {
    id: "hourglass",
    name: "Hourglass",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 30 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 41.2222c0 1.5341 1.24365 2.7778 2.77778 2.7778h24.44442c1.5341 0 2.7778-1.2437 2.7778-2.7778v-7.2222c0-8.2843-6.7157-15-15-15-8.28427 0-15 6.7157-15 15z" fill="#1570ef"/><path d="m0 6.77778c0-1.53413 1.24365-2.77778 2.77778-2.77778h24.44442c1.5341 0 2.7778 1.24365 2.7778 2.77778v7.22222c0 8.2843-6.7157 15-15 15-8.28427 0-15-6.7157-15-15z" fill="#53b1fd" opacity=".5"/></svg>`,
    darkSvg: `<svg width="100%" height="100%" viewBox="0 0 30 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.7" d="M0 41.2222C0 42.7563 1.24365 44 2.77778 44H27.2222C28.7563 44 30 42.7563 30 41.2222V34C30 25.7157 23.2843 19 15 19C6.71573 19 0 25.7157 0 34V41.2222Z" fill="white"/><path opacity="0.7" d="M0 6.77778C0 5.24365 1.24365 4 2.77778 4H27.2222C28.7563 4 30 5.24365 30 6.77778V14C30 22.2843 23.2843 29 15 29C6.71573 29 0 22.2843 0 14V6.77778Z" fill="white"/></svg>`
  },
  {
    id: "kintsugi",
    name: "Kintsugi",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`
  },
  {
    id: "layers",
    name: "Layers",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6796c-2.80085.7505-4.462904-.9115-3.712306-3.7124z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6795c-2.80085.7506-4.462904-.9114-3.712306-3.7123z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`
  },
  {
    id: "luminescence",
    name: "Luminescence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`
  },
  {
    id: "luminous",
    name: "Luminous",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".6"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".8"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".5"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".7"/></g></svg>`
  },
  {
    id: "pollinate",
    name: "Pollinate",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`
  },
  {
    id: "polymath",
    name: "Polymath",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#155eef" stroke-width="6"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#fff" stroke-width="6"/></svg>`
  },
  {
    id: "prometheus",
    name: "Prometheus",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".7"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".75"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`
  },
  {
    id: "quantum",
    name: "Quantum",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`
  },
  {
    id: "quartz-ai",
    name: "QuartzAI",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "radius",
    name: "Radius",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`
  },
  {
    id: "railspeed",
    name: "Railspeed",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`
  },
  {
    id: "refractional",
    name: "Refractional",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#444ce7"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#155eef"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#8098f9"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/></g></svg>`
  },
  {
    id: "renaissance",
    name: "Renaissance",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3248-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#1849a9" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3247-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "sisyphus",
    name: "Sisyphus",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`
  },
  {
    id: "solaris-energy",
    name: "Solaris Energy",
    lightSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="#175CD3" stroke-width="4"/></svg>`,
    darkSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="white" stroke-width="4"/></svg>`
  }
];

// features/shared/sanitize-store-logo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) return "";
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) return "";
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/shared/store-logo.ts
var DEFAULT_STORE_LOGO_ICON = LOGO_ICONS[0].lightSvg;
function normalizeStoreLogoColor(value) {
  const numeric = Number(String(value ?? "0"));
  if (!Number.isFinite(numeric)) return "0";
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/models/tenancy.ts
var Firm = (0, import_core3.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageFirm,
      update: permissions.canManageFirm,
      delete: denyAll
    },
    filter: {
      query: ({ session }) => {
        const id2 = activeFirmId(session);
        return id2 ? { id: { equals: id2 } } : false;
      },
      update: ({ session }) => {
        const id2 = activeFirmId(session);
        return id2 ? { id: { equals: id2 } } : false;
      },
      delete: () => false
    }
  },
  hooks: activeFirmRelationshipHooks({ lifecycle: "firm" }),
  ui: { listView: { initialColumns: ["name", "slug", "status", "defaultTimezone"] } },
  fields: {
    isDemo: (0, import_fields7.checkbox)({ defaultValue: false, access: { create: denyAll, update: denyAll } }),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    displayName: (0, import_fields7.text)({ validation: { length: { min: 2, max: 120 } } }),
    shortName: (0, import_fields7.text)({ validation: { length: { min: 2, max: 40 } } }),
    brandTagline: (0, import_fields7.text)({ validation: { length: { max: 180 } } }),
    brandColor: (0, import_fields7.text)({
      validation: { match: { regex: /^(?:#[0-9a-f]{6})?$/i, explanation: "Use a six-digit hexadecimal color, or leave it blank for neutral." } }
    }),
    supportEmail: (0, import_fields7.text)({ validation: { length: { max: 320 } } }),
    logoIcon: (0, import_fields7.text)({
      defaultValue: DEFAULT_STORE_LOGO_ICON,
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
        if (resolvedData[fieldKey] === void 0) return void 0;
        const safe = sanitizeStoreLogoSvg(String(resolvedData[fieldKey] || DEFAULT_STORE_LOGO_ICON));
        if (!safe) throw new Error("Logo must be a safe SVG document.");
        return safe;
      } }
    }),
    logoColor: (0, import_fields7.text)({ defaultValue: "0", hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    slug: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Onboarding", value: "onboarding" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "onboarding",
      validation: { isRequired: true }
    }),
    defaultTimezone: (0, import_fields7.text)({ defaultValue: "UTC", validation: { isRequired: true } }),
    defaultCurrency: (0, import_fields7.text)({
      defaultValue: "USD",
      validation: {
        isRequired: true,
        match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." }
      }
    }),
    // Inverse writes such as `roles: { set: [] }` would detach children without their
    // own hooks running; offices and roles are created and changed from their own lists.
    offices: readOnlyRelationship("Office.firm", true),
    memberships: readOnlyRelationship("FirmMembership.firm", true),
    activeUsers: readOnlyRelationship("User.activeFirm", true),
    roles: readOnlyRelationship("Role.firm", true),
    ...trackingFields
  }
});
var Office = (0, import_core3.list)({
  db: uniqueConstraints(["firmId", "code"]),
  access: scopedAccess("canReadPeople", "canManageFirm"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "code", "status", "timezone"] } },
  fields: {
    firm: (0, import_fields7.relationship)({
      ref: "Firm.offices",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { create: denyAll, update: denyAll }
    }),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    code: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: true }),
    status: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    timezone: (0, import_fields7.text)({ defaultValue: "UTC", validation: { isRequired: true } }),
    email: (0, import_fields7.text)({ access: { read: permissions.canReadPeople } }),
    phone: (0, import_fields7.text)({ access: { read: permissions.canReadPeople } }),
    primaryMemberships: readOnlyRelationship("FirmMembership.primaryOffice", true),
    allowedMemberships: readOnlyRelationship("FirmMembership.allowedOffices", true),
    ...trackingFields
  }
});
var FirmMembership = (0, import_core3.list)({
  db: uniqueConstraints(["firmId", "userId"]),
  graphql: { omit: { create: true, update: true, delete: true } },
  access: {
    operation: {
      query: isSignedIn,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: ({ session }) => {
        const firmId = activeFirmId(session);
        if (!firmId || !session?.itemId) return false;
        const firm = { firm: { id: { equals: firmId } } };
        return permissions.canReadPeople({ session }) ? firm : { AND: [firm, { user: { id: { equals: session.itemId } } }] };
      },
      update: ({ session }) => {
        const firmId = activeFirmId(session);
        return firmId ? { firm: { id: { equals: firmId } } } : false;
      },
      delete: () => false
    }
  },
  hooks: firmOwnedHooks({ lifecycle: "membership" }),
  ui: { listView: { initialColumns: ["user", "firm", "status", "primaryOffice", "role"] } },
  fields: {
    firm: (0, import_fields7.relationship)({
      ref: "Firm.memberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { create: denyAll, update: denyAll }
    }),
    user: (0, import_fields7.relationship)({
      ref: "User.firmMemberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField }
    }),
    role: (0, import_fields7.relationship)({
      ref: "Role.memberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField }
    }),
    primaryOffice: (0, import_fields7.relationship)({ ref: "Office.primaryMemberships" }),
    allowedOffices: (0, import_fields7.relationship)({ ref: "Office.allowedMemberships", many: true }),
    status: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Ended", value: "ended" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    title: (0, import_fields7.text)(),
    startedAt: (0, import_fields7.timestamp)(),
    endedAt: (0, import_fields7.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/authentication.ts
var import_core4 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var canReadCredentials = ({ session }) => permissions.canReadMachineCredentials({ session }) || permissions.canManageMachineCredentials({ session });
var credentialEvidenceAccess = {
  operation: {
    query: canReadCredentials,
    create: denyAll,
    update: denyAll,
    delete: denyAll
  },
  filter: {
    query: rules.activeFirmOwned,
    update: () => false,
    delete: () => false
  }
};
var credentialMetadataAccess = {
  read: canReadCredentials,
  create: denyAll,
  update: denyAll
};
var ApiKey = (0, import_core4.list)({
  db: uniqueConstraints(["firmId", "name"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["name", "prefix", "status", "owner", "expiresAt", "lastUsedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    owner: requiredRelationship("User.apiKeys"),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    prefix: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    secretDigest: secretText("API key digest", true),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    scopes: (0, import_fields9.json)({
      defaultValue: [],
      access: credentialMetadataAccess,
      ui: { description: "Allowlisted machine scopes only; never inferred from a role name." }
    }),
    expiresAt: (0, import_fields9.timestamp)(),
    lastUsedAt: (0, import_fields9.timestamp)(),
    createdBy: requiredRelationship("User"),
    revokedBy: (0, import_fields9.relationship)({ ref: "User" }),
    revokedAt: (0, import_fields9.timestamp)(),
    revocationReason: (0, import_fields9.text)({ access: credentialMetadataAccess }),
    ...trackingFields
  }
});
var OAuthClient = (0, import_core4.list)({
  db: uniqueConstraints(["firmId", "name"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["name", "clientId", "status", "owner", "createdAt"] }
  },
  fields: {
    firm: firmRelationship(),
    owner: requiredRelationship("User.oauthClients"),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    clientId: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    clientSecretDigest: secretText("OAuth client secret digest", true),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    isConfidential: (0, import_fields9.checkbox)({ defaultValue: true }),
    redirectUris: (0, import_fields9.json)({ defaultValue: [], access: credentialMetadataAccess }),
    allowedScopes: (0, import_fields9.json)({ defaultValue: [], access: credentialMetadataAccess }),
    description: (0, import_fields9.text)({ access: credentialMetadataAccess, ui: { displayMode: "textarea" } }),
    createdBy: requiredRelationship("User"),
    revokedBy: (0, import_fields9.relationship)({ ref: "User" }),
    revokedAt: (0, import_fields9.timestamp)(),
    tokens: readOnlyRelationship("OAuthToken.client", true),
    consents: readOnlyRelationship("OAuthConsent.client", true),
    ...trackingFields
  }
});
var OAuthConsent = (0, import_core4.list)({
  db: uniqueConstraints(["clientId", "userId", "firmId"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["client", "user", "status", "grantedAt", "revokedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    client: requiredRelationship("OAuthClient.consents"),
    user: requiredRelationship("User.oauthConsents"),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    scopes: (0, import_fields9.json)({ defaultValue: [], access: credentialMetadataAccess }),
    consentDigest: (0, import_fields9.text)({ validation: { isRequired: true } }),
    grantedAt: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    revokedAt: (0, import_fields9.timestamp)(),
    ...trackingFields
  }
});
var OAuthToken = (0, import_core4.list)({
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["tokenType", "client", "status", "user", "expiresAt", "consumedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    client: requiredRelationship("OAuthClient.tokens"),
    user: requiredRelationship("User.oauthTokens"),
    consent: (0, import_fields9.relationship)({ ref: "OAuthConsent" }),
    tokenType: (0, import_fields9.select)({
      type: "enum",
      options: [
        { label: "Authorization code", value: "authorization_code" },
        { label: "Access token", value: "access_token" },
        { label: "Refresh token", value: "refresh_token" }
      ],
      validation: { isRequired: true }
    }),
    tokenDigest: (0, import_fields9.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" }
      }
    }),
    tokenPrefix: (0, import_fields9.text)({ isIndexed: true, validation: { isRequired: true } }),
    familyId: (0, import_fields9.text)({ isIndexed: true }),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [
        { label: "Pending consent", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Consumed", value: "consumed" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    scopes: (0, import_fields9.json)({ defaultValue: [], access: credentialMetadataAccess }),
    redirectUri: (0, import_fields9.text)({ access: credentialMetadataAccess }),
    state: secretText("OAuth state"),
    codeChallenge: secretText("PKCE code challenge"),
    codeChallengeMethod: (0, import_fields9.select)({
      type: "enum",
      options: [{ label: "S256", value: "S256" }]
    }),
    parentToken: (0, import_fields9.relationship)({ ref: "OAuthToken.replacementTokens" }),
    replacementTokens: readOnlyRelationship("OAuthToken.parentToken", true),
    expiresAt: (0, import_fields9.timestamp)({ validation: { isRequired: true } }),
    consumedAt: (0, import_fields9.timestamp)(),
    revokedAt: (0, import_fields9.timestamp)(),
    lastUsedAt: (0, import_fields9.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/contacts.ts
var import_core5 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var piiRead = ({ session }) => permissions.canReadPeople({ session });
var piiWrite = ({ session }) => permissions.canManagePeople({ session });
var piiAccess = { read: piiRead, create: piiWrite, update: piiWrite };
var Contact = (0, import_core5.list)({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: {
    labelField: "displayName",
    listView: { initialColumns: ["displayName", "contactType", "status", "primaryEmail"] }
  },
  fields: {
    firm: firmRelationship(),
    contactType: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Person", value: "person" },
        { label: "Organization", value: "organization" }
      ],
      defaultValue: "person",
      validation: { isRequired: true }
    }),
    status: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Prospective client", value: "prospective_client" },
        { label: "Client", value: "client" },
        { label: "Former client", value: "former_client" },
        { label: "Opposing", value: "opposing" },
        { label: "Other", value: "other" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "prospective_client",
      validation: { isRequired: true }
    }),
    firstName: (0, import_fields11.text)({ access: piiAccess }),
    middleName: (0, import_fields11.text)({ access: piiAccess }),
    lastName: (0, import_fields11.text)({ access: piiAccess }),
    organizationName: (0, import_fields11.text)({ access: piiAccess }),
    preferredName: (0, import_fields11.text)({ access: piiAccess }),
    primaryEmail: (0, import_fields11.text)({ access: piiAccess }),
    primaryPhone: (0, import_fields11.text)({ access: piiAccess }),
    dateOfBirth: (0, import_fields11.timestamp)({ access: piiAccess }),
    governmentIdLastFour: (0, import_fields11.text)({
      access: piiAccess,
      validation: {
        length: { min: 4, max: 4 },
        match: { regex: /^\d{4}$/, explanation: "Use only the final four digits." }
      }
    }),
    conflictSearchAliases: (0, import_fields11.json)({
      access: piiAccess,
      defaultValue: [],
      ui: { description: "Bounded alternate names for conflict searching; never credentials or full identity documents." }
    }),
    privilegedNotes: (0, import_fields11.text)({
      access: { read: denyAll, create: denyAll, update: denyAll },
      graphql: { omit: { read: true, create: true, update: true } },
      ui: {
        itemView: { fieldMode: "hidden" },
        createView: { fieldMode: "hidden" },
        description: "Matter-specific privileged content belongs on an authorized matter record, never a firm-wide contact."
      }
    }),
    addresses: readOnlyRelationship("Address.contact", true),
    contactMethods: readOnlyRelationship("ContactMethod.contact", true),
    displayName: (0, import_fields11.virtual)({
      field: import_core5.graphql.field({
        type: import_core5.graphql.String,
        resolve(item) {
          if (item.contactType === "organization") return String(item.organizationName || "Organization");
          return [item.firstName, item.middleName, item.lastName].filter(Boolean).join(" ") || "Unnamed contact";
        }
      })
    }),
    ...trackingFields
  }
});
var Address = (0, import_core5.list)({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["label", "contact", "city", "region", "postalCode"] } },
  fields: {
    firm: firmRelationship(),
    contact: (0, import_fields11.relationship)({ ref: "Contact.addresses" }),
    label: (0, import_fields11.text)({ defaultValue: "Primary" }),
    addressType: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Home", value: "home" },
        { label: "Work", value: "work" },
        { label: "Billing", value: "billing" },
        { label: "Mailing", value: "mailing" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "mailing"
    }),
    line1: (0, import_fields11.text)({ access: piiAccess }),
    line2: (0, import_fields11.text)({ access: piiAccess }),
    city: (0, import_fields11.text)({ access: piiAccess }),
    region: (0, import_fields11.text)({ access: piiAccess }),
    postalCode: (0, import_fields11.text)({ access: piiAccess }),
    countryCode: (0, import_fields11.text)({
      access: piiAccess,
      defaultValue: "US",
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use a two-letter uppercase country code." } }
    }),
    isPrimary: (0, import_fields11.checkbox)({ defaultValue: false }),
    ...trackingFields
  }
});
var ContactMethod = (0, import_core5.list)({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["contact", "methodType", "label", "value", "isPrimary"] } },
  fields: {
    firm: firmRelationship(),
    contact: (0, import_fields11.relationship)({ ref: "Contact.contactMethods" }),
    methodType: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
        { label: "Secure portal", value: "portal" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    label: (0, import_fields11.text)(),
    value: (0, import_fields11.text)({ access: piiAccess, validation: { isRequired: true } }),
    isPrimary: (0, import_fields11.checkbox)({ defaultValue: false }),
    canContact: (0, import_fields11.checkbox)({ defaultValue: true }),
    verifiedAt: (0, import_fields11.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/intake.ts
var import_core6 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var intakeAccess = scopedAccess("canReadIntake", "canManageIntake");
var controlledIntakeIdentityAccess = {
  read: ({ session }) => permissions.canReadIntake({ session }),
  create: ({ session }) => permissions.canManageIntake({ session }),
  update: denyAll
};
var sensitiveIntakeAccess = {
  read: ({ session }) => permissions.canReadIntake({ session }),
  create: ({ session }) => permissions.canManageIntake({ session }),
  update: ({ session }) => permissions.canManageIntake({ session })
};
var Intake = (0, import_core6.list)({
  db: uniqueConstraints(["firmId", "intakeNumber"]),
  access: intakeAccess,
  hooks: firmOwnedHooks({ lifecycle: "intake", controlledStatus: true }),
  ui: {
    listView: { initialColumns: ["intakeNumber", "title", "status", "primaryContact", "assignedTo"] }
  },
  fields: {
    firm: firmRelationship(),
    intakeNumber: (0, import_fields13.text)({ isIndexed: true, access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, validation: { isRequired: true } }),
    title: (0, import_fields13.text)({ validation: { isRequired: true } }),
    status: (0, import_fields13.select)({
      type: "enum",
      access: controlledIntakeIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "New", value: "new" },
        { label: "Screening", value: "screening" },
        { label: "Conflict review", value: "conflict_review" },
        { label: "Consultation", value: "consultation" },
        { label: "Decision", value: "decision" },
        { label: "Converted", value: "converted" },
        { label: "Declined", value: "declined" },
        { label: "Withdrawn", value: "withdrawn" }
      ],
      defaultValue: "new",
      validation: { isRequired: true }
    }),
    source: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Referral", value: "referral" },
        { label: "Phone", value: "phone" },
        { label: "Walk-in", value: "walk_in" },
        { label: "Import", value: "import" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "other"
    }),
    primaryContact: (0, import_fields13.relationship)({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledIntakeIdentityAccess,
      graphql: { omit: { update: true } }
    }),
    office: (0, import_fields13.relationship)({ ref: "Office" }),
    practiceArea: (0, import_fields13.relationship)({ ref: "PracticeArea" }),
    openedBy: (0, import_fields13.relationship)({ ref: "User" }),
    assignedTo: (0, import_fields13.relationship)({ ref: "User" }),
    receivedAt: (0, import_fields13.timestamp)({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    summary: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    desiredOutcome: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    adversePartySummary: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    declineReason: (0, import_fields13.text)({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, ui: { displayMode: "textarea" } }),
    decidedAt: (0, import_fields13.timestamp)({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } } }),
    participants: readOnlyRelationship("IntakeParticipant.intake", true),
    submissions: readOnlyRelationship("IntakeSubmission.intake", true),
    consultations: readOnlyRelationship("Consultation.intake", true),
    conflictChecks: readOnlyRelationship("ConflictCheck.intake", true),
    convertedMatter: readOnlyRelationship("Matter.intake"),
    ...trackingFields
  }
});
var IntakeParticipant = (0, import_core6.list)({
  access: intakeAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["intake", "contact", "participantRole", "status"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.participants"),
    contact: requiredRelationship("Contact"),
    participantRole: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Prospective client", value: "prospective_client" },
        { label: "Adverse party", value: "adverse_party" },
        { label: "Related party", value: "related_party" },
        { label: "Witness", value: "witness" },
        { label: "Referrer", value: "referrer" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" }
      ],
      defaultValue: "active"
    }),
    notes: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var IntakeSubmission = (0, import_core6.list)({
  access: intakeAccess,
  hooks: firmOwnedHooks({ lifecycle: "intakeSubmission" }),
  ui: { listView: { initialColumns: ["intake", "status", "schemaVersion", "submittedAt", "reviewedBy"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.submissions"),
    submittedByContact: (0, import_fields13.relationship)({ ref: "Contact" }),
    reviewedBy: (0, import_fields13.relationship)({ ref: "User" }),
    status: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Submitted", value: "submitted" },
        { label: "Under review", value: "under_review" },
        { label: "Accepted", value: "accepted" },
        { label: "Superseded", value: "superseded" }
      ],
      defaultValue: "submitted",
      validation: { isRequired: true }
    }),
    schemaVersion: (0, import_fields13.text)({ validation: { isRequired: true } }),
    formSchema: (0, import_fields13.json)({ access: sensitiveIntakeAccess }),
    responses: (0, import_fields13.json)({
      access: {
        ...sensitiveIntakeAccess,
        update: denyAll
      }
    }),
    submittedAt: (0, import_fields13.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    reviewedAt: (0, import_fields13.timestamp)(),
    reviewNotes: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    supersedes: (0, import_fields13.relationship)({ ref: "IntakeSubmission" }),
    ...trackingFields
  }
});
var Consultation = (0, import_core6.list)({
  db: uniqueConstraints(["firmId", "requestKey"]),
  graphql: { omit: { create: true, update: true, delete: true } },
  access: { ...intakeAccess, operation: { ...intakeAccess.operation, create: denyAll, update: denyAll, delete: denyAll } },
  hooks: firmOwnedHooks({ lifecycle: "consultation" }),
  ui: { listView: { initialColumns: ["intake", "status", "startsAt", "host", "office"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.consultations"),
    account: readOnlyRelationship("User.consultations"),
    requestKey: (0, import_fields13.text)({ db: { isNullable: true }, defaultValue: null, graphql: { omit: true } }),
    requestDigest: (0, import_fields13.text)({ graphql: { omit: true } }),
    serviceTitle: (0, import_fields13.text)(),
    serviceSnapshot: (0, import_fields13.json)({ access: { create: denyAll, update: denyAll } }),
    feeMinor: (0, import_fields13.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 2147483647 }, access: { create: denyAll, update: denyAll } }),
    currencyCode: (0, import_fields13.text)({ defaultValue: "USD", access: { create: denyAll, update: denyAll } }),
    status: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No show", value: "no_show" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true }
    }),
    startsAt: (0, import_fields13.timestamp)(),
    endsAt: (0, import_fields13.timestamp)(),
    timezone: (0, import_fields13.text)({ defaultValue: "UTC", validation: { isRequired: true } }),
    office: (0, import_fields13.relationship)({ ref: "Office" }),
    host: (0, import_fields13.relationship)({ ref: "User" }),
    participants: (0, import_fields13.relationship)({ ref: "Contact", many: true }),
    location: (0, import_fields13.text)(),
    outcome: (0, import_fields13.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Recommend engagement", value: "recommend_engagement" },
        { label: "Decline", value: "decline" },
        { label: "Follow up", value: "follow_up" }
      ],
      defaultValue: "pending"
    }),
    notes: (0, import_fields13.text)({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    cancellationReason: (0, import_fields13.text)({ access: sensitiveIntakeAccess }),
    ...trackingFields
  }
});

// features/keystone/models/conflicts.ts
var import_core7 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var canReadConflicts = ({ session }) => permissions.canReadIntake({ session }) || permissions.canRunConflictChecks({ session }) || permissions.canResolveConflicts({ session });
var canCreateConflictChecks = ({ session }) => permissions.canRunConflictChecks({ session });
var canResolveConflicts = ({ session }) => permissions.canResolveConflicts({ session });
var conflictAccess = {
  operation: {
    query: canReadConflicts,
    create: canCreateConflictChecks,
    update: denyAll,
    delete: denyAll
  },
  filter: {
    query: rules.canReadConflictRecord,
    update: () => false,
    delete: rules.canResolveConflictRecord
  }
};
var conflictEvidenceAccess = {
  read: canReadConflicts,
  create: canCreateConflictChecks,
  update: canResolveConflicts
};
var withheldConflictNarrative = {
  read: denyAll
};
function immutableConflictInputAccess(query) {
  return {
    operation: {
      query: canReadConflicts,
      create: canCreateConflictChecks,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query,
      update: () => false,
      delete: () => false
    }
  };
}
var ConflictCheck = (0, import_core7.list)({
  db: uniqueConstraints(["firmId", "checkNumber"]),
  access: conflictAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "conflictCheck", controlledStatus: true }),
  ui: { listView: { initialColumns: ["checkNumber", "status", "intake", "requestedBy", "completedAt"] } },
  fields: {
    firm: firmRelationship(),
    checkNumber: (0, import_fields15.text)({ isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Running", value: "running" },
        { label: "Review required", value: "review_required" },
        { label: "Cleared", value: "cleared" },
        { label: "Conflict found", value: "conflict_found" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true }
    }),
    intake: (0, import_fields15.relationship)({ ref: "Intake.conflictChecks" }),
    matter: (0, import_fields15.relationship)({ ref: "Matter.conflictChecks" }),
    requestedBy: requiredRelationship("User"),
    reviewedBy: (0, import_fields15.relationship)({ ref: "User" }),
    searchScope: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Active firm", value: "active_firm" },
        { label: "Contacts", value: "contacts" },
        { label: "Matters", value: "matters" },
        { label: "Contacts and matters", value: "contacts_and_matters" }
      ],
      defaultValue: "contacts_and_matters"
    }),
    searchVersion: (0, import_fields15.text)({ defaultValue: "v1", validation: { isRequired: true } }),
    startedAt: (0, import_fields15.timestamp)(),
    completedAt: (0, import_fields15.timestamp)(),
    reviewedAt: (0, import_fields15.timestamp)(),
    summary: (0, import_fields15.text)({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    failureReason: (0, import_fields15.text)({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    terms: readOnlyRelationship("ConflictSearchTerm.check", true),
    matches: readOnlyRelationship("ConflictMatch.check", true),
    dispositions: readOnlyRelationship("ConflictDisposition.check", true),
    ...trackingFields
  }
});
var ConflictSearchTerm = (0, import_core7.list)({
  access: immutableConflictInputAccess(rules.canReadConflictTerm),
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["check", "term", "termType", "sourceContact"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields15.relationship)({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.terms"),
    term: (0, import_fields15.text)({ access: conflictEvidenceAccess, validation: { isRequired: true } }),
    normalizedTerm: (0, import_fields15.text)({ access: conflictEvidenceAccess, validation: { isRequired: true }, isIndexed: true }),
    termType: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Person", value: "person" },
        { label: "Organization", value: "organization" },
        { label: "Alias", value: "alias" },
        { label: "Matter", value: "matter" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    sourceContact: (0, import_fields15.relationship)({ ref: "Contact" }),
    includeAliases: (0, import_fields15.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ConflictMatch = (0, import_core7.list)({
  access: immutableConflictInputAccess(rules.canReadConflictMatch),
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "conflictMatch", controlledStatus: true }),
  ui: { listView: { initialColumns: ["check", "status", "matchType", "matchedContact", "matchedMatter", "score"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields15.relationship)({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.matches"),
    status: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Potential", value: "potential" },
        { label: "Reviewing", value: "reviewing" },
        { label: "Cleared", value: "cleared" },
        { label: "Escalated", value: "escalated" }
      ],
      defaultValue: "potential",
      validation: { isRequired: true }
    }),
    matchType: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Exact name", value: "exact_name" },
        { label: "Alias", value: "alias" },
        { label: "Fuzzy name", value: "fuzzy_name" },
        { label: "Related party", value: "related_party" },
        { label: "Matter text", value: "matter_text" },
        { label: "Manual", value: "manual" }
      ],
      validation: { isRequired: true }
    }),
    matchedContact: (0, import_fields15.relationship)({ ref: "Contact" }),
    matchedMatter: (0, import_fields15.relationship)({ ref: "Matter.conflictMatches" }),
    matchedMatterParty: (0, import_fields15.relationship)({ ref: "MatterParty.conflictMatches" }),
    score: (0, import_fields15.integer)({ validation: { min: 0, max: 100 } }),
    matchedValue: (0, import_fields15.text)({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    evidenceExcerpt: (0, import_fields15.text)({ access: { read: denyAll }, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    sourceType: (0, import_fields15.text)({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    sourceId: (0, import_fields15.text)({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    reviewedBy: (0, import_fields15.relationship)({ ref: "User" }),
    reviewedAt: (0, import_fields15.timestamp)(),
    dispositions: readOnlyRelationship("ConflictDisposition.match", true),
    ...trackingFields
  }
});
var ConflictDisposition = (0, import_core7.list)({
  access: {
    operation: {
      query: canReadConflicts,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadConflictDisposition,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: (args) => !canResolveConflicts(args),
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["check", "match", "outcome", "reviewer", "decidedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields15.relationship)({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.dispositions"),
    match: (0, import_fields15.relationship)({ ref: "ConflictMatch.dispositions" }),
    outcome: (0, import_fields15.select)({
      type: "enum",
      options: [
        { label: "Clear", value: "clear" },
        { label: "Conflict", value: "conflict" },
        { label: "More information required", value: "needs_more_information" },
        { label: "Approved exception recorded", value: "approved_exception" }
      ],
      validation: { isRequired: true }
    }),
    reviewer: requiredRelationship("User"),
    rationale: (0, import_fields15.text)({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    conditions: (0, import_fields15.text)({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    policyReference: (0, import_fields15.text)({ access: withheldConflictNarrative, graphql: { omit: { read: true } } }),
    decidedAt: (0, import_fields15.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/matters.ts
var import_core8 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");

// features/keystone/lib/team-capability.ts
function touchedMatterIds(args) {
  const ids = /* @__PURE__ */ new Set();
  if (args.listKey === "Matter") {
    if (args.item?.id) ids.add(String(args.item.id));
    return ids;
  }
  if (args.item?.matterId) ids.add(String(args.item.matterId));
  for (const id2 of relationshipConnectionIds(args.resolvedData?.matter)) ids.add(id2);
  return ids;
}
async function validateMatterTeamCapability(args, capability) {
  if (args.listKey === "Matter" && args.operation !== "update") return;
  const userId = args.context.session?.itemId;
  const firmId = activeFirmId(args.context.session);
  if (!userId || !firmId) return;
  const matterIds = [...touchedMatterIds(args)];
  if (!matterIds.length) return;
  const granted = await args.context.prisma.matterTeamMember.count({
    where: { firmId, userId, status: "active", [capability]: true, matterId: { in: matterIds } }
  });
  if (granted !== matterIds.length) {
    args.addValidationError(capability === "canBill" ? "Matter billing authority is not explicitly granted to this team member." : "Matter editing authority is not explicitly granted to this team member.");
  }
}

// features/keystone/models/matters.ts
var matterAccess = {
  operation: {
    query: permissions.canReadMatters,
    create: permissions.canManageMatters,
    update: permissions.canManageMatters,
    delete: denyAll
  },
  filter: {
    query: rules.canReadMatter,
    update: rules.canManageMatter,
    delete: rules.canManageMatter
  }
};
var matterRecordAccess = {
  operation: {
    query: permissions.canReadMatters,
    create: permissions.canManageMatters,
    update: permissions.canManageMatters,
    delete: denyAll
  },
  filter: {
    query: rules.canReadMatterRecord,
    update: rules.canManageMatterRecord,
    delete: rules.canManageMatterRecord
  }
};
var privilegedFieldAccess = {
  read: ({ session }) => permissions.canReadMatters({ session }),
  create: ({ session }) => permissions.canManageMatters({ session }),
  update: ({ session }) => permissions.canManageMatters({ session })
};
var controlledConfidentialityAccess = {
  read: ({ session }) => permissions.canReadMatters({ session }),
  create: ({ session }) => permissions.canManageMatters({ session }),
  update: denyAll
};
var practiceAreaHooks = firmOwnedHooks();
var PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function normalizePublicSlug(value) {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || null;
}
var PracticeArea = (0, import_core8.list)({
  // Published services resolve by an explicit firm-unique public slug, never by
  // a lowercased internal code (codes may be empty, contain "/", or differ only by case).
  db: uniqueConstraints(["firmId", "code"], ["firmId", "publicSlug"]),
  access: scopedAccess("canReadMatters", "canManageMatters"),
  hooks: {
    ...practiceAreaHooks,
    resolveInput: {
      create: (args) => {
        const data = practiceAreaHooks.resolveInput.create(args);
        if (typeof data.publicSlug === "string") data.publicSlug = normalizePublicSlug(data.publicSlug);
        if (data.isPublic && !data.publicSlug) data.publicSlug = normalizePublicSlug(data.code) ?? normalizePublicSlug(data.name);
        return data;
      },
      update: ({ resolvedData, item }) => {
        if (typeof resolvedData.publicSlug === "string") resolvedData.publicSlug = normalizePublicSlug(resolvedData.publicSlug);
        const isPublic = resolvedData.isPublic ?? item.isPublic;
        if (isPublic && !(resolvedData.publicSlug ?? item.publicSlug)) {
          resolvedData.publicSlug = normalizePublicSlug(resolvedData.code ?? item.code) ?? normalizePublicSlug(resolvedData.name ?? item.name);
        }
        return resolvedData;
      }
    },
    validate: {
      create: async (args) => {
        await practiceAreaHooks.validate.create(args);
        validatePublicSlug(args);
      },
      update: async (args) => {
        await practiceAreaHooks.validate.update(args);
        validatePublicSlug(args);
      }
    }
  },
  ui: { listView: { initialColumns: ["name", "code", "publicSlug", "isPublic", "status"] } },
  fields: {
    firm: firmRelationship(),
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    code: (0, import_fields17.text)({ isIndexed: true }),
    status: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active"
    }),
    description: (0, import_fields17.text)({ ui: { displayMode: "textarea" } }),
    isPublic: (0, import_fields17.checkbox)({ defaultValue: false }),
    publicSlug: (0, import_fields17.text)({
      isIndexed: true,
      defaultValue: null,
      db: { isNullable: true },
      ui: { description: "Public URL handle for a published service, e.g. business-contracts. Derived from the code when left empty." }
    }),
    consultationFeeMinor: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 2147483647 } }),
    consultationMinutes: (0, import_fields17.integer)({ defaultValue: 30, validation: { isRequired: true, min: 15, max: 120 } }),
    // Read-only inverse: `matters: { set: [] }` would unlink hidden matters without
    // Matter's own access or hooks; matters choose their practice area themselves.
    matters: readOnlyRelationship("Matter.practiceArea", true),
    ...trackingFields
  }
});
function validatePublicSlug(args) {
  const isPublic = args.resolvedData?.isPublic ?? args.item?.isPublic;
  const slug2 = args.resolvedData?.publicSlug !== void 0 ? args.resolvedData.publicSlug : args.item?.publicSlug;
  if (slug2 && (slug2.length > 80 || !PUBLIC_SLUG_PATTERN.test(slug2))) args.addValidationError("Public slug must use lowercase letters, numbers and single hyphens.");
  if (isPublic && !slug2) args.addValidationError("A published service needs a public slug.");
}
var baseMatterHooks = firmOwnedHooks({ lifecycle: "matter", controlledStatus: true });
var matterHooks = {
  ...baseMatterHooks,
  validate: {
    ...baseMatterHooks.validate,
    update: async (args) => {
      await baseMatterHooks.validate.update(args);
      await validateMatterTeamCapability(args, "canEdit");
    }
  }
};
var Matter = (0, import_core8.list)({
  db: uniqueConstraints(["firmId", "matterNumber"]),
  access: matterAccess,
  hooks: matterHooks,
  ui: {
    listView: { initialColumns: ["matterNumber", "title", "status", "confidentiality", "client", "responsibleAttorney"] }
  },
  fields: {
    firm: firmRelationship(),
    matterNumber: (0, import_fields17.text)({ isIndexed: true, access: controlledConfidentialityAccess, graphql: { omit: { update: true } }, validation: { isRequired: true } }),
    title: (0, import_fields17.text)({ access: privilegedFieldAccess, validation: { isRequired: true } }),
    status: (0, import_fields17.select)({
      type: "enum",
      access: controlledConfidentialityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Proposed", value: "proposed" },
        { label: "Pending conflict", value: "pending_conflict" },
        { label: "Open", value: "open" },
        { label: "On hold", value: "on_hold" },
        { label: "Closing", value: "closing" },
        { label: "Closed", value: "closed" },
        { label: "Declined", value: "declined" }
      ],
      defaultValue: "proposed",
      validation: { isRequired: true }
    }),
    confidentiality: (0, import_fields17.select)({
      access: controlledConfidentialityAccess,
      ui: { itemView: { fieldMode: "read" } },
      type: "enum",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Restricted", value: "restricted" }
      ],
      defaultValue: "standard",
      validation: { isRequired: true }
    }),
    client: (0, import_fields17.relationship)({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledConfidentialityAccess,
      graphql: { omit: { update: true } }
    }),
    office: (0, import_fields17.relationship)({ ref: "Office" }),
    practiceArea: (0, import_fields17.relationship)({ ref: "PracticeArea.matters" }),
    intake: readOnlyRelationship("Intake.convertedMatter"),
    responsibleAttorney: (0, import_fields17.relationship)({ ref: "User" }),
    originatingAttorney: (0, import_fields17.relationship)({ ref: "User" }),
    description: (0, import_fields17.text)({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    billingType: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Contingency", value: "contingency" },
        { label: "Pro bono", value: "pro_bono" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "hourly"
    }),
    openedAt: (0, import_fields17.timestamp)({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } } }),
    closedAt: (0, import_fields17.timestamp)({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } } }),
    closureReason: (0, import_fields17.text)({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } }, ui: { displayMode: "textarea" } }),
    customData: (0, import_fields17.json)({
      access: privilegedFieldAccess,
      ui: { description: "Bounded firm-defined attributes; core relationships and financial values remain first-class fields." }
    }),
    parties: readOnlyRelationship("MatterParty.matter", true),
    teamMembers: readOnlyRelationship("MatterTeamMember.matter", true),
    authorizedUsers: (0, import_fields17.relationship)({
      ref: "User.authorizedMatters",
      many: true,
      access: { create: denyAll, update: denyAll },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    blockedUsers: (0, import_fields17.relationship)({
      ref: "User.blockedMatters",
      many: true,
      access: {
        read: ({ session }) => permissions.canManageEthicalWalls({ session }),
        create: denyAll,
        update: denyAll
      },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    ethicalWalls: readOnlyRelationship("EthicalWall.matter", true),
    statusEvents: readOnlyRelationship("MatterStatusEvent.matter", true),
    conflictChecks: readOnlyRelationship("ConflictCheck.matter", true),
    conflictMatches: readOnlyRelationship("ConflictMatch.matchedMatter", true),
    ...trackingFields
  }
});
var MatterParty = (0, import_core8.list)({
  access: matterRecordAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["matter", "contact", "partyRole", "side", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.parties"),
    contact: requiredRelationship("Contact"),
    partyRole: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Client", value: "client" },
        { label: "Plaintiff / claimant", value: "claimant" },
        { label: "Defendant / respondent", value: "respondent" },
        { label: "Opposing party", value: "opposing_party" },
        { label: "Witness", value: "witness" },
        { label: "Expert", value: "expert" },
        { label: "Counsel", value: "counsel" },
        { label: "Judge / adjudicator", value: "adjudicator" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    side: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Our client", value: "our_client" },
        { label: "Adverse", value: "adverse" },
        { label: "Neutral", value: "neutral" },
        { label: "Unknown", value: "unknown" }
      ],
      defaultValue: "unknown"
    }),
    representedBy: (0, import_fields17.relationship)({ ref: "Contact" }),
    counselContact: (0, import_fields17.relationship)({ ref: "Contact" }),
    status: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" }
      ],
      defaultValue: "active"
    }),
    isPrimaryClient: (0, import_fields17.checkbox)({ defaultValue: false }),
    notes: (0, import_fields17.text)({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    conflictMatches: readOnlyRelationship("ConflictMatch.matchedMatterParty", true),
    ...trackingFields
  }
});
var MatterTeamMember = (0, import_core8.list)({
  db: uniqueConstraints(["matterId", "userId"]),
  access: {
    ...matterRecordAccess,
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    }
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["matter", "user", "teamRole", "status", "canAccessRestricted"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.teamMembers"),
    user: requiredRelationship("User"),
    office: (0, import_fields17.relationship)({ ref: "Office" }),
    teamRole: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Responsible attorney", value: "responsible_attorney" },
        { label: "Attorney", value: "attorney" },
        { label: "Paralegal", value: "paralegal" },
        { label: "Assistant", value: "assistant" },
        { label: "Billing", value: "billing" },
        { label: "Observer", value: "observer" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    canAccessRestricted: (0, import_fields17.checkbox)({ defaultValue: false }),
    canEdit: (0, import_fields17.checkbox)({ defaultValue: false }),
    canBill: (0, import_fields17.checkbox)({ defaultValue: false }),
    assignedAt: (0, import_fields17.timestamp)({ defaultValue: { kind: "now" } }),
    removedAt: (0, import_fields17.timestamp)(),
    ...trackingFields
  }
});
var EthicalWall = (0, import_core8.list)({
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: permissions.canManageEthicalWalls,
      update: permissions.canManageEthicalWalls,
      delete: denyAll
    },
    filter: {
      query: rules.canReadEthicalWallRecord,
      update: rules.canManageEthicalWallRecord,
      delete: rules.canManageEthicalWallRecord
    }
  },
  hooks: firmOwnedHooks({ lifecycle: "ethicalWall", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "matter", "status", "approvedBy", "effectiveAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.ethicalWalls"),
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    status: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Lifted", value: "lifted" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    reason: (0, import_fields17.text)({ access: privilegedFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    policyReference: (0, import_fields17.text)(),
    createdBy: (0, import_fields17.relationship)({
      ref: "User",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { update: denyAll }
    }),
    approvedBy: (0, import_fields17.relationship)({
      ref: "User",
      access: { create: denyAll, update: denyAll }
    }),
    effectiveAt: (0, import_fields17.timestamp)({ access: { create: denyAll, update: denyAll } }),
    liftedAt: (0, import_fields17.timestamp)({ access: { create: denyAll, update: denyAll } }),
    members: readOnlyRelationship("EthicalWallMember.wall", true),
    ...trackingFields
  }
});
var EthicalWallMember = (0, import_core8.list)({
  db: uniqueConstraints(["wallId", "userId"]),
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadEthicalWallRecord,
      update: rules.canManageEthicalWallRecord,
      delete: rules.canManageEthicalWallRecord
    }
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["wall", "matter", "user", "decision", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    wall: requiredRelationship("EthicalWall.members"),
    user: requiredRelationship("User"),
    decision: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Allowed", value: "allowed" },
        { label: "Blocked", value: "blocked" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields17.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "active"
    }),
    approvedBy: requiredRelationship("User"),
    reason: (0, import_fields17.text)({ access: privilegedFieldAccess, validation: { isRequired: true } }),
    effectiveAt: (0, import_fields17.timestamp)({ defaultValue: { kind: "now" } }),
    revokedAt: (0, import_fields17.timestamp)(),
    ...trackingFields
  }
});
var MatterStatusEvent = (0, import_core8.list)({
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadMatterRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    isHidden: ({ session }) => !permissions.canReadMatters({ session }),
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["matter", "fromStatus", "toStatus", "occurredAt", "actorUser"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.statusEvents"),
    fromStatus: (0, import_fields17.text)(),
    toStatus: (0, import_fields17.text)({ validation: { isRequired: true } }),
    action: (0, import_fields17.text)({ validation: { isRequired: true } }),
    reason: (0, import_fields17.text)({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    actorUser: (0, import_fields17.relationship)({ ref: "User" }),
    actorAgent: (0, import_fields17.relationship)({ ref: "AgentPrincipal" }),
    occurredAt: (0, import_fields17.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: (0, import_fields17.json)({ access: privilegedFieldAccess }),
    ...trackingFields
  }
});

// features/keystone/models/calendaring.ts
var import_core9 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var canReadCalendar = ({ session }) => permissions.canReadCalendar({ session }) || permissions.canReadMatters({ session });
var canManageCalendar = ({ session }) => permissions.canManageCalendar({ session });
var matterCalendarAccess = {
  operation: {
    query: canReadCalendar,
    create: canManageCalendar,
    update: canManageCalendar,
    delete: denyAll
  },
  filter: {
    query: rules.canReadCalendarRecord,
    update: rules.canManageCalendarRecord,
    delete: rules.canManageCalendarRecord
  }
};
var canReadTasks = ({ session }) => permissions.canReadTasks({ session }) || permissions.canReadMatters({ session });
var canManageTasks = ({ session }) => permissions.canManageTasks({ session });
var taskAccess = {
  operation: {
    query: canReadTasks,
    create: canManageTasks,
    update: canManageTasks,
    delete: denyAll
  },
  filter: {
    query: rules.canReadTaskRecord,
    update: rules.canManageTaskRecord,
    delete: rules.canManageTaskRecord
  }
};
var privilegedCalendarField = {
  read: canReadCalendar,
  create: canManageCalendar,
  update: canManageCalendar
};
var controlledCalendarField = {
  read: canReadCalendar,
  create: denyAll,
  update: denyAll
};
var controlledTaskField = {
  read: canReadTasks,
  create: canManageTasks,
  update: denyAll
};
var Court = (0, import_core9.list)({
  access: scopedAccess("canReadCalendar", "canManageCalendar"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "courtType", "jurisdiction", "status"] } },
  fields: {
    firm: firmRelationship(),
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    courtType: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Federal", value: "federal" },
        { label: "State / provincial", value: "state" },
        { label: "County / local", value: "local" },
        { label: "Administrative", value: "administrative" },
        { label: "Arbitration", value: "arbitration" },
        { label: "Other tribunal", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    jurisdiction: (0, import_fields19.text)({ validation: { isRequired: true } }),
    jurisdictionCode: (0, import_fields19.text)({ isIndexed: true }),
    division: (0, import_fields19.text)(),
    status: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" }
      ],
      defaultValue: "active"
    }),
    address: (0, import_fields19.relationship)({ ref: "Address" }),
    phone: (0, import_fields19.text)(),
    website: (0, import_fields19.text)(),
    filingUrl: (0, import_fields19.text)(),
    dockets: readOnlyRelationship("Docket.court", true),
    ...trackingFields
  }
});
var Docket = (0, import_core9.list)({
  db: uniqueConstraints(["matterId", "docketNumber"]),
  access: matterCalendarAccess,
  hooks: firmOwnedHooks({ lifecycle: "docket" }),
  ui: { listView: { initialColumns: ["docketNumber", "title", "status", "matter", "court"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    court: requiredRelationship("Court.dockets"),
    docketNumber: (0, import_fields19.text)({ validation: { isRequired: true }, isIndexed: true }),
    title: (0, import_fields19.text)({ access: privilegedCalendarField, validation: { isRequired: true } }),
    status: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Stayed", value: "stayed" },
        { label: "Appealed", value: "appealed" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    judgeContact: (0, import_fields19.relationship)({ ref: "Contact" }),
    clerkContact: (0, import_fields19.relationship)({ ref: "Contact" }),
    filedAt: (0, import_fields19.timestamp)(),
    closedAt: (0, import_fields19.timestamp)(),
    notes: (0, import_fields19.text)({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    entries: readOnlyRelationship("DocketEntry.docket", true),
    deadlines: readOnlyRelationship("Deadline.docket", true),
    ...trackingFields
  }
});
var DocketEntry = (0, import_core9.list)({
  access: matterCalendarAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "docketEntry", controlledStatus: true }),
  ui: { listView: { initialColumns: ["title", "entryType", "status", "docket", "occurredAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    docket: requiredRelationship("Docket.entries"),
    title: (0, import_fields19.text)({ access: privilegedCalendarField, validation: { isRequired: true } }),
    entryType: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Filing", value: "filing" },
        { label: "Order", value: "order" },
        { label: "Hearing", value: "hearing" },
        { label: "Notice", value: "notice" },
        { label: "Service", value: "service" },
        { label: "Correspondence", value: "correspondence" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Filed", value: "filed" },
        { label: "Entered", value: "entered" },
        { label: "Rejected", value: "rejected" },
        { label: "Withdrawn", value: "withdrawn" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    externalEntryId: (0, import_fields19.text)(),
    occurredAt: (0, import_fields19.timestamp)({ validation: { isRequired: true } }),
    filedAt: (0, import_fields19.timestamp)(),
    enteredAt: (0, import_fields19.timestamp)(),
    description: (0, import_fields19.text)({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    sourceUrl: (0, import_fields19.text)(),
    documentVersion: (0, import_fields19.relationship)({ ref: "DocumentVersion" }),
    isVerified: (0, import_fields19.checkbox)({ defaultValue: false }),
    verifiedBy: (0, import_fields19.relationship)({ ref: "User" }),
    verifiedAt: (0, import_fields19.timestamp)(),
    deadlines: readOnlyRelationship("Deadline.sourceEntry", true),
    ...trackingFields
  }
});
var baseDeadlineHooks = firmOwnedHooks({ lifecycle: "deadline", controlledStatus: true });
var deadlineHooks = {
  ...baseDeadlineHooks,
  validate: {
    create: baseDeadlineHooks.validate.create,
    update: async (args) => {
      await baseDeadlineHooks.validate.update(args);
      const verifiedSnapshotFields = /* @__PURE__ */ new Set([
        "matter",
        "docket",
        "sourceEntry",
        "title",
        "deadlineType",
        "dueAt",
        "timezone",
        "source",
        "calculationMethod",
        "ruleReference",
        "parentDeadline"
      ]);
      if (args.item.isVerified && Object.keys(args.resolvedData).some((field) => verifiedSnapshotFields.has(field))) {
        args.addValidationError("A verified deadline snapshot cannot be changed; create a corrected deadline with new verification evidence.");
      }
    }
  }
};
var Deadline = (0, import_core9.list)({
  access: {
    ...matterCalendarAccess,
    operation: { ...matterCalendarAccess.operation, update: denyAll },
    filter: { ...matterCalendarAccess.filter, update: () => false }
  },
  graphql: immutableUpdateDeleteGraphql,
  hooks: deadlineHooks,
  ui: { listView: { initialColumns: ["title", "status", "dueAt", "matter", "assignedTo", "isVerified"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    docket: (0, import_fields19.relationship)({ ref: "Docket.deadlines" }),
    sourceEntry: (0, import_fields19.relationship)({ ref: "DocketEntry.deadlines" }),
    title: (0, import_fields19.text)({ access: privilegedCalendarField, validation: { isRequired: true } }),
    status: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Pending", value: "pending" },
        { label: "Completed", value: "completed" },
        { label: "Missed", value: "missed" },
        { label: "Waived", value: "waived" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    deadlineType: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Court", value: "court" },
        { label: "Statutory", value: "statutory" },
        { label: "Contractual", value: "contractual" },
        { label: "Internal", value: "internal" },
        { label: "Limitation", value: "limitation" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    dueAt: (0, import_fields19.timestamp)({ validation: { isRequired: true } }),
    timezone: (0, import_fields19.text)({ defaultValue: "UTC", validation: { isRequired: true } }),
    source: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Court rule", value: "court_rule" },
        { label: "Docket integration", value: "docket_integration" },
        { label: "Agent proposed", value: "agent_proposed" },
        { label: "Imported", value: "imported" }
      ],
      defaultValue: "manual"
    }),
    calculationMethod: (0, import_fields19.text)({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    ruleReference: (0, import_fields19.text)(),
    isVerified: (0, import_fields19.checkbox)({ access: controlledCalendarField, defaultValue: false }),
    verifiedBy: (0, import_fields19.relationship)({ ref: "User", access: controlledCalendarField }),
    verifiedAt: (0, import_fields19.timestamp)({ access: controlledCalendarField }),
    assignedTo: (0, import_fields19.relationship)({ ref: "User" }),
    completedAt: (0, import_fields19.timestamp)({ access: controlledCalendarField }),
    parentDeadline: (0, import_fields19.relationship)({ ref: "Deadline.dependentDeadlines" }),
    dependentDeadlines: readOnlyRelationship("Deadline.parentDeadline", true),
    tasks: readOnlyRelationship("LegalTask.deadline", true),
    metadata: (0, import_fields19.json)({ access: privilegedCalendarField }),
    ...trackingFields
  }
});
var LegalTask = (0, import_core9.list)({
  access: taskAccess,
  hooks: firmOwnedHooks({ lifecycle: "legalTask", controlledStatus: true }),
  ui: { listView: { initialColumns: ["title", "status", "priority", "dueAt", "matter", "assignedTo"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    deadline: (0, import_fields19.relationship)({ ref: "Deadline.tasks" }),
    title: (0, import_fields19.text)({ validation: { isRequired: true } }),
    description: (0, import_fields19.text)({ ui: { displayMode: "textarea" } }),
    status: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "In progress", value: "in_progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "open",
      validation: { isRequired: true }
    }),
    priority: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" }
      ],
      defaultValue: "normal"
    }),
    assignedTo: (0, import_fields19.relationship)({ ref: "User" }),
    assignedBy: (0, import_fields19.relationship)({ ref: "User" }),
    dueAt: (0, import_fields19.timestamp)(),
    completedAt: (0, import_fields19.timestamp)({ access: controlledTaskField }),
    parentTask: (0, import_fields19.relationship)({ ref: "LegalTask.subtasks" }),
    subtasks: readOnlyRelationship("LegalTask.parentTask", true),
    dependsOn: (0, import_fields19.relationship)({ ref: "LegalTask.dependents", many: true }),
    dependents: (0, import_fields19.relationship)({ ref: "LegalTask.dependsOn", many: true }),
    blockedReason: (0, import_fields19.text)({ access: controlledTaskField, ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/communications.ts
var import_core10 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var canReadCommunications = ({ session }) => permissions.canReadCommunications({ session }) || permissions.canManageCommunications({ session });
var canManageCommunications = ({ session }) => permissions.canManageCommunications({ session });
var communicationAccess = {
  operation: {
    query: canReadCommunications,
    create: canManageCommunications,
    update: canManageCommunications,
    delete: denyAll
  },
  filter: {
    query: rules.canReadCommunicationRecord,
    update: rules.canManageCommunicationRecord,
    delete: rules.canManageCommunicationRecord
  }
};
var messageFieldAccess = {
  read: canReadCommunications,
  create: canManageCommunications,
  update: canManageCommunications
};
var CommunicationThread = (0, import_core10.list)({
  access: communicationAccess,
  hooks: firmOwnedHooks({ lifecycle: "communicationThread" }),
  ui: { listView: { initialColumns: ["subject", "status", "matter", "intake", "lastMessageAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields21.relationship)({ ref: "Matter" }),
    intake: (0, import_fields21.relationship)({ ref: "Intake" }),
    subject: (0, import_fields21.text)({ access: messageFieldAccess, validation: { isRequired: true } }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Archived", value: "archived" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "open",
      validation: { isRequired: true }
    }),
    primaryChannel: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Phone", value: "phone" },
        { label: "Portal", value: "portal" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "email"
    }),
    lastMessageAt: (0, import_fields21.timestamp)(),
    participants: readOnlyRelationship("CommunicationParticipant.thread", true),
    messages: readOnlyRelationship("CommunicationMessage.thread", true),
    ...trackingFields
  }
});
var CommunicationParticipant = (0, import_core10.list)({
  access: communicationAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["thread", "participantRole", "user", "contact", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields21.relationship)({ ref: "Matter" }),
    thread: requiredRelationship("CommunicationThread.participants"),
    user: (0, import_fields21.relationship)({ ref: "User" }),
    contact: (0, import_fields21.relationship)({ ref: "Contact" }),
    portalAccount: (0, import_fields21.relationship)({ ref: "PortalAccount" }),
    participantRole: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Staff", value: "staff" },
        { label: "Client", value: "client" },
        { label: "External counsel", value: "external_counsel" },
        { label: "Third party", value: "third_party" },
        { label: "System", value: "system" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" }
      ],
      defaultValue: "active"
    }),
    displayAddress: (0, import_fields21.text)({ access: messageFieldAccess }),
    addedAt: (0, import_fields21.timestamp)({ defaultValue: { kind: "now" } }),
    removedAt: (0, import_fields21.timestamp)(),
    ...trackingFields
  }
});
var baseCommunicationMessageHooks = firmOwnedHooks({ lifecycle: "communicationMessage", controlledStatus: true });
var communicationMessageHooks = {
  ...baseCommunicationMessageHooks,
  validate: {
    create: baseCommunicationMessageHooks.validate.create,
    update: async (args) => {
      await baseCommunicationMessageHooks.validate.update(args);
      if (args.item.status !== "draft" && Object.keys(args.resolvedData).length) {
        args.addValidationError("A queued communication envelope is immutable.");
      }
    }
  }
};
var CommunicationMessage = (0, import_core10.list)({
  access: communicationAccess,
  hooks: communicationMessageHooks,
  ui: { listView: { initialColumns: ["thread", "direction", "channel", "status", "sentAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields21.relationship)({ ref: "Matter" }),
    thread: requiredRelationship("CommunicationThread.messages"),
    direction: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Inbound", value: "inbound" },
        { label: "Outbound", value: "outbound" },
        { label: "Internal", value: "internal" }
      ],
      validation: { isRequired: true }
    }),
    channel: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Phone", value: "phone" },
        { label: "Portal", value: "portal" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Queued", value: "queued" },
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
        { label: "Received", value: "received" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    subject: (0, import_fields21.text)({ access: { ...messageFieldAccess, update: denyAll } }),
    body: (0, import_fields21.text)({
      access: { ...messageFieldAccess, update: denyAll },
      validation: { isRequired: true },
      ui: { displayMode: "textarea" }
    }),
    senderUser: (0, import_fields21.relationship)({ ref: "User" }),
    senderContact: (0, import_fields21.relationship)({ ref: "Contact" }),
    senderAgent: (0, import_fields21.relationship)({ ref: "AgentPrincipal" }),
    externalMessageId: (0, import_fields21.text)({ isIndexed: true }),
    replyToMessage: (0, import_fields21.relationship)({ ref: "CommunicationMessage.replies" }),
    replies: readOnlyRelationship("CommunicationMessage.replyToMessage", true),
    queuedAt: (0, import_fields21.timestamp)(),
    sentAt: (0, import_fields21.timestamp)(),
    receivedAt: (0, import_fields21.timestamp)(),
    metadata: (0, import_fields21.json)({
      access: messageFieldAccess,
      ui: { description: "Bounded provider provenance; never credentials or unrestricted raw provider payloads." }
    }),
    attachments: (0, import_fields21.relationship)({
      ref: "DocumentVersion",
      many: true,
      access: { create: canManageCommunications, update: denyAll }
    }),
    deliveries: readOnlyRelationship("CommunicationDelivery.message", true),
    ...trackingFields
  }
});
var CommunicationDelivery = (0, import_core10.list)({
  access: {
    ...communicationAccess,
    operation: { ...communicationAccess.operation, update: denyAll },
    filter: { ...communicationAccess.filter, update: () => false }
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "communicationDelivery", controlledStatus: true }),
  ui: { listView: { initialColumns: ["message", "channel", "status", "recipientAddress", "attemptCount"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields21.relationship)({ ref: "Matter" }),
    message: requiredRelationship("CommunicationMessage.deliveries"),
    integrationConnection: (0, import_fields21.relationship)({ ref: "IntegrationConnection" }),
    channel: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Portal", value: "portal" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
        { label: "Bounced", value: "bounced" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    recipientContact: (0, import_fields21.relationship)({ ref: "Contact" }),
    recipientAddress: (0, import_fields21.text)({ access: messageFieldAccess }),
    provider: (0, import_fields21.text)(),
    providerMessageId: (0, import_fields21.text)({ isIndexed: true }),
    attemptCount: (0, import_fields21.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lastAttemptAt: (0, import_fields21.timestamp)(),
    deliveredAt: (0, import_fields21.timestamp)(),
    errorCode: (0, import_fields21.text)(),
    errorMessage: (0, import_fields21.text)({ access: messageFieldAccess, ui: { displayMode: "textarea" } }),
    providerMetadata: (0, import_fields21.json)({ access: messageFieldAccess }),
    ...trackingFields
  }
});

// features/keystone/models/documents.ts
var import_core11 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var canReadDocuments = ({ session }) => permissions.canReadDocuments({ session }) || permissions.canManageDocuments({ session });
var canManageDocuments = ({ session }) => permissions.canManageDocuments({ session });
var documentAccess = {
  operation: {
    query: canReadDocuments,
    create: canManageDocuments,
    update: canManageDocuments,
    delete: denyAll
  },
  filter: {
    query: rules.canReadDocumentRecord,
    update: rules.canManageDocumentRecord,
    delete: rules.canManageDocumentRecord
  }
};
var documentFieldAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: canManageDocuments
};
var controlledDocumentLifecycleAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: denyAll
};
var immutableDocumentEvidenceAccess = {
  operation: {
    query: canReadDocuments,
    create: denyAll,
    update: denyAll,
    delete: denyAll
  },
  filter: {
    query: rules.canReadDocumentRecord,
    update: () => false,
    delete: () => false
  }
};
var immutableSignatureRequestAccess = {
  ...documentAccess,
  operation: { ...documentAccess.operation, update: denyAll },
  filter: { ...documentAccess.filter, update: () => false }
};
var controlledSignerFieldAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: denyAll
};
async function validateDocumentCurrentVersion(args) {
  if (!Object.prototype.hasOwnProperty.call(args.resolvedData ?? {}, "currentVersion")) return;
  const versionId = relationshipConnectionIds(args.resolvedData.currentVersion)[0];
  if (!versionId) {
    if (args.item?.status === "active") args.addValidationError("An active document must retain an exact current version.");
    return;
  }
  if (args.operation === "create" || !args.item?.id) {
    args.addValidationError("Create the document before assigning one of its immutable versions as current.");
    return;
  }
  const firmId = activeFirmId(args.context.session);
  const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma);
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, firmId, documentId: args.item.id },
    select: { id: true }
  });
  if (!version) args.addValidationError("Current version must be an immutable version of this same document.");
}
var baseDocumentHooks = firmOwnedHooks({ lifecycle: "document", controlledStatus: true });
var documentHooks = {
  ...baseDocumentHooks,
  validate: {
    create: async (args) => {
      await baseDocumentHooks.validate.create(args);
      await validateDocumentCurrentVersion(args);
    },
    update: async (args) => {
      await baseDocumentHooks.validate.update(args);
      await validateDocumentCurrentVersion(args);
    }
  }
};
var Document = (0, import_core11.list)({
  access: documentAccess,
  hooks: documentHooks,
  ui: { listView: { initialColumns: ["title", "status", "category", "matter", "currentVersion"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields23.relationship)({ ref: "Matter" }),
    intake: (0, import_fields23.relationship)({ ref: "Intake" }),
    contact: (0, import_fields23.relationship)({ ref: "Contact" }),
    title: (0, import_fields23.text)({ access: documentFieldAccess, validation: { isRequired: true } }),
    status: (0, import_fields23.select)({
      type: "enum",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
        { label: "Disposed", value: "disposed" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    category: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Pleading", value: "pleading" },
        { label: "Correspondence", value: "correspondence" },
        { label: "Evidence", value: "evidence" },
        { label: "Contract", value: "contract" },
        { label: "Research", value: "research" },
        { label: "Billing", value: "billing" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "other"
    }),
    confidentiality: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Restricted", value: "restricted" },
        { label: "Client shareable", value: "client_shareable" }
      ],
      defaultValue: "matter"
    }),
    description: (0, import_fields23.text)({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    currentVersion: (0, import_fields23.relationship)({
      ref: "DocumentVersion",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } }
    }),
    versions: readOnlyRelationship("DocumentVersion.document", true),
    archivedAt: (0, import_fields23.timestamp)({ access: controlledDocumentLifecycleAccess, graphql: { omit: { update: true } } }),
    disposedAt: (0, import_fields23.timestamp)({ access: controlledDocumentLifecycleAccess, graphql: { omit: { update: true } } }),
    retentionPolicy: (0, import_fields23.relationship)({
      ref: "RetentionPolicy.documents",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } }
    }),
    ...trackingFields
  }
});
var DocumentVersion = (0, import_core11.list)({
  db: uniqueConstraints(["documentId", "versionNumber"]),
  access: {
    operation: {
      query: canReadDocuments,
      create: canManageDocuments,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadDocumentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["document", "versionNumber", "fileName", "checksumSha256", "createdAt"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields23.relationship)({ ref: "Matter" }),
    document: requiredRelationship("Document.versions"),
    versionKey: (0, import_fields23.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    versionNumber: (0, import_fields23.integer)({ validation: { isRequired: true, min: 1 } }),
    fileName: (0, import_fields23.text)({ access: documentFieldAccess, validation: { isRequired: true } }),
    objectKey: (0, import_fields23.text)({ access: documentFieldAccess, validation: { isRequired: true } }),
    mediaType: (0, import_fields23.text)({ validation: { isRequired: true } }),
    byteSize: (0, import_fields23.integer)({ validation: { isRequired: true, min: 0 } }),
    checksumSha256: (0, import_fields23.text)({
      validation: {
        isRequired: true,
        match: { regex: /^[a-f0-9]{64}$/i, explanation: "Use a 64-character SHA-256 hex digest." }
      }
    }),
    source: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Upload", value: "upload" },
        { label: "Generated", value: "generated" },
        { label: "Email", value: "email" },
        { label: "Court", value: "court" },
        { label: "Signature provider", value: "signature_provider" },
        { label: "Import", value: "import" }
      ],
      defaultValue: "upload"
    }),
    createdBy: (0, import_fields23.relationship)({ ref: "User" }),
    sourceMessage: (0, import_fields23.relationship)({ ref: "CommunicationMessage" }),
    sourceDocketEntry: (0, import_fields23.relationship)({ ref: "DocketEntry" }),
    notes: (0, import_fields23.text)({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    signatureRequests: readOnlyRelationship("SignatureRequest.documentVersion", true),
    ...trackingFields
  }
});
var baseSignatureRequestHooks = firmOwnedHooks({ lifecycle: "signatureRequest", controlledStatus: true });
var signatureRequestHooks = {
  ...baseSignatureRequestHooks,
  validate: {
    create: baseSignatureRequestHooks.validate.create,
    update: async (args) => {
      await baseSignatureRequestHooks.validate.update(args);
      if (args.item.status !== "draft" && Object.keys(args.resolvedData).length) {
        args.addValidationError("A signature request is immutable after provider handoff.");
      }
    }
  }
};
var SignatureRequest = (0, import_core11.list)({
  access: immutableSignatureRequestAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: signatureRequestHooks,
  ui: { listView: { initialColumns: ["title", "status", "documentVersion", "provider", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields23.relationship)({ ref: "Matter" }),
    documentVersion: (0, import_fields23.relationship)({
      ref: "DocumentVersion.signatureRequests",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { read: canReadDocuments, create: canManageDocuments, update: denyAll }
    }),
    title: (0, import_fields23.text)({ access: documentFieldAccess, validation: { isRequired: true } }),
    status: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Partially signed", value: "partially_signed" },
        { label: "Completed", value: "completed" },
        { label: "Declined", value: "declined" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    provider: (0, import_fields23.text)(),
    integrationConnection: (0, import_fields23.relationship)({ ref: "IntegrationConnection" }),
    providerRequestId: (0, import_fields23.text)({ isIndexed: true }),
    message: (0, import_fields23.text)({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    sentAt: (0, import_fields23.timestamp)(),
    completedAt: (0, import_fields23.timestamp)(),
    expiresAt: (0, import_fields23.timestamp)(),
    signers: readOnlyRelationship("DocumentSigner.request", true),
    events: readOnlyRelationship("SignatureEvent.request", true),
    ...trackingFields
  }
});
var baseDocumentSignerHooks = firmOwnedHooks({ lifecycle: "signer", controlledStatus: true });
var documentSignerHooks = {
  ...baseDocumentSignerHooks,
  validate: {
    update: baseDocumentSignerHooks.validate.update,
    create: async (args) => {
      await baseDocumentSignerHooks.validate.create(args);
      const requestId = relationshipConnectionIds(args.resolvedData.request)[0];
      const firmId = activeFirmId(args.context.session);
      if (!requestId || !firmId) return;
      const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma);
      const request = await prisma.signatureRequest.findFirst({
        where: { id: requestId, firmId, status: "draft" },
        select: { id: true }
      });
      if (!request) args.addValidationError("Signers may be added only before provider handoff.");
    }
  }
};
var DocumentSigner = (0, import_core11.list)({
  access: immutableDocumentEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: documentSignerHooks,
  ui: { listView: { initialColumns: ["request", "name", "email", "status", "signingOrder"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields23.relationship)({ ref: "Matter" }),
    request: (0, import_fields23.relationship)({
      ref: "SignatureRequest.signers",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledSignerFieldAccess
    }),
    contact: (0, import_fields23.relationship)({ ref: "Contact", access: controlledSignerFieldAccess }),
    portalAccount: (0, import_fields23.relationship)({ ref: "PortalAccount", access: controlledSignerFieldAccess }),
    name: (0, import_fields23.text)({ access: controlledSignerFieldAccess, validation: { isRequired: true } }),
    email: (0, import_fields23.text)({ access: controlledSignerFieldAccess, validation: { isRequired: true } }),
    signingOrder: (0, import_fields23.integer)({ access: controlledSignerFieldAccess, defaultValue: 1, validation: { min: 1 } }),
    status: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Viewed", value: "viewed" },
        { label: "Signed", value: "signed" },
        { label: "Declined", value: "declined" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    providerSignerId: (0, import_fields23.text)({ access: controlledSignerFieldAccess, isIndexed: true }),
    viewedAt: (0, import_fields23.timestamp)({ access: controlledSignerFieldAccess }),
    signedAt: (0, import_fields23.timestamp)({ access: controlledSignerFieldAccess }),
    declinedAt: (0, import_fields23.timestamp)({ access: controlledSignerFieldAccess }),
    events: readOnlyRelationship("SignatureEvent.signer", true),
    ...trackingFields
  }
});
var SignatureEvent = (0, import_core11.list)({
  db: uniqueConstraints(["firmId", "providerEventId"]),
  access: {
    operation: {
      query: canReadDocuments,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadDocumentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["request", "signer", "eventType", "occurredAt", "providerEventId"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields23.relationship)({ ref: "Matter" }),
    request: requiredRelationship("SignatureRequest.events"),
    signer: (0, import_fields23.relationship)({ ref: "DocumentSigner.events" }),
    eventType: (0, import_fields23.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields23.text)({ isIndexed: true }),
    actorReference: (0, import_fields23.text)({ access: documentFieldAccess }),
    occurredAt: (0, import_fields23.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    evidence: (0, import_fields23.json)({
      access: documentFieldAccess,
      ui: { description: "Bounded signature evidence; never provider credentials or unrestricted request bodies." }
    }),
    ...trackingFields
  }
});

// features/keystone/models/billing.ts
var import_core12 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var canReadBilling = ({ session }) => permissions.canReadBilling({ session }) || permissions.canManageBilling({ session });
var canManageBilling = ({ session }) => permissions.canManageBilling({ session });
var billingAccess = {
  operation: {
    query: canReadBilling,
    create: canManageBilling,
    update: canManageBilling,
    delete: denyAll
  },
  filter: {
    query: rules.canReadBillingRecord,
    update: rules.canManageBillingRecord,
    delete: rules.canManageBillingRecord
  }
};
var controlledBillingAccess = {
  ...billingAccess,
  operation: { ...billingAccess.operation, update: denyAll },
  filter: { ...billingAccess.filter, update: () => false }
};
var optionalBillingAccess = {
  ...billingAccess,
  filter: {
    query: rules.canReadOptionalBillingRecord,
    update: rules.canManageOptionalBillingRecord,
    delete: rules.canManageOptionalBillingRecord
  }
};
var billingFieldAccess = {
  read: canReadBilling,
  create: canManageBilling,
  update: canManageBilling
};
var controlledBillingLifecycleAccess = {
  read: canReadBilling,
  create: canManageBilling,
  update: denyAll
};
var currencyValidation = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." }
};
function invoiceValue(args, field) {
  return args.resolvedData[field] ?? args.item?.[field];
}
function validateInvoiceTotals(args) {
  const subtotal = invoiceValue(args, "subtotalMinor");
  const discount = invoiceValue(args, "discountMinor");
  const tax = invoiceValue(args, "taxMinor");
  const total = invoiceValue(args, "totalMinor");
  const paid = invoiceValue(args, "paidMinor");
  const balance = invoiceValue(args, "balanceDueMinor");
  const status = invoiceValue(args, "status");
  if (total !== subtotal - discount + tax) {
    args.addValidationError("Invoice total must equal subtotal minus discount plus tax.");
  }
  if (paid > total) args.addValidationError("Invoice paid amount cannot exceed its total.");
  if (status === "void") {
    if (balance !== 0) args.addValidationError("A void invoice must have zero balance due.");
  } else if (balance !== total - paid) {
    args.addValidationError("Invoice balance must equal total minus paid amount.");
  }
  if (status === "paid" && (paid !== total || balance !== 0)) {
    args.addValidationError("A paid invoice must be paid in full with zero balance.");
  }
  if (["issued", "partially_paid", "paid", "overdue"].includes(status) && !invoiceValue(args, "issuedAt")) {
    args.addValidationError("An issued invoice status requires an issue timestamp.");
  }
  if (status === "void" && !String(invoiceValue(args, "voidReason") ?? "").trim()) {
    args.addValidationError("A void invoice requires a reason.");
  }
}
var invoiceSnapshotFields = /* @__PURE__ */ new Set([
  "matter",
  "client",
  "retainer",
  "invoiceNumber",
  "currencyCode",
  "subtotalMinor",
  "discountMinor",
  "taxMinor",
  "totalMinor",
  "issuedAt",
  "dueAt"
]);
var baseInvoiceHooks = firmOwnedHooks({ lifecycle: "invoice", controlledStatus: true });
var invoiceHooks = {
  ...baseInvoiceHooks,
  validate: {
    create: async (args) => {
      await baseInvoiceHooks.validate.create(args);
      validateInvoiceTotals(args);
      if (args.resolvedData.status !== "draft") {
        args.addValidationError("Invoices must be created in draft status.");
      }
    },
    update: async (args) => {
      await baseInvoiceHooks.validate.update(args);
      validateInvoiceTotals(args);
      if (["issued", "partially_paid", "paid", "overdue", "void"].includes(args.item.status) && Object.keys(args.resolvedData).some((field) => invoiceSnapshotFields.has(field))) {
        args.addValidationError("Issued invoice snapshot fields cannot be changed.");
      }
      if (args.resolvedData.status === "issued" && args.item.status !== "issued") {
        const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma);
        const totals = await prisma.invoiceLine.aggregate({
          where: { invoiceId: args.item.id },
          _sum: {
            subtotalMinor: true,
            discountMinor: true,
            taxMinor: true,
            lineTotalMinor: true
          }
        });
        if ((totals._sum.subtotalMinor ?? 0) !== invoiceValue(args, "subtotalMinor") || (totals._sum.discountMinor ?? 0) !== invoiceValue(args, "discountMinor") || (totals._sum.taxMinor ?? 0) !== invoiceValue(args, "taxMinor") || (totals._sum.lineTotalMinor ?? 0) !== invoiceValue(args, "totalMinor")) {
          args.addValidationError("Invoice totals must match immutable line snapshots before issue.");
        }
      }
    }
  }
};
var baseInvoiceLineHooks = firmOwnedHooks();
var invoiceLineHooks = {
  ...baseInvoiceLineHooks,
  validate: {
    create: async (args) => {
      await baseInvoiceLineHooks.validate.create(args);
      const invoiceId = relationshipConnectionIds(args.resolvedData.invoice)[0];
      if (!invoiceId) return;
      const firmId = activeFirmId(args.context.session);
      if (!firmId) return;
      const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma);
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, firmId, status: "draft" },
        select: { id: true, matterId: true, currencyCode: true }
      });
      if (!invoice) {
        args.addValidationError("Invoice lines may be added only to an accessible draft invoice.");
        return;
      }
      if (invoice.currencyCode !== args.resolvedData.currencyCode) {
        args.addValidationError("Invoice line currency must match its invoice.");
      }
      if (args.resolvedData.lineTotalMinor !== args.resolvedData.subtotalMinor - (args.resolvedData.discountMinor ?? 0) + (args.resolvedData.taxMinor ?? 0)) {
        args.addValidationError("Invoice line total must equal subtotal minus discount plus tax.");
      }
      const timeEntryId = relationshipConnectionIds(args.resolvedData.timeEntry)[0];
      const expenseId = relationshipConnectionIds(args.resolvedData.expense)[0];
      const hasTime = Boolean(timeEntryId);
      const hasExpense = Boolean(expenseId);
      if (args.resolvedData.lineType === "time" && (!hasTime || hasExpense)) {
        args.addValidationError("A time invoice line requires exactly one time entry source.");
      }
      if (args.resolvedData.lineType === "expense" && (!hasExpense || hasTime)) {
        args.addValidationError("An expense invoice line requires exactly one expense source.");
      }
      if (!["time", "expense"].includes(args.resolvedData.lineType) && (hasTime || hasExpense)) {
        args.addValidationError("Only time or expense lines may link those source records.");
      }
      if (timeEntryId) {
        const source = await prisma.timeEntry.findFirst({
          where: { id: timeEntryId, firmId, matterId: invoice.matterId, status: "approved", invoiceLine: null },
          select: { id: true, currencyCode: true }
        });
        if (!source || source.currencyCode !== invoice.currencyCode) {
          args.addValidationError("Time source must be unbilled, approved, same-matter, and same-currency.");
        }
      }
      if (expenseId) {
        const source = await prisma.expense.findFirst({
          where: { id: expenseId, firmId, matterId: invoice.matterId, status: "approved", invoiceLineId: null },
          select: { id: true, currencyCode: true }
        });
        if (!source || source.currencyCode !== invoice.currencyCode) {
          args.addValidationError("Expense source must be unbilled, approved, same-matter, and same-currency.");
        }
      }
    }
  }
};
var RateCard = (0, import_core12.list)({
  access: optionalBillingAccess,
  hooks: firmOwnedHooks({ lifecycle: "rateCard" }),
  ui: { listView: { initialColumns: ["name", "status", "currencyCode", "effectiveFrom", "effectiveTo"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields25.relationship)({ ref: "Matter" }),
    name: (0, import_fields25.text)({ validation: { isRequired: true } }),
    status: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    effectiveFrom: (0, import_fields25.timestamp)(),
    effectiveTo: (0, import_fields25.timestamp)(),
    description: (0, import_fields25.text)({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    rules: readOnlyRelationship("RateRule.rateCard", true),
    ...trackingFields
  }
});
var RateRule = (0, import_core12.list)({
  access: optionalBillingAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["rateCard", "rateType", "amountMinor", "user", "practiceArea", "matter"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields25.relationship)({ ref: "Matter" }),
    rateCard: requiredRelationship("RateCard.rules"),
    user: (0, import_fields25.relationship)({ ref: "User" }),
    practiceArea: (0, import_fields25.relationship)({ ref: "PracticeArea" }),
    rateType: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Per appearance", value: "per_appearance" },
        { label: "Per item", value: "per_item" }
      ],
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields25.integer)({ validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    unitLabel: (0, import_fields25.text)({ defaultValue: "hour" }),
    priority: (0, import_fields25.integer)({ defaultValue: 100, validation: { min: 0 } }),
    effectiveFrom: (0, import_fields25.timestamp)(),
    effectiveTo: (0, import_fields25.timestamp)(),
    ...trackingFields
  }
});
function approvedSourceHooks(lifecycle, immutableStatuses, immutableFields) {
  const base = firmOwnedHooks({ lifecycle, controlledStatus: true });
  return {
    ...base,
    validate: {
      ...base.validate,
      create: async (args) => {
        await base.validate.create(args);
        await validateMatterTeamCapability(args, "canBill");
      },
      update: async (args) => {
        await base.validate.update(args);
        await validateMatterTeamCapability(args, "canBill");
        if (immutableStatuses.has(args.item?.status) && Object.keys(args.resolvedData).some((field) => immutableFields.has(field))) {
          args.addValidationError("Approved or finalized billing sources are immutable; write off the source and create a corrected record with renewed approval.");
        }
      }
    }
  };
}
var timeEntryHooks = approvedSourceHooks(
  "timeEntry",
  /* @__PURE__ */ new Set(["approved", "billed", "written_off"]),
  /* @__PURE__ */ new Set(["matter", "user", "task", "workDate", "startedAt", "endedAt", "durationMinutes", "description", "isBillable", "rateMinor", "amountMinor", "currencyCode"])
);
var expenseHooks = approvedSourceHooks(
  "expense",
  /* @__PURE__ */ new Set(["approved", "billed", "reimbursed", "written_off"]),
  /* @__PURE__ */ new Set(["matter", "incurredBy", "vendor", "receiptVersion", "expenseType", "description", "incurredAt", "amountMinor", "currencyCode", "isBillable"])
);
var TimeEntry = (0, import_core12.list)({
  access: billingAccess,
  hooks: timeEntryHooks,
  ui: { listView: { initialColumns: ["matter", "user", "status", "workDate", "durationMinutes", "amountMinor"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    user: requiredRelationship("User"),
    task: (0, import_fields25.relationship)({ ref: "LegalTask" }),
    status: (0, import_fields25.select)({
      type: "enum",
      access: controlledBillingLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Billed", value: "billed" },
        { label: "Written off", value: "written_off" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    workDate: (0, import_fields25.timestamp)({ validation: { isRequired: true } }),
    startedAt: (0, import_fields25.timestamp)(),
    endedAt: (0, import_fields25.timestamp)(),
    durationMinutes: (0, import_fields25.integer)({ validation: { isRequired: true, min: 1 } }),
    description: (0, import_fields25.text)({ access: billingFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    isBillable: (0, import_fields25.checkbox)({ access: { ...billingFieldAccess, update: denyAll }, graphql: { omit: { update: true } }, defaultValue: true }),
    rateMinor: (0, import_fields25.integer)({ validation: { min: 0 } }),
    amountMinor: (0, import_fields25.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    approvedBy: (0, import_fields25.relationship)({ ref: "User", access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    approvedAt: (0, import_fields25.timestamp)({ access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    invoiceLine: readOnlyRelationship("InvoiceLine.timeEntry"),
    ...trackingFields
  }
});
var Expense = (0, import_core12.list)({
  access: billingAccess,
  hooks: expenseHooks,
  ui: { listView: { initialColumns: ["matter", "description", "status", "incurredAt", "amountMinor", "vendor"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    incurredBy: (0, import_fields25.relationship)({ ref: "User" }),
    vendor: (0, import_fields25.relationship)({ ref: "Contact" }),
    receiptVersion: (0, import_fields25.relationship)({ ref: "DocumentVersion" }),
    status: (0, import_fields25.select)({
      type: "enum",
      access: controlledBillingLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Billed", value: "billed" },
        { label: "Reimbursed", value: "reimbursed" },
        { label: "Written off", value: "written_off" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    expenseType: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Filing fee", value: "filing_fee" },
        { label: "Travel", value: "travel" },
        { label: "Expert", value: "expert" },
        { label: "Copying", value: "copying" },
        { label: "Service", value: "service" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "other"
    }),
    description: (0, import_fields25.text)({ access: billingFieldAccess, validation: { isRequired: true } }),
    incurredAt: (0, import_fields25.timestamp)({ validation: { isRequired: true } }),
    amountMinor: (0, import_fields25.integer)({ validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    isBillable: (0, import_fields25.checkbox)({ access: { ...billingFieldAccess, update: denyAll }, graphql: { omit: { update: true } }, defaultValue: true }),
    approvedBy: (0, import_fields25.relationship)({ ref: "User", access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    approvedAt: (0, import_fields25.timestamp)({ access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    invoiceLine: readOnlyRelationship("InvoiceLine.expense"),
    ...trackingFields
  }
});
var RetainerAgreement = (0, import_core12.list)({
  db: uniqueConstraints(["firmId", "agreementNumber"]),
  access: billingAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "retainer", controlledStatus: true }),
  ui: { listView: { initialColumns: ["agreementNumber", "matter", "client", "status", "feeStructure"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    client: requiredRelationship("Contact"),
    rateCard: (0, import_fields25.relationship)({ ref: "RateCard" }),
    agreementNumber: (0, import_fields25.text)({ isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Accepted", value: "accepted" },
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Terminated", value: "terminated" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    feeStructure: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Contingency", value: "contingency" },
        { label: "Hybrid", value: "hybrid" },
        { label: "Pro bono", value: "pro_bono" }
      ],
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    initialRetainerMinor: (0, import_fields25.integer)({ validation: { min: 0 } }),
    evergreenThresholdMinor: (0, import_fields25.integer)({ validation: { min: 0 } }),
    replenishmentAmountMinor: (0, import_fields25.integer)({ validation: { min: 0 } }),
    contingencyBasisPoints: (0, import_fields25.integer)({ validation: { min: 0, max: 1e4 } }),
    termsSummary: (0, import_fields25.text)({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    signedDocumentVersion: (0, import_fields25.relationship)({ ref: "DocumentVersion" }),
    trustLedgerAccount: (0, import_fields25.relationship)({ ref: "TrustLedgerAccount" }),
    sentAt: (0, import_fields25.timestamp)(),
    acceptedAt: (0, import_fields25.timestamp)(),
    effectiveAt: (0, import_fields25.timestamp)(),
    terminatedAt: (0, import_fields25.timestamp)(),
    invoices: readOnlyRelationship("Invoice.retainer", true),
    ...trackingFields
  }
});
var Invoice = (0, import_core12.list)({
  db: uniqueConstraints(["firmId", "invoiceNumber"]),
  access: controlledBillingAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: invoiceHooks,
  ui: { listView: { initialColumns: ["invoiceNumber", "matter", "client", "status", "totalMinor", "dueAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    client: requiredRelationship("Contact"),
    retainer: (0, import_fields25.relationship)({ ref: "RetainerAgreement.invoices" }),
    invoiceNumber: (0, import_fields25.text)({ isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Approved", value: "approved" },
        { label: "Issued", value: "issued" },
        { label: "Partially paid", value: "partially_paid" },
        { label: "Paid", value: "paid" },
        { label: "Overdue", value: "overdue" },
        { label: "Void", value: "void" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    subtotalMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    discountMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    paidMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    balanceDueMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    issuedAt: (0, import_fields25.timestamp)(),
    dueAt: (0, import_fields25.timestamp)(),
    paidAt: (0, import_fields25.timestamp)(),
    voidedAt: (0, import_fields25.timestamp)(),
    voidReason: (0, import_fields25.text)({ access: billingFieldAccess }),
    memo: (0, import_fields25.text)({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    lines: readOnlyRelationship("InvoiceLine.invoice", true),
    payments: readOnlyRelationship("Payment.invoice", true),
    paymentAllocations: readOnlyRelationship("PaymentAllocation.invoice", true),
    refunds: readOnlyRelationship("Refund.invoice", true),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core12.list)({
  access: {
    operation: {
      query: canReadBilling,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadBillingRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: invoiceLineHooks,
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["invoice", "lineType", "description", "quantity", "lineTotalMinor"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    invoice: requiredRelationship("Invoice.lines"),
    timeEntry: (0, import_fields25.relationship)({ ref: "TimeEntry.invoiceLine" }),
    expense: (0, import_fields25.relationship)({ ref: "Expense.invoiceLine" }),
    lineType: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Time", value: "time" },
        { label: "Expense", value: "expense" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Discount", value: "discount" },
        { label: "Tax", value: "tax" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    description: (0, import_fields25.text)({ access: { ...billingFieldAccess, update: denyAll }, validation: { isRequired: true } }),
    quantity: (0, import_fields25.integer)({ defaultValue: 1, validation: { min: 1 } }),
    unitAmountMinor: (0, import_fields25.integer)({ validation: { isRequired: true } }),
    subtotalMinor: (0, import_fields25.integer)({ validation: { isRequired: true } }),
    discountMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxMinor: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lineTotalMinor: (0, import_fields25.integer)({ validation: { isRequired: true } }),
    currencyCode: (0, import_fields25.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    sourceRecordId: (0, import_fields25.text)(),
    serviceDate: (0, import_fields25.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/trust.ts
var import_core13 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var canReadTrust = ({ session }) => permissions.canReadTrust({ session }) || permissions.canManageTrust({ session });
var canManageTrust = ({ session }) => permissions.canManageTrust({ session });
var trustAccountAccess = scopedAccess("canReadTrust", "canManageTrust");
var trustMatterAccess = {
  operation: {
    query: canReadTrust,
    create: canManageTrust,
    update: canManageTrust,
    delete: denyAll
  },
  filter: {
    query: rules.canReadTrustRecord,
    update: rules.canManageTrustRecord,
    delete: rules.canManageTrustRecord
  }
};
var trustFieldAccess = {
  read: canReadTrust,
  create: canManageTrust,
  update: canManageTrust
};
var immutableTrustIdentityAccess = {
  read: canReadTrust,
  create: canManageTrust,
  update: denyAll
};
var currencyValidation2 = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." }
};
var TrustAccount = (0, import_core13.list)({
  access: trustAccountAccess,
  hooks: firmOwnedHooks({ lifecycle: "trustAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "accountType", "status", "office", "currencyCode", "bankAccountLastFour"] } },
  fields: {
    firm: firmRelationship(),
    office: (0, import_fields27.relationship)({ ref: "Office", access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    name: (0, import_fields27.text)({ validation: { isRequired: true } }),
    accountType: (0, import_fields27.select)({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Trust", value: "trust" },
        { label: "IOLTA / pooled", value: "pooled_trust" },
        { label: "Dedicated client", value: "dedicated_client" },
        { label: "Other safeguarded funds", value: "other" }
      ],
      defaultValue: "trust",
      validation: { isRequired: true }
    }),
    status: (0, import_fields27.select)({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Frozen", value: "frozen" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, defaultValue: "USD", validation: { isRequired: true, ...currencyValidation2 } }),
    financialInstitutionName: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    bankAccountLastFour: (0, import_fields27.text)({
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      validation: {
        length: { min: 4, max: 4 },
        match: { regex: /^\d{4}$/, explanation: "Use only the final four digits." }
      }
    }),
    externalAccountReference: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    openedAt: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess }),
    closedAt: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess }),
    ledgerAccounts: readOnlyRelationship("TrustLedgerAccount.trustAccount", true),
    transactions: readOnlyRelationship("TrustTransaction.trustAccount", true),
    entries: readOnlyRelationship("TrustLedgerEntry.trustAccount", true),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.trustAccount", true),
    reconciliations: readOnlyRelationship("TrustReconciliation.trustAccount", true),
    ...trackingFields
  }
});
var TrustLedgerAccount = (0, import_core13.list)({
  db: uniqueConstraints(["firmId", "ledgerNumber"]),
  access: trustMatterAccess,
  hooks: firmOwnedHooks({ lifecycle: "trustLedgerAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["ledgerNumber", "client", "matter", "trustAccount", "status", "currencyCode"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields27.relationship)({ ref: "Matter", access: immutableTrustIdentityAccess }),
    trustAccount: (0, import_fields27.relationship)({
      ref: "TrustAccount.ledgerAccounts",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess
    }),
    client: (0, import_fields27.relationship)({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess
    }),
    ledgerNumber: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields27.select)({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Active", value: "active" },
        { label: "Frozen", value: "frozen" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, defaultValue: "USD", validation: { isRequired: true, ...currencyValidation2 } }),
    openedAt: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess, defaultValue: { kind: "now" } }),
    closedAt: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess }),
    freezeReason: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, ui: { displayMode: "textarea" } }),
    entries: readOnlyRelationship("TrustLedgerEntry.ledgerAccount", true),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.ledgerAccount", true),
    ...trackingFields
  }
});
var TrustTransaction = (0, import_core13.list)({
  db: uniqueConstraints(
    ["firmId", "transactionNumber"],
    ["reversesTransactionId"],
    ["sourcePaymentId"],
    ["sourceRefundId"]
  ),
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadTrustTransaction,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["transactionNumber", "transactionType", "trustAccount", "status", "occurredAt", "idempotencyKey"] }
  },
  fields: {
    firm: firmRelationship(),
    transactionNumber: (0, import_fields27.text)({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields27.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    postingDigest: (0, import_fields27.text)({ validation: { isRequired: true }, isIndexed: true }),
    trustAccount: requiredRelationship("TrustAccount.transactions"),
    transactionType: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Deposit", value: "deposit" },
        { label: "Disbursement", value: "disbursement" },
        { label: "Transfer", value: "transfer" },
        { label: "Reversal", value: "reversal" },
        { label: "Bank fee", value: "bank_fee" },
        { label: "Adjustment", value: "adjustment" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Posted", value: "posted" },
        { label: "Reversed by reference", value: "reversed" }
      ],
      defaultValue: "posted",
      validation: { isRequired: true }
    }),
    currencyCode: (0, import_fields27.text)({ validation: { isRequired: true, ...currencyValidation2 } }),
    description: (0, import_fields27.text)({ access: { ...trustFieldAccess, update: denyAll }, validation: { isRequired: true } }),
    occurredAt: (0, import_fields27.timestamp)({ validation: { isRequired: true } }),
    postedAt: (0, import_fields27.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    postedBy: (0, import_fields27.relationship)({ ref: "User" }),
    postedByAgent: (0, import_fields27.relationship)({ ref: "AgentPrincipal" }),
    sourcePayment: (0, import_fields27.relationship)({ ref: "Payment.trustTransactions" }),
    sourceRefund: (0, import_fields27.relationship)({ ref: "Refund.trustTransactions" }),
    reversesTransaction: (0, import_fields27.relationship)({ ref: "TrustTransaction.reversalTransactions" }),
    reversalTransactions: readOnlyRelationship("TrustTransaction.reversesTransaction", true),
    entries: readOnlyRelationship("TrustLedgerEntry.transaction", true),
    ...trackingFields
  }
});
var TrustLedgerEntry = (0, import_core13.list)({
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadTrustEntry,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["transaction", "accountingBucket", "direction", "amountMinor", "ledgerAccount", "occurredAt"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields27.relationship)({ ref: "Matter" }),
    transaction: requiredRelationship("TrustTransaction.entries"),
    trustAccount: requiredRelationship("TrustAccount.entries"),
    ledgerAccount: (0, import_fields27.relationship)({ ref: "TrustLedgerAccount.entries" }),
    accountingBucket: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Bank control", value: "bank_control" },
        { label: "Client liability", value: "client_liability" },
        { label: "Bank fee", value: "bank_fee" },
        { label: "Suspense", value: "suspense" }
      ],
      validation: { isRequired: true }
    }),
    direction: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Debit", value: "debit" },
        { label: "Credit", value: "credit" }
      ],
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields27.integer)({ validation: { isRequired: true, min: 1 } }),
    currencyCode: (0, import_fields27.text)({ validation: { isRequired: true, ...currencyValidation2 } }),
    memo: (0, import_fields27.text)({ access: { ...trustFieldAccess, update: denyAll } }),
    occurredAt: (0, import_fields27.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var TrustBalanceSnapshot = (0, import_core13.list)({
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadTrustRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["trustAccount", "ledgerAccount", "snapshotType", "balanceMinor", "asOf"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields27.relationship)({ ref: "Matter" }),
    trustAccount: requiredRelationship("TrustAccount.snapshots"),
    ledgerAccount: (0, import_fields27.relationship)({ ref: "TrustLedgerAccount.snapshots" }),
    reconciliation: (0, import_fields27.relationship)({ ref: "TrustReconciliation.snapshots" }),
    snapshotType: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Client balance", value: "client_balance" },
        { label: "Book balance", value: "book_balance" },
        { label: "Statement balance", value: "statement_balance" },
        { label: "Reconciliation", value: "reconciliation" }
      ],
      validation: { isRequired: true }
    }),
    balanceMinor: (0, import_fields27.integer)({ validation: { isRequired: true } }),
    currencyCode: (0, import_fields27.text)({ validation: { isRequired: true, ...currencyValidation2 } }),
    asOf: (0, import_fields27.timestamp)({ validation: { isRequired: true } }),
    createdBy: (0, import_fields27.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var TrustReconciliation = (0, import_core13.list)({
  db: uniqueConstraints(["trustAccountId", "periodStart", "periodEnd"]),
  access: trustAccountAccess,
  graphql: { omit: { create: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "trustReconciliation", controlledStatus: true }),
  ui: { listView: { initialColumns: ["trustAccount", "status", "periodStart", "periodEnd", "differenceMinor", "reviewedBy"] } },
  fields: {
    firm: firmRelationship(),
    trustAccount: (0, import_fields27.relationship)({
      ref: "TrustAccount.reconciliations",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess
    }),
    status: (0, import_fields27.select)({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "In review", value: "in_review" },
        { label: "Completed", value: "completed" },
        { label: "Reopened", value: "reopened" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    periodStart: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    periodEnd: (0, import_fields27.timestamp)({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    statementBalanceMinor: (0, import_fields27.integer)({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    bookBalanceMinor: (0, import_fields27.integer)({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    differenceMinor: (0, import_fields27.integer)({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    currencyCode: (0, import_fields27.text)({ access: immutableTrustIdentityAccess, validation: { isRequired: true, ...currencyValidation2 } }),
    createdBy: (0, import_fields27.relationship)({ ref: "User", access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    reviewedBy: (0, import_fields27.relationship)({ ref: "User", access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    reviewedAt: (0, import_fields27.timestamp)({ access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    completedAt: (0, import_fields27.timestamp)({ access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    notes: (0, import_fields27.text)({ access: trustFieldAccess, ui: { displayMode: "textarea" } }),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.reconciliation", true),
    ...trackingFields
  }
});

// features/keystone/models/payments.ts
var import_core14 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var canReadPayments = ({ session }) => permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }) || permissions.canReadBilling({ session }) || permissions.canReadTrust({ session });
var canManagePayments = ({ session }) => permissions.canManagePayments({ session });
var paymentAccess = {
  operation: {
    query: canReadPayments,
    create: canManagePayments,
    update: denyAll,
    delete: denyAll
  },
  filter: {
    query: rules.canReadPaymentRecord,
    update: () => false,
    delete: rules.canManagePaymentRecord
  }
};
var paymentFieldAccess = {
  read: canReadPayments,
  create: canManagePayments,
  update: canManagePayments
};
var currencyValidation3 = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." }
};
var Payment = (0, import_core14.list)({
  db: uniqueConstraints(
    ["firmId", "paymentNumber"],
    ["firmId", "idempotencyKey"]
  ),
  access: paymentAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "payment", controlledStatus: true }),
  ui: { listView: { initialColumns: ["paymentNumber", "paymentType", "status", "amountMinor", "invoice", "payer"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields29.relationship)({ ref: "Matter" }),
    invoice: (0, import_fields29.relationship)({ ref: "Invoice.payments" }),
    trustAccount: (0, import_fields29.relationship)({ ref: "TrustAccount" }),
    payer: requiredRelationship("Contact"),
    paymentNumber: (0, import_fields29.text)({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields29.text)({ isIndexed: true }),
    paymentType: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Operating payment", value: "operating" },
        { label: "Trust deposit", value: "trust_deposit" },
        { label: "Other receipt", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Settled", value: "settled" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields29.integer)({ validation: { isRequired: true, min: 1 } }),
    refundedMinor: (0, import_fields29.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields29.text)({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation3 } }),
    providerCode: (0, import_fields29.text)(),
    integrationConnection: (0, import_fields29.relationship)({ ref: "IntegrationConnection" }),
    providerPaymentId: (0, import_fields29.text)({ isIndexed: true }),
    authorizedAt: (0, import_fields29.timestamp)(),
    capturedAt: (0, import_fields29.timestamp)(),
    settledAt: (0, import_fields29.timestamp)(),
    failedAt: (0, import_fields29.timestamp)(),
    failureReason: (0, import_fields29.text)({ access: paymentFieldAccess }),
    receivedBy: (0, import_fields29.relationship)({ ref: "User" }),
    allocations: readOnlyRelationship("PaymentAllocation.payment", true),
    refunds: readOnlyRelationship("Refund.payment", true),
    trustTransactions: readOnlyRelationship("TrustTransaction.sourcePayment", true),
    ...trackingFields
  }
});
var PaymentAllocation = (0, import_core14.list)({
  db: uniqueConstraints(
    ["firmId", "idempotencyKey"],
    ["reversesAllocationId"]
  ),
  access: {
    operation: {
      query: canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadPaymentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["payment", "allocationType", "invoice", "trustTransaction", "amountMinor", "allocatedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields29.relationship)({ ref: "Matter" }),
    payment: requiredRelationship("Payment.allocations"),
    idempotencyKey: (0, import_fields29.text)({
      isIndexed: true,
      defaultValue: null,
      db: { isNullable: true }
    }),
    invoice: (0, import_fields29.relationship)({ ref: "Invoice.paymentAllocations" }),
    trustTransaction: (0, import_fields29.relationship)({ ref: "TrustTransaction" }),
    allocationType: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Invoice", value: "invoice" },
        { label: "Trust deposit", value: "trust_deposit" },
        { label: "Trust application", value: "trust_application" },
        { label: "Reversal", value: "reversal" }
      ],
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields29.integer)({ validation: { isRequired: true, min: 1 } }),
    currencyCode: (0, import_fields29.text)({ validation: { isRequired: true, ...currencyValidation3 } }),
    allocatedBy: (0, import_fields29.relationship)({ ref: "User" }),
    allocatedAt: (0, import_fields29.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    reversesAllocation: (0, import_fields29.relationship)({ ref: "PaymentAllocation.reversalAllocations" }),
    reversalAllocations: readOnlyRelationship("PaymentAllocation.reversesAllocation", true),
    note: (0, import_fields29.text)({ access: { ...paymentFieldAccess, update: denyAll } }),
    ...trackingFields
  }
});
var Refund = (0, import_core14.list)({
  db: uniqueConstraints(
    ["firmId", "refundNumber"],
    ["firmId", "idempotencyKey"]
  ),
  access: {
    operation: {
      query: canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadPaymentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["refundNumber", "payment", "status", "amountMinor", "requestedBy", "approvedBy"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields29.relationship)({ ref: "Matter" }),
    payment: requiredRelationship("Payment.refunds"),
    invoice: (0, import_fields29.relationship)({ ref: "Invoice.refunds" }),
    refundNumber: (0, import_fields29.text)({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields29.text)({ isIndexed: true }),
    status: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Approved", value: "approved" },
        { label: "Processing", value: "processing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true }
    }),
    reason: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Overpayment", value: "overpayment" },
        { label: "Duplicate", value: "duplicate" },
        { label: "Matter closed", value: "matter_closed" },
        { label: "Client request", value: "client_request" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields29.integer)({ validation: { isRequired: true, min: 1 } }),
    currencyCode: (0, import_fields29.text)({ validation: { isRequired: true, ...currencyValidation3 } }),
    explanation: (0, import_fields29.text)({ access: paymentFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    requestedBy: requiredRelationship("User"),
    approvedBy: (0, import_fields29.relationship)({ ref: "User" }),
    requestedAt: (0, import_fields29.timestamp)({ defaultValue: { kind: "now" } }),
    approvedAt: (0, import_fields29.timestamp)(),
    processedAt: (0, import_fields29.timestamp)(),
    providerRefundId: (0, import_fields29.text)({ isIndexed: true }),
    failureReason: (0, import_fields29.text)({ access: paymentFieldAccess }),
    trustTransactions: readOnlyRelationship("TrustTransaction.sourceRefund", true),
    ...trackingFields
  }
});

// features/keystone/models/portal.ts
var import_core15 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");

// features/keystone/lib/agent-controls.ts
var import_node_crypto4 = require("node:crypto");
var highRiskAgentActions = /* @__PURE__ */ new Set([
  "privileged.read",
  "communication.send",
  "document.publish",
  "signature.send",
  "matter.transition",
  "conflict.resolve",
  "invoice.issue",
  "billing.write",
  "payment.capture",
  "payment.refund",
  "trust.post",
  "retention.dispose",
  "access.change"
]);
var denied = (reason, requiresApproval = false) => ({ allowed: false, requiresApproval, reason });
function isExpired(value, now) {
  if (!value) return false;
  const timestamp21 = Date.parse(value);
  return !Number.isFinite(timestamp21) || timestamp21 <= now.getTime();
}
function authorizeAgentAction(input) {
  const { grant } = input;
  if (grant.firmId !== input.activeFirmId) {
    return denied("Agent grant does not belong to the active firm.");
  }
  if (grant.status !== "active") return denied("Agent grant is not active.");
  if (isExpired(grant.expiresAt, input.now)) return denied("Agent grant has expired.");
  if (input.matterId && grant.matterId !== input.matterId) {
    return denied("Agent grant does not cover the requested matter.");
  }
  if (!grant.capabilities.includes(input.actionType)) {
    return denied("Agent grant does not include the requested capability.");
  }
  const requiresApproval = highRiskAgentActions.has(input.actionType);
  if (!requiresApproval) return { allowed: true, requiresApproval: false, reason: null };
  const { approval } = input;
  if (!approval) {
    return denied("A current human approval is required for this action.", true);
  }
  if (approval.status !== "approved") return denied("Agent action approval is not approved.", true);
  if (approval.firmId !== input.activeFirmId) {
    return denied("Agent action approval does not belong to the active firm.", true);
  }
  if ((approval.matterId ?? null) !== (input.matterId ?? null)) {
    return denied("Agent action approval does not cover the requested matter.", true);
  }
  if (approval.actionType !== input.actionType) {
    return denied("Agent action approval does not match the requested action.", true);
  }
  if (approval.requestDigest !== input.requestDigest) {
    return denied("Agent action approval digest does not match the request digest.", true);
  }
  if (isExpired(approval.expiresAt, input.now)) {
    return denied("Agent action approval has expired.", true);
  }
  if (!approval.approverUserId || !approval.approverCanApproveAgentActions) {
    return denied("A human approver with agent-approval authority is required.", true);
  }
  if (!approval.approverHasDomainPermission) {
    return denied("The human approver lacks the required domain permission.", true);
  }
  return { allowed: true, requiresApproval: true, reason: null };
}
function computeAgentApprovalDigest(input) {
  return (0, import_node_crypto4.createHash)("sha256").update(JSON.stringify({
    actionId: input.actionId,
    actionType: input.actionType,
    matterId: input.matterId,
    requestDigest: input.requestDigest,
    approvalExpiresAt: input.approvalExpiresAt.toISOString()
  })).digest("hex");
}
var AGENT_EXECUTION_LEASE_MS = 15 * 60 * 1e3;
var replaySafeAgentActions = /* @__PURE__ */ new Set([
  "task.draft",
  "matter.transition",
  "payment.capture",
  "payment.refund",
  "trust.post",
  "signature.send"
]);
function agentExecutionLeaseExpired(startedAt, now) {
  return !startedAt || now.getTime() - startedAt.getTime() >= AGENT_EXECUTION_LEASE_MS;
}

// features/keystone/lib/machine-auth.ts
var import_node_crypto5 = require("node:crypto");
var tokenTags = {
  api_key: "olfk",
  oauth_access: "olfoa",
  oauth_refresh: "olfor",
  oauth_code: "olfoc",
  oauth_client: "olfcs",
  agent: "olfa",
  portal_invite: "olfpi",
  portal_session: "olfps"
};
var tagKinds = new Map(Object.entries(tokenTags).map(([kind, tag]) => [tag, kind]));
var tokenPattern = /^([a-z]+)_([a-f0-9]{16})_([A-Za-z0-9_-]{43})$/;
var availableMachineScopes = Object.freeze(Object.keys(machineScopePermissionMap));
function credentialPepper(override) {
  const value = override ?? process.env.MACHINE_CREDENTIAL_PEPPER ?? process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("MACHINE_CREDENTIAL_PEPPER or SESSION_SECRET must be at least 32 bytes.");
  }
  return value;
}
function credentialDigest(kind, token, pepper) {
  return (0, import_node_crypto5.createHmac)("sha256", credentialPepper(pepper)).update(kind).update("\0").update(token).digest("hex");
}
function issueCredential(kind, pepper) {
  const prefix = (0, import_node_crypto5.randomBytes)(8).toString("hex");
  const token = `${tokenTags[kind]}_${prefix}_${(0, import_node_crypto5.randomBytes)(32).toString("base64url")}`;
  return {
    token,
    prefix,
    digest: credentialDigest(kind, token, pepper)
  };
}
function parseCredential(value) {
  if (!value || value.length > 128) return null;
  const match = value.match(tokenPattern);
  if (!match) return null;
  const kind = tagKinds.get(match[1]);
  if (!kind) return null;
  return { kind, prefix: match[2], token: value };
}
function normalizeMachineScopes(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("At least one and at most twenty machine scopes are required.");
  }
  const scopes = [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))];
  if (!scopes.length || scopes.some((scope) => !availableMachineScopes.includes(scope))) {
    throw new Error("Machine scopes contain an unsupported value.");
  }
  return scopes;
}
function normalizedScopeSet(value) {
  if (!Array.isArray(value)) return /* @__PURE__ */ new Set();
  try {
    return new Set(normalizeMachineScopes(value));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function effectiveOAuthScopes(session, input) {
  const firmId = session?.data.activeFirm?.id;
  if (!session?.itemId || session.data.status !== "active" || !firmId || !["onboarding", "active"].includes(session.data.activeFirm?.status ?? "")) return [];
  const membership = session.data.firmMemberships?.find(
    (candidate) => candidate.status === "active" && candidate.firm?.id === firmId && candidate.role?.status === "active" && candidate.role.firm?.id === firmId
  );
  const role = membership?.role;
  if (!role) return [];
  const roleScopes = new Set(availableMachineScopes.filter(
    (scope) => machineScopePermissionMap[scope].every((permission) => role[permission] === true)
  ));
  const clientScopes = normalizedScopeSet(input.clientAllowedScopes);
  const consentScopes = normalizedScopeSet(input.consentScopes);
  const tokenScopes = normalizedScopeSet(input.tokenScopes);
  return availableMachineScopes.filter(
    (scope) => roleScopes.has(scope) && clientScopes.has(scope) && consentScopes.has(scope) && tokenScopes.has(scope)
  );
}
function normalizeAgentCapabilities(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("At least one and at most twenty agent capabilities are required.");
  }
  const capabilities = [...new Set(value.map((capability) => String(capability).trim()).filter(Boolean))];
  if (!capabilities.every((capability) => /^[a-z]+(?:[._-][a-z]+)+$/.test(capability))) {
    throw new Error("Agent capabilities contain an unsupported value.");
  }
  return capabilities;
}
function normalizeRedirectUri(value) {
  const uri = new URL(value);
  const loopbackHttp = uri.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(uri.hostname);
  if (uri.protocol !== "https:" && !loopbackHttp || uri.username || uri.password || uri.hash) {
    throw new Error("Redirect URIs require HTTPS or loopback HTTP and cannot contain credentials or fragments.");
  }
  return uri.href;
}
function normalizeRedirectUris(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("OAuth clients require between one and twenty redirect URIs.");
  }
  return [...new Set(value.map((uri) => normalizeRedirectUri(String(uri))))];
}
var roleSelect = {
  id: true,
  name: true,
  status: true,
  firmId: true,
  ...Object.fromEntries(permissionKeys.map((permission) => [permission, true]))
};
var userSelect = {
  id: true,
  name: true,
  status: true,
  activeFirm: { select: { id: true, name: true, displayName: true, shortName: true, brandTagline: true, brandColor: true, supportEmail: true, status: true } },
  bootstrapRole: { select: roleSelect },
  firmMemberships: {
    select: {
      id: true,
      status: true,
      firm: { select: { id: true } },
      role: { select: roleSelect }
    }
  }
};
function sessionRole(role) {
  if (!role) return null;
  const { firmId, ...fields } = role;
  return { ...fields, firm: firmId ? { id: firmId } : null };
}
function machineSession({
  user,
  authenticationType,
  scopes,
  credentialId,
  oauthClientId,
  agentPrincipalId,
  agentCapabilities
}) {
  const firmId = user?.activeFirm?.id;
  if (!user?.id || user.status !== "active" || !firmId) return null;
  const memberships = (user.firmMemberships ?? []).map((membership) => ({
    id: membership.id,
    status: membership.status,
    firm: membership.firm,
    role: sessionRole(membership.role)
  }));
  const activeMembership = memberships.find(
    (membership) => membership.status === "active" && membership.firm?.id === firmId && membership.role?.status === "active" && membership.role?.firm?.id === firmId
  );
  if (!activeMembership || !["onboarding", "active"].includes(user.activeFirm.status)) return null;
  return {
    itemId: user.id,
    listKey: "User",
    authenticationType,
    machineScopes: scopes,
    ...credentialId ? { credentialId } : {},
    oauthClientId,
    agentPrincipalId,
    agentCapabilities,
    data: {
      name: user.name,
      status: user.status,
      activeFirm: user.activeFirm,
      role: sessionRole(user.bootstrapRole),
      firmMemberships: memberships
    }
  };
}
async function loadActiveHumanSession(prisma, userId, expectedFirmId) {
  prisma = prismaWithoutGraphQLErrorConversion(prisma);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (user?.activeFirm?.id !== expectedFirmId) return null;
  return machineSession({
    user,
    authenticationType: "human",
    scopes: [],
    credentialId: ""
  });
}

// features/keystone/mutations/command-authority.ts
async function lockCurrentFirmMember(tx, userId, firmId) {
  await tx.$executeRaw`SELECT u.id FROM "User" u
    JOIN "FirmMembership" m ON m."user" = u.id AND m.firm = ${firmId}
    JOIN "Role" r ON r.id = m.role AND r.firm = m.firm
    JOIN "Firm" f ON f.id = m.firm
    WHERE u.id = ${userId} AND u."activeFirm" = f.id
    ORDER BY r.id, m.id FOR SHARE OF u, m, r, f`;
  return loadActiveHumanSession(tx, userId, firmId);
}
async function assertCurrentCommandActor(tx, context, permission) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!session?.itemId || !firmId) throw new Error("Current command authority is required.");
  const current = await lockCurrentFirmMember(tx, session.itemId, firmId);
  if (!current || current.data.activeFirm?.status !== "active") throw new Error("Current command authority is required.");
  const type = session.authenticationType || "human";
  if (type === "human") {
    if (!permissions[permission]({ session: current })) throw new Error("Current command authority is required.");
    const execution = session.agentExecution;
    if (session.agentPrincipalId) {
      if (!execution?.actionId || !execution?.credentialSession || typeof execution.claimStartedAt !== "string" || !Number.isFinite(Date.parse(execution.claimStartedAt))) throw new Error("Agent execution claim binding is required.");
      await tx.$executeRaw`SELECT a.id FROM "AgentAction" a JOIN "AgentGrant" g ON g.id = a.grant JOIN "AgentPrincipal" p ON p.id = a."agentPrincipal" WHERE a.id = ${execution.actionId} FOR SHARE OF a,g,p`;
      const action = await tx.agentAction.findFirst({ where: { id: execution.actionId, firmId, agentPrincipalId: session.agentPrincipalId, status: "executing", startedAt: new Date(execution.claimStartedAt), grant: { status: "active" }, agentPrincipal: { status: "active" } }, include: { grant: true } });
      if (!action || action.approvedById && action.approvedById !== session.itemId || action.grant.startsAt && action.grant.startsAt > /* @__PURE__ */ new Date() || action.grant.expiresAt && action.grant.expiresAt <= /* @__PURE__ */ new Date() || !Array.isArray(action.grant.capabilities) || !action.grant.capabilities.includes(action.actionType)) throw new Error("Current agent execution authority is required.");
      if (highRiskAgentActions.has(action.actionType)) {
        const expiresAt = action.approvalExpiresAt;
        if (!action.approvedById || !expiresAt || expiresAt <= /* @__PURE__ */ new Date() || action.approvalDigest !== computeAgentApprovalDigest({
          actionId: action.id,
          actionType: action.actionType,
          matterId: action.matterId,
          requestDigest: action.requestDigest,
          approvalExpiresAt: expiresAt
        }) || !permissions.canApproveAgentActions({ session: current })) throw new Error("Current agent approval authority is required.");
      }
      await assertCurrentAgentCredential(tx, context.withSession(execution.credentialSession), action.actionType);
    }
    return;
  }
  const now = /* @__PURE__ */ new Date();
  if (type === "api_key") {
    await tx.$executeRaw`SELECT id FROM "ApiKey" WHERE id = ${session.credentialId || ""} FOR SHARE`;
    const key = await tx.apiKey.findFirst({ where: { id: session.credentialId, firmId, ownerId: session.itemId, status: "active" } });
    if (!key || key.expiresAt && key.expiresAt <= now) throw new Error("Current credential authority is required.");
    const scoped = { ...current, authenticationType: type, machineScopes: normalizeMachineScopes(key.scopes) };
    if (!permissions[permission]({ session: scoped })) throw new Error("Current credential authority is required.");
    return;
  }
  if (type === "oauth") {
    await tx.$executeRaw`SELECT t.id FROM "OAuthToken" t JOIN "OAuthClient" c ON c.id = t.client JOIN "OAuthConsent" s ON s.id = t.consent WHERE t.id = ${session.credentialId || ""} FOR SHARE OF t,c,s`;
    const token = await tx.oAuthToken.findFirst({ where: { id: session.credentialId, firmId, userId: session.itemId, status: "active", tokenType: "access_token", expiresAt: { gt: now }, client: { status: "active", firmId }, consent: { status: "active" } }, include: { client: true, consent: true } });
    if (!token) throw new Error("Current credential authority is required.");
    const scopes = effectiveOAuthScopes(current, { clientAllowedScopes: token.client.allowedScopes, consentScopes: token.consent.scopes, tokenScopes: token.scopes });
    if (!permissions[permission]({ session: { ...current, authenticationType: type, machineScopes: scopes } })) throw new Error("Current credential authority is required.");
    return;
  }
  throw new Error("Direct command authority is unavailable for this credential type.");
}
async function assertCurrentAgentCredential(tx, context, capability) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!session?.itemId || !firmId || session.authenticationType !== "agent" || !session.credentialId || !session.agentPrincipalId) throw new Error("Current agent credential is required.");
  await tx.$executeRaw`SELECT c.id FROM "AgentCredential" c JOIN "AgentPrincipal" p ON p.id = c."agentPrincipal" WHERE c.id = ${session.credentialId} FOR SHARE OF c,p`;
  const current = await lockCurrentFirmMember(tx, session.itemId, firmId);
  const credential = await tx.agentCredential.findFirst({ where: { id: session.credentialId, firmId, status: "active", agentPrincipalId: session.agentPrincipalId, agentPrincipal: { status: "active", firmId, ownerId: session.itemId } } });
  if (!current || current.data.activeFirm?.status !== "active" || !credential || credential.expiresAt && credential.expiresAt <= /* @__PURE__ */ new Date() || !normalizeAgentCapabilities(credential.scopes).includes(capability)) throw new Error("Current agent credential is required.");
}

// features/keystone/lib/portal-policy.ts
var PORTAL_POLICY_STATUSES = ["open", "on_hold", "closing"];
var PORTAL_POLICY_REVIEW_STATUSES = ["proposed", "pending_conflict", ...PORTAL_POLICY_STATUSES, "closed", "declined"];
var PORTAL_POLICY_MODES = ["read_intersection", "manager_discovery_review", "live_team_only_review"];
function normalizePortalPolicy(mode, statuses) {
  if (!PORTAL_POLICY_MODES.includes(mode)) throw new Error("Unsupported discovery policy choice.");
  const normalized = [...new Set(statuses)].sort();
  if (!normalized.length || normalized.some((status) => !PORTAL_POLICY_REVIEW_STATUSES.includes(status))) {
    throw new Error("Choose explicit known Matter statuses.");
  }
  const conservativeStatuses = normalized.every((status) => PORTAL_POLICY_STATUSES.includes(status));
  return { mode, statuses: normalized, admission: mode === "read_intersection" && conservativeStatuses ? "admitted" : "review_required" };
}
async function assertCurrentPortalActor(tx, firmId, userId, required) {
  await lockCurrentFirmMember(tx, userId, firmId);
  const actor = await tx.user.findFirst({
    where: { id: userId, status: "active", activeFirmId: firmId, firmMemberships: { some: {
      firmId,
      status: "active",
      firm: { status: "active" },
      role: { status: "active", firmId, ...Object.fromEntries(required.map((key) => [key, true])) }
    } } },
    select: { id: true }
  });
  if (!actor) {
    throw new Error("Current human authority in the active firm is required.");
  }
}
async function currentPortalPolicy(tx, firmId) {
  const policy = await tx.portalDiscoveryPolicy.findFirst({
    where: { firmId, admission: "admitted" },
    orderBy: { revision: "desc" }
  });
  if (!policy) return null;
  const normalized = normalizePortalPolicy(policy.mode, policy.statuses);
  if (normalized.admission !== "admitted") throw new Error("Portal policy is not executable.");
  return policy;
}
function portalGrantProjection(grant) {
  return {
    id: grant.id,
    status: grant.status,
    version: grant.version ?? 0,
    policyRevision: grant.policyRevision ?? 0,
    canReadDocuments: grant.canReadDocuments,
    canUploadDocuments: grant.canUploadDocuments,
    canReadInvoices: grant.canReadInvoices,
    canReadMessages: grant.canReadMessages,
    expiresAt: grant.expiresAt
  };
}
async function assertPortalMatterScope(tx, firmId, matterId, userId) {
  const matter = await tx.matter.findFirst({
    where: { id: matterId, firmId, AND: [
      { OR: [{ confidentiality: { not: "restricted" } }, { AND: [
        { authorizedUsers: { some: { id: userId } } },
        { teamMembers: { some: { firmId, userId, status: "active", canAccessRestricted: true } } }
      ] }] },
      { blockedUsers: { none: { id: userId } } },
      { ethicalWalls: { none: { status: "active", members: { some: { userId, status: "active", decision: "blocked" } } } } }
    ] },
    select: { id: true, status: true }
  });
  if (!matter) throw new Error("Matter is unavailable in the current read/team/wall scope.");
  return matter;
}
async function assertPortalAccountTarget(tx, firmId, accountId, contactId, active) {
  const account2 = await tx.portalAccount.findFirst({
    where: {
      id: accountId,
      firmId,
      contactId,
      ...active ? { status: "active" } : {},
      contact: { id: contactId, firmId, status: { not: "archived" } }
    },
    select: { id: true, contactId: true, status: true }
  });
  if (!account2) throw new Error("Exact portal account/contact target is unavailable.");
  return account2;
}
async function policyGrantIsCurrent(tx, grant) {
  try {
    if (!Number.isSafeInteger(grant.policyRevision) || grant.policyRevision < 0) return false;
    await assertCurrentPortalActor(tx, grant.firmId, grant.grantedById, ["canManagePortal", "canReadMatters", "canReadPortal"]);
    const matter = await assertPortalMatterScope(tx, grant.firmId, grant.matterId, grant.grantedById);
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

// features/keystone/lib/portal-share-binding.ts
var import_zod = require("zod");
var id = import_zod.z.string().min(1);
var linkedMatter = import_zod.z.object({ id, firmId: id });
var resource = import_zod.z.object({ id, firmId: id, matterId: id });
var document = resource.extend({ status: import_zod.z.literal("active"), confidentiality: import_zod.z.literal("client_shareable") });
var portalResourceTypes = import_zod.z.enum(["document", "document_version", "invoice", "communication_thread"]);
var header = import_zod.z.object({
  id,
  firmId: id,
  matterId: id,
  portalAccountId: id,
  matterAccessId: id,
  grantVersion: import_zod.z.number().int().nonnegative(),
  policyRevision: import_zod.z.number().int().nonnegative(),
  contactId: id.nullable(),
  status: import_zod.z.literal("active"),
  expiresAt: import_zod.z.date().nullable(),
  grantedAt: import_zod.z.date(),
  grantedById: id,
  resourceType: portalResourceTypes,
  documentId: id.nullable(),
  documentVersionId: id.nullable(),
  invoiceId: id.nullable(),
  communicationThreadId: id.nullable(),
  matter: linkedMatter,
  document: document.nullable(),
  documentVersion: import_zod.z.object({ id, firmId: id, documentId: id, document }).nullable(),
  invoice: resource.extend({ status: import_zod.z.enum(["issued", "partially_paid", "paid", "overdue"]) }).nullable(),
  communicationThread: resource.extend({ status: import_zod.z.literal("open") }).nullable(),
  matterAccess: import_zod.z.object({
    id,
    firmId: id,
    matterId: id,
    portalAccountId: id,
    contactId: id.nullable(),
    grantedById: id,
    grantedAt: import_zod.z.date(),
    status: import_zod.z.literal("active"),
    expiresAt: import_zod.z.date().nullable(),
    policyRevision: import_zod.z.number().int().nonnegative(),
    version: import_zod.z.number().int().nonnegative(),
    canReadDocuments: import_zod.z.boolean(),
    canReadInvoices: import_zod.z.boolean(),
    canReadMessages: import_zod.z.boolean()
  })
});
var portalShareHeaderSelect = {
  id: true,
  firmId: true,
  matterId: true,
  portalAccountId: true,
  matterAccessId: true,
  grantVersion: true,
  policyRevision: true,
  contactId: true,
  status: true,
  grantedAt: true,
  grantedById: true,
  expiresAt: true,
  resourceType: true,
  documentId: true,
  documentVersionId: true,
  invoiceId: true,
  communicationThreadId: true,
  matter: { select: { id: true, firmId: true } },
  document: { select: { id: true, firmId: true, matterId: true, status: true, confidentiality: true } },
  documentVersion: { select: { id: true, firmId: true, documentId: true, document: { select: { id: true, firmId: true, matterId: true, status: true, confidentiality: true } } } },
  invoice: { select: { id: true, firmId: true, matterId: true, status: true } },
  communicationThread: { select: { id: true, firmId: true, matterId: true, status: true } },
  matterAccess: { select: {
    id: true,
    firmId: true,
    matterId: true,
    portalAccountId: true,
    contactId: true,
    grantedById: true,
    grantedAt: true,
    status: true,
    expiresAt: true,
    policyRevision: true,
    version: true,
    canReadDocuments: true,
    canReadInvoices: true,
    canReadMessages: true
  } }
};
function boundPortalShare(value, identity, now = /* @__PURE__ */ new Date()) {
  const parsed = header.safeParse(value);
  if (!parsed.success) return null;
  const share = parsed.data;
  const grant = share.matterAccess;
  if (share.firmId !== identity.firmId || share.portalAccountId !== identity.portalAccountId || grant.id !== share.matterAccessId || grant.firmId !== share.firmId || grant.matterId !== share.matterId || grant.portalAccountId !== share.portalAccountId || share.grantVersion !== grant.version || share.policyRevision !== grant.policyRevision || share.contactId !== null && share.contactId !== identity.contactId || share.policyRevision > 0 && share.contactId !== grant.contactId || share.matter.id !== share.matterId || share.matter.firmId !== share.firmId || share.expiresAt && share.expiresAt <= now || grant.expiresAt && grant.expiresAt <= now || share.grantedAt < grant.grantedAt || grant.contactId !== null && grant.contactId !== identity.contactId || grant.policyRevision > 0 && (!grant.contactId || grant.version < 1)) return null;
  const names = ["document", "documentVersion", "invoice", "communicationThread"];
  if (names.some((name2) => share[`${name2}Id`] === null !== (share[name2] === null))) return null;
  const selected = names.filter((name2) => share[`${name2}Id`] !== null);
  const name = { document: "document", document_version: "documentVersion", invoice: "invoice", communication_thread: "communicationThread" };
  const field = name[share.resourceType];
  if (selected.length !== 1 || selected[0] !== field) return null;
  const linked = share[field];
  if (!linked || linked.id !== share[`${field}Id`] || linked.firmId !== share.firmId) return null;
  const target = "document" in linked ? linked.document : linked;
  if ("document" in linked && linked.documentId !== linked.document.id) return null;
  if (target.firmId !== share.firmId || target.matterId !== grant.matterId) return null;
  const capability = share.resourceType === "invoice" ? grant.canReadInvoices : share.resourceType === "communication_thread" ? grant.canReadMessages : grant.canReadDocuments;
  return capability ? share : null;
}
async function portalShareIsCurrent(tx, share) {
  if (!await policyGrantIsCurrent(tx, share.matterAccess)) return false;
  const staffPermission = { document: "canReadDocuments", document_version: "canReadDocuments", invoice: "canReadBilling", communication_thread: "canReadCommunications" };
  try {
    await assertCurrentPortalActor(tx, share.firmId, share.grantedById, ["canManagePortal", "canReadPortal", "canReadMatters", staffPermission[share.resourceType]]);
    await assertPortalMatterScope(tx, share.firmId, share.matterId, share.grantedById);
    return true;
  } catch {
    return false;
  }
}
function portalShareCandidateWhere(identity, now) {
  return {
    firmId: identity.firmId,
    portalAccountId: identity.portalAccountId,
    status: "active",
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    portalAccount: {
      id: identity.portalAccountId,
      firmId: identity.firmId,
      contactId: identity.contactId,
      status: "active",
      contact: { id: identity.contactId, firmId: identity.firmId, status: { not: "archived" } },
      firm: { status: "active" }
    },
    matterAccess: {
      firmId: identity.firmId,
      portalAccountId: identity.portalAccountId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    }
  };
}
function boundPortalShareWhere(share, identity, now) {
  const grant = share.matterAccess;
  const resourceWhere = { firmId: identity.firmId, matterId: share.matterId };
  return {
    ...portalShareCandidateWhere(identity, now),
    id: share.id,
    matterId: share.matterId,
    matterAccessId: grant.id,
    resourceType: share.resourceType,
    grantedAt: share.grantedAt,
    grantedById: share.grantedById,
    grantVersion: share.grantVersion,
    policyRevision: share.policyRevision,
    contactId: share.contactId,
    documentId: share.documentId,
    documentVersionId: share.documentVersionId,
    invoiceId: share.invoiceId,
    communicationThreadId: share.communicationThreadId,
    matter: { id: share.matterId, firmId: identity.firmId },
    matterAccess: {
      id: grant.id,
      firmId: identity.firmId,
      matterId: share.matterId,
      portalAccountId: identity.portalAccountId,
      contactId: grant.contactId,
      grantedById: grant.grantedById,
      grantedAt: grant.grantedAt,
      policyRevision: grant.policyRevision,
      version: grant.version,
      status: "active",
      canReadDocuments: grant.canReadDocuments,
      canReadInvoices: grant.canReadInvoices,
      canReadMessages: grant.canReadMessages,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    ...share.resourceType === "document" ? { document: { id: share.documentId, ...resourceWhere, status: "active", confidentiality: "client_shareable" } } : {},
    ...share.resourceType === "document_version" ? { documentVersion: {
      id: share.documentVersionId,
      firmId: identity.firmId,
      documentId: share.documentVersion?.documentId,
      document: { id: share.documentVersion?.documentId, ...resourceWhere, status: "active", confidentiality: "client_shareable" }
    } } : {},
    ...share.resourceType === "invoice" ? { invoice: { id: share.invoiceId, ...resourceWhere, status: { in: ["issued", "partially_paid", "paid", "overdue"] } } } : {},
    ...share.resourceType === "communication_thread" ? { communicationThread: { id: share.communicationThreadId, ...resourceWhere, status: "open" } } : {}
  };
}

// features/keystone/models/portal.ts
var portalEvidenceOperation = {
  query: permissions.canReadPortal,
  create: denyAll,
  update: denyAll,
  delete: denyAll
};
var portalAccountEvidenceAccess = {
  operation: portalEvidenceOperation,
  filter: {
    query: rules.activeFirmOwned,
    update: () => false,
    delete: () => false
  }
};
var portalMatterEvidenceAccess = {
  operation: portalEvidenceOperation,
  filter: {
    query: rules.canReadPortalRecord,
    update: () => false,
    delete: () => false
  }
};
var portalPiiAccess = {
  read: ({ session }) => permissions.canReadPortal({ session }),
  create: ({ session }) => permissions.canManagePortal({ session }),
  update: ({ session }) => permissions.canManagePortal({ session })
};
var basePortalShareHooks = firmOwnedHooks({ lifecycle: "portalShare", controlledStatus: true });
function portalShareRelationId(args, field) {
  if (Object.prototype.hasOwnProperty.call(args.resolvedData ?? {}, field)) {
    return relationshipConnectionIds(args.resolvedData[field])[0] ?? null;
  }
  return args.item?.[`${field}Id`] ?? null;
}
async function validatePortalShare(args) {
  const firmId = activeFirmId(args.context.session);
  const userId = args.context.session?.itemId;
  if (!firmId || !userId || args.context.session?.authenticationType && args.context.session.authenticationType !== "human") {
    args.addValidationError("A current human portal actor in an active firm is required.");
    return;
  }
  if (args.item?.id) {
    const relations = ["matter", "portalAccount", "matterAccess", "contact", "grantedBy", "document", "documentVersion", "invoice", "communicationThread"];
    const relationChanged = relations.some((name) => Object.prototype.hasOwnProperty.call(args.resolvedData ?? {}, name) && portalShareRelationId(args, name) !== (args.item[`${name}Id`] ?? null));
    const scalarChanged = ["resourceType", "grantVersion", "policyRevision", "grantedAt", "expiresAt"].some((name) => {
      if (!Object.prototype.hasOwnProperty.call(args.resolvedData ?? {}, name)) return false;
      const original = args.item[name];
      const proposed = args.resolvedData[name];
      if (["grantedAt", "expiresAt"].includes(name)) {
        return (original ? new Date(original).getTime() : null) !== (proposed ? new Date(proposed).getTime() : null);
      }
      return original !== proposed;
    });
    if (relationChanged || scalarChanged) {
      args.addValidationError("Portal share disclosure anchors are immutable; revoke and review a new share.");
      return;
    }
  }
  const matterId = portalShareRelationId(args, "matter");
  const portalAccountId = portalShareRelationId(args, "portalAccount");
  const matterAccessId = portalShareRelationId(args, "matterAccess");
  const type = portalResourceTypes.safeParse(args.resolvedData?.resourceType ?? args.item?.resourceType);
  const names = ["document", "documentVersion", "invoice", "communicationThread"];
  const fields = { document: "document", document_version: "documentVersion", invoice: "invoice", communication_thread: "communicationThread" };
  const selected = names.filter((field) => portalShareRelationId(args, field));
  if (!type.success || selected.length !== 1 || selected[0] !== fields[type.data]) {
    args.addValidationError("Portal share resource type must match exactly one linked resource.");
    return;
  }
  if (!matterId || !portalAccountId || !matterAccessId) {
    args.addValidationError("Portal share requires a current matching portal matter grant.");
    return;
  }
  const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma);
  try {
    const staffPermission = { document: "canReadDocuments", document_version: "canReadDocuments", invoice: "canReadBilling", communication_thread: "canReadCommunications" };
    await assertCurrentPortalActor(prisma, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters", staffPermission[type.data]]);
    const access = await prisma.portalMatterAccess.findFirst({
      where: { id: matterAccessId, firmId, matterId, portalAccountId, status: "active" },
      select: portalShareHeaderSelect.matterAccess.select
    });
    if (!access || !await policyGrantIsCurrent(prisma, access)) throw new Error("unavailable");
    await assertPortalMatterScope(prisma, firmId, matterId, userId);
    const account2 = await prisma.portalAccount.findFirst({ where: {
      id: portalAccountId,
      firmId,
      status: "active",
      firm: { status: "active" },
      contact: { firmId, status: { not: "archived" } }
    }, select: { id: true, contactId: true } });
    if (!account2) throw new Error("unavailable");
    const field = fields[type.data];
    const resourceId = portalShareRelationId(args, field);
    const resource2 = await prisma[field].findFirst({ where: { id: resourceId, firmId }, select: portalShareHeaderSelect[field].select });
    const effective = (name) => Object.prototype.hasOwnProperty.call(args.resolvedData ?? {}, name) ? args.resolvedData[name] : args.item?.[name];
    const value = {
      id: args.item?.id ?? "new-share",
      firmId,
      matterId,
      portalAccountId,
      matterAccessId,
      status: effective("status") ?? "active",
      grantedById: portalShareRelationId(args, "grantedBy") ?? userId,
      grantVersion: effective("grantVersion") ?? 0,
      policyRevision: effective("policyRevision") ?? 0,
      contactId: portalShareRelationId(args, "contact"),
      grantedAt: new Date(effective("grantedAt") ?? Date.now()),
      expiresAt: effective("expiresAt") ? new Date(effective("expiresAt")) : null,
      resourceType: type.data,
      matter: { id: matterId, firmId },
      matterAccess: access,
      documentId: null,
      documentVersionId: null,
      invoiceId: null,
      communicationThreadId: null,
      document: null,
      documentVersion: null,
      invoice: null,
      communicationThread: null,
      [field]: resource2,
      [`${field}Id`]: resourceId
    };
    const identity = { firmId, portalAccountId, contactId: account2.contactId };
    const bound = boundPortalShare(value, identity);
    if (!bound || !await portalShareIsCurrent(prisma, bound)) throw new Error("unavailable");
    const predicate = boundPortalShareWhere(bound, identity, /* @__PURE__ */ new Date());
    const linkedWhere = {
      document: predicate.document,
      documentVersion: predicate.documentVersion,
      invoice: predicate.invoice,
      communicationThread: predicate.communicationThread
    }[field];
    if (!await prisma[field].findFirst({ where: linkedWhere, select: { id: true } })) throw new Error("unavailable");
  } catch {
    args.addValidationError("Portal share requires a current matching portal matter grant and exact resource scope.");
  }
}
var portalShareHooks = {
  ...basePortalShareHooks,
  validate: {
    create: async (args) => {
      await basePortalShareHooks.validate.create(args);
      await validatePortalShare(args);
    },
    update: async (args) => {
      await basePortalShareHooks.validate.update(args);
      await validatePortalShare(args);
    }
  }
};
var PortalAccount = (0, import_core15.list)({
  db: uniqueConstraints(["firmId", "email"]),
  access: portalAccountEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "portalAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["contact", "email", "status", "invitedAt", "lastLoginAt"] } },
  fields: {
    firm: firmRelationship(),
    contact: requiredRelationship("Contact"),
    user: (0, import_fields31.relationship)({ ref: "User" }),
    email: (0, import_fields31.text)({ access: portalPiiAccess, validation: { isRequired: true }, isIndexed: true }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    inviteTokenDigest: (0, import_fields31.text)({
      isIndexed: "unique",
      defaultValue: null,
      db: { isNullable: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" }
      }
    }),
    inviteTokenPrefix: (0, import_fields31.text)({ isIndexed: true }),
    resetTokenDigest: secretText("Reset token digest"),
    inviteExpiresAt: (0, import_fields31.timestamp)(),
    resetExpiresAt: (0, import_fields31.timestamp)(),
    invitedAt: (0, import_fields31.timestamp)(),
    acceptedAt: (0, import_fields31.timestamp)(),
    lastLoginAt: (0, import_fields31.timestamp)(),
    suspendedAt: (0, import_fields31.timestamp)(),
    closedAt: (0, import_fields31.timestamp)(),
    matterAccesses: (0, import_fields31.relationship)({ ref: "PortalMatterAccess.portalAccount", many: true }),
    shares: (0, import_fields31.relationship)({ ref: "PortalShare.portalAccount", many: true }),
    sessions: readOnlyRelationship("PortalSession.portalAccount", true),
    ...trackingFields
  }
});
var PortalMatterAccess = (0, import_core15.list)({
  access: portalMatterEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "portalMatterAccess", controlledStatus: true }),
  ui: { listView: { initialColumns: ["portalAccount", "matter", "status", "grantedBy", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount.matterAccesses"),
    // Zero marks pre-policy legacy evidence; never automatically infer approval.
    policyRevision: (0, import_fields31.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    version: (0, import_fields31.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    contact: (0, import_fields31.relationship)({ ref: "Contact" }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    canReadDocuments: (0, import_fields31.checkbox)({ defaultValue: false }),
    canUploadDocuments: (0, import_fields31.checkbox)({ defaultValue: false }),
    canReadInvoices: (0, import_fields31.checkbox)({ defaultValue: false }),
    canReadMessages: (0, import_fields31.checkbox)({ defaultValue: false }),
    grantedBy: requiredRelationship("User"),
    grantedAt: (0, import_fields31.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: (0, import_fields31.timestamp)(),
    revokedBy: (0, import_fields31.relationship)({ ref: "User" }),
    revokedAt: (0, import_fields31.timestamp)(),
    revocationReason: (0, import_fields31.text)({ access: portalPiiAccess }),
    shares: (0, import_fields31.relationship)({ ref: "PortalShare.matterAccess", many: true }),
    ...trackingFields
  }
});
var PortalShare = (0, import_core15.list)({
  access: portalMatterEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: portalShareHooks,
  ui: { listView: { initialColumns: ["portalAccount", "matter", "resourceType", "status", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount.shares"),
    matterAccess: requiredRelationship("PortalMatterAccess.shares"),
    // Immutable disclosure anchors for new shares. Zero/null retain legacy
    // evidence; never backfill a policy approval or contact identity.
    grantVersion: (0, import_fields31.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    policyRevision: (0, import_fields31.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    contact: (0, import_fields31.relationship)({ ref: "Contact" }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    resourceType: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Document", value: "document" },
        { label: "Document version", value: "document_version" },
        { label: "Invoice", value: "invoice" },
        { label: "Communication thread", value: "communication_thread" }
      ],
      validation: { isRequired: true }
    }),
    document: (0, import_fields31.relationship)({ ref: "Document" }),
    documentVersion: (0, import_fields31.relationship)({ ref: "DocumentVersion" }),
    invoice: (0, import_fields31.relationship)({ ref: "Invoice" }),
    communicationThread: (0, import_fields31.relationship)({ ref: "CommunicationThread" }),
    grantedBy: requiredRelationship("User"),
    grantedAt: (0, import_fields31.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: (0, import_fields31.timestamp)(),
    revokedBy: (0, import_fields31.relationship)({ ref: "User" }),
    revokedAt: (0, import_fields31.timestamp)(),
    ...trackingFields
  }
});
var PortalSession = (0, import_core15.list)({
  access: portalAccountEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["portalAccount", "status", "expiresAt", "lastUsedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    portalAccount: requiredRelationship("PortalAccount.sessions"),
    tokenDigest: (0, import_fields31.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" }
      }
    }),
    tokenPrefix: (0, import_fields31.text)({ isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    expiresAt: (0, import_fields31.timestamp)({ validation: { isRequired: true } }),
    lastUsedAt: (0, import_fields31.timestamp)(),
    revokedAt: (0, import_fields31.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/portalPolicy.ts
var import_core16 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var PortalDiscoveryPolicy = (0, import_core16.list)({
  db: uniqueConstraints(["firmId", "revision"]),
  graphql: systemEvidenceGraphql,
  access: {
    operation: { query: ({ session }) => permissions.canReadPortal({ session }) || permissions.canManageFirm({ session }), create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: rules.activeFirmOwned }
  },
  hooks: firmOwnedHooks(),
  fields: {
    firm: firmRelationship(),
    revision: (0, import_fields33.integer)({ validation: { isRequired: true, min: 1 } }),
    mode: (0, import_fields33.text)({ validation: { isRequired: true } }),
    statuses: (0, import_fields33.json)(),
    admission: (0, import_fields33.text)({ validation: { isRequired: true } }),
    reasonDigest: (0, import_fields33.text)({ validation: { isRequired: true } }),
    recordedBy: requiredRelationship("User"),
    recordedAt: (0, import_fields33.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields
  }
});
var PortalGrantIntent = (0, import_core16.list)({
  db: uniqueConstraints(["firmId", "actorId", "idempotencyKey"]),
  graphql: systemEvidenceGraphql,
  access: {
    operation: { query: permissions.canReadPortal, create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: (args) => {
      const scope = rules.canReadPortalRecord(args);
      return scope === false ? false : { AND: [scope, { actor: { id: { equals: args.session.itemId } } }] };
    } }
  },
  hooks: firmOwnedHooks(),
  fields: {
    firm: firmRelationship(),
    actor: requiredRelationship("User"),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount"),
    contact: requiredRelationship("Contact"),
    grant: requiredRelationship("PortalMatterAccess"),
    idempotencyKey: (0, import_fields33.text)({ validation: { isRequired: true }, isFilterable: false, isOrderable: false }),
    intentDigest: (0, import_fields33.text)({ validation: { isRequired: true } }),
    operation: (0, import_fields33.text)({ validation: { isRequired: true } }),
    policyRevision: (0, import_fields33.integer)({ validation: { isRequired: true } }),
    resultVersion: (0, import_fields33.integer)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields33.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/integrations.ts
var import_core17 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var canReadIntegrations = ({ session }) => permissions.canReadIntegrations({ session }) || permissions.canManageIntegrations({ session });
var canManageIntegrations = ({ session }) => permissions.canManageIntegrations({ session });
var integrationAccess = scopedAccess("canReadIntegrations", "canManageIntegrations");
var integrationMatterAccess = {
  operation: {
    query: canReadIntegrations,
    create: canManageIntegrations,
    update: canManageIntegrations,
    delete: denyAll
  },
  filter: {
    query: rules.canReadIntegrationRecord,
    update: rules.canManageIntegrationRecord,
    delete: rules.canManageIntegrationRecord
  }
};
var integrationFieldAccess = {
  read: canReadIntegrations,
  create: canManageIntegrations,
  update: canManageIntegrations
};
var controlledDeliveryEvidenceAccess = {
  read: canReadIntegrations,
  create: denyAll,
  update: denyAll
};
var IntegrationConnection = (0, import_core17.list)({
  access: integrationAccess,
  hooks: firmOwnedHooks({ lifecycle: "integrationConnection", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "provider", "category", "status", "office", "lastSyncedAt"] } },
  fields: {
    firm: firmRelationship(),
    office: (0, import_fields35.relationship)({ ref: "Office" }),
    owner: (0, import_fields35.relationship)({ ref: "User" }),
    name: (0, import_fields35.text)({ validation: { isRequired: true } }),
    provider: (0, import_fields35.text)({ validation: { isRequired: true } }),
    category: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "Calendar", value: "calendar" },
        { label: "Document storage", value: "document_storage" },
        { label: "Signature", value: "signature" },
        { label: "Payment", value: "payment" },
        { label: "Court / docket", value: "court" },
        { label: "Accounting", value: "accounting" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Needs reauthorization", value: "needs_reauth" },
        { label: "Disabled", value: "disabled" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    credentialsEncrypted: secretText("Encrypted credentials envelope"),
    oauthAccessToken: secretText("OAuth access token envelope"),
    oauthRefreshToken: secretText("OAuth refresh token envelope"),
    webhookSecretDigest: secretText("Webhook secret digest"),
    configuration: (0, import_fields35.json)({
      access: integrationFieldAccess,
      ui: { description: "Non-secret provider configuration only. Secret material belongs in omitted credential fields." }
    }),
    externalAccountId: (0, import_fields35.text)({ access: integrationFieldAccess }),
    lastSyncedAt: (0, import_fields35.timestamp)(),
    lastErrorAt: (0, import_fields35.timestamp)(),
    lastError: (0, import_fields35.text)({ access: integrationFieldAccess, ui: { displayMode: "textarea" } }),
    externalLinks: readOnlyRelationship("ExternalRecordLink.connection", true),
    webhookSubscriptions: readOnlyRelationship("WebhookSubscription.connection", true),
    webhookDeliveries: readOnlyRelationship("WebhookDelivery.connection", true),
    ...trackingFields
  }
});
var ExternalRecordLink = (0, import_core17.list)({
  db: uniqueConstraints(["connectionId", "resourceType", "externalId"]),
  access: integrationMatterAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["connection", "resourceType", "externalId", "status", "lastSyncedAt"] } },
  fields: {
    firm: firmRelationship(),
    connection: requiredRelationship("IntegrationConnection.externalLinks"),
    resourceType: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Contact", value: "contact" },
        { label: "Intake", value: "intake" },
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Invoice", value: "invoice" },
        { label: "Payment", value: "payment" },
        { label: "Docket", value: "docket" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    externalId: (0, import_fields35.text)({ validation: { isRequired: true }, isIndexed: true }),
    externalUrl: (0, import_fields35.text)(),
    status: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Linked", value: "linked" },
        { label: "Conflict", value: "conflict" },
        { label: "Unlinked", value: "unlinked" }
      ],
      defaultValue: "linked"
    }),
    contact: (0, import_fields35.relationship)({ ref: "Contact" }),
    intake: (0, import_fields35.relationship)({ ref: "Intake" }),
    matter: (0, import_fields35.relationship)({ ref: "Matter" }),
    document: (0, import_fields35.relationship)({ ref: "Document" }),
    invoice: (0, import_fields35.relationship)({ ref: "Invoice" }),
    payment: (0, import_fields35.relationship)({ ref: "Payment" }),
    docket: (0, import_fields35.relationship)({ ref: "Docket" }),
    fingerprint: (0, import_fields35.text)({ access: integrationFieldAccess }),
    providerMetadata: (0, import_fields35.json)({
      access: integrationFieldAccess,
      ui: { description: "Bounded sync provenance; never credentials or unrestricted provider records." }
    }),
    lastSyncedAt: (0, import_fields35.timestamp)(),
    lastError: (0, import_fields35.text)({ access: integrationFieldAccess }),
    ...trackingFields
  }
});
var WebhookSubscription = (0, import_core17.list)({
  access: integrationAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "connection", "status", "endpointUrl", "lastDeliveredAt"] } },
  fields: {
    firm: firmRelationship(),
    office: (0, import_fields35.relationship)({ ref: "Office" }),
    connection: requiredRelationship("IntegrationConnection.webhookSubscriptions"),
    name: (0, import_fields35.text)({ validation: { isRequired: true } }),
    status: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    endpointUrl: (0, import_fields35.text)({ access: integrationFieldAccess, validation: { isRequired: true } }),
    eventTypes: (0, import_fields35.multiselect)({
      type: "enum",
      options: [
        { label: "Matter changed", value: "matter_changed" },
        { label: "Document changed", value: "document_changed" },
        { label: "Invoice changed", value: "invoice_changed" },
        { label: "Payment changed", value: "payment_changed" },
        { label: "Task changed", value: "task_changed" }
      ],
      defaultValue: []
    }),
    signingSecretDigest: secretText("Signing secret digest"),
    // A digest cannot produce outbound HMACs; the dispatcher decrypts this server-side only.
    signingSecretEncrypted: secretText("Encrypted outbound signing secret envelope"),
    lastDeliveredAt: (0, import_fields35.timestamp)(),
    deliveries: readOnlyRelationship("WebhookDelivery.subscription", true),
    ...trackingFields
  }
});
var WebhookDelivery = (0, import_core17.list)({
  db: uniqueConstraints(["firmId", "eventId"]),
  access: {
    ...integrationMatterAccess,
    operation: { ...integrationMatterAccess.operation, create: denyAll, update: denyAll },
    filter: { ...integrationMatterAccess.filter, update: () => false }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "webhookDelivery", controlledStatus: true }),
  ui: { listView: { initialColumns: ["eventId", "eventType", "subscription", "status", "attemptCount", "nextAttemptAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields35.relationship)({ ref: "Matter" }),
    connection: requiredRelationship("IntegrationConnection.webhookDeliveries"),
    subscription: requiredRelationship("WebhookSubscription.deliveries"),
    eventId: (0, import_fields35.text)({ isIndexed: true, validation: { isRequired: true } }),
    eventType: (0, import_fields35.text)({ validation: { isRequired: true } }),
    status: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Dead letter", value: "dead_letter" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    payload: (0, import_fields35.json)({ access: integrationFieldAccess }),
    destinationUrl: (0, import_fields35.text)({ access: controlledDeliveryEvidenceAccess }),
    attemptCount: (0, import_fields35.integer)({ access: controlledDeliveryEvidenceAccess, defaultValue: 0, validation: { min: 0 } }),
    nextAttemptAt: (0, import_fields35.timestamp)({ access: controlledDeliveryEvidenceAccess }),
    completedAt: (0, import_fields35.timestamp)({ access: controlledDeliveryEvidenceAccess }),
    lastError: (0, import_fields35.text)({ access: controlledDeliveryEvidenceAccess, ui: { displayMode: "textarea" } }),
    attempts: readOnlyRelationship("WebhookDeliveryAttempt.delivery", true),
    ...trackingFields
  }
});
var WebhookDeliveryAttempt = (0, import_core17.list)({
  db: uniqueConstraints(["deliveryId", "attemptNumber"]),
  access: {
    operation: {
      query: canReadIntegrations,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadIntegrationRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["delivery", "attemptNumber", "attemptedAt", "responseStatus", "succeeded"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields35.relationship)({ ref: "Matter" }),
    delivery: requiredRelationship("WebhookDelivery.attempts"),
    attemptNumber: (0, import_fields35.integer)({ validation: { isRequired: true, min: 1 } }),
    attemptedAt: (0, import_fields35.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    requestDigest: (0, import_fields35.text)({ validation: { isRequired: true } }),
    responseStatus: (0, import_fields35.integer)(),
    responseDigest: (0, import_fields35.text)(),
    succeeded: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" }
      ],
      validation: { isRequired: true }
    }),
    errorCode: (0, import_fields35.text)(),
    errorMessage: (0, import_fields35.text)({ access: integrationFieldAccess, ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/governance.ts
var import_core18 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var retentionAccess = scopedAccess("canReadRetention", "canManageRetention");
var retentionMatterAccess = {
  operation: {
    query: permissions.canReadRetention,
    create: permissions.canManageRetention,
    update: permissions.canManageRetention,
    delete: denyAll
  },
  filter: {
    query: rules.canReadRetentionRecord,
    update: rules.canManageRetentionRecord,
    delete: rules.canManageRetentionRecord
  }
};
var retentionFieldAccess = {
  read: ({ session }) => permissions.canReadRetention({ session }),
  create: ({ session }) => permissions.canManageRetention({ session }),
  update: ({ session }) => permissions.canManageRetention({ session })
};
var controlledPolicyStatusAccess = {
  read: ({ session }) => permissions.canReadRetention({ session }),
  create: ({ session }) => permissions.canManageRetention({ session }),
  update: denyAll
};
var immutableHoldTargetAccess = {
  read: ({ session }) => permissions.canReadRetention({ session }),
  create: ({ session }) => permissions.canManageRetention({ session }),
  update: denyAll
};
var baseRetentionPolicyHooks = firmOwnedHooks({ lifecycle: "retentionPolicy", controlledStatus: true });
var immutableActivePolicyFields = /* @__PURE__ */ new Set([
  "name",
  "code",
  "recordClass",
  "trigger",
  "retentionDays",
  "practiceArea",
  "description",
  "jurisdictionReference"
]);
var retentionPolicyHooks = {
  ...baseRetentionPolicyHooks,
  validate: {
    ...baseRetentionPolicyHooks.validate,
    update: async (args) => {
      await baseRetentionPolicyHooks.validate.update(args);
      if (args.item?.status !== "draft" && Object.keys(args.resolvedData).some((field) => immutableActivePolicyFields.has(field))) {
        args.addValidationError("Active or retired retention policy terms are immutable; create a new policy version.");
      }
    }
  }
};
var RetentionPolicy = (0, import_core18.list)({
  db: uniqueConstraints(["firmId", "code"]),
  access: retentionAccess,
  graphql: { omit: { delete: true } },
  hooks: retentionPolicyHooks,
  ui: { listView: { initialColumns: ["name", "code", "status", "recordClass", "retentionDays"] } },
  fields: {
    firm: firmRelationship(),
    name: (0, import_fields37.text)({ validation: { isRequired: true } }),
    code: (0, import_fields37.text)({ isIndexed: true, validation: { isRequired: true } }),
    status: (0, import_fields37.select)({
      type: "enum",
      access: controlledPolicyStatusAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    recordClass: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Communication", value: "communication" },
        { label: "Billing", value: "billing" },
        { label: "Contact", value: "contact" },
        { label: "Audit", value: "audit" },
        { label: "Other", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    trigger: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Matter closed", value: "matter_closed" },
        { label: "Document archived", value: "document_archived" },
        { label: "Record created", value: "record_created" },
        { label: "Manual", value: "manual" }
      ],
      validation: { isRequired: true }
    }),
    retentionDays: (0, import_fields37.integer)({ validation: { isRequired: true, min: 0 } }),
    practiceArea: (0, import_fields37.relationship)({ ref: "PracticeArea" }),
    description: (0, import_fields37.text)({ access: retentionFieldAccess, ui: { displayMode: "textarea" } }),
    jurisdictionReference: (0, import_fields37.text)({
      access: retentionFieldAccess,
      ui: { description: "Firm-entered reference only; this platform does not determine jurisdictional requirements." }
    }),
    documents: readOnlyRelationship("Document.retentionPolicy", true),
    holds: readOnlyRelationship("RetentionHold.policy", true),
    actions: readOnlyRelationship("RetentionAction.policy", true),
    ...trackingFields
  }
});
var RetentionHold = (0, import_core18.list)({
  access: {
    ...retentionMatterAccess,
    operation: { ...retentionMatterAccess.operation, create: denyAll, update: denyAll },
    filter: { ...retentionMatterAccess.filter, update: () => false }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "retentionHold", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "status", "matter", "document", "contact", "createdBy"] } },
  fields: {
    firm: firmRelationship(),
    policy: (0, import_fields37.relationship)({ ref: "RetentionPolicy.holds" }),
    name: (0, import_fields37.text)({ validation: { isRequired: true } }),
    status: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Released", value: "released" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    matter: (0, import_fields37.relationship)({ ref: "Matter", access: immutableHoldTargetAccess }),
    document: (0, import_fields37.relationship)({ ref: "Document", access: immutableHoldTargetAccess }),
    contact: (0, import_fields37.relationship)({ ref: "Contact", access: immutableHoldTargetAccess }),
    reason: (0, import_fields37.text)({ access: retentionFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    authorityReference: (0, import_fields37.text)({ access: retentionFieldAccess }),
    createdBy: requiredRelationship("User"),
    effectiveAt: (0, import_fields37.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    releasedBy: (0, import_fields37.relationship)({ ref: "User" }),
    releasedAt: (0, import_fields37.timestamp)(),
    releaseReason: (0, import_fields37.text)({ access: retentionFieldAccess, ui: { displayMode: "textarea" } }),
    actions: readOnlyRelationship("RetentionAction.hold", true),
    ...trackingFields
  }
});
var RetentionAction = (0, import_core18.list)({
  access: {
    operation: {
      query: permissions.canReadRetention,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadRetentionRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["actionType", "resourceType", "matter", "document", "occurredAt", "performedBy"] }
  },
  fields: {
    firm: firmRelationship(),
    policy: (0, import_fields37.relationship)({ ref: "RetentionPolicy.actions" }),
    hold: (0, import_fields37.relationship)({ ref: "RetentionHold.actions" }),
    actionType: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Archived", value: "archived" },
        { label: "Disposed", value: "disposed" },
        { label: "Restored", value: "restored" },
        { label: "Hold applied", value: "hold_applied" },
        { label: "Hold released", value: "hold_released" }
      ],
      validation: { isRequired: true }
    }),
    resourceType: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Contact", value: "contact" },
        { label: "Communication thread", value: "communication_thread" },
        { label: "Invoice", value: "invoice" }
      ],
      validation: { isRequired: true }
    }),
    matter: (0, import_fields37.relationship)({ ref: "Matter" }),
    document: (0, import_fields37.relationship)({ ref: "Document" }),
    contact: (0, import_fields37.relationship)({ ref: "Contact" }),
    communicationThread: (0, import_fields37.relationship)({ ref: "CommunicationThread" }),
    invoice: (0, import_fields37.relationship)({ ref: "Invoice" }),
    performedBy: (0, import_fields37.relationship)({ ref: "User" }),
    performedByAgent: (0, import_fields37.relationship)({ ref: "AgentPrincipal" }),
    approvedBy: (0, import_fields37.relationship)({ ref: "User" }),
    evidenceDigest: (0, import_fields37.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields37.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: (0, import_fields37.json)({
      access: retentionFieldAccess,
      ui: { description: "Bounded disposal evidence; never record bodies, document content, or credentials." }
    }),
    ...trackingFields
  }
});
var AuditEvent = (0, import_core18.list)({
  db: uniqueConstraints(["firmId", "eventId"]),
  access: {
    operation: {
      query: permissions.canViewAudit,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadAuditRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["eventType", "category", "outcome", "actorUser", "matter", "occurredAt"] }
  },
  fields: {
    firm: firmRelationship(),
    eventId: (0, import_fields37.text)({ isIndexed: true, validation: { isRequired: true } }),
    eventType: (0, import_fields37.text)({ validation: { isRequired: true } }),
    category: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Authentication", value: "authentication" },
        { label: "Authorization", value: "authorization" },
        { label: "Legal workflow", value: "legal_workflow" },
        { label: "Financial", value: "financial" },
        { label: "Integration", value: "integration" },
        { label: "Retention", value: "retention" },
        { label: "Agent", value: "agent" }
      ],
      validation: { isRequired: true }
    }),
    outcome: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Succeeded", value: "succeeded" },
        { label: "Denied", value: "denied" },
        { label: "Failed", value: "failed" }
      ],
      validation: { isRequired: true }
    }),
    actorUser: (0, import_fields37.relationship)({ ref: "User" }),
    actorAgent: (0, import_fields37.relationship)({ ref: "AgentPrincipal" }),
    actorType: (0, import_fields37.text)({ validation: { isRequired: true } }),
    matter: (0, import_fields37.relationship)({ ref: "Matter" }),
    contact: (0, import_fields37.relationship)({ ref: "Contact" }),
    intake: (0, import_fields37.relationship)({ ref: "Intake" }),
    document: (0, import_fields37.relationship)({ ref: "Document" }),
    invoice: (0, import_fields37.relationship)({ ref: "Invoice" }),
    payment: (0, import_fields37.relationship)({ ref: "Payment" }),
    trustTransaction: (0, import_fields37.relationship)({ ref: "TrustTransaction" }),
    agentAction: (0, import_fields37.relationship)({ ref: "AgentAction" }),
    sourceIp: (0, import_fields37.text)({ access: { read: permissions.canViewAudit } }),
    userAgent: (0, import_fields37.text)({ access: { read: permissions.canViewAudit } }),
    occurredAt: (0, import_fields37.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: (0, import_fields37.json)({
      access: { read: permissions.canViewAudit },
      ui: { description: "Bounded event facts only; never privileged content or credential material." }
    }),
    ...trackingFields
  }
});

// features/keystone/models/publicSite.ts
var import_core19 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var humanFirmManager = (args) => permissions.canManageFirm(args) && isInteractiveHuman(args);
var systemManaged = { create: denyAll, update: denyAll };
var hiddenOnCreate = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } };
var baseHooks = firmOwnedHooks();
var MAX_NOTICE = 2e4;
function nextVersion(field, resolvedData, item) {
  const versionKey = `${field}Version`;
  const changed = typeof resolvedData[field] === "string" && resolvedData[field].trim() !== (item?.[field] ?? "").trim();
  if (!changed) return;
  resolvedData[field] = resolvedData[field].trim();
  resolvedData[versionKey] = Number(item?.[versionKey] ?? 0) + 1;
}
function stampPublication(resolvedData, item, session) {
  if (resolvedData.status === "published" && item?.status !== "published") {
    resolvedData.publishedAt = /* @__PURE__ */ new Date();
    resolvedData.publishedByUserId = String(session?.itemId ?? "");
  }
}
function validatePublication(args) {
  const value = (key) => args.resolvedData?.[key] !== void 0 ? args.resolvedData[key] : args.item?.[key];
  const status = value("status");
  const accounts = Boolean(value("publicAccountsEnabled"));
  const booking = Boolean(value("publicBookingEnabled"));
  for (const key of ["privacyNotice", "firstContactNotice", "aboutStatement"]) {
    const text23 = value(key);
    if (typeof text23 === "string" && text23.length > MAX_NOTICE) args.addValidationError(`${key} must be ${MAX_NOTICE} characters or fewer.`);
  }
  if (booking && !accounts) args.addValidationError("Consultation booking requires customer accounts to be enabled.");
  if (status === "published" && (accounts || booking)) {
    if (!String(value("privacyNotice") ?? "").trim()) args.addValidationError("Publish the firm's privacy notice before enabling customer accounts or booking.");
    if (booking && !String(value("firstContactNotice") ?? "").trim()) args.addValidationError("Publish the firm's first-contact notice before enabling consultation booking.");
  }
}
var PublicSitePolicy = (0, import_core19.list)({
  db: uniqueConstraints(["firmId"]),
  access: {
    operation: { query: permissions.canManageFirm, create: humanFirmManager, update: humanFirmManager, delete: denyAll },
    filter: { query: rules.activeFirmOwned, update: rules.activeFirmOwned, delete: () => false }
  },
  hooks: {
    ...baseHooks,
    resolveInput: {
      create: (args) => {
        const data = baseHooks.resolveInput.create(args);
        nextVersion("privacyNotice", data, null);
        nextVersion("firstContactNotice", data, null);
        stampPublication(data, null, args.context.session);
        return data;
      },
      update: ({ resolvedData, item, context }) => {
        nextVersion("privacyNotice", resolvedData, item);
        nextVersion("firstContactNotice", resolvedData, item);
        stampPublication(resolvedData, item, context.session);
        return resolvedData;
      }
    },
    validate: {
      create: async (args) => {
        await baseHooks.validate.create(args);
        validatePublication(args);
      },
      update: async (args) => {
        await baseHooks.validate.update(args);
        validatePublication(args);
      }
    }
  },
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["status", "publicAccountsEnabled", "publicBookingEnabled", "publishedAt"] }
  },
  fields: {
    firm: firmRelationship(),
    status: (0, import_fields39.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    publicAccountsEnabled: (0, import_fields39.checkbox)({ defaultValue: false }),
    publicBookingEnabled: (0, import_fields39.checkbox)({ defaultValue: false }),
    privacyNotice: (0, import_fields39.text)({ ui: { displayMode: "textarea", description: "The firm's own privacy notice, shown at /privacy and linked before any customer collection." } }),
    privacyNoticeVersion: (0, import_fields39.integer)({ defaultValue: 0, access: systemManaged, ui: hiddenOnCreate }),
    firstContactNotice: (0, import_fields39.text)({ ui: { displayMode: "textarea", description: "Shown before a prospective client enters any details; each booking records the version acknowledged." } }),
    firstContactNoticeVersion: (0, import_fields39.integer)({ defaultValue: 0, access: systemManaged, ui: hiddenOnCreate }),
    aboutStatement: (0, import_fields39.text)({ ui: { displayMode: "textarea", description: "Firm-approved About text for the public site." } }),
    publishedAt: (0, import_fields39.timestamp)({ access: systemManaged, ui: hiddenOnCreate }),
    publishedByUserId: (0, import_fields39.text)({ access: systemManaged, ui: hiddenOnCreate }),
    ...trackingFields
  }
});
var profileHooks = firmOwnedHooks();
function profileSlug(resolvedData, item) {
  if (typeof resolvedData.slug === "string") resolvedData.slug = normalizePublicSlug(resolvedData.slug);
  if (!(resolvedData.slug ?? item?.slug)) resolvedData.slug = normalizePublicSlug(resolvedData.name ?? item?.name);
  return resolvedData;
}
var AttorneyProfile = (0, import_core19.list)({
  db: uniqueConstraints(["firmId", "slug"]),
  access: {
    operation: { query: permissions.canManageFirm, create: humanFirmManager, update: humanFirmManager, delete: humanFirmManager },
    filter: { query: rules.activeFirmOwned, update: rules.activeFirmOwned, delete: rules.activeFirmOwned }
  },
  hooks: {
    ...profileHooks,
    resolveInput: {
      create: (args) => profileSlug(profileHooks.resolveInput.create(args), null),
      update: ({ resolvedData, item }) => profileSlug(resolvedData, item)
    },
    validate: {
      create: async (args) => {
        await profileHooks.validate.create(args);
        if (!args.resolvedData?.slug) args.addValidationError("A web address is required.");
      },
      update: async (args) => {
        await profileHooks.validate.update(args);
      }
    }
  },
  ui: { listView: { initialColumns: ["name", "title", "isPublic", "sortOrder"] } },
  fields: {
    firm: firmRelationship(),
    name: (0, import_fields39.text)({ validation: { isRequired: true, length: { max: 200 } } }),
    slug: (0, import_fields39.text)({ isIndexed: true, validation: { length: { max: 80 } }, ui: { description: "Public URL handle, e.g. jane-doe. Derived from the name when left empty." } }),
    title: (0, import_fields39.text)({ validation: { length: { max: 120 } }, ui: { description: "e.g. Partner, Associate, Of counsel" } }),
    focus: (0, import_fields39.text)({ validation: { length: { max: 200 } } }),
    biography: (0, import_fields39.text)({ ui: { displayMode: "textarea" }, validation: { length: { max: 8e3 } } }),
    admissions: (0, import_fields39.text)({ ui: { displayMode: "textarea", description: "Bar admissions as the firm verified them, one per line." }, validation: { length: { max: 2e3 } } }),
    email: (0, import_fields39.text)({ validation: { length: { max: 320 } } }),
    practiceAreas: (0, import_fields39.relationship)({ ref: "PracticeArea", many: true }),
    isPublic: (0, import_fields39.checkbox)({ defaultValue: false }),
    sortOrder: (0, import_fields39.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});

// features/keystone/models/agents.ts
var import_core20 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");
var agentAccess = scopedAccess("canReadAgents", "canManageAgents");
var canReadAgents = ({ session }) => permissions.canReadAgents({ session }) || permissions.canManageAgents({ session });
var canManageAgents = ({ session }) => permissions.canManageAgents({ session });
var immutableAgentIdentityAccess = {
  read: canReadAgents,
  create: canManageAgents,
  update: denyAll
};
var agentFieldAccess = {
  read: canReadAgents,
  create: canManageAgents,
  update: canManageAgents
};
var controlledAgentApprovalAccess = {
  read: canReadAgents,
  create: denyAll,
  update: denyAll
};
var capabilityOptions = [
  { label: "Matter read", value: "matter.read" },
  { label: "Privileged read", value: "privileged.read" },
  { label: "Task draft", value: "task.draft" },
  { label: "Communication send", value: "communication.send" },
  { label: "Document publish", value: "document.publish" },
  { label: "Signature send", value: "signature.send" },
  { label: "Matter transition", value: "matter.transition" },
  { label: "Conflict resolve", value: "conflict.resolve" },
  { label: "Invoice issue", value: "invoice.issue" },
  { label: "Billing write", value: "billing.write" },
  { label: "Payment capture", value: "payment.capture" },
  { label: "Payment refund", value: "payment.refund" },
  { label: "Trust post", value: "trust.post" },
  { label: "Retention dispose", value: "retention.dispose" },
  { label: "Access change", value: "access.change" }
];
var baseAgentGrantHooks = firmOwnedHooks({ lifecycle: "agentGrant" });
var grantAuthorityFields = /* @__PURE__ */ new Set([
  "matter",
  "agentPrincipal",
  "capabilities",
  "reason",
  "requestedBy",
  "startsAt",
  "expiresAt"
]);
function grantRequiresApproval(args, resolvedData) {
  return resolvedData.status === "active" && args.item?.status !== "active" || args.item?.status === "active" && Object.keys(resolvedData).some((field) => grantAuthorityFields.has(field));
}
function bindGrantApproval(args, resolvedData) {
  if (!grantRequiresApproval(args, resolvedData)) return resolvedData;
  if (!permissions.canApproveAgentActions({ session: args.context.session })) return resolvedData;
  return {
    ...resolvedData,
    approvedBy: { connect: { id: args.context.session.itemId } },
    approvedAt: /* @__PURE__ */ new Date()
  };
}
var agentGrantHooks = {
  resolveInput: {
    create: (args) => {
      const resolvedData = baseAgentGrantHooks.resolveInput.create(args);
      return bindGrantApproval(args, resolvedData);
    },
    update: (args) => bindGrantApproval(args, args.resolvedData)
  },
  validate: {
    create: async (args) => {
      await baseAgentGrantHooks.validate.create(args);
      if (grantRequiresApproval(args, args.resolvedData) && !permissions.canApproveAgentActions({ session: args.context.session })) {
        args.addValidationError("Activating or changing active agent authority requires agent-approval permission.");
      }
    },
    update: async (args) => {
      await baseAgentGrantHooks.validate.update(args);
      if (grantRequiresApproval(args, args.resolvedData) && !permissions.canApproveAgentActions({ session: args.context.session })) {
        args.addValidationError("Activating or changing active agent authority requires agent-approval permission.");
      }
    }
  }
};
var AgentPrincipal = (0, import_core20.list)({
  access: agentAccess,
  hooks: firmOwnedHooks({ lifecycle: "agentPrincipal" }),
  ui: { listView: { initialColumns: ["name", "agentType", "status", "owner", "provider"] } },
  fields: {
    firm: firmRelationship(),
    owner: (0, import_fields41.relationship)({
      ref: "User",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } }
    }),
    name: (0, import_fields41.text)({ validation: { isRequired: true } }),
    agentType: (0, import_fields41.select)({
      type: "enum",
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Assistant", value: "assistant" },
        { label: "Workflow", value: "workflow" },
        { label: "Integration", value: "integration" },
        { label: "Service account", value: "service_account" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields41.select)({
      type: "enum",
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true }
    }),
    provider: (0, import_fields41.text)(),
    model: (0, import_fields41.text)(),
    description: (0, import_fields41.text)({ access: agentFieldAccess, ui: { displayMode: "textarea" } }),
    lastActiveAt: (0, import_fields41.timestamp)(),
    credentials: readOnlyRelationship("AgentCredential.agentPrincipal", true),
    grants: readOnlyRelationship("AgentGrant.agentPrincipal", true),
    actions: readOnlyRelationship("AgentAction.agentPrincipal", true),
    actionEvents: readOnlyRelationship("AgentActionEvent.actorAgent", true),
    ...trackingFields
  }
});
var AgentCredential = (0, import_core20.list)({
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.activeFirmOwned,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "prefix", "agentPrincipal", "status", "expiresAt", "lastUsedAt"] } },
  fields: {
    firm: firmRelationship(),
    agentPrincipal: requiredRelationship("AgentPrincipal.credentials"),
    name: (0, import_fields41.text)({ validation: { isRequired: true } }),
    prefix: (0, import_fields41.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    secretHash: secretText("Credential secret hash", true),
    status: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    scopes: (0, import_fields41.multiselect)({ type: "string", options: capabilityOptions, defaultValue: [] }),
    createdBy: requiredRelationship("User"),
    expiresAt: (0, import_fields41.timestamp)(),
    lastUsedAt: (0, import_fields41.timestamp)(),
    revokedAt: (0, import_fields41.timestamp)(),
    revokedBy: (0, import_fields41.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var AgentGrant = (0, import_core20.list)({
  access: {
    operation: {
      query: canReadAgents,
      create: canManageAgents,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadAgentRecord,
      update: () => false,
      delete: rules.canManageAgentRecord
    }
  },
  graphql: immutableUpdateDeleteGraphql,
  hooks: agentGrantHooks,
  ui: { listView: { initialColumns: ["agentPrincipal", "matter", "status", "approvedBy", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields41.relationship)({ ref: "Matter" }),
    agentPrincipal: requiredRelationship("AgentPrincipal.grants"),
    status: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Proposed", value: "proposed" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "proposed",
      validation: { isRequired: true }
    }),
    capabilities: (0, import_fields41.multiselect)({ type: "string", options: capabilityOptions, defaultValue: [] }),
    reason: (0, import_fields41.text)({ access: agentFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    requestedBy: requiredRelationship("User"),
    approvedBy: (0, import_fields41.relationship)({ ref: "User", access: controlledAgentApprovalAccess }),
    approvedAt: (0, import_fields41.timestamp)({ access: controlledAgentApprovalAccess }),
    startsAt: (0, import_fields41.timestamp)(),
    expiresAt: (0, import_fields41.timestamp)(),
    suspendedAt: (0, import_fields41.timestamp)(),
    revokedAt: (0, import_fields41.timestamp)(),
    actions: readOnlyRelationship("AgentAction.grant", true),
    ...trackingFields
  }
});
var AgentAction = (0, import_core20.list)({
  db: uniqueConstraints(["firmId", "actionNumber"]),
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadAgentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["actionNumber", "actionType", "status", "riskLevel", "agentPrincipal", "matter"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields41.relationship)({ ref: "Matter" }),
    agentPrincipal: requiredRelationship("AgentPrincipal.actions"),
    grant: requiredRelationship("AgentGrant.actions"),
    actionNumber: (0, import_fields41.text)({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields41.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    actionType: (0, import_fields41.select)({ type: "string", options: capabilityOptions, validation: { isRequired: true } }),
    status: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Awaiting approval", value: "awaiting_approval" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
        { label: "Executing", value: "executing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true }
    }),
    riskLevel: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "High", value: "high" },
        { label: "Financial", value: "financial" },
        { label: "Access control", value: "access_control" }
      ],
      defaultValue: "high",
      validation: { isRequired: true }
    }),
    requestDigest: (0, import_fields41.text)({ validation: { isRequired: true } }),
    requestEnvelope: (0, import_fields41.json)({ access: agentFieldAccess }),
    requiresApproval: (0, import_fields41.checkbox)({ defaultValue: true }),
    requestedByUser: (0, import_fields41.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields41.relationship)({ ref: "User" }),
    approvalDigest: (0, import_fields41.text)(),
    approvalExpiresAt: (0, import_fields41.timestamp)(),
    reviewedAt: (0, import_fields41.timestamp)(),
    rejectionReason: (0, import_fields41.text)({ access: agentFieldAccess }),
    contact: (0, import_fields41.relationship)({ ref: "Contact" }),
    intake: (0, import_fields41.relationship)({ ref: "Intake" }),
    document: (0, import_fields41.relationship)({ ref: "Document" }),
    invoice: (0, import_fields41.relationship)({ ref: "Invoice" }),
    payment: (0, import_fields41.relationship)({ ref: "Payment" }),
    trustTransaction: (0, import_fields41.relationship)({ ref: "TrustTransaction" }),
    deadline: (0, import_fields41.relationship)({ ref: "Deadline" }),
    task: (0, import_fields41.relationship)({ ref: "LegalTask" }),
    startedAt: (0, import_fields41.timestamp)(),
    completedAt: (0, import_fields41.timestamp)(),
    resultDigest: (0, import_fields41.text)(),
    resultEnvelope: (0, import_fields41.json)({ access: agentFieldAccess }),
    errorMessage: (0, import_fields41.text)({ access: agentFieldAccess }),
    events: readOnlyRelationship("AgentActionEvent.action", true),
    ...trackingFields
  }
});
var AgentActionEvent = (0, import_core20.list)({
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll
    },
    filter: {
      query: rules.canReadAgentRecord,
      update: () => false,
      delete: () => false
    }
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["action", "eventType", "fromStatus", "toStatus", "actorUser", "occurredAt"] }
  },
  fields: {
    firm: firmRelationship(),
    matter: (0, import_fields41.relationship)({ ref: "Matter" }),
    action: requiredRelationship("AgentAction.events"),
    eventType: (0, import_fields41.text)({ validation: { isRequired: true } }),
    fromStatus: (0, import_fields41.text)(),
    toStatus: (0, import_fields41.text)(),
    actorUser: (0, import_fields41.relationship)({ ref: "User" }),
    actorAgent: (0, import_fields41.relationship)({ ref: "AgentPrincipal.actionEvents" }),
    reason: (0, import_fields41.text)({ access: agentFieldAccess }),
    occurredAt: (0, import_fields41.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: (0, import_fields41.json)({
      access: agentFieldAccess,
      ui: { description: "Bounded action evidence; never privileged content or credential material." }
    }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var modelDefinitions = {
  User,
  Role,
  Firm,
  Office,
  FirmMembership,
  ApiKey,
  OAuthClient,
  OAuthConsent,
  OAuthToken,
  Contact,
  Address,
  ContactMethod,
  Intake,
  IntakeParticipant,
  IntakeSubmission,
  Consultation,
  ConflictCheck,
  ConflictSearchTerm,
  ConflictMatch,
  ConflictDisposition,
  PracticeArea,
  Matter,
  MatterParty,
  MatterTeamMember,
  EthicalWall,
  EthicalWallMember,
  MatterStatusEvent,
  Court,
  Docket,
  DocketEntry,
  Deadline,
  LegalTask,
  CommunicationThread,
  CommunicationParticipant,
  CommunicationMessage,
  CommunicationDelivery,
  Document,
  DocumentVersion,
  SignatureRequest,
  DocumentSigner,
  SignatureEvent,
  RateCard,
  RateRule,
  TimeEntry,
  Expense,
  RetainerAgreement,
  Invoice,
  InvoiceLine,
  TrustAccount,
  TrustLedgerAccount,
  TrustTransaction,
  TrustLedgerEntry,
  TrustBalanceSnapshot,
  TrustReconciliation,
  Payment,
  PaymentAllocation,
  Refund,
  PortalAccount,
  PortalMatterAccess,
  PortalShare,
  PortalSession,
  PortalDiscoveryPolicy,
  PortalGrantIntent,
  IntegrationConnection,
  ExternalRecordLink,
  WebhookSubscription,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  RetentionPolicy,
  RetentionHold,
  RetentionAction,
  AuditEvent,
  AgentPrincipal,
  AgentCredential,
  AgentGrant,
  AgentAction,
  AgentActionEvent,
  PublicSitePolicy,
  AttorneyProfile
};
var models = Object.fromEntries(
  Object.entries(modelDefinitions).map(([key, model]) => [
    key,
    {
      ...model,
      graphql: { maxTake: 100, ...model.graphql }
    }
  ])
);

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/workflow-helpers.ts
var import_node_crypto6 = require("node:crypto");
function requirePermission(context, permission, options = {}) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!session?.itemId || !firmId || options.humanOnly && !isInteractiveHumanSession(session) || !permissions[permission]({ session })) {
    throw new Error(`Permission ${permission} is required in an active firm.`);
  }
  return { session, firmId, userId: session.itemId };
}
function boundedReason(value, label = "Reason", minimum = 3, maximum = 2e3) {
  const reason = value?.trim();
  if (!reason || reason.length < minimum || reason.length > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum} characters.`);
  }
  return reason;
}
function optionalBoundedText(value, label, maximum = 2e3) {
  const text23 = value?.trim() || null;
  if (text23 && text23.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return text23;
}
function workflowActor(context, userId) {
  const session = context.session;
  return {
    actorUserId: userId,
    actorAgentId: session?.agentPrincipalId ?? null,
    actorType: session?.agentPrincipalId ? "agent" : session?.authenticationType && session.authenticationType !== "human" ? session.authenticationType : "user"
  };
}
async function assertMatterAccess(prisma, firmId, matterId, userId) {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      ...accessibleMatterStorageWhere(firmId, userId)
    },
    select: { id: true }
  });
  if (!matter) throw new Error("Matter access is not explicitly granted in the active firm.");
}
async function assertMatterTeamCapability(prisma, firmId, matterId, userId, capability) {
  const grant = await prisma.matterTeamMember.findFirst({
    where: { firmId, matterId, userId, status: "active", [capability]: true },
    select: { id: true }
  });
  if (!grant) {
    throw new Error(capability === "canBill" ? "Matter billing authority is not explicitly granted to this team member." : "Matter editing authority is not explicitly granted to this team member.");
  }
}
async function recordAuditEvent(tx, data) {
  await tx.auditEvent.create({
    data: {
      firmId: data.firmId,
      eventId: (0, import_node_crypto6.randomUUID)(),
      eventType: data.eventType,
      category: data.category,
      outcome: data.outcome ?? "succeeded",
      actorUserId: data.actorUserId ?? null,
      actorAgentId: data.actorAgentId ?? null,
      actorType: data.actorType ?? (data.actorAgentId ? "agent" : "user"),
      matterId: data.matterId ?? null,
      contactId: data.contactId ?? null,
      intakeId: data.intakeId ?? null,
      documentId: data.documentId ?? null,
      invoiceId: data.invoiceId ?? null,
      paymentId: data.paymentId ?? null,
      trustTransactionId: data.trustTransactionId ?? null,
      agentActionId: data.agentActionId ?? null,
      occurredAt: /* @__PURE__ */ new Date(),
      metadata: data.metadata ?? null
    }
  });
}

// features/keystone/mutations/accessWorkflows.ts
var teamRoles = /* @__PURE__ */ new Set([
  "responsible_attorney",
  "attorney",
  "paralegal",
  "assistant",
  "billing",
  "observer"
]);
async function synchronizeMatterBlocks(tx, matterId, userIds) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return /* @__PURE__ */ new Set();
  const activeBlocks = await tx.ethicalWallMember.findMany({
    where: {
      matterId,
      userId: { in: uniqueUserIds },
      status: "active",
      decision: "blocked",
      wall: { status: "active" }
    },
    select: { userId: true },
    distinct: ["userId"]
  });
  const blockedUserIds = new Set(activeBlocks.map((member) => member.userId));
  await tx.matter.update({
    where: { id: matterId },
    data: {
      blockedUsers: {
        connect: uniqueUserIds.filter((userId) => blockedUserIds.has(userId)).map((id2) => ({ id: id2 })),
        disconnect: uniqueUserIds.filter((userId) => !blockedUserIds.has(userId)).map((id2) => ({ id: id2 }))
      }
    }
  });
  return blockedUserIds;
}
async function setMatterTeamAccess(_root, args, context) {
  const { firmId, userId: actorUserId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  if (!teamRoles.has(args.teamRole) || !(/* @__PURE__ */ new Set(["active", "removed"])).has(args.status)) {
    throw new Error("Matter team role or status is invalid.");
  }
  const reason = boundedReason(args.reason, "Matter team access reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${firmId}:${args.matterId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${args.matterId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${args.matterId} AND firm = ${firmId} FOR SHARE`;
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, confidentiality: true } });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, actorUserId);
    const target = await tx.user.findFirst({
      where: {
        id: args.userId,
        status: "active",
        firmMemberships: { some: { firmId, status: "active", role: { status: "active" } } }
      },
      select: { id: true }
    });
    if (!target) throw new Error("Matter team user must be an active member of the selected firm.");
    const existing = await tx.matterTeamMember.findUnique({
      where: { matterId_userId: { matterId: matter.id, userId: target.id } }
    });
    const now = /* @__PURE__ */ new Date();
    const willGrantRestrictedAccess = args.status === "active" && Boolean(args.canAccessRestricted);
    const currentlyGrantsRestrictedAccess = existing?.status === "active" && existing.canAccessRestricted;
    if (matter.confidentiality === "restricted" && currentlyGrantsRestrictedAccess && !willGrantRestrictedAccess) {
      let viable = false;
      let after;
      for (let page = 0; page < 32 && !viable; page++) {
        const candidates = await tx.matterTeamMember.findMany({
          where: { firmId, matterId: matter.id, status: "active", canAccessRestricted: true, userId: { not: target.id }, ...after ? { id: { gt: after } } : {} },
          select: { id: true, userId: true },
          orderBy: { id: "asc" },
          take: 32
        });
        for (const candidate of candidates) {
          const current = await lockCurrentFirmMember(tx, candidate.userId, firmId);
          if (!current || !permissions.canReadMatters({ session: current }) || !permissions.canManageMatters({ session: current })) continue;
          viable = Boolean(await tx.matter.findFirst({ where: { id: matter.id, ...accessibleMatterStorageWhere(firmId, candidate.userId) }, select: { id: true } }));
          if (viable) break;
        }
        if (candidates.length < 32) break;
        after = candidates[candidates.length - 1].id;
      }
      if (!viable) throw new Error("A restricted matter must retain a current authorized access steward. Request a reviewed recovery if none is available.");
    }
    const data = {
      firmId,
      matterId: matter.id,
      userId: target.id,
      teamRole: args.teamRole,
      status: args.status,
      canAccessRestricted: args.status === "active" && Boolean(args.canAccessRestricted),
      canEdit: args.status === "active" && Boolean(args.canEdit),
      canBill: args.status === "active" && Boolean(args.canBill),
      removedAt: args.status === "removed" ? now : null
    };
    const member = existing ? await tx.matterTeamMember.update({ where: { id: existing.id }, data }) : await tx.matterTeamMember.create({ data: { ...data, assignedAt: now } });
    const grantsRestrictedAccess = member.status === "active" && member.canAccessRestricted;
    await tx.matter.update({
      where: { id: matter.id },
      data: {
        authorizedUsers: grantsRestrictedAccess ? { connect: { id: target.id } } : { disconnect: { id: target.id } }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: grantsRestrictedAccess ? "matter.team_access_granted" : "matter.team_access_removed",
      category: "authorization",
      actorUserId,
      matterId: matter.id,
      metadata: {
        matterTeamMemberId: member.id,
        targetUserId: target.id,
        teamRole: member.teamRole,
        canAccessRestricted: member.canAccessRestricted,
        canEdit: member.canEdit,
        canBill: member.canBill,
        reasonDigest: sha256Digest(reason)
      }
    });
    return member;
  });
}
async function setEthicalWallMember(_root, args, context) {
  const { firmId, userId: actorUserId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["allowed", "blocked"])).has(args.decision) || !(/* @__PURE__ */ new Set(["active", "revoked"])).has(args.status)) {
    throw new Error("Ethical-wall member decision or status is invalid.");
  }
  const reason = boundedReason(args.reason, "Ethical-wall member reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-member:${firmId}:${args.wallId}:${args.userId}`}))`;
    const wall = await tx.ethicalWall.findFirst({
      where: { id: args.wallId, firmId },
      select: { id: true, matterId: true, status: true }
    });
    if (!wall || wall.status === "lifted") throw new Error("Current ethical wall was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${wall.matterId}`}))`;
    await assertMatterAccess(tx, firmId, wall.matterId, actorUserId);
    const target = await tx.user.findFirst({
      where: {
        id: args.userId,
        status: "active",
        firmMemberships: { some: { firmId, status: "active", role: { status: "active" } } }
      },
      select: { id: true }
    });
    if (!target) throw new Error("Ethical-wall user must be an active member of the selected firm.");
    const existing = await tx.ethicalWallMember.findUnique({
      where: { wallId_userId: { wallId: wall.id, userId: target.id } }
    });
    const now = /* @__PURE__ */ new Date();
    const data = {
      firmId,
      matterId: wall.matterId,
      wallId: wall.id,
      userId: target.id,
      decision: args.decision,
      status: args.status,
      approvedById: actorUserId,
      reason,
      effectiveAt: now,
      revokedAt: args.status === "revoked" ? now : null
    };
    const member = existing ? await tx.ethicalWallMember.update({ where: { id: existing.id }, data }) : await tx.ethicalWallMember.create({ data });
    const blockedUserIds = await synchronizeMatterBlocks(tx, wall.matterId, [target.id]);
    const blocked = blockedUserIds.has(target.id);
    await recordAuditEvent(tx, {
      firmId,
      eventType: "ethical_wall.member_access_updated",
      category: "authorization",
      actorUserId,
      matterId: wall.matterId,
      metadata: {
        ethicalWallId: wall.id,
        ethicalWallMemberId: member.id,
        targetUserId: target.id,
        decision: member.decision,
        status: member.status,
        effectiveBlocked: blocked,
        reasonDigest: sha256Digest(reason)
      }
    });
    return member;
  });
}
async function transitionEthicalWall(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["active", "lifted"])).has(args.toStatus)) throw new Error("Ethical-wall status is invalid.");
  const reason = boundedReason(args.reason, "Ethical-wall transition reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall:${firmId}:${args.wallId}`}))`;
    const wall = await tx.ethicalWall.findFirst({ where: { id: args.wallId, firmId } });
    if (!wall) throw new Error("Ethical wall was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${wall.matterId}`}))`;
    await assertMatterAccess(tx, firmId, wall.matterId, userId);
    if (wall.status === args.toStatus) return { wall, replayed: true };
    assertLifecycleTransition("ethicalWall", wall.status, args.toStatus);
    const members = await tx.ethicalWallMember.findMany({
      where: { wallId: wall.id },
      select: { userId: true, status: true, decision: true }
    });
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.ethicalWall.update({
      where: { id: wall.id },
      data: {
        status: args.toStatus,
        approvedById: args.toStatus === "active" ? userId : wall.approvedById,
        effectiveAt: args.toStatus === "active" ? now : wall.effectiveAt,
        liftedAt: args.toStatus === "lifted" ? now : null
      }
    });
    const affectedUserIds = members.map((member) => member.userId);
    const blockedUserIds = await synchronizeMatterBlocks(tx, wall.matterId, affectedUserIds);
    await recordAuditEvent(tx, {
      firmId,
      eventType: `ethical_wall.${args.toStatus}`,
      category: "authorization",
      actorUserId: userId,
      matterId: wall.matterId,
      metadata: {
        ethicalWallId: wall.id,
        fromStatus: wall.status,
        blockedUserCount: blockedUserIds.size,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { wall: updated, replayed: false };
  });
}

// features/keystone/mutations/agentActions.ts
var import_node_crypto7 = require("node:crypto");
var actionPermission = {
  "matter.read": "canReadMatters",
  "privileged.read": "canReadMatters",
  "task.draft": "canManageTasks",
  "communication.send": "canManageCommunications",
  "document.publish": "canManageDocuments",
  "signature.send": "canManageDocuments",
  "matter.transition": "canManageMatters",
  "conflict.resolve": "canResolveConflicts",
  "invoice.issue": "canManageBilling",
  "billing.write": "canManageBilling",
  "payment.capture": "canManagePayments",
  "payment.refund": "canManagePayments",
  "trust.post": "canManageTrust",
  "retention.dispose": "canManageRetention",
  "access.change": "canManageRoles"
};
function boundedText(value, label, min, max) {
  const text23 = value?.trim();
  if (!text23 || text23.length < min || text23.length > max) {
    throw new Error(`${label} must be between ${min} and ${max} characters.`);
  }
  return text23;
}
async function assertMatterAccess2(prisma, firmId, matterId, userId) {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      firmId,
      AND: [
        {
          OR: [
            { confidentiality: { not: "restricted" } },
            {
              teamMembers: {
                some: { userId, status: "active", canAccessRestricted: true }
              }
            }
          ]
        },
        {
          NOT: {
            ethicalWalls: {
              some: {
                status: "active",
                members: { some: { userId, status: "active", decision: "blocked" } }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  });
  if (!matter) throw new Error("Matter access is not explicitly granted in the active firm.");
}
var targetDefinitions = [
  ["contactId", "contact", false],
  ["intakeId", "intake", false],
  ["documentId", "document", true],
  ["invoiceId", "invoice", true],
  ["paymentId", "payment", true],
  ["trustTransactionId", "trustTransaction", false],
  ["deadlineId", "deadline", true],
  ["taskId", "legalTask", true]
];
async function assertTargets(prisma, firmId, matterId, data) {
  for (const [inputKey, model, hasMatter] of targetDefinitions) {
    const id2 = data[inputKey];
    if (!id2) continue;
    const item = await prisma[model].findFirst({
      where: { id: id2, firmId },
      select: hasMatter ? { id: true, matterId: true } : { id: true }
    });
    if (!item) throw new Error(`Agent action target ${inputKey} was not found in the active firm.`);
    if (hasMatter && item.matterId && item.matterId !== matterId) {
      throw new Error(`Agent action target ${inputKey} does not belong to the requested matter.`);
    }
  }
}
function requestEnvelope(value) {
  if (value === void 0 || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized.length > 5e4) throw new Error("Agent action request envelope exceeds the size limit.");
  return value;
}
function computeAgentRequestDigest(data) {
  const request = Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "idempotencyKey")
  );
  return sha256Digest(request);
}
async function requestAgentAction(_root, { data }, context) {
  const session = context.session;
  const firmId = activeFirmId(session);
  const isAgent = session?.authenticationType === "agent";
  if (!firmId || !session?.itemId) {
    throw new Error("You do not have permission to request agent actions.");
  }
  if (isAgent) {
    if (session.agentPrincipalId !== data.agentPrincipalId || !session.agentCapabilities?.includes(data.actionType)) {
      throw new Error("The authenticated agent credential does not cover this action.");
    }
  } else if (session.authenticationType && session.authenticationType !== "human" || !permissions.canManageAgents({ session })) {
    throw new Error("You do not have permission to request agent actions.");
  }
  const idempotencyKey3 = boundedText(data.idempotencyKey, "Idempotency key", 12, 160);
  const requiredPermission = actionPermission[data.actionType];
  if (!requiredPermission) throw new Error("Unsupported agent action type.");
  if (!isAgent && !permissions[requiredPermission]({ session })) {
    throw new Error("You lack the domain permission required for this agent action.");
  }
  const envelope2 = requestEnvelope(data.requestEnvelope);
  const requestDigest = computeAgentRequestDigest({ ...data, requestEnvelope: envelope2 });
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma);
  const now = /* @__PURE__ */ new Date();
  const [principal, grant] = await Promise.all([
    prisma.agentPrincipal.findFirst({
      where: { id: data.agentPrincipalId, firmId, status: "active" },
      select: { id: true }
    }),
    prisma.agentGrant.findFirst({
      where: { id: data.grantId, firmId, agentPrincipalId: data.agentPrincipalId },
      select: {
        id: true,
        status: true,
        matterId: true,
        capabilities: true,
        startsAt: true,
        expiresAt: true
      }
    })
  ]);
  if (!principal) throw new Error("Active agent principal not found in the active firm.");
  if (!grant) throw new Error("Agent grant not found for the selected principal and firm.");
  if (grant.startsAt && grant.startsAt.getTime() > now.getTime()) throw new Error("Agent grant is not yet active.");
  const capabilities = Array.isArray(grant.capabilities) ? grant.capabilities.filter((value) => typeof value === "string") : [];
  const authorization = authorizeAgentAction({
    now,
    activeFirmId: firmId,
    matterId: data.matterId ?? null,
    actionType: data.actionType,
    requestDigest,
    grant: {
      status: grant.status,
      firmId,
      matterId: grant.matterId,
      capabilities,
      expiresAt: grant.expiresAt?.toISOString() ?? null
    }
  });
  if (!authorization.allowed && !authorization.requiresApproval) {
    throw new Error(authorization.reason ?? "Agent action is not authorized by its grant.");
  }
  if (data.matterId) {
    await assertMatterAccess2(prisma, firmId, data.matterId, session.itemId);
  }
  await assertTargets(prisma, firmId, data.matterId ?? null, data);
  const storedIdempotencyKey = `${firmId}:${idempotencyKey3}`;
  const status = authorization.requiresApproval ? "awaiting_approval" : "approved";
  const riskLevel = authorization.requiresApproval ? ["trust.post", "payment.capture", "payment.refund"].includes(data.actionType) ? "financial" : data.actionType === "access.change" ? "access_control" : "high" : "low";
  return runSerializableTransaction(prisma, async (tx) => {
    if (isAgent) await assertCurrentAgentCredential(tx, context, data.actionType);
    else {
      await assertCurrentCommandActor(tx, context, "canManageAgents");
      await assertCurrentCommandActor(tx, context, requiredPermission);
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storedIdempotencyKey}))`;
    const replay = await tx.agentAction.findUnique({ where: { idempotencyKey: storedIdempotencyKey } });
    if (replay) {
      if (replay.requestDigest !== requestDigest) {
        throw new Error("Idempotency key was already used for a different agent request.");
      }
      return { action: replay, replayed: true };
    }
    const [currentPrincipal, currentGrant] = await Promise.all([
      tx.agentPrincipal.findFirst({
        where: { id: principal.id, firmId, status: "active" },
        select: { id: true }
      }),
      tx.agentGrant.findFirst({
        where: { id: grant.id, firmId, agentPrincipalId: principal.id },
        select: {
          id: true,
          status: true,
          matterId: true,
          capabilities: true,
          startsAt: true,
          expiresAt: true
        }
      })
    ]);
    if (!currentPrincipal || !currentGrant || currentGrant.startsAt && currentGrant.startsAt > now) {
      throw new Error("The agent principal or grant is no longer active.");
    }
    const currentCapabilities = Array.isArray(currentGrant.capabilities) ? currentGrant.capabilities.filter((value) => typeof value === "string") : [];
    const currentAuthorization = authorizeAgentAction({
      now,
      activeFirmId: firmId,
      matterId: data.matterId ?? null,
      actionType: data.actionType,
      requestDigest,
      grant: {
        status: currentGrant.status,
        firmId,
        matterId: currentGrant.matterId,
        capabilities: currentCapabilities,
        expiresAt: currentGrant.expiresAt?.toISOString() ?? null
      }
    });
    if (!currentAuthorization.allowed && !currentAuthorization.requiresApproval) {
      throw new Error(currentAuthorization.reason ?? "The agent grant is no longer valid for this request.");
    }
    const action = await tx.agentAction.create({
      data: {
        firmId,
        matterId: data.matterId ?? null,
        agentPrincipalId: principal.id,
        grantId: grant.id,
        actionNumber: `AGENT-${(0, import_node_crypto7.randomUUID)().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: storedIdempotencyKey,
        actionType: data.actionType,
        status,
        riskLevel,
        requestDigest,
        requestEnvelope: envelope2,
        requiresApproval: authorization.requiresApproval,
        requestedByUserId: isAgent ? null : session.itemId,
        contactId: data.contactId ?? null,
        intakeId: data.intakeId ?? null,
        documentId: data.documentId ?? null,
        invoiceId: data.invoiceId ?? null,
        paymentId: data.paymentId ?? null,
        trustTransactionId: data.trustTransactionId ?? null,
        deadlineId: data.deadlineId ?? null,
        taskId: data.taskId ?? null
      }
    });
    await tx.agentActionEvent.create({
      data: {
        firmId,
        matterId: data.matterId ?? null,
        actionId: action.id,
        eventType: authorization.requiresApproval ? "agent_action.awaiting_approval" : "agent_action.auto_approved",
        fromStatus: "requested",
        toStatus: status,
        actorUserId: isAgent ? null : session.itemId,
        actorAgentId: isAgent ? principal.id : null,
        reason: authorization.requiresApproval ? "Human approval required by action policy." : "Low-risk action authorized by active grant.",
        occurredAt: now,
        metadata: { actionType: data.actionType, requestDigest }
      }
    });
    return { action, replayed: false };
  });
}
async function reviewAgentAction(_root, args, context) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || session.authenticationType && session.authenticationType !== "human" || !permissions.canApproveAgentActions({ session })) {
    throw new Error("You do not have permission to review agent actions.");
  }
  if (!["approve", "reject"].includes(args.decision)) {
    throw new Error("Decision must be approve or reject.");
  }
  const reason = boundedText(args.reason, "Review reason", 3, 2e3);
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma);
  const action = await prisma.agentAction.findFirst({
    where: { id: args.actionId, firmId },
    select: {
      id: true,
      matterId: true,
      actionType: true,
      status: true,
      requestDigest: true,
      agentPrincipalId: true,
      requiresApproval: true
    }
  });
  if (!action) throw new Error("Agent action not found in the active firm.");
  const isReplay = action.status === "approved" || action.status === "rejected";
  if (!isReplay && (action.status !== "awaiting_approval" || !action.requiresApproval)) {
    throw new Error("Agent action is not awaiting human approval.");
  }
  const requiredPermission = actionPermission[action.actionType];
  if (!requiredPermission || !permissions[requiredPermission]({ session })) {
    throw new Error("The reviewer lacks the required domain permission for this action.");
  }
  if (action.matterId) await assertMatterAccess2(prisma, firmId, action.matterId, session.itemId);
  const now = /* @__PURE__ */ new Date();
  let approvalExpiresAt = null;
  if (args.decision === "approve") {
    approvalExpiresAt = args.approvalExpiresAt ? new Date(args.approvalExpiresAt) : new Date(now.getTime() + 15 * 6e4);
    if (Number.isNaN(approvalExpiresAt.getTime()) || approvalExpiresAt <= now || approvalExpiresAt.getTime() > now.getTime() + 24 * 60 * 6e4) {
      throw new Error("Approval expiration must be in the next 24 hours.");
    }
  }
  const approvalDigest = args.decision === "approve" ? computeAgentApprovalDigest({
    actionId: action.id,
    actionType: action.actionType,
    matterId: action.matterId,
    requestDigest: action.requestDigest,
    approvalExpiresAt
  }) : "";
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, requiredPermission);
    if (action.matterId) await assertMatterAccess2(tx, firmId, action.matterId, session.itemId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${action.id}))`;
    const current = await tx.agentAction.findUnique({ where: { id: action.id } });
    if (current.status === "approved" || current.status === "rejected") {
      if (current.status !== (args.decision === "approve" ? "approved" : "rejected")) throw new Error("The action already has a different review decision.");
      return { action: current, replayed: true };
    }
    if (current.status !== "awaiting_approval") {
      throw new Error("Agent action is no longer awaiting approval.");
    }
    const [currentPrincipal, currentGrant] = await Promise.all([
      tx.agentPrincipal.findFirst({
        where: { id: current.agentPrincipalId, firmId, status: "active" },
        select: { id: true }
      }),
      tx.agentGrant.findFirst({
        where: {
          id: current.grantId,
          firmId,
          agentPrincipalId: current.agentPrincipalId
        },
        select: {
          status: true,
          matterId: true,
          capabilities: true,
          startsAt: true,
          expiresAt: true
        }
      })
    ]);
    if (!currentPrincipal || !currentGrant || currentGrant.startsAt && currentGrant.startsAt > now) {
      throw new Error("The agent principal or grant is no longer active.");
    }
    const currentCapabilities = Array.isArray(currentGrant.capabilities) ? currentGrant.capabilities.filter((value) => typeof value === "string") : [];
    const currentAuthorization = authorizeAgentAction({
      now,
      activeFirmId: firmId,
      matterId: current.matterId,
      actionType: current.actionType,
      requestDigest: current.requestDigest,
      grant: {
        status: currentGrant.status,
        firmId,
        matterId: currentGrant.matterId,
        capabilities: currentCapabilities,
        expiresAt: currentGrant.expiresAt?.toISOString() ?? null
      }
    });
    if (!currentAuthorization.allowed && !currentAuthorization.requiresApproval) {
      throw new Error(currentAuthorization.reason ?? "The agent grant is no longer valid for this request.");
    }
    const nextStatus = args.decision === "approve" ? "approved" : "rejected";
    const reviewed = await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: nextStatus,
        approvedById: args.decision === "approve" ? session.itemId : null,
        approvalDigest,
        approvalExpiresAt,
        reviewedAt: now,
        rejectionReason: args.decision === "reject" ? reason : ""
      }
    });
    await tx.agentActionEvent.create({
      data: {
        firmId,
        matterId: action.matterId,
        actionId: action.id,
        eventType: `agent_action.${nextStatus}`,
        fromStatus: "awaiting_approval",
        toStatus: nextStatus,
        actorUserId: session.itemId,
        reason,
        occurredAt: now,
        metadata: {
          actionType: action.actionType,
          requestDigest: action.requestDigest,
          approvalDigest: approvalDigest || null,
          approvalExpiresAt: approvalExpiresAt?.toISOString() ?? null
        }
      }
    });
    return { action: reviewed, replayed: false };
  });
}

// features/keystone/mutations/billingWorkflows.ts
var import_node_crypto8 = require("node:crypto");

// features/keystone/lib/int32.ts
var GRAPHQL_INT_MIN = -2147483648;
var GRAPHQL_INT_MAX = 2147483647;
function isGraphqlInt(value) {
  return Number.isInteger(value) && value >= GRAPHQL_INT_MIN && value <= GRAPHQL_INT_MAX;
}

// features/keystone/mutations/billingWorkflows.ts
function idempotencyKey(value) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) {
    throw new Error("Idempotency key must be between 12 and 160 characters.");
  }
  return key;
}
function timestamp20(value, label) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return parsed;
}
async function lineTotals(tx, invoiceId) {
  const [count, totals] = await Promise.all([
    tx.invoiceLine.count({ where: { invoiceId } }),
    tx.invoiceLine.aggregate({
      where: { invoiceId },
      _sum: {
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        lineTotalMinor: true
      }
    })
  ]);
  return { count, totals: totals._sum };
}
async function transitionInvoice(_root, args, context) {
  assertCommandTarget("invoice", args.toStatus, ["approved", "issued", "overdue", "void"]);
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const reason = args.toStatus === "void" ? boundedReason(args.reason, "Invoice void reason", 5, 2e3) : optionalBoundedText(args.reason, "Invoice transition reason", 2e3);
  const dueAt = timestamp20(args.dueAt, "Invoice due date");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${firmId}:${args.invoiceId}`}))`;
    const invoice = await tx.invoice.findFirst({
      where: { id: args.invoiceId, firmId },
      include: { lines: { select: { id: true, timeEntryId: true, expense: { select: { id: true } } } } }
    });
    if (!invoice) throw new Error("Invoice was not found in the active firm.");
    await assertMatterAccess(tx, firmId, invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
    if (invoice.status === args.toStatus) return { invoice, replayed: true };
    assertLifecycleTransition("invoice", invoice.status, args.toStatus);
    const { count, totals } = await lineTotals(tx, invoice.id);
    const timeIds = invoice.lines.flatMap((line) => line.timeEntryId ? [line.timeEntryId] : []);
    const expenseIds = invoice.lines.flatMap((line) => line.expense?.id ? [line.expense.id] : []);
    if (["approved", "issued"].includes(args.toStatus)) {
      if (!count) throw new Error("Invoice approval requires at least one immutable line snapshot.");
      if (![totals.subtotalMinor, totals.discountMinor, totals.taxMinor, totals.lineTotalMinor, invoice.subtotalMinor, invoice.discountMinor, invoice.taxMinor, invoice.totalMinor].every((value) => isGraphqlInt(value ?? 0)) || (totals.subtotalMinor ?? 0) !== invoice.subtotalMinor || (totals.discountMinor ?? 0) !== invoice.discountMinor || (totals.taxMinor ?? 0) !== invoice.taxMinor || (totals.lineTotalMinor ?? 0) !== invoice.totalMinor || invoice.totalMinor !== invoice.subtotalMinor - invoice.discountMinor + invoice.taxMinor) {
        throw new Error("Invoice totals must exactly match immutable line snapshots.");
      }
      const [billableTimeCount, billableExpenseCount] = await Promise.all([
        timeIds.length ? tx.timeEntry.count({ where: { id: { in: timeIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true } }) : 0,
        expenseIds.length ? tx.expense.count({ where: { id: { in: expenseIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true } }) : 0
      ]);
      if (billableTimeCount !== timeIds.length || billableExpenseCount !== expenseIds.length) {
        throw new Error("Every invoice source must remain approved, billable, and scoped to the invoice matter.");
      }
    }
    const now = /* @__PURE__ */ new Date();
    const data = { status: args.toStatus };
    if (args.toStatus === "issued") {
      const effectiveDueAt = dueAt ?? invoice.dueAt;
      if (!effectiveDueAt || effectiveDueAt < now) {
        throw new Error("Invoice issue requires a current or future due date.");
      }
      const [billedTime, billedExpenses] = await Promise.all([
        timeIds.length ? tx.timeEntry.updateMany({ where: { id: { in: timeIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true }, data: { status: "billed" } }) : { count: 0 },
        expenseIds.length ? tx.expense.updateMany({ where: { id: { in: expenseIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true }, data: { status: "billed" } }) : { count: 0 }
      ]);
      if (billedTime.count !== timeIds.length || billedExpenses.count !== expenseIds.length) {
        throw new Error("Invoice sources changed before issue; the invoice was not issued.");
      }
      Object.assign(data, { issuedAt: now, dueAt: effectiveDueAt });
    }
    if (args.toStatus === "overdue") {
      if (!invoice.dueAt || invoice.dueAt >= now || invoice.balanceDueMinor <= 0) {
        throw new Error("Only an unpaid invoice past its due date can become overdue.");
      }
    }
    if (args.toStatus === "void") {
      const activeAllocations = await tx.paymentAllocation.count({
        where: {
          invoiceId: invoice.id,
          allocationType: "invoice",
          reversalAllocations: { none: {} }
        }
      });
      if (invoice.paidMinor !== 0 || activeAllocations) {
        throw new Error("An invoice with payment allocations must be reversed or refunded before voiding.");
      }
      if (["draft", "approved"].includes(invoice.status)) {
        const lineIds = invoice.lines.map((line) => line.id);
        await tx.invoiceLine.updateMany({
          where: { firmId, invoiceId: invoice.id },
          data: { timeEntryId: null }
        });
        if (lineIds.length) {
          await tx.expense.updateMany({
            where: { firmId, invoiceLineId: { in: lineIds } },
            data: { invoiceLineId: null }
          });
        }
      }
      Object.assign(data, {
        balanceDueMinor: 0,
        voidReason: reason,
        voidedAt: now
      });
    }
    const updated = await tx.invoice.update({ where: { id: invoice.id }, data });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `invoice.${args.toStatus}`,
      category: "financial",
      actorUserId: userId,
      matterId: invoice.matterId,
      invoiceId: invoice.id,
      metadata: {
        fromStatus: invoice.status,
        toStatus: args.toStatus,
        draftSourceReservationsReleased: args.toStatus === "void" && ["draft", "approved"].includes(invoice.status)
      }
    });
    return { invoice: updated, replayed: false };
  });
}
async function transitionPayment(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["cancelled"])).has(args.toStatus)) {
    throw new Error("Payment provider outcomes are unavailable until authenticated provider ingress is configured.");
  }
  const eventId2 = idempotencyKey(args.eventId);
  const providerPaymentId = optionalBoundedText(args.providerPaymentId, "Provider payment ID", 500);
  const failureReason = args.toStatus === "failed" ? boundedReason(args.failureReason, "Payment failure reason", 3, 2e3) : optionalBoundedText(args.failureReason, "Payment failure reason", 2e3);
  const prisma = context.prisma;
  const auditEventId = `payment:${firmId}:${eventId2}`;
  const requestDigest = sha256Digest({
    paymentId: args.paymentId,
    toStatus: args.toStatus,
    providerPaymentId: providerPaymentId ?? null,
    failureReason: failureReason ?? null
  });
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auditEventId}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${firmId}:${args.paymentId}`}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditEventId } });
    const payment = await tx.payment.findFirst({
      where: { id: args.paymentId, firmId },
      include: { invoice: { select: { matterId: true } } }
    });
    if (!payment) throw new Error("Payment was not found in the active firm.");
    if (payment.matterId && payment.invoice?.matterId && payment.matterId !== payment.invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    const matterId = payment.matterId ?? payment.invoice?.matterId ?? null;
    if (matterId) {
      await assertMatterAccess(tx, firmId, matterId, userId);
      await assertMatterTeamCapability(tx, firmId, matterId, userId, "canBill");
    }
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Payment event ID was reused with a different payload.");
      }
      return { payment, replayed: true };
    }
    assertLifecycleTransition("payment", payment.status, args.toStatus);
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: args.toStatus,
        ...providerPaymentId ? { providerPaymentId } : {},
        ...args.toStatus === "authorized" ? { authorizedAt: now } : {},
        ...args.toStatus === "captured" ? { capturedAt: now } : {},
        ...args.toStatus === "settled" ? { settledAt: now } : {},
        ...args.toStatus === "failed" ? { failedAt: now, failureReason } : {}
      }
    });
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditEventId,
        eventType: `payment.${args.toStatus}`,
        category: "financial",
        outcome: args.toStatus === "failed" ? "failed" : "succeeded",
        actorUserId: userId,
        actorType: "user",
        matterId,
        paymentId: payment.id,
        occurredAt: now,
        metadata: { fromStatus: payment.status, toStatus: args.toStatus, requestDigest }
      }
    });
    return { payment: updated, replayed: false };
  });
}
function invoiceStatusAfterPayment(invoice, paidMinor, now) {
  if (paidMinor === invoice.totalMinor) return "paid";
  if (paidMinor > 0) return "partially_paid";
  return invoice.dueAt && invoice.dueAt < now ? "overdue" : "issued";
}
async function allocatePayment(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  if (!isGraphqlInt(args.amountMinor) || args.amountMinor <= 0) {
    throw new Error("Payment allocation amount must be a positive database-range integer minor-unit value.");
  }
  const note = optionalBoundedText(args.note, "Allocation note", 1e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`allocation:${firmId}:${key}`}))`;
    const replay = await tx.paymentAllocation.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        invoice: { select: { matterId: true } },
        payment: { select: { matterId: true } }
      }
    });
    if (replay) {
      if (replay.paymentId !== args.paymentId || replay.invoiceId !== args.invoiceId || replay.amountMinor !== args.amountMinor || replay.allocationType !== "invoice" || replay.note !== (note ?? "")) {
        throw new Error("Payment allocation idempotency key was reused with a different payload.");
      }
      if (!replay.invoice) throw new Error("Payment allocation replay invoice is unavailable.");
      await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      return { allocation: replay, replayed: true };
    }
    const [payment, invoice] = await Promise.all([
      tx.payment.findFirst({ where: { id: args.paymentId, firmId } }),
      tx.invoice.findFirst({ where: { id: args.invoiceId, firmId } })
    ]);
    if (!payment || !invoice) throw new Error("Payment and invoice must exist in the active firm.");
    if (payment.matterId && payment.matterId !== invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    await assertMatterAccess(tx, firmId, invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
    if (!(/* @__PURE__ */ new Set(["captured", "settled"])).has(payment.status)) {
      throw new Error("Only a captured or settled payment can be allocated.");
    }
    if (payment.paymentType !== "operating") {
      throw new Error("Trust deposits require a controlled trust-funds application and cannot use operating payment allocation.");
    }
    if (!(/* @__PURE__ */ new Set(["issued", "partially_paid", "overdue"])).has(invoice.status)) {
      throw new Error("Payment can be allocated only to an open issued invoice.");
    }
    if (payment.currencyCode !== invoice.currencyCode) throw new Error("Payment and invoice currencies must match.");
    const sums = await tx.paymentAllocation.groupBy({
      by: ["allocationType"],
      where: { paymentId: payment.id },
      _sum: { amountMinor: true }
    });
    const allocated = sums.reduce((total, row) => total + (row.allocationType === "reversal" ? -(row._sum.amountMinor ?? 0) : row._sum.amountMinor ?? 0), 0);
    const available = payment.amountMinor - payment.refundedMinor - allocated;
    if (args.amountMinor > available) throw new Error("Payment allocation exceeds the unallocated payment amount.");
    if (args.amountMinor > invoice.balanceDueMinor) throw new Error("Payment allocation exceeds the invoice balance.");
    const now = /* @__PURE__ */ new Date();
    const allocation = await tx.paymentAllocation.create({
      data: {
        firmId,
        matterId: invoice.matterId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        idempotencyKey: key,
        allocationType: "invoice",
        amountMinor: args.amountMinor,
        currencyCode: payment.currencyCode,
        allocatedById: userId,
        allocatedAt: now,
        note: note ?? ""
      }
    });
    const paidMinor = invoice.paidMinor + args.amountMinor;
    const balanceDueMinor = invoice.totalMinor - paidMinor;
    if (!isGraphqlInt(paidMinor) || !isGraphqlInt(balanceDueMinor) || balanceDueMinor < 0) {
      throw new Error("Payment allocation exceeds the invoice integer range.");
    }
    const status = invoiceStatusAfterPayment(invoice, paidMinor, now);
    assertLifecycleTransition("invoice", invoice.status, status);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidMinor,
        balanceDueMinor,
        status,
        ...status === "paid" ? { paidAt: now } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "payment.allocated",
      category: "financial",
      actorUserId: userId,
      matterId: invoice.matterId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      metadata: { allocationId: allocation.id, amountMinor: args.amountMinor, currencyCode: payment.currencyCode }
    });
    return { allocation, replayed: false };
  });
}
async function reversePaymentAllocation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  const reason = boundedReason(args.reason, "Allocation reversal reason", 5, 1e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`allocation:${firmId}:${key}`}))`;
    const replay = await tx.paymentAllocation.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        invoice: { select: { matterId: true } },
        payment: { select: { matterId: true } }
      }
    });
    if (replay) {
      if (replay.reversesAllocationId !== args.allocationId || replay.allocationType !== "reversal" || replay.note !== reason) {
        throw new Error("Allocation reversal idempotency key was reused with a different payload.");
      }
      if (!replay.invoice) throw new Error("Allocation reversal replay invoice is unavailable.");
      await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      return { allocation: replay, replayed: true };
    }
    const original = await tx.paymentAllocation.findFirst({
      where: { id: args.allocationId, firmId, allocationType: "invoice" },
      include: { invoice: true, payment: true, reversalAllocations: true }
    });
    if (!original || !original.invoice || !original.payment) {
      throw new Error("Original invoice allocation was not found in the active firm.");
    }
    if (original.reversalAllocations.length) throw new Error("Payment allocation already has a reversal.");
    await assertMatterAccess(tx, firmId, original.invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, original.invoice.matterId, userId, "canBill");
    const now = /* @__PURE__ */ new Date();
    const reversal = await tx.paymentAllocation.create({
      data: {
        firmId,
        matterId: original.matterId,
        paymentId: original.paymentId,
        invoiceId: original.invoiceId,
        idempotencyKey: key,
        allocationType: "reversal",
        amountMinor: original.amountMinor,
        currencyCode: original.currencyCode,
        allocatedById: userId,
        allocatedAt: now,
        reversesAllocationId: original.id,
        note: reason
      }
    });
    const paidMinor = original.invoice.paidMinor - original.amountMinor;
    if (!isGraphqlInt(paidMinor) || paidMinor < 0) throw new Error("Allocation reversal would make invoice paid amount negative or exceed its supported range.");
    const status = invoiceStatusAfterPayment(original.invoice, paidMinor, now);
    await tx.invoice.update({
      where: { id: original.invoice.id },
      data: {
        paidMinor,
        balanceDueMinor: original.invoice.totalMinor - paidMinor,
        status,
        paidAt: null
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "payment.allocation_reversed",
      category: "financial",
      actorUserId: userId,
      matterId: original.invoice.matterId,
      invoiceId: original.invoice.id,
      paymentId: original.payment.id,
      metadata: { allocationId: original.id, reversalId: reversal.id }
    });
    return { allocation: reversal, replayed: false };
  });
}
var refundReasons = /* @__PURE__ */ new Set(["overpayment", "duplicate", "matter_closed", "client_request", "other"]);
async function requestRefund(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  if (!refundReasons.has(args.reason)) throw new Error("Unsupported refund reason.");
  if (!isGraphqlInt(args.amountMinor) || args.amountMinor <= 0) {
    throw new Error("Refund amount must be a positive database-range integer minor-unit value.");
  }
  const explanation = boundedReason(args.explanation, "Refund explanation", 10, 4e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${firmId}:${key}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-payment:${firmId}:${args.paymentId}`}))`;
    const replay = await tx.refund.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        payment: { select: { matterId: true } },
        invoice: { select: { matterId: true } }
      }
    });
    if (replay) {
      if (replay.paymentId !== args.paymentId || replay.amountMinor !== args.amountMinor || replay.reason !== args.reason || replay.explanation !== explanation) {
        throw new Error("Refund idempotency key was reused with a different payload.");
      }
      if (replay.matterId) {
        await assertMatterAccess(tx, firmId, replay.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.matterId, userId, "canBill");
      }
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      if (replay.invoice?.matterId) {
        await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      }
      return { refund: replay, replayed: true };
    }
    const payment = await tx.payment.findFirst({
      where: { id: args.paymentId, firmId },
      include: { invoice: { select: { matterId: true } } }
    });
    if (!payment || !(/* @__PURE__ */ new Set(["captured", "settled"])).has(payment.status)) {
      throw new Error("Only a captured or settled active-firm payment can be refunded.");
    }
    if (payment.matterId && payment.invoice?.matterId && payment.matterId !== payment.invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    const matterId = payment.matterId ?? payment.invoice?.matterId ?? null;
    if (matterId) {
      await assertMatterAccess(tx, firmId, matterId, userId);
      await assertMatterTeamCapability(tx, firmId, matterId, userId, "canBill");
    }
    const [pending, allocationSums] = await Promise.all([
      tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: ["requested", "approved", "processing"] }
        },
        _sum: { amountMinor: true }
      }),
      tx.paymentAllocation.groupBy({
        by: ["allocationType"],
        where: { paymentId: payment.id },
        _sum: { amountMinor: true }
      })
    ]);
    const allocated = allocationSums.reduce((total, row) => total + (row.allocationType === "reversal" ? -(row._sum.amountMinor ?? 0) : row._sum.amountMinor ?? 0), 0);
    const available = payment.amountMinor - payment.refundedMinor - (pending._sum.amountMinor ?? 0) - allocated;
    if (args.amountMinor > available) {
      throw new Error("Refund requests exceed the unallocated captured payment amount.");
    }
    const refund = await tx.refund.create({
      data: {
        firmId,
        matterId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        refundNumber: `REF-${(0, import_node_crypto8.randomUUID)().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: key,
        status: "requested",
        reason: args.reason,
        amountMinor: args.amountMinor,
        currencyCode: payment.currencyCode,
        explanation,
        requestedById: userId,
        requestedAt: /* @__PURE__ */ new Date()
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "refund.requested",
      category: "financial",
      actorUserId: userId,
      matterId,
      invoiceId: payment.invoiceId,
      paymentId: payment.id,
      metadata: { refundId: refund.id, amountMinor: args.amountMinor, currencyCode: payment.currencyCode }
    });
    return { refund, replayed: false };
  });
}
async function reviewRefund(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["approve", "cancel"])).has(args.decision)) throw new Error("Refund decision is invalid.");
  const reason = boundedReason(args.reason, "Refund review reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${firmId}:${args.refundId}`}))`;
    const refund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      include: { invoice: { select: { matterId: true } } }
    });
    if (!refund) throw new Error("Refund was not found in the active firm.");
    const matterId = refund.matterId ?? refund.invoice?.matterId ?? null;
    if (matterId) await assertMatterAccess(tx, firmId, matterId, userId);
    const target = args.decision === "approve" ? "approved" : "cancelled";
    if (refund.status === target) return { refund, replayed: true };
    if (refund.status !== "requested") throw new Error("Refund is no longer awaiting review.");
    if (args.decision === "approve" && refund.requestedById === userId) {
      throw new Error("Refund approval requires a different human reviewer.");
    }
    assertLifecycleTransition("refund", refund.status, target);
    const now = /* @__PURE__ */ new Date();
    const reviewed = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: target,
        approvedById: args.decision === "approve" ? userId : null,
        approvedAt: args.decision === "approve" ? now : null,
        ...args.decision === "cancel" ? { failureReason: reason } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `refund.${target}`,
      category: "financial",
      actorUserId: userId,
      matterId,
      invoiceId: refund.invoiceId,
      paymentId: refund.paymentId,
      metadata: { refundId: refund.id }
    });
    return { refund: reviewed, replayed: false };
  });
}
async function recordRefundProviderOutcome(_root, args, context) {
  requirePermission(context, "canManagePayments", { humanOnly: true });
  throw new Error("Refund provider outcomes are unavailable until authenticated provider ingress is configured.");
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const eventId2 = idempotencyKey(args.eventId);
  const providerRefundId = optionalBoundedText(args.providerRefundId, "Provider refund ID", 500);
  const failureReason = args.toStatus === "failed" ? boundedReason(args.failureReason, "Refund failure reason", 3, 2e3) : optionalBoundedText(args.failureReason, "Refund failure reason", 2e3);
  const auditEventId = `refund:${firmId}:${eventId2}`;
  const requestDigest = sha256Digest({
    refundId: args.refundId,
    toStatus: args.toStatus,
    providerRefundId: providerRefundId ?? null,
    failureReason: failureReason ?? null
  });
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auditEventId}))`;
    const initialRefund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      select: { paymentId: true }
    });
    if (!initialRefund) throw new Error("Refund was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-payment:${firmId}:${initialRefund.paymentId}`}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditEventId } });
    const refund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      include: { payment: true, trustTransactions: { include: { entries: true } } }
    });
    if (!refund) throw new Error("Refund was not found in the active firm.");
    if (refund.matterId) await assertMatterAccess(tx, firmId, refund.matterId, userId);
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Refund provider event ID was reused with a different payload.");
      }
      return { refund, replayed: true };
    }
    assertLifecycleTransition("refund", refund.status, args.toStatus);
    if (args.toStatus === "succeeded" && refund.payment.paymentType === "trust_deposit") {
      const posting = refund.trustTransactions[0];
      const entryTotal = (bucket, direction) => posting?.entries.reduce(
        (total, entry) => entry.accountingBucket === bucket && entry.direction === direction ? total + entry.amountMinor : total,
        0
      ) ?? 0;
      if (refund.trustTransactions.length !== 1 || posting.transactionType !== "disbursement" || posting.trustAccountId !== refund.payment.trustAccountId || posting.currencyCode !== refund.currencyCode || entryTotal("client_liability", "debit") !== refund.amountMinor || entryTotal("bank_control", "credit") !== refund.amountMinor || entryTotal("client_liability", "credit") !== 0 || entryTotal("bank_control", "debit") !== 0) {
        throw new Error("A successful trust-deposit refund requires its exact posted trust liability disbursement.");
      }
    }
    if (args.toStatus === "succeeded" && refund.payment.refundedMinor + refund.amountMinor > refund.payment.amountMinor) {
      throw new Error("Refund outcome would exceed the captured payment amount.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: args.toStatus,
        providerRefundId: providerRefundId ?? "",
        processedAt: args.toStatus === "processing" ? null : now,
        failureReason: args.toStatus === "failed" ? failureReason : ""
      }
    });
    if (args.toStatus === "succeeded") {
      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { refundedMinor: { increment: refund.amountMinor } }
      });
    }
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditEventId,
        eventType: `refund.${args.toStatus}`,
        category: "financial",
        outcome: args.toStatus === "failed" ? "failed" : "succeeded",
        actorUserId: userId,
        actorType: "user",
        matterId: refund.matterId,
        invoiceId: refund.invoiceId,
        paymentId: refund.paymentId,
        occurredAt: now,
        metadata: { refundId: refund.id, requestDigest }
      }
    });
    return { refund: updated, replayed: false };
  });
}
var manualPaymentMethods = /* @__PURE__ */ new Set(["check", "ach", "wire", "cash", "card", "other"]);
async function recordManualPayment(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  if (!manualPaymentMethods.has(args.method)) throw new Error("Unsupported payment method.");
  if (!isGraphqlInt(args.amountMinor) || args.amountMinor <= 0) {
    throw new Error("Payment amount must be a positive database-range integer minor-unit value.");
  }
  const currencyCode = String(args.currencyCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Use a three-letter uppercase currency code.");
  const receivedAt = timestamp20(args.receivedAt, "Payment received date");
  if (!receivedAt) throw new Error("Payment received date is required.");
  const now = /* @__PURE__ */ new Date();
  if (receivedAt.getTime() > now.getTime() + 36 * 36e5) throw new Error("Payment received date cannot be in the future.");
  const reference = optionalBoundedText(args.reference, "Payment reference", 200) ?? "";
  const invoiceId = args.invoiceId?.trim() || null;
  const providerCode = `manual:${args.method}`;
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manual-payment:${firmId}:${key}`}))`;
    const replay = await tx.payment.findFirst({ where: { firmId, idempotencyKey: key } });
    if (replay) {
      if (replay.payerId !== args.payerId || (replay.invoiceId ?? null) !== invoiceId || replay.amountMinor !== args.amountMinor || replay.currencyCode !== currencyCode || replay.providerCode !== providerCode || (replay.providerPaymentId ?? "") !== reference) {
        throw new Error("Payment idempotency key was reused with a different payload.");
      }
      if (replay.matterId) {
        await assertMatterAccess(tx, firmId, replay.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.matterId, userId, "canBill");
      }
      return { payment: replay, replayed: true };
    }
    const payer = await tx.contact.findFirst({ where: { id: args.payerId, firmId }, select: { id: true } });
    if (!payer) throw new Error("Payer was not found in the active firm.");
    let matterId = null;
    if (invoiceId) {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, firmId },
        select: { id: true, matterId: true, status: true, currencyCode: true }
      });
      if (!invoice) throw new Error("Invoice was not found in the active firm.");
      await assertMatterAccess(tx, firmId, invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
      if (!(/* @__PURE__ */ new Set(["issued", "partially_paid", "overdue"])).has(invoice.status)) {
        throw new Error("A payment can be recorded against an open issued invoice only.");
      }
      if (invoice.currencyCode !== currencyCode) throw new Error("Payment and invoice currencies must match.");
      matterId = invoice.matterId;
    }
    const payment = await tx.payment.create({
      data: {
        firmId,
        matterId,
        invoiceId,
        payerId: payer.id,
        paymentNumber: `PAY-${(0, import_node_crypto8.randomUUID)().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: key,
        paymentType: "operating",
        status: "captured",
        amountMinor: args.amountMinor,
        refundedMinor: 0,
        currencyCode,
        providerCode,
        providerPaymentId: reference,
        capturedAt: receivedAt,
        receivedById: userId
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "payment.recorded",
      category: "financial",
      actorUserId: userId,
      matterId,
      invoiceId,
      paymentId: payment.id,
      metadata: { method: args.method, amountMinor: args.amountMinor, currencyCode, receivedAt: receivedAt.toISOString() }
    });
    return { payment, replayed: false };
  });
}

// features/keystone/lib/conflict-status.ts
var blockingConflictCheckStatuses = ["requested", "running", "review_required", "conflict_found", "failed"];

// features/keystone/mutations/intakeWorkflows.ts
var import_node_crypto9 = require("node:crypto");
var MAX_ADVERSE_PARTIES = 25;
var organizationSuffix = /\b(inc|incorporated|llc|l\.l\.c|llp|lp|ltd|limited|corp|corporation|company|co|plc|pllc|pc|gmbh|ag|sa|bv|nv|bank|trust|group|holdings|partners|association|foundation|university|hospital|authority|department|agency|county|city)\.?$/i;
function normalizeConflictTerm(value) {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function parseAdversePartyNames(summary, exclude = []) {
  if (!summary) return [];
  const seen = new Set(exclude.map(normalizeConflictTerm).filter(Boolean));
  const names = [];
  for (const raw of summary.split(/[\r\n;,]+/)) {
    const name = raw.replace(/^[\s\-*•\d.)]+/, "").replace(/\s+/g, " ").trim();
    const normalized = normalizeConflictTerm(name);
    if (!normalized || seen.has(normalized)) continue;
    if (name.length > 200) throw new Error("Each known adverse party must be 200 characters or fewer.");
    seen.add(normalized);
    names.push(name);
  }
  if (names.length > MAX_ADVERSE_PARTIES) throw new Error(`List at most ${MAX_ADVERSE_PARTIES} known adverse parties.`);
  return names;
}
function adversePartyContact(name) {
  if (organizationSuffix.test(name)) return { contactType: "organization", firstName: "", lastName: "", organizationName: name };
  const parts = name.split(" ");
  const lastName = parts.length > 1 ? parts.pop() : "";
  return { contactType: "person", firstName: parts.join(" "), lastName, organizationName: "" };
}
var intakeClearancePath = {
  new: ["screening", "conflict_review", "decision"],
  screening: ["conflict_review", "decision"],
  conflict_review: ["decision"],
  consultation: ["decision"]
};
async function advanceIntakeAfterConflictClearance(tx, context, input) {
  const session = context.session;
  if (!isInteractiveHumanSession(session) || !permissions.canManageIntake({ session })) return null;
  try {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
  } catch {
    return null;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${input.firmId}:${input.intakeId}`}))`;
  const intake = await tx.intake.findFirst({ where: { id: input.intakeId, firmId: input.firmId }, select: { id: true, status: true } });
  const path = intake ? intakeClearancePath[intake.status] : void 0;
  if (!intake || !path) return null;
  const [cleared, blocking] = await Promise.all([
    tx.conflictCheck.count({ where: { firmId: input.firmId, intakeId: intake.id, status: "cleared" } }),
    tx.conflictCheck.count({ where: { firmId: input.firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } } })
  ]);
  if (!cleared || blocking) return null;
  let fromStatus = intake.status;
  for (const toStatus of path) {
    assertLifecycleTransition("intake", fromStatus, toStatus);
    await recordAuditEvent(tx, {
      firmId: input.firmId,
      eventType: `intake.${toStatus}`,
      category: "legal_workflow",
      actorUserId: input.userId,
      intakeId: intake.id,
      metadata: { fromStatus, toStatus, cause: "conflict_check_cleared", conflictCheckId: input.checkId, reasonDigest: sha256Digest("Conflict check cleared.") }
    });
    fromStatus = toStatus;
  }
  await tx.intake.update({ where: { id: intake.id }, data: { status: "decision" } });
  return { intakeId: intake.id, fromStatus: intake.status, toStatus: "decision" };
}
function text22(value, label, maximum, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result || result.length > maximum) throw new Error(`${label} ${required ? "is required and " : ""}must be ${maximum} characters or fewer.`);
  return result || null;
}
async function startClientIntake(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (!permissions.canManagePeople({ session: context.session }) || !permissions.canRunConflictChecks({ session: context.session })) {
    throw new Error("Starting an intake requires people-management and conflict-check permission.");
  }
  if (!["person", "organization"].includes(args.contactType)) throw new Error("Contact type must be person or organization.");
  const firstName = text22(args.firstName, "First name", 120, args.contactType === "person");
  const lastName = text22(args.lastName, "Last name", 120, args.contactType === "person");
  const organizationName = text22(args.organizationName, "Organization name", 200, args.contactType === "organization");
  const email = text22(args.email, "Email", 320, false)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email must be valid.");
  const phone = text22(args.phone, "Phone", 80, false);
  const title = text22(args.title, "Intake title", 240);
  const summary = text22(args.summary, "Intake summary", 4e3, false);
  const adversePartySummary = text22(args.adversePartySummary, "Adverse-party summary", 2e3, false);
  const source = args.source?.trim() || "other";
  const contactName2 = args.contactType === "organization" ? organizationName : [firstName, lastName].filter(Boolean).join(" ");
  if (!contactName2) throw new Error("A conflict-search name is required.");
  parseAdversePartyNames(adversePartySummary, [contactName2]);
  if (!["website", "referral", "phone", "walk_in", "import", "other"].includes(source)) throw new Error("Unsupported intake source.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    if (args.officeId) {
      const office = await tx.office.findFirst({ where: { id: args.officeId, firmId, status: "active" }, select: { id: true } });
      if (!office) throw new Error("The selected office is unavailable in this firm.");
    }
    if (args.practiceAreaId) {
      const area = await tx.practiceArea.findFirst({ where: { id: args.practiceAreaId, firmId, status: "active" }, select: { id: true } });
      if (!area) throw new Error("The selected practice area is unavailable in this firm.");
    }
    if (args.assignedToId) {
      const membership = await tx.firmMembership.findFirst({
        where: { firmId, userId: args.assignedToId, status: "active" },
        select: { id: true }
      });
      if (!membership) throw new Error("The selected assignee is not an active firm member.");
    }
    const suffix = (0, import_node_crypto9.randomUUID)().replaceAll("-", "").slice(0, 12).toUpperCase();
    const contact = await tx.contact.create({
      data: {
        firmId,
        contactType: args.contactType,
        status: "prospective_client",
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        organizationName: organizationName ?? "",
        primaryEmail: email ?? "",
        primaryPhone: phone ?? "",
        conflictSearchAliases: []
      },
      select: { id: true }
    });
    const intake = await tx.intake.create({
      data: {
        firmId,
        intakeNumber: `INT-${suffix}`,
        title,
        status: "new",
        source,
        primaryContactId: contact.id,
        officeId: args.officeId || null,
        practiceAreaId: args.practiceAreaId || null,
        openedById: userId,
        assignedToId: args.assignedToId || userId,
        receivedAt: /* @__PURE__ */ new Date(),
        summary: summary ?? "",
        adversePartySummary: adversePartySummary ?? ""
      },
      select: { id: true, intakeNumber: true, status: true }
    });
    await tx.intakeParticipant.create({
      data: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: "prospective_client", status: "active" }
    });
    const adverseNames = parseAdversePartyNames(adversePartySummary, [contactName2 ?? ""]);
    const adverseContacts = [];
    for (const name of adverseNames) {
      const identity = adversePartyContact(name);
      const adverse = await tx.contact.create({
        data: { firmId, ...identity, status: "opposing", primaryEmail: "", primaryPhone: "", conflictSearchAliases: [] },
        select: { id: true }
      });
      await tx.intakeParticipant.create({
        data: { firmId, intakeId: intake.id, contactId: adverse.id, participantRole: "adverse_party", status: "active" }
      });
      adverseContacts.push({ id: adverse.id, name, termType: identity.contactType });
    }
    const conflictCheck = await tx.conflictCheck.create({
      data: {
        firmId,
        checkNumber: `CHK-${suffix}`,
        status: "requested",
        intakeId: intake.id,
        requestedById: userId,
        searchScope: "contacts_and_matters",
        searchVersion: "v1"
      },
      select: { id: true, checkNumber: true, status: true }
    });
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        checkId: conflictCheck.id,
        term: contactName2,
        normalizedTerm: normalizeConflictTerm(contactName2),
        termType: args.contactType === "organization" ? "organization" : "person",
        sourceContactId: contact.id,
        includeAliases: true
      }
    });
    for (const adverse of adverseContacts) {
      await tx.conflictSearchTerm.create({
        data: {
          firmId,
          checkId: conflictCheck.id,
          term: adverse.name,
          normalizedTerm: normalizeConflictTerm(adverse.name),
          termType: adverse.termType,
          sourceContactId: adverse.id,
          includeAliases: true
        }
      });
    }
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "intake.started",
      category: "legal_workflow",
      intakeId: intake.id,
      contactId: contact.id,
      metadata: { conflictCheckId: conflictCheck.id, source, adversePartyContactIds: adverseContacts.map((adverse) => adverse.id) }
    });
    return { intake, contact, conflictCheck };
  });
}

// features/keystone/mutations/legalWorkflows.ts
var conflictTermTypes = /* @__PURE__ */ new Set(["person", "organization", "alias", "matter", "other"]);
var conflictMatchTypes = /* @__PURE__ */ new Set(["exact_name", "alias", "fuzzy_name", "related_party", "matter_text", "manual"]);
async function assertConflictEvidenceSources(tx, firmId, userId, matches, context) {
  for (const match of matches) {
    const sourceIds = [match.matchedContactId, match.matchedMatterId, match.matchedMatterPartyId].filter(Boolean);
    if (sourceIds.length !== 1) {
      throw new Error("Conflict evidence is unclassified; link exactly one verified source before review.");
    }
    if (match.matterId) await assertMatterAccess(tx, firmId, match.matterId, userId);
    if (match.matchedMatterId) {
      if (match.sourceType !== "matter" || match.sourceId !== match.matchedMatterId) {
        throw new Error("Conflict matter evidence does not match its verified source identity.");
      }
      await assertMatterAccess(tx, firmId, match.matchedMatterId, userId);
    } else if (match.matchedMatterPartyId) {
      const matterId = match.matchedMatterParty?.matterId;
      if (!matterId || match.matchedMatterParty?.firmId !== firmId || match.sourceType !== "matter_party" || match.sourceId !== match.matchedMatterPartyId) {
        throw new Error("Conflict party evidence does not match its verified source identity.");
      }
      await assertMatterAccess(tx, firmId, matterId, userId);
    } else {
      if (!match.matchedContact || match.matchedContact.firmId !== firmId || match.sourceType !== "contact" || match.sourceId !== match.matchedContactId) {
        throw new Error("Conflict contact evidence does not match its verified source identity.");
      }
      requirePermission(context, "canReadPeople");
      await assertCurrentCommandActor(tx, context, "canReadPeople");
    }
  }
}
async function requestConflictCheck(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks", { humanOnly: true });
  const checkNumber = String(args.checkNumber).trim();
  const initialTerm = String(args.initialTerm).trim();
  if (!checkNumber || checkNumber.length > 100) throw new Error("Conflict check number is required and must be 100 characters or fewer.");
  if (!initialTerm || initialTerm.length > 500) throw new Error("An initial conflict search term is required and must be 500 characters or fewer.");
  if (!conflictTermTypes.has(args.termType)) throw new Error("Unsupported conflict term type.");
  if (Boolean(args.intakeId) === Boolean(args.matterId)) throw new Error("A conflict check requires exactly one intake or matter scope.");
  const normalizedTerm = initialTerm.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalizedTerm) throw new Error("The initial conflict term must contain searchable characters.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict-number:${firmId}:${checkNumber}`}))`;
    if (args.matterId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    const [intake, matter] = await Promise.all([
      args.intakeId ? tx.intake.findFirst({ where: { id: args.intakeId, firmId }, select: { id: true, primaryContactId: true } }) : null,
      args.matterId ? tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, clientId: true } }) : null
    ]);
    if (args.intakeId && !intake) throw new Error("Intake was not found in the active firm.");
    if (args.matterId && !matter) throw new Error("Matter was not found in the active firm.");
    if (matter) await assertMatterAccess(tx, firmId, matter.id, userId);
    const check = await tx.conflictCheck.create({
      data: {
        firmId,
        intakeId: intake?.id ?? null,
        matterId: matter?.id ?? null,
        checkNumber,
        status: "requested",
        requestedById: userId,
        searchScope: "contacts_and_matters",
        searchVersion: "manual-v1"
      }
    });
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        matterId: matter?.id ?? null,
        checkId: check.id,
        term: initialTerm,
        normalizedTerm,
        termType: args.termType,
        sourceContactId: intake?.primaryContactId ?? matter?.clientId ?? null
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.check_requested",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: matter?.id ?? null,
      intakeId: intake?.id ?? null,
      metadata: { checkId: check.id, initialTermDigest: sha256Digest(normalizedTerm), searchVersion: "manual-v1" }
    });
    return check;
  });
}
async function addConflictSearchTerm(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  const term = boundedReason(args.term, "Conflict search term", 1, 500);
  const normalizedTerm = boundedReason(args.normalizedTerm, "Normalized conflict search term", 1, 500);
  if (!conflictTermTypes.has(args.termType)) throw new Error("Conflict search term type is unsupported.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check || !(/* @__PURE__ */ new Set(["requested", "running"])).has(check.status)) {
      throw new Error("Conflict terms may be recorded only before review.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (args.sourceContactId && !await tx.contact.findFirst({ where: { id: args.sourceContactId, firmId }, select: { id: true } })) {
      throw new Error("Conflict source contact was not found in the active firm.");
    }
    return tx.conflictSearchTerm.create({
      data: {
        firmId,
        matterId: check.matterId,
        checkId: check.id,
        term,
        normalizedTerm,
        termType: args.termType,
        sourceContactId: args.sourceContactId ?? null,
        includeAliases: args.includeAliases !== false
      }
    });
  });
}
async function addConflictMatch(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  if (!conflictMatchTypes.has(args.matchType)) throw new Error("Conflict match type is unsupported.");
  if (args.score != null && (!Number.isInteger(args.score) || args.score < 0 || args.score > 100)) throw new Error("Conflict match score is invalid.");
  const sources = [args.matchedContactId, args.matchedMatterId, args.matchedMatterPartyId].filter(Boolean);
  if (sources.length !== 1) throw new Error("Conflict candidates require exactly one linked contact, matter, or matter party source.");
  if (args.matchType === "matter_text" && !args.matchedMatterId) {
    throw new Error("Matter-text candidates must link to their source matter.");
  }
  if (args.matchType === "related_party" && !args.matchedMatterPartyId && !args.matchedContactId) {
    throw new Error("Related-party candidates must link to their source party or contact.");
  }
  if (args.matchedContactId) requirePermission(context, "canReadPeople");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    if (args.matchedContactId) await assertCurrentCommandActor(tx, context, "canReadPeople");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check || !(/* @__PURE__ */ new Set(["requested", "running"])).has(check.status)) {
      throw new Error("Conflict matches may be recorded only before review.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (args.matchedMatterId) await assertMatterAccess(tx, firmId, args.matchedMatterId, userId);
    const [contact, matter, party] = await Promise.all([
      args.matchedContactId ? tx.contact.findFirst({ where: { id: args.matchedContactId, firmId }, select: { id: true } }) : null,
      args.matchedMatterId ? tx.matter.findFirst({ where: { id: args.matchedMatterId, firmId }, select: { id: true } }) : null,
      args.matchedMatterPartyId ? tx.matterParty.findFirst({ where: { id: args.matchedMatterPartyId, firmId }, select: { id: true, matterId: true } }) : null
    ]);
    if (args.matchedContactId && !contact) throw new Error("Matched contact was not found in the active firm.");
    if (args.matchedMatterId && !matter) throw new Error("Matched matter was not found in the active firm.");
    if (args.matchedMatterPartyId && !party) throw new Error("Matched matter party was not found in the active firm.");
    if (party?.matterId) await assertMatterAccess(tx, firmId, party.matterId, userId);
    const sourceType = args.matchedMatterId ? "matter" : args.matchedMatterPartyId ? "matter_party" : "contact";
    const sourceId = args.matchedMatterId ?? args.matchedMatterPartyId ?? args.matchedContactId;
    const matchedValue = args.matchedMatterId ? "Linked matter source" : args.matchedMatterPartyId ? "Linked matter-party source" : "Linked contact source";
    return tx.conflictMatch.create({
      data: {
        firmId,
        matterId: check.matterId,
        checkId: check.id,
        status: "potential",
        matchType: args.matchType,
        matchedContactId: args.matchedContactId ?? null,
        matchedMatterId: args.matchedMatterId ?? null,
        matchedMatterPartyId: args.matchedMatterPartyId ?? null,
        score: args.score ?? null,
        matchedValue,
        evidenceExcerpt: "",
        sourceType,
        sourceId
      }
    });
  });
}
async function transitionConflictCheck(_root, args, context) {
  assertCommandTarget("conflict-check", args.toStatus, ["running", "review_required", "failed", "cancelled"]);
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  const summary = args.toStatus === "failed" ? boundedReason(args.summary, "Conflict-check failure reason", 3, 2e3) : args.toStatus === "review_required" ? boundedReason(args.summary, "Completed conflict-search summary", 10, 2e3) : optionalBoundedText(args.summary, "Conflict-check summary", 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check) throw new Error("Conflict check was not found in the active firm.");
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (check.status === args.toStatus) return { check, replayed: true };
    assertLifecycleTransition("conflictCheck", check.status, args.toStatus);
    if (args.toStatus === "review_required") {
      const termCount = await tx.conflictSearchTerm.count({ where: { firmId, checkId: check.id } });
      if (!termCount || !check.searchVersion) {
        throw new Error("Conflict review requires nonempty search terms and explicit search-version evidence.");
      }
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.conflictCheck.update({
      where: { id: check.id },
      data: {
        status: args.toStatus,
        ...args.toStatus === "running" ? { startedAt: now } : {},
        ...args.toStatus === "review_required" ? { summary } : {},
        ...args.toStatus === "failed" ? { failureReason: summary, completedAt: now } : {},
        ...args.toStatus === "cancelled" ? { completedAt: now } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `conflict.check_${args.toStatus}`,
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: { checkId: check.id, fromStatus: check.status, toStatus: args.toStatus }
    });
    return { check: updated, replayed: false };
  });
}
var dispositionOutcomes = /* @__PURE__ */ new Set([
  "clear",
  "conflict",
  "needs_more_information",
  "approved_exception"
]);
async function recordConflictDisposition(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!dispositionOutcomes.has(args.outcome)) throw new Error("Unsupported conflict disposition outcome.");
  const rationale = boundedReason(args.rationale, "Disposition rationale", 10, 4e3);
  const conditions = optionalBoundedText(args.conditions, "Disposition conditions", 4e3);
  const policyReference = optionalBoundedText(args.policyReference, "Policy reference", 500);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({
      where: { id: args.checkId, firmId },
      include: {
        matches: {
          include: {
            matchedContact: { select: { id: true, firmId: true } },
            matchedMatterParty: { select: { matterId: true, firmId: true } }
          }
        }
      }
    });
    if (!check || check.status !== "review_required") {
      throw new Error("Conflict check must be awaiting review in the active firm.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    await assertConflictEvidenceSources(tx, firmId, userId, check.matches, context);
    let match = null;
    if (args.matchId) {
      match = check.matches.find((candidate) => candidate.id === args.matchId) ?? null;
      if (!match) throw new Error("Conflict match was not found on the selected check.");
    }
    const disposition = await tx.conflictDisposition.create({
      data: {
        firmId,
        matterId: check.matterId ?? match?.matterId ?? null,
        checkId: check.id,
        matchId: match?.id ?? null,
        outcome: args.outcome,
        reviewerId: userId,
        rationale,
        conditions: conditions ?? "",
        policyReference: policyReference ?? "",
        decidedAt: /* @__PURE__ */ new Date()
      }
    });
    if (match) {
      const target = args.outcome === "clear" ? "cleared" : args.outcome === "needs_more_information" ? "reviewing" : "escalated";
      if (match.status !== target && canTransition("conflictMatch", match.status, target)) {
        await tx.conflictMatch.update({
          where: { id: match.id },
          data: { status: target, reviewedById: userId, reviewedAt: /* @__PURE__ */ new Date() }
        });
      }
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.disposition_recorded",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: {
        checkId: check.id,
        matchId: match?.id ?? null,
        outcome: args.outcome,
        dispositionId: disposition.id
      }
    });
    return disposition;
  });
}
async function finalizeConflictCheck(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["cleared", "conflict_found"])).has(args.outcome)) {
    throw new Error("Conflict check outcome must be cleared or conflict_found.");
  }
  const summary = boundedReason(args.summary, "Conflict review summary", 10, 4e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({
      where: { id: args.checkId, firmId },
      include: {
        terms: { select: { id: true }, take: 1 },
        matches: {
          include: {
            matchedContact: { select: { id: true, firmId: true } },
            matchedMatterParty: { select: { matterId: true, firmId: true } },
            dispositions: { orderBy: { decidedAt: "desc" }, take: 1 }
          }
        }
      }
    });
    if (!check) throw new Error("Conflict check was not found in the active firm.");
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    await assertConflictEvidenceSources(tx, firmId, userId, check.matches, context);
    if (check.status === args.outcome) return { check, replayed: true };
    if (check.status !== "review_required") throw new Error("Conflict check is not awaiting final review.");
    if (!check.terms.length || !check.searchVersion) {
      throw new Error("Conflict clearance requires nonempty search terms and explicit completed-search evidence.");
    }
    const latestOutcomes = check.matches.map((match) => match.dispositions[0]?.outcome ?? null);
    if (latestOutcomes.some((outcome) => !outcome || outcome === "needs_more_information")) {
      throw new Error("Every conflict match requires a final disposition before check completion.");
    }
    const hasConflict = latestOutcomes.includes("conflict");
    if (args.outcome === "cleared" && hasConflict) {
      throw new Error("A check with an unresolved conflict disposition cannot be cleared.");
    }
    if (args.outcome === "conflict_found" && !hasConflict) {
      throw new Error("Conflict-found completion requires at least one conflict disposition.");
    }
    assertLifecycleTransition("conflictCheck", check.status, args.outcome);
    const now = /* @__PURE__ */ new Date();
    const completed = await tx.conflictCheck.update({
      where: { id: check.id },
      data: {
        status: args.outcome,
        summary,
        reviewedById: userId,
        reviewedAt: now,
        completedAt: now
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.check_finalized",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: { checkId: check.id, outcome: args.outcome }
    });
    if (args.outcome === "cleared" && check.intakeId) {
      await advanceIntakeAfterConflictClearance(tx, context, { firmId, userId, intakeId: check.intakeId, checkId: check.id });
    }
    return { check: completed, replayed: false };
  });
}
var reasonedMatterStates = /* @__PURE__ */ new Set(["on_hold", "closing", "closed", "declined"]);
async function changeMatterConfidentiality(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["standard", "restricted"])).has(args.confidentiality)) {
    throw new Error("Matter confidentiality is invalid.");
  }
  const reason = boundedReason(args.reason, "Confidentiality change reason", 10, 4e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-confidentiality:${firmId}:${args.matterId}`}))`;
    const matter = await tx.matter.findFirst({
      where: { id: args.matterId, firmId },
      select: { id: true, confidentiality: true }
    });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, userId);
    if (matter.confidentiality === args.confidentiality) return { matter, replayed: true };
    if (args.confidentiality === "restricted") {
      const authorizedTeam = await tx.matterTeamMember.count({
        where: { firmId, matterId: matter.id, status: "active", canAccessRestricted: true }
      });
      if (!authorizedTeam) throw new Error("Restricting a matter requires at least one active restricted-access team member.");
    }
    const updated = await tx.matter.update({
      where: { id: matter.id },
      data: { confidentiality: args.confidentiality }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "matter.confidentiality_changed",
      category: "authorization",
      actorUserId: userId,
      matterId: matter.id,
      metadata: {
        fromConfidentiality: matter.confidentiality,
        toConfidentiality: args.confidentiality,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { matter: updated, replayed: false };
  });
}
async function transitionMatter(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageMatters");
  const reason = reasonedMatterStates.has(args.toStatus) ? boundedReason(args.reason, "Matter transition reason", 5, 4e3) : optionalBoundedText(args.reason, "Matter transition reason", 4e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    const matter = await tx.matter.findFirst({
      where: { id: args.matterId, firmId },
      select: { id: true, status: true, confidentiality: true }
    });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, userId);
    await assertMatterTeamCapability(tx, firmId, matter.id, userId, "canEdit");
    if (matter.status === args.toStatus) return { matter, replayed: true };
    assertLifecycleTransition("matter", matter.status, args.toStatus);
    if (matter.status === "pending_conflict" && args.toStatus === "open") {
      const [cleared, blocking] = await Promise.all([
        tx.conflictCheck.count({ where: { firmId, matterId: matter.id, status: "cleared" } }),
        tx.conflictCheck.count({ where: { firmId, matterId: matter.id, status: { in: [...blockingConflictCheckStatuses] } } })
      ]);
      if (!cleared || blocking) {
        throw new Error("Opening a matter requires a cleared conflict check and no pending, failed or conflict-found check.");
      }
    }
    if (args.toStatus === "closed") {
      const openInvoices = await tx.invoice.count({
        where: {
          firmId,
          matterId: matter.id,
          status: { not: "void" },
          balanceDueMinor: { gt: 0 }
        }
      });
      if (openInvoices) throw new Error("Matter closure requires all non-void invoice balances to be resolved.");
      const [credits, debits] = await Promise.all([
        tx.trustLedgerEntry.aggregate({
          where: {
            firmId,
            ledgerAccount: { matterId: matter.id },
            accountingBucket: "client_liability",
            direction: "credit"
          },
          _sum: { amountMinor: true }
        }),
        tx.trustLedgerEntry.aggregate({
          where: {
            firmId,
            ledgerAccount: { matterId: matter.id },
            accountingBucket: "client_liability",
            direction: "debit"
          },
          _sum: { amountMinor: true }
        })
      ]);
      if ((credits._sum.amountMinor ?? 0) !== (debits._sum.amountMinor ?? 0)) {
        throw new Error("Matter closure requires a zero client trust-ledger balance.");
      }
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.matter.update({
      where: { id: matter.id },
      data: {
        status: args.toStatus,
        ...args.toStatus === "open" && matter.status !== "on_hold" ? { openedAt: now } : {},
        ...args.toStatus === "closed" ? { closedAt: now, closureReason: reason } : {}
      }
    });
    const event = await tx.matterStatusEvent.create({
      data: {
        firmId,
        matterId: matter.id,
        fromStatus: matter.status,
        toStatus: args.toStatus,
        action: "matter.transition",
        reason: reason ?? "",
        actorUserId: userId,
        actorAgentId: context.session?.agentPrincipalId ?? null,
        occurredAt: now
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "matter.transitioned",
      category: "legal_workflow",
      actorUserId: context.session?.authenticationType === "agent" ? null : userId,
      actorAgentId: context.session?.agentPrincipalId ?? null,
      matterId: matter.id,
      metadata: { fromStatus: matter.status, toStatus: args.toStatus, eventId: event.id }
    });
    return { matter: updated, event, replayed: false };
  });
}

// features/keystone/mutations/postTrustTransaction.ts
var import_node_crypto10 = require("node:crypto");

// features/keystone/lib/trust-ledger.ts
var currencyPattern = /^[A-Z]{3}$/;
var accountingBuckets = /* @__PURE__ */ new Set([
  "bank_control",
  "client_liability",
  "bank_fee",
  "suspense"
]);
function assertTrustLedgerHistoricalMinimumBalances(existingEntries, proposedEntries) {
  const events = /* @__PURE__ */ new Map();
  const add = (entry) => {
    if (!entry.ledgerAccountId || !isGraphqlInt(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error("Trust ledger history contains an invalid client-liability entry.");
    }
    const occurredAt = entry.occurredAt instanceof Date ? entry.occurredAt : new Date(entry.occurredAt);
    const at = occurredAt.valueOf();
    if (!Number.isFinite(at)) throw new Error("Trust ledger history contains an invalid effective date.");
    const delta = entry.direction === "credit" ? entry.amountMinor : entry.direction === "debit" ? -entry.amountMinor : null;
    if (delta === null) throw new Error("Trust ledger history contains an invalid direction.");
    let ledgerEvents = events.get(entry.ledgerAccountId);
    if (!ledgerEvents) events.set(entry.ledgerAccountId, ledgerEvents = /* @__PURE__ */ new Map());
    const next = (ledgerEvents.get(at) ?? 0) + delta;
    if (!isGraphqlInt(next)) throw new Error("Trust ledger history exceeds the supported database integer range.");
    ledgerEvents.set(at, next);
  };
  for (const entry of existingEntries) add(entry);
  for (const entry of proposedEntries) add(entry);
  for (const ledgerEvents of events.values()) {
    let balance = 0;
    for (const [, delta] of [...ledgerEvents].sort(([left], [right]) => left - right)) {
      balance += delta;
      if (!isGraphqlInt(balance)) throw new Error("Trust ledger balance exceeds the supported database integer range.");
      if (balance < 0) throw new Error("Trust posting would make a client ledger historically over-disbursed.");
    }
  }
}
function assertTrustPostingPeriodOpen(occurredAt, reconciliations) {
  const effectiveAt = occurredAt instanceof Date ? occurredAt.valueOf() : new Date(occurredAt).valueOf();
  if (!Number.isFinite(effectiveAt)) throw new Error("A valid trust posting effective date is required.");
  const closedPeriod = reconciliations.some((reconciliation) => {
    if (reconciliation.status !== "completed") return false;
    const end = reconciliation.periodEnd instanceof Date ? reconciliation.periodEnd.valueOf() : new Date(reconciliation.periodEnd).valueOf();
    return !Number.isFinite(end) || effectiveAt <= end;
  });
  if (closedPeriod) throw new Error("Trust postings cannot be dated on or before the end of a completed reconciliation period; reopen that reconciliation through review first.");
}
function validateTrustPosting(input) {
  const idempotencyKey3 = input.idempotencyKey?.trim();
  if (!idempotencyKey3 || idempotencyKey3.length < 12 || idempotencyKey3.length > 160) {
    throw new Error("A durable idempotency key between 12 and 160 characters is required.");
  }
  if (!input.trustAccountId?.trim()) throw new Error("A trust account is required.");
  if (!currencyPattern.test(input.currencyCode)) {
    throw new Error("A three-letter uppercase currency code is required.");
  }
  if (!Array.isArray(input.entries) || input.entries.length < 2) {
    throw new Error("A trust posting requires at least two ledger entries.");
  }
  let debitTotalMinor = 0;
  let creditTotalMinor = 0;
  for (const entry of input.entries) {
    if (!isGraphqlInt(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error("Every trust entry must use a positive integer minor-unit amount.");
    }
    const entryCurrency = entry.currencyCode ?? input.currencyCode;
    if (entryCurrency !== input.currencyCode) {
      throw new Error("Every trust entry must use the same currency as its transaction.");
    }
    if (!accountingBuckets.has(entry.accountingBucket)) {
      throw new Error("Trust entry accounting bucket is not supported.");
    }
    if (entry.accountingBucket === "client_liability" && !entry.ledgerAccountId?.trim()) {
      throw new Error("A client-liability trust entry requires a ledger account.");
    }
    if (entry.accountingBucket !== "client_liability" && entry.ledgerAccountId?.trim()) {
      throw new Error("Only client-liability entries may reference a client ledger account.");
    }
    if ((entry.memo?.trim().length ?? 0) > 1e3) {
      throw new Error("Trust entry memo must be 1000 characters or fewer.");
    }
    if (entry.direction === "debit") debitTotalMinor += entry.amountMinor;
    else if (entry.direction === "credit") creditTotalMinor += entry.amountMinor;
    else throw new Error("Trust entry direction must be debit or credit.");
  }
  if (!isGraphqlInt(debitTotalMinor) || !isGraphqlInt(creditTotalMinor)) {
    throw new Error("Trust posting totals exceed the supported database integer range.");
  }
  if (debitTotalMinor !== creditTotalMinor) {
    throw new Error("Trust transaction debits must equal credits.");
  }
  return {
    idempotencyKey: idempotencyKey3,
    currencyCode: input.currencyCode,
    debitTotalMinor,
    creditTotalMinor,
    entryCount: input.entries.length
  };
}

// features/keystone/mutations/postTrustTransaction.ts
var transactionTypes = /* @__PURE__ */ new Set([
  "deposit",
  "disbursement",
  "transfer",
  "reversal",
  "bank_fee",
  "adjustment"
]);
function requiredText(value, label, maxLength) {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return cleaned;
}
function normalizedMemo(value) {
  const memo = value?.trim() ?? "";
  if (memo.length > 1e3) throw new Error("Trust entry memo must be 1000 characters or fewer.");
  return memo;
}
function matterAccessWhere(userId) {
  return {
    OR: [
      { matterId: null },
      {
        matter: {
          AND: [
            {
              OR: [
                { confidentiality: { not: "restricted" } },
                {
                  teamMembers: {
                    some: { userId, status: "active", canAccessRestricted: true }
                  }
                }
              ]
            },
            {
              NOT: {
                ethicalWalls: {
                  some: {
                    status: "active",
                    members: { some: { userId, status: "active", decision: "blocked" } }
                  }
                }
              }
            }
          ]
        }
      }
    ]
  };
}
async function assertTrustReplayMatterAccess(tx, firmId, userId, entries) {
  const ledgerIds = [...new Set(entries.flatMap((entry) => entry.ledgerAccountId ? [entry.ledgerAccountId] : []))];
  if (!ledgerIds.length) return;
  const ledgers = await tx.trustLedgerAccount.findMany({
    where: { firmId, id: { in: ledgerIds } },
    select: { id: true, matterId: true }
  });
  if (ledgers.length !== ledgerIds.length) throw new Error("Trust replay resources are no longer available in the active firm.");
  const matterIds = Array.from(new Set(ledgers.flatMap((ledger) => ledger.matterId ? [String(ledger.matterId)] : [])));
  for (const matterId of matterIds) {
    await assertMatterAccess(tx, firmId, matterId, userId);
  }
}
function digestEntry(entry, currencyCode) {
  return {
    ledgerAccountId: entry.ledgerAccountId ?? null,
    accountingBucket: entry.accountingBucket,
    direction: entry.direction,
    amountMinor: entry.amountMinor,
    currencyCode,
    memo: normalizedMemo(entry.memo)
  };
}
function computeTrustPostingDigest(data, description = data.description.trim(), occurredAt = new Date(data.occurredAt)) {
  const entries = data.entries.map((entry) => digestEntry(entry, data.currencyCode)).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return sha256Digest({
    trustAccountId: data.trustAccountId,
    transactionType: data.transactionType,
    currencyCode: data.currencyCode,
    occurredAt: occurredAt.toISOString(),
    description,
    reversesTransactionId: data.reversesTransactionId ?? null,
    sourcePaymentId: data.sourcePaymentId ?? null,
    sourceRefundId: data.sourceRefundId ?? null,
    entries
  });
}
function reversalSignature(entry, invert) {
  const direction = invert ? entry.direction === "debit" ? "credit" : "debit" : entry.direction;
  return canonicalJson({
    ledgerAccountId: entry.ledgerAccountId ?? null,
    accountingBucket: entry.accountingBucket,
    direction,
    amountMinor: entry.amountMinor,
    currencyCode: entry.currencyCode
  });
}
function assertExactReversal(originalEntries, requestedEntries, currencyCode) {
  const expected = originalEntries.map((entry) => reversalSignature(entry, true)).sort();
  const actual = requestedEntries.map((entry) => reversalSignature({ ...entry, currencyCode }, false)).sort();
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    throw new Error("A reversal must exactly invert every entry in the referenced transaction.");
  }
}
function assertExactTrustSourcePosting(args) {
  const total = (bucket, direction) => args.entries.reduce((sum, entry) => entry.accountingBucket === bucket && entry.direction === direction ? sum + entry.amountMinor : sum, 0);
  const source = args.source;
  if (source.trustTransactions.length) {
    throw new Error(`The source ${args.kind} already has a posted trust transaction.`);
  }
  if (source.matterId && args.ledgers.some((ledger) => ledger.matterId !== source.matterId)) {
    throw new Error(`Source ${args.kind} and client ledgers must use the same matter scope.`);
  }
  if (args.kind === "payment") {
    if (args.transactionType !== "deposit" || source.paymentType !== "trust_deposit" || !(/* @__PURE__ */ new Set(["captured", "settled"])).has(source.status) || source.trustAccountId !== args.trustAccountId || source.currencyCode !== args.currencyCode) {
      throw new Error("A trust source payment must be a captured or settled same-account trust deposit in the posting currency.");
    }
    if (total("client_liability", "credit") !== source.amountMinor || total("bank_control", "debit") !== source.amountMinor || total("client_liability", "debit") !== 0 || total("bank_control", "credit") !== 0) {
      throw new Error("A source payment posting must exactly debit bank control and credit client liability for the payment amount.");
    }
    return;
  }
  if (args.transactionType !== "disbursement" || !(/* @__PURE__ */ new Set(["approved", "processing"])).has(source.status) || source.payment.paymentType !== "trust_deposit" || source.payment.trustAccountId !== args.trustAccountId || source.currencyCode !== args.currencyCode) {
    throw new Error("A trust source refund must be an approved or processing same-account trust-deposit refund in the posting currency.");
  }
  if (total("client_liability", "debit") !== source.amountMinor || total("bank_control", "credit") !== source.amountMinor || total("client_liability", "credit") !== 0 || total("bank_control", "debit") !== 0) {
    throw new Error("A source refund posting must exactly debit client liability and credit bank control for the refund amount.");
  }
}
async function postTrustTransaction(_root, { data }, context) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !permissions.canManageTrust({ session })) {
    throw new Error("You do not have permission to post trust transactions.");
  }
  const description = requiredText(data.description, "Description", 2e3);
  if (!transactionTypes.has(data.transactionType)) throw new Error("Unsupported trust transaction type.");
  if (data.sourcePaymentId && data.sourceRefundId) {
    throw new Error("A trust transaction cannot reference both a source payment and a source refund.");
  }
  const occurredAt = new Date(data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("A valid occurrence timestamp is required.");
  if (occurredAt.getTime() > Date.now()) throw new Error("Trust transactions cannot be future-dated.");
  for (const entry of data.entries) normalizedMemo(entry.memo);
  const validatedInput = {
    idempotencyKey: data.idempotencyKey,
    trustAccountId: data.trustAccountId,
    currencyCode: data.currencyCode,
    occurredAt: data.occurredAt,
    description,
    entries: data.entries.map((entry) => ({
      ledgerAccountId: entry.ledgerAccountId ?? void 0,
      accountingBucket: entry.accountingBucket,
      direction: entry.direction,
      amountMinor: entry.amountMinor,
      currencyCode: entry.currencyCode ?? void 0,
      memo: entry.memo ?? void 0
    })),
    reversesTransactionId: data.reversesTransactionId ?? void 0,
    sourcePaymentId: data.sourcePaymentId ?? void 0,
    sourceRefundId: data.sourceRefundId ?? void 0
  };
  const validation = validateTrustPosting(validatedInput);
  const storedIdempotencyKey = `${firmId}:${validation.idempotencyKey}`;
  const postingDigest = computeTrustPostingDigest(data, description, occurredAt);
  const ledgerIds = [...new Set(data.entries.flatMap(
    (entry) => entry.ledgerAccountId ? [entry.ledgerAccountId] : []
  ))];
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storedIdempotencyKey}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${data.trustAccountId}`}))`;
    const replay = await tx.trustTransaction.findUnique({
      where: { idempotencyKey: storedIdempotencyKey },
      include: { entries: true }
    });
    if (replay) {
      if (replay.postingDigest !== postingDigest) {
        throw new Error("Idempotency key was already used for a different trust posting.");
      }
      await assertTrustReplayMatterAccess(tx, firmId, session.itemId, replay.entries);
      return { transaction: replay, replayed: true };
    }
    const account2 = await tx.trustAccount.findFirst({
      where: { id: data.trustAccountId, firmId, status: "active" },
      select: { id: true, currencyCode: true }
    });
    if (!account2) throw new Error("Active trust account not found in the active firm.");
    if (account2.currencyCode !== data.currencyCode) {
      throw new Error("Trust transaction currency must match the trust account currency.");
    }
    const completedPeriods = await tx.trustReconciliation.findMany({
      where: {
        firmId,
        trustAccountId: account2.id,
        status: "completed",
        periodEnd: { gte: occurredAt }
      },
      select: { status: true, periodStart: true, periodEnd: true }
    });
    assertTrustPostingPeriodOpen(occurredAt, completedPeriods);
    const ledgers = ledgerIds.length ? await tx.trustLedgerAccount.findMany({
      where: {
        id: { in: ledgerIds },
        firmId,
        trustAccountId: account2.id,
        currencyCode: data.currencyCode,
        status: "active",
        ...matterAccessWhere(session.itemId)
      },
      select: { id: true, matterId: true }
    }) : [];
    if (ledgers.length !== ledgerIds.length) {
      throw new Error("Every client ledger must be active, accessible, and belong to the selected trust account and firm.");
    }
    const ledgerById = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
    if (data.reversesTransactionId) {
      if (data.transactionType !== "reversal") {
        throw new Error("A transaction with a reversal reference must use the reversal type.");
      }
      const [original, priorReversal] = await Promise.all([
        tx.trustTransaction.findFirst({
          where: {
            id: data.reversesTransactionId,
            firmId,
            trustAccountId: account2.id,
            currencyCode: data.currencyCode
          },
          include: { entries: true }
        }),
        tx.trustTransaction.findFirst({
          where: { firmId, reversesTransactionId: data.reversesTransactionId },
          select: { id: true }
        })
      ]);
      if (!original) throw new Error("Reversed transaction not found in the selected trust account and firm.");
      if (priorReversal) throw new Error("The referenced trust transaction already has a reversal.");
      assertExactReversal(original.entries, data.entries, data.currencyCode);
    } else if (data.transactionType === "reversal") {
      throw new Error("A reversal must reference the transaction it corrects.");
    }
    if (data.sourcePaymentId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-source-payment:${firmId}:${data.sourcePaymentId}`}))`;
      const payment = await tx.payment.findFirst({
        where: { id: data.sourcePaymentId, firmId, ...matterAccessWhere(session.itemId) },
        select: {
          id: true,
          matterId: true,
          paymentType: true,
          status: true,
          amountMinor: true,
          currencyCode: true,
          trustAccountId: true,
          trustTransactions: { select: { id: true } }
        }
      });
      if (!payment) throw new Error("Payment not found in the accessible active-firm scope.");
      assertExactTrustSourcePosting({
        kind: "payment",
        source: payment,
        transactionType: data.transactionType,
        trustAccountId: account2.id,
        currencyCode: data.currencyCode,
        ledgers,
        entries: data.entries
      });
    }
    if (data.sourceRefundId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-source-refund:${firmId}:${data.sourceRefundId}`}))`;
      const refund = await tx.refund.findFirst({
        where: { id: data.sourceRefundId, firmId, ...matterAccessWhere(session.itemId) },
        select: {
          id: true,
          matterId: true,
          status: true,
          amountMinor: true,
          currencyCode: true,
          trustTransactions: { select: { id: true } },
          payment: { select: { paymentType: true, trustAccountId: true } }
        }
      });
      if (!refund) throw new Error("Refund not found in the accessible active-firm scope.");
      assertExactTrustSourcePosting({
        kind: "refund",
        source: refund,
        transactionType: data.transactionType,
        trustAccountId: account2.id,
        currencyCode: data.currencyCode,
        ledgers,
        entries: data.entries
      });
    }
    if (ledgerIds.length) {
      const historicalEntries = await tx.trustLedgerEntry.findMany({
        where: {
          firmId,
          ledgerAccountId: { in: ledgerIds },
          accountingBucket: "client_liability"
        },
        select: { ledgerAccountId: true, direction: true, amountMinor: true, occurredAt: true }
      });
      assertTrustLedgerHistoricalMinimumBalances(
        historicalEntries,
        data.entries.flatMap((entry) => entry.accountingBucket === "client_liability" && entry.ledgerAccountId ? [{ ledgerAccountId: entry.ledgerAccountId, direction: entry.direction, amountMinor: entry.amountMinor, occurredAt }] : [])
      );
    }
    const transaction = await tx.trustTransaction.create({
      data: {
        firmId,
        transactionNumber: `TRUST-${(0, import_node_crypto10.randomUUID)().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: storedIdempotencyKey,
        postingDigest,
        trustAccountId: account2.id,
        transactionType: data.transactionType,
        status: "posted",
        currencyCode: data.currencyCode,
        description,
        occurredAt,
        postedAt: /* @__PURE__ */ new Date(),
        postedById: session.itemId,
        postedByAgentId: session.agentPrincipalId ?? null,
        sourcePaymentId: data.sourcePaymentId ?? null,
        sourceRefundId: data.sourceRefundId ?? null,
        reversesTransactionId: data.reversesTransactionId ?? null
      }
    });
    await tx.trustLedgerEntry.createMany({
      data: data.entries.map((entry) => {
        const ledger = entry.ledgerAccountId ? ledgerById.get(entry.ledgerAccountId) : null;
        return {
          firmId,
          matterId: ledger?.matterId ?? null,
          transactionId: transaction.id,
          trustAccountId: account2.id,
          ledgerAccountId: entry.ledgerAccountId ?? null,
          accountingBucket: entry.accountingBucket,
          direction: entry.direction,
          amountMinor: entry.amountMinor,
          currencyCode: data.currencyCode,
          memo: normalizedMemo(entry.memo),
          occurredAt
        };
      })
    });
    const posted = await tx.trustTransaction.findUnique({
      where: { id: transaction.id },
      include: { entries: true }
    });
    if (!posted) throw new Error("Trust posting could not be reloaded after creation.");
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: `trust-posting:${storedIdempotencyKey}`,
        eventType: "trust.transaction_posted",
        category: "financial",
        outcome: "succeeded",
        ...workflowActor(context, session.itemId),
        trustTransactionId: posted.id,
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: {
          postingDigest,
          transactionType: data.transactionType,
          currencyCode: data.currencyCode,
          entryCount: data.entries.length,
          reversal: Boolean(data.reversesTransactionId)
        }
      }
    });
    return { transaction: posted, replayed: false };
  });
}

// features/keystone/mutations/communicationWorkflows.ts
var COMMUNICATION_DELIVERY_SNAPSHOT_VERSION = 1;
var MAX_RECIPIENTS = 50;
var participantRoles = /* @__PURE__ */ new Set(["staff", "client", "external_counsel", "third_party"]);
var singleEmailAddress = /^[^\s@<>,;()"]+@[^\s@<>,;()"]+\.[^\s@<>,;()"]+$/;
function isSingleEmailAddress(value) {
  return Boolean(value && value.length <= 254 && singleEmailAddress.test(value));
}
function communicationEnvelopeDigest(message) {
  return sha256Digest({ subject: message.subject ?? "", body: message.body ?? "" });
}
function communicationQueueDigest(message, deliveries) {
  return sha256Digest({
    messageId: message.id,
    firmId: message.firmId,
    matterId: message.matterId ?? null,
    threadId: message.threadId,
    envelopeDigest: communicationEnvelopeDigest(message),
    deliveries: deliveries.map((delivery) => ({
      id: delivery.id,
      channel: delivery.channel,
      provider: delivery.provider,
      integrationConnectionId: delivery.integrationConnectionId ?? null,
      recipientAddress: delivery.recipientAddress,
      participantId: delivery.providerMetadata?.participantId ?? null,
      envelopeDigest: delivery.providerMetadata?.envelopeDigest ?? null,
      snapshotVersion: delivery.providerMetadata?.snapshotVersion ?? null,
      attachments: delivery.providerMetadata?.attachments ?? []
    })).sort((a, b) => a.id.localeCompare(b.id))
  });
}
async function lockThread(tx, firmId, threadId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-thread:${firmId}:${threadId}`}))`;
}
async function resolveParticipantIdentity(tx, firmId, thread, args) {
  const identities = [args.userId, args.contactId, args.portalAccountId].filter(Boolean);
  if (identities.length !== 1) throw new Error("Choose exactly one staff member, contact or portal account.");
  if (args.contactMethodId && !args.contactId) throw new Error("A contact method can be chosen only for a contact participant.");
  if (args.userId) {
    if (args.participantRole !== "staff") throw new Error("Firm users can join a thread only as staff.");
    const membership = await tx.firmMembership.findFirst({
      where: { firmId, userId: args.userId, status: "active", user: { status: "active" }, role: { firmId, status: "active", canReadCommunications: true, ...thread.matterId ? { canReadMatters: true } : {} } },
      select: { user: { select: { email: true } } }
    });
    if (!membership) throw new Error("Staff participant must be an active member of the active firm.");
    if (thread.matterId) await assertMatterAccess(tx, firmId, thread.matterId, args.userId);
    return { userId: args.userId, displayAddress: membership.user?.email ?? "" };
  }
  if (args.participantRole === "staff") throw new Error("Staff participants must be firm users.");
  if (args.portalAccountId) {
    if (args.participantRole !== "client") throw new Error("Portal accounts can join a thread only as clients.");
    const account2 = await tx.portalAccount.findFirst({
      where: { id: args.portalAccountId, firmId, status: "active" },
      select: { id: true, email: true, contactId: true, contact: { select: { firmId: true, status: true } } }
    });
    if (!account2 || account2.contact?.firmId !== firmId || account2.contact.status === "archived" || !thread.matterId) throw new Error("Portal participant must be a current account/contact on this matter.");
    const identity = { firmId, portalAccountId: account2.id, contactId: account2.contactId };
    let after;
    let admitted = false;
    for (let page = 0; page < 32 && !admitted; page++) {
      const shares = await tx.portalShare.findMany({
        where: { ...portalShareCandidateWhere(identity, /* @__PURE__ */ new Date()), matterId: thread.matterId, resourceType: "communication_thread", communicationThreadId: thread.id, ...after ? { id: { gt: after } } : {} },
        select: portalShareHeaderSelect,
        orderBy: { id: "asc" },
        take: 32
      });
      for (const candidate of shares) {
        const share = boundPortalShare(candidate, identity);
        if (share && await portalShareIsCurrent(tx, share)) {
          admitted = true;
          break;
        }
      }
      if (shares.length < 32) break;
      after = shares[shares.length - 1].id;
    }
    if (!admitted) throw new Error("Portal recipient needs a current message-capable share of this exact thread.");
    return { portalAccountId: account2.id, contactId: account2.contactId ?? null, displayAddress: account2.email ?? "" };
  }
  const contact = await tx.contact.findFirst({
    where: { id: args.contactId, firmId, status: { not: "archived" } },
    select: { id: true, primaryEmail: true }
  });
  if (!contact) throw new Error("Contact participant must be an active contact in the active firm.");
  if (args.contactMethodId) {
    const method2 = await tx.contactMethod.findFirst({
      where: { id: args.contactMethodId, firmId, contactId: contact.id, methodType: "email", canContact: true },
      select: { value: true }
    });
    if (!method2) throw new Error("Contact method must be a contactable email address of this contact.");
    return { contactId: contact.id, displayAddress: method2.value };
  }
  const method = await tx.contactMethod.findFirst({
    where: { firmId, contactId: contact.id, methodType: "email", value: args.address ?? contact.primaryEmail, canContact: true },
    select: { value: true }
  });
  if (!method) throw new Error("Choose a currently contactable email method before preparing this recipient.");
  return { contactId: contact.id, displayAddress: method.value };
}
async function assertCurrentCommunicationRecipient(tx, message, participantId, expectedAddress) {
  await tx.$executeRaw`SELECT id FROM "Firm" WHERE id = ${message.firmId} FOR SHARE`;
  await tx.$executeRaw`SELECT id FROM "CommunicationThread" WHERE id = ${message.threadId} AND firm = ${message.firmId} FOR SHARE`;
  await tx.$executeRaw`SELECT id FROM "CommunicationParticipant" WHERE id = ${participantId} AND firm = ${message.firmId} FOR SHARE`;
  if (message.matterId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${message.matterId} AND firm = ${message.firmId} FOR SHARE`;
  }
  const thread = await tx.communicationThread.findFirst({
    where: { id: message.threadId, firmId: message.firmId, matterId: message.matterId, status: "open", firm: { status: "active" } },
    select: { id: true, matterId: true }
  });
  const participant = await tx.communicationParticipant.findFirst({
    where: { id: participantId, firmId: message.firmId, threadId: message.threadId, matterId: message.matterId, status: "active" }
  });
  if (!thread || !participant) throw new Error("Recipient or thread is no longer available.");
  if (participant.userId) {
    await tx.$executeRaw`SELECT u.id FROM "User" u JOIN "FirmMembership" m ON m."user" = u.id JOIN "Role" r ON r.id = m.role AND r.firm = m.firm WHERE u.id = ${participant.userId} AND m.firm = ${message.firmId} FOR SHARE OF u,m,r`;
  }
  if (participant.portalAccountId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${message.firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${message.firmId}:${participant.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT id FROM "PortalAccount" WHERE id = ${participant.portalAccountId} AND firm = ${message.firmId} FOR SHARE`;
  }
  if (participant.contactId) {
    await tx.$executeRaw`SELECT id FROM "Contact" WHERE id = ${participant.contactId} AND firm = ${message.firmId} FOR SHARE`;
    await tx.$executeRaw`SELECT id FROM "ContactMethod" WHERE contact = ${participant.contactId} AND firm = ${message.firmId} ORDER BY id FOR SHARE`;
  }
  const current = await resolveParticipantIdentity(tx, message.firmId, thread, {
    participantRole: participant.participantRole,
    userId: participant.userId,
    portalAccountId: participant.portalAccountId,
    contactId: participant.portalAccountId ? void 0 : participant.contactId,
    address: expectedAddress ?? participant.displayAddress
  });
  const address = expectedAddress ?? participant.displayAddress;
  if (!isSingleEmailAddress(current.displayAddress) || current.displayAddress !== address) throw new Error("Recipient address or contactability changed; prepare a new reviewed envelope.");
  return participant;
}
async function addCommunicationParticipant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  if (!participantRoles.has(args.participantRole)) throw new Error("Participant role is not available through this command.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    await lockThread(tx, firmId, args.threadId);
    const thread = await tx.communicationThread.findFirst({
      where: { id: args.threadId, firmId },
      select: { id: true, status: true, matterId: true }
    });
    if (!thread) throw new Error("Communication thread was not found in the active firm.");
    if (thread.matterId) await assertMatterAccess(tx, firmId, thread.matterId, userId);
    if (thread.status !== "open") throw new Error("Participants can be added only to open threads.");
    const identity = await resolveParticipantIdentity(tx, firmId, thread, args);
    const existing = await tx.communicationParticipant.findFirst({
      where: {
        firmId,
        threadId: thread.id,
        status: "active",
        userId: identity.userId ?? null,
        contactId: identity.contactId ?? null,
        portalAccountId: identity.portalAccountId ?? null
      }
    });
    if (existing) {
      if (existing.participantRole !== args.participantRole) {
        throw new Error("This identity already participates in the thread with a different role.");
      }
      await assertCurrentCommunicationRecipient(tx, { firmId, threadId: thread.id, matterId: thread.matterId }, existing.id, existing.displayAddress);
      return { participant: existing, replayed: true };
    }
    const participant = await tx.communicationParticipant.create({
      data: {
        firmId,
        matterId: thread.matterId ?? null,
        threadId: thread.id,
        userId: identity.userId ?? null,
        contactId: identity.contactId ?? null,
        portalAccountId: identity.portalAccountId ?? null,
        participantRole: args.participantRole,
        status: "active",
        displayAddress: identity.displayAddress,
        addedAt: /* @__PURE__ */ new Date()
      }
    });
    await assertCurrentCommunicationRecipient(tx, { firmId, threadId: thread.id, matterId: thread.matterId }, participant.id, participant.displayAddress);
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.participant_added",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: thread.matterId ?? null,
      contactId: identity.contactId ?? null,
      metadata: {
        threadId: thread.id,
        participantId: participant.id,
        participantRole: args.participantRole,
        identityDigest: sha256Digest({ ...identity, participantRole: args.participantRole })
      }
    });
    return { participant, replayed: false };
  });
}
async function removeCommunicationParticipant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  const reason = boundedReason(args.reason, "Participant removal reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    const identity = await tx.communicationParticipant.findFirst({
      where: { id: args.participantId, firmId },
      select: { threadId: true }
    });
    if (!identity) throw new Error("Communication participant was not found in the active firm.");
    await lockThread(tx, firmId, identity.threadId);
    const participant = await tx.communicationParticipant.findFirst({ where: { id: args.participantId, firmId } });
    if (!participant) throw new Error("Communication participant was not found in the active firm.");
    if (participant.matterId) await assertMatterAccess(tx, firmId, participant.matterId, userId);
    if (participant.status === "removed") return { participant, replayed: true };
    const removed = await tx.communicationParticipant.update({
      where: { id: participant.id },
      data: { status: "removed", removedAt: /* @__PURE__ */ new Date() }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.participant_removed",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: participant.matterId ?? null,
      contactId: participant.contactId ?? null,
      metadata: { threadId: participant.threadId, participantId: participant.id, reasonDigest: sha256Digest(reason) }
    });
    return { participant: removed, replayed: false };
  });
}
async function prepareCommunicationDeliveries(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  const reason = boundedReason(args.reason, "Delivery preparation reason", 5, 2e3);
  const participantIds = [...new Set((args.participantIds ?? []).map((id2) => id2?.trim()).filter(Boolean))].sort();
  if (!participantIds.length || participantIds.length > MAX_RECIPIENTS) {
    throw new Error(`Choose between 1 and ${MAX_RECIPIENTS} thread participants.`);
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`message:${firmId}:${args.messageId}`}))`;
    const message = await tx.communicationMessage.findFirst({
      where: { id: args.messageId, firmId },
      include: {
        attachments: {
          select: { id: true, firmId: true, checksumSha256: true, byteSize: true, document: { select: { matterId: true, status: true } } }
        },
        deliveries: { select: { id: true, status: true, providerMetadata: true } }
      }
    });
    if (!message) throw new Error("Communication message was not found in the active firm.");
    if (message.matterId) await assertMatterAccess(tx, firmId, message.matterId, userId);
    if (message.status !== "draft") throw new Error("Deliveries can be prepared only for draft messages.");
    if (message.direction !== "outbound") throw new Error("Only outbound messages have deliveries.");
    if (message.channel !== "email") {
      throw new Error("Only email delivery preparation is available; portal and SMS delivery adapters are not configured.");
    }
    if (message.deliveries.some((delivery) => delivery.status !== "pending")) {
      throw new Error("A message with delivery outcomes cannot be re-prepared.");
    }
    await lockThread(tx, firmId, message.threadId);
    const participants = await tx.communicationParticipant.findMany({
      where: { id: { in: participantIds }, firmId, threadId: message.threadId, status: "active" },
      select: { id: true, userId: true, contactId: true, portalAccountId: true, displayAddress: true },
      orderBy: { id: "asc" }
    });
    if (participants.length !== participantIds.length) {
      throw new Error("Every recipient must be an active participant of this message's thread.");
    }
    for (const participant of participants) {
      if (!isSingleEmailAddress(participant.displayAddress)) {
        throw new Error("Every email recipient needs one valid email address on the thread participant.");
      }
      await assertCurrentCommunicationRecipient(tx, message, participant.id, participant.displayAddress);
    }
    const attachments = message.attachments.map((attachment) => {
      if (attachment.firmId !== firmId || attachment.document?.status === "disposed" || message.matterId && attachment.document?.matterId !== message.matterId) {
        throw new Error("Attachments must be current versions from this firm and matter.");
      }
      return { versionId: attachment.id, checksumSha256: attachment.checksumSha256, byteSize: attachment.byteSize };
    }).sort((left, right) => left.versionId.localeCompare(right.versionId));
    let connection = null;
    if (args.integrationConnectionId) {
      connection = await tx.integrationConnection.findFirst({
        where: { id: args.integrationConnectionId, firmId, status: "active", category: "email" },
        select: { id: true, provider: true }
      });
      if (!connection) throw new Error("Delivery connection must be an active email integration in the active firm.");
    }
    const provider = connection?.provider ?? "smtp";
    const envelopeDigest = communicationEnvelopeDigest(message);
    const snapshots = participants.map((participant) => ({
      snapshotVersion: COMMUNICATION_DELIVERY_SNAPSHOT_VERSION,
      participantId: participant.id,
      envelopeDigest,
      attachments,
      destination: { channel: "email", provider, connectionId: connection?.id ?? null }
    }));
    const preparationDigest = sha256Digest({
      messageId: message.id,
      snapshots,
      recipients: participants.map((participant) => participant.displayAddress)
    });
    if (message.deliveries.length === snapshots.length && message.deliveries.every((delivery) => delivery.providerMetadata?.preparationDigest === preparationDigest)) {
      return { message, deliveries: message.deliveries, replayed: true };
    }
    const replaced = message.deliveries.length;
    if (replaced) await tx.communicationDelivery.deleteMany({ where: { firmId, messageId: message.id, status: "pending" } });
    const deliveries = [];
    for (const [index, participant] of participants.entries()) {
      deliveries.push(await tx.communicationDelivery.create({
        data: {
          firmId,
          matterId: message.matterId ?? null,
          messageId: message.id,
          integrationConnectionId: connection?.id ?? null,
          channel: "email",
          status: "pending",
          recipientContactId: participant.contactId ?? null,
          recipientAddress: participant.displayAddress,
          provider,
          attemptCount: 0,
          providerMetadata: { ...snapshots[index], preparationDigest }
        }
      }));
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.deliveries_prepared",
      category: "integration",
      ...workflowActor(context, userId),
      matterId: message.matterId ?? null,
      metadata: {
        messageId: message.id,
        deliveryCount: deliveries.length,
        replacedPendingCount: replaced,
        preparationDigest,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { message, deliveries, replayed: false };
  });
}

// features/keystone/webhooks/wire-contract.ts
var import_node_http = require("node:http");
function assertWebhookWireIdentity(eventId2, eventType) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,299}$/.test(eventId2)) throw new Error("Webhook event ID must be an 8\u2013300 character ASCII identifier.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,299}$/.test(eventType)) throw new Error("Webhook event type must be an ASCII identifier.");
}

// features/keystone/lib/secret-envelope.ts
var import_node_crypto11 = require("node:crypto");
function envelopeKey(override) {
  const encoded = override ?? process.env.INTEGRATION_CREDENTIAL_KEY;
  if (!encoded) throw new Error("INTEGRATION_CREDENTIAL_KEY is required.");
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) throw new Error("INTEGRATION_CREDENTIAL_KEY must encode exactly 32 bytes.");
  return key;
}
function encryptSecret(value, keyOverride) {
  if (!value || Buffer.byteLength(value, "utf8") > 32768) {
    throw new Error("Integration credential must be between 1 and 32768 bytes.");
  }
  const key = envelopeKey(keyOverride);
  const iv = (0, import_node_crypto11.randomBytes)(12);
  const cipher = (0, import_node_crypto11.createCipheriv)("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("openfront-law-firm:integration:v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}
function secretDigest(value, keyOverride) {
  return (0, import_node_crypto11.createHmac)("sha256", envelopeKey(keyOverride)).update(value).digest("hex");
}

// features/keystone/mutations/providerWorkflows.ts
function eventId(value) {
  const id2 = value?.trim();
  if (!id2 || id2.length < 8 || id2.length > 300) throw new Error("Provider event ID is invalid.");
  return id2;
}
function digest(value, label, required = false) {
  const normalized = value?.trim() ?? "";
  if (required && !/^[a-f0-9]{64}$/i.test(normalized)) throw new Error(`${label} must be a SHA-256 digest.`);
  if (normalized && !/^[a-f0-9]{64}$/i.test(normalized)) throw new Error(`${label} must be a SHA-256 digest.`);
  return normalized || null;
}
async function rotateIntegrationCredential(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  if (!(/* @__PURE__ */ new Set(["credentials", "oauth_access", "oauth_refresh", "webhook_secret"])).has(args.credentialType)) {
    throw new Error("Integration credential type is unsupported.");
  }
  const field = {
    credentials: "credentialsEncrypted",
    oauth_access: "oauthAccessToken",
    oauth_refresh: "oauthRefreshToken",
    webhook_secret: "webhookSecretDigest"
  }[args.credentialType];
  const protectedValue = args.credentialType === "webhook_secret" ? secretDigest(args.secret) : encryptSecret(args.secret);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    const connection = await tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId } });
    if (!connection || connection.status === "revoked") {
      throw new Error("Active integration connection was not found in the selected firm.");
    }
    const updated = await tx.integrationConnection.update({
      where: { id: connection.id },
      data: { [field]: protectedValue }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "integration.credential_rotated",
      category: "integration",
      actorUserId: userId,
      metadata: { connectionId: connection.id, credentialType: args.credentialType }
    });
    return updated;
  });
}
async function rotateWebhookSigningSecret(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const secret = args.secret ?? "";
  if (secret.length < 32 || secret.length > 4096 || secret.trim() !== secret) {
    throw new Error("Webhook signing secret must be 32-4096 characters without surrounding whitespace.");
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-subscription:${firmId}:${args.subscriptionId}`}))`;
    const subscription = await tx.webhookSubscription.findFirst({
      where: { id: args.subscriptionId, firmId },
      select: { id: true, status: true }
    });
    if (!subscription || subscription.status === "revoked") {
      throw new Error("Active webhook subscription was not found in the selected firm.");
    }
    const updated = await tx.webhookSubscription.update({
      where: { id: subscription.id },
      data: { signingSecretEncrypted: encryptSecret(secret), signingSecretDigest: secretDigest(secret) },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "integration.webhook_signing_secret_rotated",
      category: "integration",
      actorUserId: userId,
      metadata: { subscriptionId: subscription.id }
    });
    return updated;
  });
}
async function transitionIntegrationConnection(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const reason = boundedReason(args.reason, "Integration transition reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`integration:${firmId}:${args.connectionId}`}))`;
    const connection = await tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId } });
    if (!connection) throw new Error("Integration connection was not found in the active firm.");
    if (connection.status === args.toStatus) return { connection, replayed: true };
    assertLifecycleTransition("integrationConnection", connection.status, args.toStatus);
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: args.toStatus,
        ...args.toStatus === "needs_reauth" ? { lastErrorAt: now, lastError: reason } : {},
        ...args.toStatus === "active" ? { lastError: "" } : {},
        ...args.toStatus === "revoked" ? {
          credentialsEncrypted: "",
          oauthAccessToken: "",
          oauthRefreshToken: "",
          webhookSecretDigest: ""
        } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `integration.connection_${args.toStatus}`,
      category: "integration",
      actorUserId: userId,
      metadata: { connectionId: connection.id, fromStatus: connection.status, reasonDigest: sha256Digest(reason) }
    });
    return { connection: updated, replayed: false };
  });
}
async function enqueueWebhookDelivery(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations");
  const deliveryEventId = eventId(args.eventId);
  const eventType = optionalBoundedText(args.eventType, "Webhook event type", 300);
  if (!eventType) throw new Error("Webhook event type is required.");
  assertWebhookWireIdentity(deliveryEventId, eventType);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-delivery:${firmId}:${deliveryEventId}`}))`;
    const [connection, subscription] = await Promise.all([
      tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId }, select: { id: true, status: true } }),
      tx.webhookSubscription.findFirst({ where: { id: args.subscriptionId, firmId }, select: { id: true, status: true, connectionId: true, endpointUrl: true, eventTypes: true } })
    ]);
    if (!connection || connection.status !== "active") throw new Error("Webhook delivery requires an active connection.");
    if (!subscription || subscription.status !== "active" || subscription.connectionId !== connection.id) {
      throw new Error("Webhook subscription must be active and belong to the selected connection.");
    }
    if (!Array.isArray(subscription.eventTypes) || !subscription.eventTypes.includes(eventType)) {
      throw new Error("Webhook subscription is not subscribed to this event type.");
    }
    if (args.matterId) await assertMatterAccess(tx, firmId, args.matterId, userId);
    const existing = await tx.webhookDelivery.findFirst({ where: { firmId, eventId: deliveryEventId } });
    if (existing) throw new Error("Webhook delivery event ID already exists in the active firm.");
    const delivery = await tx.webhookDelivery.create({
      data: {
        firmId,
        matterId: args.matterId ?? null,
        connectionId: connection.id,
        subscriptionId: subscription.id,
        eventId: deliveryEventId,
        eventType,
        status: "pending",
        payload: args.payload ?? null,
        destinationUrl: subscription.endpointUrl,
        attemptCount: 0
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "webhook.delivery_enqueued",
      category: "integration",
      ...workflowActor(context, userId),
      matterId: args.matterId ?? null,
      metadata: { deliveryId: delivery.id, connectionId: connection.id, subscriptionId: subscription.id, authenticationType: context.session?.authenticationType ?? "human", credentialId: context.session?.credentialId ?? null, requestDigest: sha256Digest({ eventId: deliveryEventId, eventType, payload: args.payload ?? null, destinationUrl: subscription.endpointUrl }) }
    });
    return delivery;
  });
}
async function queueCommunicationMessage(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  const reason = boundedReason(args.reason, "Communication send reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`message:${firmId}:${args.messageId}`}))`;
    const message = await tx.communicationMessage.findFirst({
      where: { id: args.messageId, firmId },
      include: { deliveries: true }
    });
    if (!message) throw new Error("Communication message was not found in the active firm.");
    if (message.matterId) await assertMatterAccess(tx, firmId, message.matterId, userId);
    for (const delivery of message.deliveries) {
      await assertCurrentCommunicationRecipient(tx, message, delivery.providerMetadata?.participantId ?? "", delivery.recipientAddress);
    }
    if (message.status === "queued") return { message, replayed: true };
    assertLifecycleTransition("communicationMessage", message.status, "queued");
    if (!message.deliveries.length || message.deliveries.some((delivery) => delivery.status !== "pending")) {
      throw new Error("Message queueing requires at least one pending controlled delivery.");
    }
    const queued = await tx.communicationMessage.update({
      where: { id: message.id },
      data: { status: "queued", queuedAt: /* @__PURE__ */ new Date() }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.message_queued",
      category: "integration",
      actorUserId: userId,
      matterId: message.matterId,
      metadata: { messageId: message.id, deliveryCount: message.deliveries.length, reasonDigest: sha256Digest(reason), authenticationType: "human", intentVersion: 1, requestDigest: communicationQueueDigest(message, message.deliveries) }
    });
    return { message: queued, replayed: false };
  });
}
async function transitionCommunicationDelivery(_root, args, context) {
  requirePermission(context, "canManageCommunications", { humanOnly: true });
  throw new Error("Communication delivery outcomes are unavailable until authenticated provider ingress is configured.");
  const { session, firmId, userId } = requirePermission(context, "canManageCommunications");
  const providerEventId = eventId(args.providerEventId);
  const providerMessageId = optionalBoundedText(args.providerMessageId, "Provider message ID", 500);
  const errorCode = optionalBoundedText(args.errorCode, "Provider error code", 200);
  const errorMessage = optionalBoundedText(args.errorMessage, "Provider error message", 2e3);
  const prisma = context.prisma;
  const auditId = `communication:${providerEventId}`;
  const requestDigest = sha256Digest({
    deliveryId: args.deliveryId,
    toStatus: args.toStatus,
    providerMessageId: providerMessageId ?? null,
    errorCode: errorCode ?? null,
    errorMessage: errorMessage ?? null
  });
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auditId}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-delivery:${firmId}:${args.deliveryId}`}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditId } });
    const delivery = await tx.communicationDelivery.findFirst({ where: { id: args.deliveryId, firmId } });
    if (!delivery) throw new Error("Communication delivery was not found in the active firm.");
    if (delivery.matterId) await assertMatterAccess(tx, firmId, delivery.matterId, userId);
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Communication provider event ID was reused with a different payload.");
      }
      return { delivery, replayed: true };
    }
    assertLifecycleTransition("communicationDelivery", delivery.status, args.toStatus);
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: args.toStatus,
        providerMessageId: providerMessageId ?? "",
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        deliveredAt: args.toStatus === "delivered" ? now : null,
        errorCode: errorCode ?? "",
        errorMessage: errorMessage ?? ""
      }
    });
    const [message, deliveryStates] = await Promise.all([
      tx.communicationMessage.findUnique({ where: { id: delivery.messageId } }),
      tx.communicationDelivery.findMany({
        where: { messageId: delivery.messageId },
        select: { status: true }
      })
    ]);
    const statuses = deliveryStates.map((item) => item.status);
    const messageTarget = statuses.every((status) => status === "delivered") ? "delivered" : statuses.every((status) => (/* @__PURE__ */ new Set(["failed", "bounced"])).has(status)) ? "failed" : statuses.some((status) => (/* @__PURE__ */ new Set(["sent", "delivered"])).has(status)) ? "sent" : null;
    if (message && messageTarget && message.status !== messageTarget) {
      assertLifecycleTransition("communicationMessage", message.status, messageTarget);
      await tx.communicationMessage.update({
        where: { id: message.id },
        data: {
          status: messageTarget,
          ...messageTarget === "sent" ? { sentAt: now } : {}
        }
      });
    }
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditId,
        eventType: `communication.delivery_${args.toStatus}`,
        category: "integration",
        outcome: (/* @__PURE__ */ new Set(["failed", "bounced"])).has(args.toStatus) ? "failed" : "succeeded",
        ...workflowActor(context, userId),
        matterId: delivery.matterId,
        occurredAt: now,
        metadata: {
          deliveryId: delivery.id,
          fromStatus: delivery.status,
          providerMessageId,
          credentialId: session.credentialId ?? null,
          requestDigest
        }
      }
    });
    return { delivery: updated, replayed: false };
  });
}
async function addDocumentSigner(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const name = optionalBoundedText(args.name, "Signer name", 300);
  const email = optionalBoundedText(args.email, "Signer email", 320);
  const providerSignerId = optionalBoundedText(args.providerSignerId, "Provider signer ID", 500);
  const signingOrder = args.signingOrder ?? 1;
  if (!name || !email || !email.includes("@")) throw new Error("Signer name and email are required.");
  if (!Number.isInteger(signingOrder) || signingOrder < 1 || signingOrder > 1e3) throw new Error("Signer order is invalid.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${args.requestId}`}))`;
    const request = await tx.signatureRequest.findFirst({ where: { id: args.requestId, firmId } });
    if (!request || request.status !== "draft") throw new Error("Signers may be added only before provider handoff.");
    if (request.matterId) await assertMatterAccess(tx, firmId, request.matterId, userId);
    if (args.contactId && !await tx.contact.findFirst({ where: { id: args.contactId, firmId }, select: { id: true } })) {
      throw new Error("Signer contact was not found in the active firm.");
    }
    if (args.portalAccountId && !await tx.portalAccount.findFirst({ where: { id: args.portalAccountId, firmId }, select: { id: true } })) {
      throw new Error("Signer portal account was not found in the active firm.");
    }
    const signer = await tx.documentSigner.create({
      data: {
        firmId,
        matterId: request.matterId,
        requestId: request.id,
        contactId: args.contactId ?? null,
        portalAccountId: args.portalAccountId ?? null,
        name,
        email,
        signingOrder,
        status: "pending",
        providerSignerId: providerSignerId ?? ""
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "signature.signer_added",
      category: "integration",
      actorUserId: userId,
      matterId: request.matterId,
      metadata: { requestId: request.id, signerId: signer.id, identityDigest: sha256Digest({ name, email, signingOrder }) }
    });
    return signer;
  });
}
async function transitionDocumentSigner(_root, args, context) {
  requirePermission(context, "canManageDocuments", { humanOnly: true });
  throw new Error("Signature signer certification is unavailable until authenticated provider ingress is configured.");
  const { firmId, userId } = requirePermission(context, "canManageDocuments");
  const providerEventId = eventId(args.providerEventId);
  const evidenceDigest = digest(args.evidenceDigest, "Signature evidence digest", true);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature:${firmId}:${providerEventId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document-signer:${firmId}:${args.signerId}`}))`;
    const replay = await tx.signatureEvent.findFirst({ where: { firmId, providerEventId } });
    const signerIdentity = await tx.documentSigner.findFirst({ where: { id: args.signerId, firmId }, select: { requestId: true } });
    if (!signerIdentity) throw new Error("Document signer was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${signerIdentity.requestId}`}))`;
    const signer = await tx.documentSigner.findFirst({
      where: { id: args.signerId, firmId },
      include: { request: true }
    });
    if (!signer) throw new Error("Document signer was not found in the active firm.");
    if (signer.matterId) await assertMatterAccess(tx, firmId, signer.matterId, userId);
    if (replay) {
      if (replay.signerId !== signer.id || replay.requestId !== signer.requestId || replay.eventType !== `signer.${args.toStatus}` || replay.evidence?.digest !== evidenceDigest) {
        throw new Error("Signer provider event ID was reused with a different payload.");
      }
      return { request: signer.request, signer, event: replay, replayed: true };
    }
    if (!(/* @__PURE__ */ new Set(["sent", "partially_signed"])).has(signer.request.status)) {
      throw new Error("Signer evidence requires a signature request that has been sent.");
    }
    assertLifecycleTransition("signer", signer.status, args.toStatus);
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.documentSigner.update({
      where: { id: signer.id },
      data: {
        status: args.toStatus,
        ...args.toStatus === "viewed" ? { viewedAt: now } : {},
        ...args.toStatus === "signed" ? { signedAt: now } : {},
        ...args.toStatus === "declined" ? { declinedAt: now } : {}
      }
    });
    const signatureEvent = await tx.signatureEvent.create({
      data: {
        firmId,
        matterId: signer.matterId,
        requestId: signer.requestId,
        signerId: signer.id,
        eventType: `signer.${args.toStatus}`,
        providerEventId,
        occurredAt: now,
        evidence: { digest: evidenceDigest }
      }
    });
    return { request: signer.request, signer: updated, event: signatureEvent, replayed: false };
  });
}
async function transitionSignatureRequest(_root, args, context) {
  const { session, firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  if (args.toStatus !== "cancelled") {
    throw new Error("Signature provider outcomes are unavailable until authenticated provider ingress is configured.");
  }
  const providerEventId = eventId(args.providerEventId);
  const actorReference = optionalBoundedText(args.actorReference, "Signature actor reference", 500);
  const evidenceDigest = digest(args.evidenceDigest, "Signature evidence digest", true);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature:${firmId}:${providerEventId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${args.requestId}`}))`;
    const replay = await tx.signatureEvent.findFirst({ where: { firmId, providerEventId } });
    const request = await tx.signatureRequest.findFirst({
      where: { id: args.requestId, firmId },
      include: { signers: { select: { id: true, status: true } } }
    });
    if (!request) throw new Error("Signature request was not found in the active firm.");
    if (request.matterId) await assertMatterAccess(tx, firmId, request.matterId, userId);
    if (replay) {
      if (replay.requestId !== args.requestId || replay.signerId != null || replay.eventType !== `signature.${args.toStatus}` || replay.actorReference !== (actorReference ?? "") || replay.evidence?.digest !== evidenceDigest) {
        throw new Error("Signature provider event ID was reused with a different payload.");
      }
      return { request, event: replay, replayed: true };
    }
    assertLifecycleTransition("signatureRequest", request.status, args.toStatus);
    const signerStatuses = request.signers.map((signer) => signer.status);
    if (args.toStatus === "sent" && signerStatuses.length === 0) {
      throw new Error("Sending a signature request requires at least one immutable signer.");
    }
    if (args.toStatus === "partially_signed" && (!signerStatuses.includes("signed") || signerStatuses.every((status) => status === "signed"))) {
      throw new Error("A partially signed request requires some, but not all, signers to be signed.");
    }
    if (args.toStatus === "completed" && (!signerStatuses.length || signerStatuses.some((status) => status !== "signed"))) {
      throw new Error("Completing a signature request requires every signer to have controlled signed evidence.");
    }
    if (args.toStatus === "declined" && !signerStatuses.includes("declined")) {
      throw new Error("Declining a signature request requires controlled signer decline evidence.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.signatureRequest.update({
      where: { id: request.id },
      data: {
        status: args.toStatus,
        ...args.toStatus === "sent" ? { sentAt: now } : {},
        ...args.toStatus === "completed" ? { completedAt: now } : {}
      }
    });
    const signatureEvent = await tx.signatureEvent.create({
      data: {
        firmId,
        matterId: request.matterId,
        requestId: request.id,
        eventType: `signature.${args.toStatus}`,
        providerEventId,
        actorReference: actorReference ?? "",
        occurredAt: now,
        evidence: { digest: evidenceDigest }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `signature.${args.toStatus}`,
      category: "integration",
      ...workflowActor(context, userId),
      matterId: request.matterId,
      metadata: {
        signatureRequestId: request.id,
        signatureEventId: signatureEvent.id,
        evidenceDigest,
        credentialId: session.credentialId ?? null
      }
    });
    return { request: updated, event: signatureEvent, replayed: false };
  });
}
async function transitionDocument(_root, args, context) {
  assertCommandTarget("document", args.toStatus, ["active", "archived"]);
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Document transition reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document:${firmId}:${args.documentId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-document:${firmId}:${args.documentId}`}))`;
    const document2 = await tx.document.findFirst({ where: { id: args.documentId, firmId } });
    if (!document2) throw new Error("Document was not found in the active firm.");
    if (document2.matterId) await assertMatterAccess(tx, firmId, document2.matterId, userId);
    if (document2.status === args.toStatus) return { document: document2, replayed: true };
    assertLifecycleTransition("document", document2.status, args.toStatus);
    if (args.toStatus === "active" && !document2.currentVersionId) {
      throw new Error("Publishing a document requires an immutable current version.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.document.update({
      where: { id: document2.id },
      data: {
        status: args.toStatus,
        archivedAt: args.toStatus === "archived" ? now : null
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `document.${args.toStatus}`,
      category: "legal_workflow",
      actorUserId: userId,
      matterId: document2.matterId,
      documentId: document2.id,
      metadata: { fromStatus: document2.status, reasonDigest: sha256Digest(reason) }
    });
    return { document: updated, replayed: false };
  });
}

// features/keystone/lib/retention.ts
function evaluateRetentionDisposal(input) {
  if (input.holds.some((hold) => hold.status === "active" && !hold.releasedAt)) {
    return { allowed: false, reason: "An active retention hold blocks disposal." };
  }
  const eligibleAt = Date.parse(input.eligibleAt);
  if (!Number.isFinite(eligibleAt) || eligibleAt > input.now.getTime()) {
    return { allowed: false, reason: "The resource is not yet eligible for disposal." };
  }
  if (!input.approved) {
    return { allowed: false, reason: "Human disposal approval is required." };
  }
  return { allowed: true, reason: null };
}

// features/keystone/mutations/retentionWorkflows.ts
async function lockRetentionResources(tx, firmId, targets) {
  const keys = [
    targets.policyId ? `retention-policy:${firmId}:${targets.policyId}` : null,
    targets.matterId ? `retention-matter:${firmId}:${targets.matterId}` : null,
    targets.contactId ? `retention-contact:${firmId}:${targets.contactId}` : null,
    targets.documentId ? `retention-document:${firmId}:${targets.documentId}` : null
  ].filter(Boolean).sort();
  for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
async function transitionRetentionPolicy(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Retention policy transition reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await lockRetentionResources(tx, firmId, { policyId: args.policyId });
    const policy = await tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId } });
    if (!policy) throw new Error("Retention policy was not found in the active firm.");
    if (policy.status === args.toStatus) return { policy, replayed: true };
    assertLifecycleTransition("retentionPolicy", policy.status, args.toStatus);
    const updated = await tx.retentionPolicy.update({ where: { id: policy.id }, data: { status: args.toStatus } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `retention.policy_${args.toStatus}`,
      category: "retention",
      actorUserId: userId,
      metadata: {
        policyId: policy.id,
        fromStatus: policy.status,
        toStatus: args.toStatus,
        policyTermsDigest: sha256Digest({
          code: policy.code,
          recordClass: policy.recordClass,
          trigger: policy.trigger,
          retentionDays: policy.retentionDays,
          practiceAreaId: policy.practiceAreaId,
          jurisdictionReference: policy.jurisdictionReference
        }),
        reasonDigest: sha256Digest(reason)
      }
    });
    return { policy: updated, replayed: false };
  });
}
async function assignDocumentRetentionPolicy(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Retention policy assignment reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    const reference = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      select: { id: true, matterId: true }
    });
    if (!reference) throw new Error("Document was not found in the active firm.");
    await lockRetentionResources(tx, firmId, {
      policyId: args.policyId,
      documentId: reference.id,
      matterId: reference.matterId
    });
    const [document2, policy] = await Promise.all([
      tx.document.findFirst({ where: { id: reference.id, firmId } }),
      tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId, status: "active" } })
    ]);
    if (!document2 || document2.matterId !== reference.matterId) {
      throw new Error("Document retention scope changed concurrently; reload before retrying.");
    }
    if (document2.matterId) await assertMatterAccess(tx, firmId, document2.matterId, userId);
    if (!policy) throw new Error("Only an active retention policy can be assigned.");
    if (["archived", "disposed"].includes(document2.status)) {
      throw new Error("A document retention policy is frozen after archival.");
    }
    if (document2.retentionPolicyId === policy.id) return { document: document2, replayed: true };
    const updated = await tx.document.update({ where: { id: document2.id }, data: { retentionPolicyId: policy.id } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.document_policy_assigned",
      category: "retention",
      actorUserId: userId,
      matterId: document2.matterId,
      documentId: document2.id,
      metadata: {
        policyId: policy.id,
        priorPolicyId: document2.retentionPolicyId,
        policyTermsDigest: sha256Digest({
          code: policy.code,
          trigger: policy.trigger,
          retentionDays: policy.retentionDays,
          jurisdictionReference: policy.jurisdictionReference
        }),
        reasonDigest: sha256Digest(reason)
      }
    });
    return { document: updated, replayed: false };
  });
}
async function placeRetentionHold(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const name = boundedReason(args.name, "Hold name", 3, 300);
  const reason = boundedReason(args.reason, "Hold reason", 10, 4e3);
  const authorityReference = args.authorityReference?.trim() || "";
  if (authorityReference.length > 1e3) throw new Error("Hold authority reference is too long.");
  if (!args.matterId && !args.documentId && !args.contactId) throw new Error("A retention hold requires a matter, document, or contact target.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    const preliminaryDocument = args.documentId ? await tx.document.findFirst({ where: { id: args.documentId, firmId }, select: { id: true, matterId: true, contactId: true } }) : null;
    if (args.documentId && !preliminaryDocument) throw new Error("Hold document was not found in the active firm.");
    if (preliminaryDocument && args.matterId && args.matterId !== preliminaryDocument.matterId) {
      throw new Error("Hold matter must match the selected document.");
    }
    if (preliminaryDocument && args.contactId && args.contactId !== preliminaryDocument.contactId) {
      throw new Error("Hold contact must match the selected document.");
    }
    const canonicalTargets = {
      matterId: preliminaryDocument?.matterId ?? args.matterId ?? null,
      contactId: args.contactId ?? null,
      documentId: args.documentId ?? null
    };
    await lockRetentionResources(tx, firmId, canonicalTargets);
    const [matter, document2, contact, policy] = await Promise.all([
      canonicalTargets.matterId ? tx.matter.findFirst({ where: { id: canonicalTargets.matterId, firmId }, select: { id: true } }) : null,
      args.documentId ? tx.document.findFirst({ where: { id: args.documentId, firmId }, select: { id: true, matterId: true, contactId: true, status: true } }) : null,
      canonicalTargets.contactId ? tx.contact.findFirst({ where: { id: canonicalTargets.contactId, firmId }, select: { id: true } }) : null,
      args.policyId ? tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId }, select: { id: true } }) : null
    ]);
    if (canonicalTargets.matterId && !matter) throw new Error("Hold matter was not found in the active firm.");
    if (args.documentId && (!document2 || document2.matterId !== canonicalTargets.matterId || args.contactId && document2.contactId !== args.contactId)) {
      throw new Error("Hold document scope changed while the hold was being placed.");
    }
    if (document2?.status === "disposed") throw new Error("A hold cannot be placed after document disposal.");
    if (canonicalTargets.contactId && !contact) throw new Error("Hold contact was not found in the active firm.");
    if (args.policyId && !policy) throw new Error("Hold policy was not found in the active firm.");
    const matterId = canonicalTargets.matterId;
    if (matterId) await assertMatterAccess(tx, firmId, matterId, userId);
    const now = /* @__PURE__ */ new Date();
    const hold = await tx.retentionHold.create({
      data: {
        firmId,
        policyId: args.policyId ?? null,
        matterId,
        documentId: args.documentId ?? null,
        contactId: canonicalTargets.contactId,
        name,
        status: "active",
        reason,
        authorityReference,
        createdById: userId,
        effectiveAt: now
      }
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId,
        policyId: args.policyId ?? null,
        holdId: hold.id,
        actionType: "hold_applied",
        resourceType: args.documentId ? "document" : args.contactId ? "contact" : "matter",
        matterId,
        documentId: args.documentId ?? null,
        contactId: canonicalTargets.contactId,
        performedById: userId,
        approvedById: userId,
        occurredAt: now,
        evidenceDigest: sha256Digest({ holdId: hold.id, matterId, documentId: args.documentId ?? null, contactId: args.contactId ?? null, reason }),
        metadata: { authorityReferenceDigest: authorityReference ? sha256Digest(authorityReference) : null }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.hold_applied",
      category: "retention",
      actorUserId: userId,
      matterId,
      contactId: canonicalTargets.contactId,
      documentId: args.documentId ?? null,
      metadata: { holdId: hold.id, retentionActionId: action.id }
    });
    return { hold, action };
  });
}
async function releaseRetentionHold(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Hold release reason", 10, 4e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-hold:${firmId}:${args.holdId}`}))`;
    const hold = await tx.retentionHold.findFirst({ where: { id: args.holdId, firmId } });
    if (!hold) throw new Error("Retention hold was not found in the active firm.");
    if (hold.matterId) await assertMatterAccess(tx, firmId, hold.matterId, userId);
    if (hold.status === "released") return { hold, replayed: true };
    assertLifecycleTransition("retentionHold", hold.status, "released");
    const now = /* @__PURE__ */ new Date();
    const released = await tx.retentionHold.update({
      where: { id: hold.id },
      data: {
        status: "released",
        releasedById: userId,
        releasedAt: now,
        releaseReason: reason
      }
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId,
        policyId: hold.policyId,
        holdId: hold.id,
        actionType: "hold_released",
        resourceType: hold.documentId ? "document" : hold.contactId ? "contact" : "matter",
        matterId: hold.matterId,
        documentId: hold.documentId,
        contactId: hold.contactId,
        performedById: userId,
        approvedById: userId,
        evidenceDigest: sha256Digest({
          holdId: hold.id,
          reason,
          releasedAt: now.toISOString(),
          releasedBy: userId
        }),
        occurredAt: now,
        metadata: { reasonDigest: sha256Digest(reason) }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.hold_released",
      category: "retention",
      actorUserId: userId,
      matterId: hold.matterId,
      contactId: hold.contactId,
      documentId: hold.documentId,
      metadata: { holdId: hold.id, retentionActionId: action.id }
    });
    return { hold: released, replayed: false };
  });
}
function documentEligibility(document2) {
  const policy = document2.retentionPolicy;
  if (!policy || policy.status !== "active" || policy.recordClass !== "document") {
    throw new Error("Document requires an active document retention policy.");
  }
  let triggerAt = null;
  if (policy.trigger === "document_archived") triggerAt = document2.archivedAt;
  if (policy.trigger === "matter_closed") triggerAt = document2.matter?.closedAt ?? null;
  if (policy.trigger === "record_created") triggerAt = document2.createdAt;
  if (policy.trigger === "manual") {
    throw new Error("Manual retention policies require a future controlled policy operation before disposal.");
  }
  if (!triggerAt) throw new Error("Retention policy trigger has not occurred for this document.");
  return new Date(triggerAt.getTime() + policy.retentionDays * 24 * 60 * 6e4);
}
async function disposeRetainedDocument(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Disposal reason", 10, 4e3);
  const confirmation = args.confirmation?.trim();
  if (confirmation !== `DISPOSE ${args.documentId}`) {
    throw new Error("Disposal confirmation must exactly identify the document.");
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    const unlockedDocument = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      select: { matterId: true, contactId: true }
    });
    if (!unlockedDocument) throw new Error("Document was not found in the active firm.");
    await lockRetentionResources(tx, firmId, { ...unlockedDocument, documentId: args.documentId });
    const document2 = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      include: { retentionPolicy: true, matter: true }
    });
    if (!document2) throw new Error("Document was not found in the active firm.");
    if (document2.matterId) await assertMatterAccess(tx, firmId, document2.matterId, userId);
    if (document2.status === "disposed") {
      const action2 = await tx.retentionAction.findFirst({
        where: { firmId, documentId: document2.id, actionType: "disposed" },
        orderBy: { occurredAt: "desc" }
      });
      return { document: document2, action: action2, replayed: true };
    }
    if (document2.status !== "archived") throw new Error("Only an archived document can enter disposal.");
    const eligibleAt = documentEligibility(document2);
    const holds = await tx.retentionHold.findMany({
      where: {
        firmId,
        status: "active",
        OR: [
          { documentId: document2.id },
          ...document2.matterId ? [{ matterId: document2.matterId }] : [],
          ...document2.contactId ? [{ contactId: document2.contactId }] : []
        ]
      },
      select: { id: true, status: true, releasedAt: true }
    });
    const evaluation = evaluateRetentionDisposal({
      now: /* @__PURE__ */ new Date(),
      eligibleAt: eligibleAt.toISOString(),
      holds: holds.map((hold) => ({
        status: hold.status,
        releasedAt: hold.releasedAt?.toISOString() ?? null
      })),
      approved: true
    });
    if (!evaluation.allowed) throw new Error(evaluation.reason);
    assertLifecycleTransition("document", document2.status, "disposed");
    const now = /* @__PURE__ */ new Date();
    const evidenceDigest = sha256Digest({
      documentId: document2.id,
      policyId: document2.retentionPolicyId,
      eligibleAt: eligibleAt.toISOString(),
      disposedAt: now.toISOString(),
      approvedBy: userId,
      reason,
      versionCount: await tx.documentVersion.count({ where: { documentId: document2.id } })
    });
    const disposed = await tx.document.update({
      where: { id: document2.id },
      data: { status: "disposed", disposedAt: now }
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId,
        policyId: document2.retentionPolicyId,
        actionType: "disposed",
        resourceType: "document",
        matterId: document2.matterId,
        documentId: document2.id,
        performedById: userId,
        approvedById: userId,
        evidenceDigest,
        occurredAt: now,
        metadata: {
          eligibleAt: eligibleAt.toISOString(),
          reasonDigest: sha256Digest(reason),
          logicalDisposalOnly: true
        }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.document_disposed",
      category: "retention",
      actorUserId: userId,
      matterId: document2.matterId,
      documentId: document2.id,
      metadata: { retentionActionId: action.id, evidenceDigest, logicalDisposalOnly: true }
    });
    return { document: disposed, action, replayed: false };
  });
}

// features/keystone/mutations/executeAgentAction.ts
function envelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent action requires an object request envelope.");
  }
  return value;
}
function exactTarget(action, field, value) {
  const expected = action[field];
  if (expected && value !== expected) throw new Error(`Agent action envelope does not match approved ${field}.`);
}
async function assertActionMatterResource(prisma, action, model, id2) {
  if (!id2) throw new Error("Agent action resource identifier is required.");
  const item = await prisma[model].findFirst({
    where: {
      id: id2,
      firmId: action.firmId,
      ...action.matterId ? { matterId: action.matterId } : {}
    },
    select: { id: true }
  });
  if (!item) throw new Error("Agent action resource does not match the approved firm and matter scope.");
}
function resultSummary(result) {
  const candidates = [
    ["matter", "Matter"],
    ["invoice", "Invoice"],
    ["payment", "Payment"],
    ["refund", "Refund"],
    ["transaction", "TrustTransaction"],
    ["document", "Document"],
    ["request", "SignatureRequest"],
    ["check", "ConflictCheck"],
    ["action", "RetentionAction"],
    ["allocation", "PaymentAllocation"]
  ];
  for (const [key, type] of candidates) {
    if (result?.[key]?.id) return { resourceType: type, resourceId: result[key].id, replayed: Boolean(result.replayed) };
  }
  if (result?.id) return { resourceType: "Record", resourceId: result.id, replayed: false };
  return { resourceType: "Operation", resourceId: null, replayed: Boolean(result?.replayed) };
}
async function recordAgentActionSucceeded(tx, action, summary, agentPrincipalId) {
  const now = /* @__PURE__ */ new Date();
  const resultDigest = sha256Digest(summary);
  const updated = await tx.agentAction.updateMany({
    where: { id: action.id, status: "executing", startedAt: action.startedAt },
    data: { status: "succeeded", completedAt: now, resultDigest, resultEnvelope: summary }
  });
  if (updated.count !== 1) throw new Error("Agent action is no longer executing.");
  await tx.agentActionEvent.create({
    data: {
      firmId: action.firmId,
      matterId: action.matterId,
      actionId: action.id,
      eventType: "agent_action.succeeded",
      fromStatus: "executing",
      toStatus: "succeeded",
      actorAgentId: agentPrincipalId,
      occurredAt: now,
      metadata: { resultDigest, ...summary }
    }
  });
  await recordAuditEvent(tx, {
    firmId: action.firmId,
    eventType: "agent.action_succeeded",
    category: "agent",
    actorAgentId: agentPrincipalId,
    matterId: action.matterId,
    agentActionId: action.id,
    metadata: { resultDigest, ...summary }
  });
  return tx.agentAction.findUnique({ where: { id: action.id } });
}
async function dispatchAction(action, approvedContext) {
  const data = envelope(action.requestEnvelope);
  if (action.actionType === "task.draft") {
    if (!action.matterId) throw new Error("Task drafting requires an approved matter scope.");
    const title = String(data.title ?? "").trim();
    const description = String(data.description ?? "").trim() || null;
    const dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (!title || title.length > 300 || description && description.length > 4e3 || dueAt && Number.isNaN(dueAt.getTime())) {
      throw new Error("Agent task draft title, description, or due date is invalid.");
    }
    const session = approvedContext.session;
    return runSerializableTransaction(approvedContext.prisma, async (tx) => {
      await assertCurrentCommandActor(tx, approvedContext, "canManageTasks");
      await assertMatterAccess(tx, action.firmId, action.matterId, session.itemId);
      await tx.$executeRaw`SELECT id FROM "AgentAction" WHERE id = ${action.id} FOR UPDATE`;
      const current = await tx.agentAction.findFirst({ where: { id: action.id, status: "executing", startedAt: action.startedAt }, select: { id: true } });
      if (!current) throw new Error("Agent action is no longer executing.");
      const task = await tx.legalTask.create({
        data: {
          firmId: action.firmId,
          matterId: action.matterId,
          title,
          description: description ?? "",
          status: "open",
          priority: (/* @__PURE__ */ new Set(["low", "normal", "high", "urgent"])).has(data.priority) ? data.priority : "normal",
          assignedToId: session.itemId,
          assignedById: session.itemId,
          dueAt
        }
      });
      const summary = { resourceType: "LegalTask", resourceId: task.id, replayed: false };
      const completedAction = await recordAgentActionSucceeded(tx, action, summary, session.agentPrincipalId);
      return { task, completedAction };
    });
  }
  if (action.actionType === "matter.transition") {
    exactTarget(action, "matterId", data.matterId);
    return transitionMatter(null, {
      matterId: data.matterId,
      toStatus: data.toStatus,
      reason: data.reason
    }, approvedContext);
  }
  if (action.actionType === "conflict.resolve") {
    await assertActionMatterResource(approvedContext.prisma, action, "conflictCheck", data.checkId);
    if (data.operation === "finalize") {
      return finalizeConflictCheck(null, {
        checkId: data.checkId,
        outcome: data.outcome,
        summary: data.summary
      }, approvedContext);
    }
    return recordConflictDisposition(null, {
      checkId: data.checkId,
      matchId: data.matchId,
      outcome: data.outcome,
      rationale: data.rationale,
      conditions: data.conditions,
      policyReference: data.policyReference
    }, approvedContext);
  }
  if (action.actionType === "invoice.issue") {
    exactTarget(action, "invoiceId", data.invoiceId);
    return transitionInvoice(null, {
      invoiceId: data.invoiceId,
      toStatus: "issued",
      dueAt: data.dueAt,
      reason: data.reason
    }, approvedContext);
  }
  if (action.actionType === "payment.capture") {
    exactTarget(action, "paymentId", data.paymentId);
    return transitionPayment(null, {
      paymentId: data.paymentId,
      toStatus: "captured",
      eventId: `agent-action-${action.id}`,
      providerPaymentId: data.providerPaymentId
    }, approvedContext);
  }
  if (action.actionType === "payment.refund") {
    exactTarget(action, "paymentId", data.paymentId);
    if (data.operation === "provider_outcome") {
      return recordRefundProviderOutcome(null, {
        refundId: data.refundId,
        toStatus: data.toStatus,
        eventId: `agent-action-${action.id}`,
        providerRefundId: data.providerRefundId,
        failureReason: data.failureReason
      }, approvedContext);
    }
    return requestRefund(null, {
      paymentId: data.paymentId,
      amountMinor: data.amountMinor,
      reason: data.reason,
      explanation: data.explanation,
      idempotencyKey: `agent-refund-${action.id}`
    }, approvedContext);
  }
  if (action.actionType === "trust.post") {
    if (action.matterId) {
      const ledgerIds = [...new Set((data.entries ?? []).flatMap((entry) => entry.ledgerAccountId ? [entry.ledgerAccountId] : []))];
      if (!ledgerIds.length) throw new Error("Matter-scoped trust actions require an exact client ledger.");
      const count = await approvedContext.prisma.trustLedgerAccount.count({
        where: { id: { in: ledgerIds }, firmId: action.firmId, matterId: action.matterId }
      });
      if (count !== ledgerIds.length) throw new Error("Trust action ledger does not match the approved matter scope.");
    }
    return postTrustTransaction(null, { data }, approvedContext);
  }
  if (action.actionType === "retention.dispose") {
    exactTarget(action, "documentId", data.documentId);
    return disposeRetainedDocument(null, {
      documentId: data.documentId,
      reason: data.reason,
      confirmation: data.confirmation
    }, approvedContext);
  }
  if (action.actionType === "communication.send") {
    await assertActionMatterResource(approvedContext.prisma, action, "communicationMessage", data.messageId);
    return queueCommunicationMessage(null, {
      messageId: data.messageId,
      reason: data.reason
    }, approvedContext);
  }
  if (action.actionType === "document.publish") {
    exactTarget(action, "documentId", data.documentId);
    return transitionDocument(null, {
      documentId: data.documentId,
      toStatus: "active",
      reason: data.reason
    }, approvedContext);
  }
  if (action.actionType === "signature.send") {
    await assertActionMatterResource(approvedContext.prisma, action, "signatureRequest", data.requestId);
    return transitionSignatureRequest(null, {
      requestId: data.requestId,
      toStatus: "sent",
      providerEventId: `agent-action-${action.id}`,
      actorReference: action.agentPrincipalId,
      evidenceDigest: sha256Digest({ actionId: action.id, requestDigest: action.requestDigest })
    }, approvedContext);
  }
  throw new Error("This agent action type has no controlled execution adapter.");
}
async function executeAgentAction(_root, args, context) {
  const session = context.session;
  if (!session?.itemId || session.authenticationType !== "agent" || !session.agentPrincipalId) {
    throw new Error("An authenticated agent credential is required to execute an action.");
  }
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma);
  const claimed = await runSerializableTransaction(prisma, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-action:${args.actionId}`}))`;
    let action = await tx.agentAction.findFirst({
      where: { id: args.actionId, agentPrincipalId: session.agentPrincipalId },
      include: { grant: true, agentPrincipal: true }
    });
    if (!action) throw new Error("Agent action was not found for the authenticated principal.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-grant:${action.firmId}:${action.grantId}`}))`;
    action = await tx.agentAction.findFirst({
      where: { id: args.actionId, agentPrincipalId: session.agentPrincipalId },
      include: { grant: true, agentPrincipal: true }
    });
    if (!action) throw new Error("Agent action was not found for the authenticated principal.");
    await assertCurrentAgentCredential(tx, context, action.actionType);
    if (action.status === "succeeded") return { action, replayed: true, reviewerSession: null };
    const now = /* @__PURE__ */ new Date();
    const recovering = action.status === "executing" && agentExecutionLeaseExpired(action.startedAt, now) && replaySafeAgentActions.has(action.actionType);
    if (action.status === "executing" && !recovering) {
      throw new Error("Agent action is already executing; an unfinished execution can be recovered only after its lease expires, and only for replay-safe actions.");
    }
    if (action.status !== "approved" && !recovering) throw new Error("Agent action is not approved for execution.");
    if (!session.agentCapabilities?.includes(action.actionType)) {
      throw new Error("Agent credential no longer covers this action.");
    }
    if (action.agentPrincipal.status !== "active" || action.grant.status !== "active" || action.grant.startsAt && action.grant.startsAt > now || action.grant.expiresAt && action.grant.expiresAt <= now || !Array.isArray(action.grant.capabilities) || !action.grant.capabilities.includes(action.actionType)) {
      throw new Error("Agent principal or grant is no longer valid for this action.");
    }
    const requiredPermission = actionPermission[action.actionType];
    if (!requiredPermission) throw new Error("Agent action type is unsupported.");
    let reviewerSession = null;
    let approval = null;
    if (highRiskAgentActions.has(action.actionType)) {
      if (!action.approvedById || !action.approvalExpiresAt || action.approvalExpiresAt <= now) {
        throw new Error("Agent action approval is missing or expired.");
      }
      const expectedDigest = computeAgentApprovalDigest({
        actionId: action.id,
        actionType: action.actionType,
        matterId: action.matterId,
        requestDigest: action.requestDigest,
        approvalExpiresAt: action.approvalExpiresAt
      });
      if (action.approvalDigest !== expectedDigest) throw new Error("Agent action approval digest is invalid.");
      reviewerSession = await loadActiveHumanSession(tx, action.approvedById, action.firmId);
      if (!reviewerSession || !permissions.canApproveAgentActions({ session: reviewerSession }) || !permissions[requiredPermission]({ session: reviewerSession })) {
        throw new Error("The current human approval authority is no longer valid.");
      }
      approval = {
        status: "approved",
        actionType: action.actionType,
        requestDigest: action.requestDigest,
        firmId: action.firmId,
        matterId: action.matterId,
        approverUserId: action.approvedById,
        approverCanApproveAgentActions: true,
        approverHasDomainPermission: true,
        expiresAt: action.approvalExpiresAt.toISOString()
      };
    } else {
      reviewerSession = await loadActiveHumanSession(tx, action.agentPrincipal.ownerId, action.firmId);
      if (!reviewerSession) throw new Error("Agent owner is no longer an active firm member.");
    }
    const authorization = authorizeAgentAction({
      now,
      activeFirmId: action.firmId,
      matterId: action.matterId,
      actionType: action.actionType,
      requestDigest: action.requestDigest,
      grant: {
        status: action.grant.status,
        firmId: action.firmId,
        matterId: action.grant.matterId,
        capabilities: action.grant.capabilities,
        expiresAt: action.grant.expiresAt?.toISOString() ?? null
      },
      approval
    });
    if (!authorization.allowed) throw new Error(authorization.reason ?? "Agent action is not authorized.");
    const claimed2 = await tx.agentAction.updateMany({
      where: recovering ? { id: action.id, status: "executing", startedAt: action.startedAt } : { id: action.id, status: "approved" },
      data: { status: "executing", startedAt: now }
    });
    if (claimed2.count !== 1) throw new Error("Agent action was claimed by another executor.");
    await tx.agentActionEvent.create({
      data: {
        firmId: action.firmId,
        matterId: action.matterId,
        actionId: action.id,
        eventType: recovering ? "agent_action.execution_recovered" : "agent_action.executing",
        fromStatus: recovering ? "executing" : "approved",
        toStatus: "executing",
        actorAgentId: session.agentPrincipalId,
        occurredAt: now,
        metadata: { requestDigest: action.requestDigest }
      }
    });
    return { action: { ...action, status: "executing", startedAt: now }, replayed: false, reviewerSession };
  });
  if (claimed.replayed) return { action: claimed.action, replayed: true };
  const approvedContext = context.withSession({
    ...claimed.reviewerSession,
    agentPrincipalId: session.agentPrincipalId,
    agentExecution: { actionId: claimed.action.id, claimStartedAt: claimed.action.startedAt.toISOString(), credentialSession: session }
  });
  let result;
  try {
    result = await dispatchAction(claimed.action, approvedContext);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Controlled action execution failed.";
    await runSerializableTransaction(prisma, async (tx) => {
      const now = /* @__PURE__ */ new Date();
      const failed = await tx.agentAction.updateMany({
        where: { id: claimed.action.id, status: "executing", startedAt: claimed.action.startedAt },
        data: {
          status: "failed",
          completedAt: now,
          errorMessage: message.slice(0, 2e3),
          resultDigest: sha256Digest({ error: message })
        }
      });
      if (failed.count !== 1) return;
      await tx.agentActionEvent.create({
        data: {
          firmId: claimed.action.firmId,
          matterId: claimed.action.matterId,
          actionId: claimed.action.id,
          eventType: "agent_action.failed",
          fromStatus: "executing",
          toStatus: "failed",
          actorAgentId: session.agentPrincipalId,
          occurredAt: now,
          reason: message.slice(0, 2e3)
        }
      });
    });
    throw new Error("Agent action execution failed; immutable failure evidence was recorded.");
  }
  if (result?.completedAction) return { action: result.completedAction, replayed: false };
  try {
    const completed = await runSerializableTransaction(
      prisma,
      (tx) => recordAgentActionSucceeded(tx, claimed.action, resultSummary(result), session.agentPrincipalId)
    );
    return { action: completed, replayed: false };
  } catch {
    console.error("Agent action completion evidence could not be recorded", { actionId: claimed.action.id });
    throw new Error("The agent action effect committed, but its completion evidence could not be recorded; it remains executing for recovery.");
  }
}

// features/keystone/mutations/grantWorkflows.ts
var grantCapabilities = /* @__PURE__ */ new Set([
  "matter.read",
  "privileged.read",
  "task.draft",
  "communication.send",
  "document.publish",
  "signature.send",
  "matter.transition",
  "conflict.resolve",
  "invoice.issue",
  "billing.write",
  "payment.capture",
  "payment.refund",
  "trust.post",
  "retention.dispose",
  "access.change"
]);
async function transitionAgentPrincipal(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageAgents", { humanOnly: true });
  const reason = boundedReason(args.reason, "Agent-principal transition reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-principal:${firmId}:${args.principalId}`}))`;
    const principal = await tx.agentPrincipal.findFirst({ where: { id: args.principalId, firmId } });
    if (!principal) throw new Error("Agent principal was not found in the active firm.");
    if (principal.status === args.toStatus) return { principal, replayed: true };
    assertLifecycleTransition("agentPrincipal", principal.status, args.toStatus);
    const updated = await tx.agentPrincipal.update({ where: { id: principal.id }, data: { status: args.toStatus } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `agent.principal_${args.toStatus}`,
      category: "agent",
      actorUserId: userId,
      metadata: {
        principalId: principal.id,
        fromStatus: principal.status,
        toStatus: args.toStatus,
        identityDigest: sha256Digest({ ownerId: principal.ownerId, agentType: principal.agentType }),
        reasonDigest: sha256Digest(reason)
      }
    });
    return { principal: updated, replayed: false };
  });
}
async function updateAgentGrantAuthority(_root, args, context) {
  const { session, firmId, userId } = requirePermission(context, "canManageAgents", { humanOnly: true });
  const reason = boundedReason(args.reason, "Agent grant authority reason", 5, 2e3);
  const capabilities = args.capabilities == null ? null : [...new Set(args.capabilities)];
  if (capabilities && (capabilities.length > 30 || capabilities.some((value) => !grantCapabilities.has(value)))) {
    throw new Error("Agent grant capabilities contain an unsupported value.");
  }
  const startsAt = args.startsAt ? new Date(args.startsAt) : null;
  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
  if (args.startsAt && Number.isNaN(startsAt.getTime()) || args.expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("Agent grant authority dates are invalid.");
  }
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new Error("Agent grant expiration must follow its start.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-grant:${firmId}:${args.grantId}`}))`;
    const grant = await tx.agentGrant.findFirst({ where: { id: args.grantId, firmId } });
    if (!grant) throw new Error("Agent grant was not found in the active firm.");
    if (grant.matterId) await assertMatterAccess(tx, firmId, grant.matterId, userId);
    if ((/* @__PURE__ */ new Set(["suspended", "revoked", "expired"])).has(args.toStatus)) {
      const executingActions = await tx.agentAction.count({
        where: { grantId: grant.id, status: "executing", startedAt: { gt: new Date(Date.now() - AGENT_EXECUTION_LEASE_MS) } }
      });
      if (executingActions) throw new Error("Agent grant authority cannot change while an action is executing.");
    }
    if (grant.status !== args.toStatus) assertLifecycleTransition("agentGrant", grant.status, args.toStatus);
    const finalCapabilities = capabilities ?? grant.capabilities;
    const finalStartsAt = args.startsAt === void 0 ? grant.startsAt : startsAt;
    const finalExpiresAt = args.expiresAt === void 0 ? grant.expiresAt : expiresAt;
    const authorityChanged = JSON.stringify(finalCapabilities) !== JSON.stringify(grant.capabilities) || String(finalStartsAt ?? "") !== String(grant.startsAt ?? "") || String(finalExpiresAt ?? "") !== String(grant.expiresAt ?? "") || grant.status !== args.toStatus;
    const requiresApproval = args.toStatus === "active" && authorityChanged;
    if (requiresApproval && !permissions.canApproveAgentActions({ session })) {
      throw new Error("Activating or renewing agent authority requires agent-approval permission.");
    }
    if (requiresApproval) await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    const authorityDigest = sha256Digest({
      grantId: grant.id,
      agentPrincipalId: grant.agentPrincipalId,
      matterId: grant.matterId,
      capabilities: finalCapabilities,
      startsAt: finalStartsAt?.toISOString?.() ?? finalStartsAt ?? null,
      expiresAt: finalExpiresAt?.toISOString?.() ?? finalExpiresAt ?? null,
      status: args.toStatus,
      reason
    });
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.agentGrant.update({
      where: { id: grant.id },
      data: {
        status: args.toStatus,
        capabilities: finalCapabilities,
        reason,
        startsAt: finalStartsAt,
        expiresAt: finalExpiresAt,
        ...requiresApproval ? { approvedById: userId, approvedAt: now } : {},
        ...args.toStatus === "suspended" ? { suspendedAt: now } : {},
        ...args.toStatus === "revoked" ? { revokedAt: now } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `agent.grant_${args.toStatus}`,
      category: "agent",
      actorUserId: userId,
      matterId: grant.matterId,
      metadata: {
        grantId: grant.id,
        agentPrincipalId: grant.agentPrincipalId,
        fromStatus: grant.status,
        authorityDigest,
        approvedBy: requiresApproval ? userId : grant.approvedById
      }
    });
    return { grant: updated, authorityDigest };
  });
}

// features/keystone/mutations/credentials.ts
var import_node_crypto12 = require("node:crypto");
function requireHumanSession(context, permission) {
  const session = context.session;
  const firmId = activeFirmId(session);
  if (!session?.itemId || !firmId || !isInteractiveHumanSession(session) || !permissions[permission]({ session })) {
    throw new Error("A human administrator with credential authority is required.");
  }
  return { session, firmId };
}
function boundedName(value, label) {
  const name = value?.trim();
  if (!name || name.length > 120) throw new Error(`${label} must be between 1 and 120 characters.`);
  return name;
}
function boundedReason2(value) {
  const reason = value?.trim();
  if (!reason || reason.length < 3 || reason.length > 1e3) {
    throw new Error("A revocation reason between 3 and 1000 characters is required.");
  }
  return reason;
}
function futureExpiration(value, maxDays) {
  if (!value) return null;
  const expiresAt = new Date(value);
  const now = Date.now();
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > now + maxDays * 24 * 60 * 60 * 1e3) {
    throw new Error(`Expiration must be in the future and within ${maxDays} days.`);
  }
  return expiresAt;
}
async function audit(tx, data) {
  await tx.auditEvent.create({
    data: {
      firmId: data.firmId,
      eventId: (0, import_node_crypto12.randomUUID)(),
      eventType: data.eventType,
      category: "authentication",
      outcome: "succeeded",
      actorUserId: data.actorUserId,
      actorType: "user",
      occurredAt: /* @__PURE__ */ new Date(),
      metadata: data.metadata
    }
  });
}
async function issueApiKey(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const name = boundedName(args.name, "API key name");
  const scopes = normalizeMachineScopes(args.scopes);
  const ownerId = args.ownerId ?? session.itemId;
  const expiresAt = futureExpiration(args.expiresAt, 366);
  const credential = issueCredential("api_key");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const owner = await lockCurrentFirmMember(tx, ownerId, firmId);
    if (!owner || owner.data.activeFirm?.status !== "active" || scopes.some(
      (scope) => machineScopePermissionMap[scope].some((permission) => !permissions[permission]({ session: owner }))
    )) {
      throw new Error("API-key scopes must be within the current same-firm owner role.");
    }
    const key = await tx.apiKey.create({
      data: {
        firmId,
        ownerId,
        name,
        prefix: credential.prefix,
        secretDigest: credential.digest,
        status: "active",
        scopes,
        expiresAt,
        createdById: session.itemId
      }
    });
    await audit(tx, {
      firmId,
      eventType: "api_key.issued",
      actorUserId: session.itemId,
      metadata: { apiKeyId: key.id, ownerId, scopes, expiresAt: expiresAt?.toISOString() ?? null }
    });
    return { credential: key, secret: credential.token };
  });
}
async function revokeApiKey(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const reason = boundedReason2(args.reason);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const key = await tx.apiKey.findFirst({ where: { id: args.id, firmId } });
    if (!key) throw new Error("API key was not found in the active firm.");
    if (key.status === "revoked") return { credential: key, replayed: true };
    const revoked = await tx.apiKey.update({
      where: { id: key.id },
      data: {
        status: "revoked",
        revokedById: session.itemId,
        revokedAt: /* @__PURE__ */ new Date(),
        revocationReason: `sha256:${sha256Digest(reason)}`
      }
    });
    await audit(tx, {
      firmId,
      eventType: "api_key.revoked",
      actorUserId: session.itemId,
      metadata: { apiKeyId: key.id, reasonDigest: sha256Digest(reason) }
    });
    return { credential: revoked, replayed: false };
  });
}
async function issueOAuthClient(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const name = boundedName(args.name, "OAuth client name");
  const redirectUris = normalizeRedirectUris(args.redirectUris);
  const scopes = normalizeMachineScopes(args.scopes);
  const description = args.description?.trim() || null;
  if (description && description.length > 2e3) throw new Error("OAuth client description is too long.");
  const clientId = `olfc_${(0, import_node_crypto12.randomUUID)().replaceAll("-", "")}`;
  const secret = issueCredential("oauth_client");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const client = await tx.oAuthClient.create({
      data: {
        firmId,
        ownerId: session.itemId,
        name,
        clientId,
        clientSecretDigest: secret.digest,
        status: "active",
        isConfidential: true,
        redirectUris,
        allowedScopes: scopes,
        description: description ?? "",
        createdById: session.itemId
      }
    });
    await audit(tx, {
      firmId,
      eventType: "oauth_client.issued",
      actorUserId: session.itemId,
      metadata: { oauthClientId: client.id, clientId, redirectUris, scopes }
    });
    return { client, clientSecret: secret.token };
  });
}
async function revokeOAuthClient(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const reason = boundedReason2(args.reason);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const client = await tx.oAuthClient.findFirst({ where: { id: args.id, firmId } });
    if (!client) throw new Error("OAuth client was not found in the active firm.");
    if (client.status === "revoked") return { client, replayed: true };
    const now = /* @__PURE__ */ new Date();
    const revoked = await tx.oAuthClient.update({
      where: { id: client.id },
      data: { status: "revoked", revokedById: session.itemId, revokedAt: now }
    });
    await Promise.all([
      tx.oAuthToken.updateMany({
        where: { clientId: client.id, status: "active" },
        data: { status: "revoked", revokedAt: now }
      }),
      tx.oAuthConsent.updateMany({
        where: { clientId: client.id, status: "active" },
        data: { status: "revoked", revokedAt: now }
      })
    ]);
    await audit(tx, {
      firmId,
      eventType: "oauth_client.revoked",
      actorUserId: session.itemId,
      metadata: { oauthClientId: client.id, reasonDigest: sha256Digest(reason) }
    });
    return { client: revoked, replayed: false };
  });
}
async function issueAgentCredential(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canApproveAgentActions");
  if (!permissions.canManageAgents({ session })) {
    throw new Error("Agent-management permission is required.");
  }
  const name = boundedName(args.name, "Agent credential name");
  const capabilities = normalizeAgentCapabilities(args.capabilities);
  const expiresAt = futureExpiration(args.expiresAt, 90);
  const credential = issueCredential("agent");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    const principal = await tx.agentPrincipal.findFirst({
      where: { id: args.agentPrincipalId, firmId, status: "active" },
      select: {
        id: true,
        grants: {
          where: {
            status: "active",
            OR: [{ startsAt: null }, { startsAt: { lte: /* @__PURE__ */ new Date() } }],
            AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }] }]
          },
          select: { capabilities: true }
        }
      }
    });
    if (!principal) throw new Error("Active agent principal was not found in the selected firm.");
    const granted = new Set(principal.grants.flatMap((grant) => grant.capabilities));
    if (capabilities.some((capability) => !granted.has(capability))) {
      throw new Error("Agent credential capabilities must be covered by a current approved grant.");
    }
    const created = await tx.agentCredential.create({
      data: {
        firmId,
        agentPrincipalId: principal.id,
        name,
        prefix: credential.prefix,
        secretHash: credential.digest,
        status: "active",
        scopes: capabilities,
        createdById: session.itemId,
        expiresAt
      }
    });
    await audit(tx, {
      firmId,
      eventType: "agent_credential.issued",
      actorUserId: session.itemId,
      metadata: { agentCredentialId: created.id, principalId: principal.id, capabilities }
    });
    return { credential: created, secret: credential.token };
  });
}
async function revokeAgentCredential(_root, args, context) {
  const { session, firmId } = requireHumanSession(context, "canApproveAgentActions");
  if (!permissions.canManageAgents({ session })) {
    throw new Error("Agent-management permission is required.");
  }
  const reason = boundedReason2(args.reason);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    const credential = await tx.agentCredential.findFirst({ where: { id: args.id, firmId } });
    if (!credential) throw new Error("Agent credential was not found in the active firm.");
    if (credential.status === "revoked") return { credential, replayed: true };
    const revoked = await tx.agentCredential.update({
      where: { id: credential.id },
      data: { status: "revoked", revokedAt: /* @__PURE__ */ new Date(), revokedById: session.itemId }
    });
    await audit(tx, {
      firmId,
      eventType: "agent_credential.revoked",
      actorUserId: session.itemId,
      metadata: { agentCredentialId: credential.id, reasonDigest: sha256Digest(reason) }
    });
    return { credential: revoked, replayed: false };
  });
}

// features/keystone/mutations/dataWorkflows.ts
var CONTACT_TYPES = /* @__PURE__ */ new Set(["person", "organization"]);
var CONTACT_STATUSES = /* @__PURE__ */ new Set(["prospective_client", "client", "former_client", "opposing", "other"]);
var EXPORT_SCOPES = /* @__PURE__ */ new Set(["contacts", "matters", "time_entries", "invoices", "audit"]);
function projectedExportRows(scope, rows) {
  return {
    contacts: scope === "contacts" ? rows : [],
    matters: scope === "matters" ? rows : [],
    timeEntries: scope === "time_entries" ? rows : [],
    invoices: scope === "invoices" ? rows : [],
    auditEvents: scope === "audit" ? rows : []
  };
}
function bounded(value, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, maximum);
}
function fieldTooLong(row, key, maximum) {
  return typeof row[key] === "string" && row[key].trim().length > maximum;
}
function durableKey(value) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) throw new Error("Idempotency key must be between 12 and 160 characters.");
  return key;
}
function normalizeContactImportRows(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new Error("Contact import requires between 1 and 500 rows.");
  }
  if (JSON.stringify(input).length > 75e4) throw new Error("Contact import payload is too large.");
  const rows = input.map((candidate, index) => {
    const row = candidate && typeof candidate === "object" ? candidate : {};
    const contactType = bounded(row.contactType, 30).toLowerCase() || "person";
    const status = bounded(row.status, 40).toLowerCase() || "prospective_client";
    const normalized = {
      sourceId: bounded(row.sourceId, 200),
      contactType,
      firstName: bounded(row.firstName, 200),
      lastName: bounded(row.lastName, 200),
      organizationName: bounded(row.organizationName, 300),
      email: bounded(row.email, 320).toLowerCase(),
      phone: bounded(row.phone, 80),
      status
    };
    const errors = [];
    for (const [key, maximum] of [
      ["sourceId", 200],
      ["firstName", 200],
      ["lastName", 200],
      ["organizationName", 300],
      ["email", 320],
      ["phone", 80],
      ["contactType", 30],
      ["status", 40]
    ]) {
      if (fieldTooLong(row, key, maximum)) errors.push(`${key} must be ${maximum} characters or fewer`);
    }
    if (!normalized.sourceId) errors.push("sourceId is required and must be 200 characters or fewer");
    if (!CONTACT_TYPES.has(contactType)) errors.push("contactType must be person or organization");
    if (!CONTACT_STATUSES.has(status)) errors.push("status is unsupported");
    if (contactType === "person" && !normalized.firstName && !normalized.lastName) errors.push("person requires a first or last name");
    if (contactType === "organization" && !normalized.organizationName) errors.push("organization requires organizationName");
    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) errors.push("email is invalid");
    return { rowNumber: index + 1, valid: errors.length === 0, errors, normalized };
  });
  const duplicateSourceIds = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (seen.has(row.normalized.sourceId)) duplicateSourceIds.add(row.normalized.sourceId);
    seen.add(row.normalized.sourceId);
  }
  for (const row of rows) {
    if (duplicateSourceIds.has(row.normalized.sourceId)) {
      row.valid = false;
      row.errors.push("sourceId is duplicated in this batch");
    }
  }
  return {
    valid: rows.every((row) => row.valid),
    rowCount: rows.length,
    errorCount: rows.filter((row) => !row.valid).length,
    digest: sha256Digest(rows.map((row) => row.normalized)),
    rows
  };
}
async function previewContactImport(_root, args, context) {
  requirePermission(context, "canManagePeople", { humanOnly: true });
  requirePermission(context, "canManageIntegrations", { humanOnly: true });
  return normalizeContactImportRows(args.rows);
}
async function applyContactImport(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePeople", { humanOnly: true });
  requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const key = durableKey(args.idempotencyKey);
  const preview = normalizeContactImportRows(args.rows);
  if (!preview.valid) throw new Error("Contact import must pass preview validation before apply.");
  const requestDigest = sha256Digest({ connectionId: args.connectionId, rows: preview.rows.map((row) => row.normalized) });
  const eventId2 = `contact-import:${firmId}:${key}`;
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId2}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: eventId2 } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) throw new Error("Import idempotency key was reused with a different payload.");
      return { importedCount: replay.metadata?.contactIds?.length ?? 0, contactIds: replay.metadata?.contactIds ?? [], replayed: true };
    }
    const connection = await tx.integrationConnection.findFirst({
      where: { id: args.connectionId, firmId, status: "active" },
      select: { id: true }
    });
    if (!connection) throw new Error("Contact import requires an active integration connection in the firm.");
    const sourceIds = preview.rows.map((row) => row.normalized.sourceId);
    const collisions = await tx.externalRecordLink.count({
      where: { connectionId: connection.id, resourceType: "contact", externalId: { in: sourceIds }, status: { not: "unlinked" } }
    });
    if (collisions) throw new Error("One or more source IDs are already linked; resolve duplicates before applying the import.");
    const contactIds = [];
    for (const row of preview.rows) {
      const data = row.normalized;
      const contact = await tx.contact.create({
        data: {
          firmId,
          contactType: data.contactType,
          status: data.status,
          firstName: data.firstName,
          lastName: data.lastName,
          organizationName: data.organizationName,
          primaryEmail: data.email,
          primaryPhone: data.phone
        }
      });
      await tx.externalRecordLink.create({
        data: {
          firmId,
          connectionId: connection.id,
          resourceType: "contact",
          externalId: data.sourceId,
          status: "linked",
          contactId: contact.id,
          fingerprint: sha256Digest(data),
          providerMetadata: { importRowNumber: row.rowNumber },
          lastSyncedAt: /* @__PURE__ */ new Date()
        }
      });
      contactIds.push(contact.id);
    }
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: eventId2,
        eventType: "data.contact_import_applied",
        category: "integration",
        outcome: "succeeded",
        actorUserId: userId,
        actorType: "user",
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: { requestDigest, previewDigest: preview.digest, connectionId: connection.id, contactIds }
      }
    });
    return { importedCount: contactIds.length, contactIds, replayed: false };
  });
}
async function preparePracticeExport(_root, args, context) {
  const requestedScope = args.scope?.trim().toLowerCase();
  if (!EXPORT_SCOPES.has(requestedScope)) throw new Error("Unsupported export scope.");
  const scope = requestedScope;
  const permission = {
    contacts: "canReadPeople",
    matters: "canReadMatters",
    time_entries: "canReadBilling",
    invoices: "canReadBilling",
    audit: "canViewAudit"
  }[scope];
  const { firmId, userId } = requirePermission(context, permission, { humanOnly: true });
  const key = durableKey(args.idempotencyKey);
  const limit = args.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Export limit must be between 1 and 500 rows.");
  const requestDigest = sha256Digest({ scope, limit });
  const eventId2 = `data-export:${firmId}:${key}`;
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, permission);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId2}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: eventId2 } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) throw new Error("Export idempotency key was reused with a different payload.");
      return {
        scope,
        rowCount: replay.metadata?.rowCount ?? 0,
        digest: replay.metadata?.exportDigest ?? "",
        ...projectedExportRows(scope, []),
        replayed: true
      };
    }
    const matterWhere = accessibleMatterStorageWhere(firmId, userId);
    let rows;
    if (scope === "contacts") {
      rows = await tx.contact.findMany({
        where: { firmId },
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: { id: true, contactType: true, status: true, firstName: true, lastName: true, organizationName: true, primaryEmail: true, primaryPhone: true, updatedAt: true }
      });
    } else if (scope === "matters") {
      rows = await tx.matter.findMany({
        where: matterWhere,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: { id: true, matterNumber: true, title: true, status: true, confidentiality: true, clientId: true, officeId: true, practiceAreaId: true, responsibleAttorneyId: true, openedAt: true, closedAt: true, updatedAt: true }
      });
    } else if (scope === "time_entries") {
      rows = await tx.timeEntry.findMany({
        where: { firmId, matter: matterWhere },
        take: limit,
        orderBy: { workDate: "desc" },
        select: { id: true, matterId: true, userId: true, status: true, workDate: true, durationMinutes: true, description: true, isBillable: true, rateMinor: true, amountMinor: true, currencyCode: true }
      });
    } else if (scope === "invoices") {
      rows = await tx.invoice.findMany({
        where: { firmId, matter: matterWhere },
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: { id: true, matterId: true, clientId: true, invoiceNumber: true, status: true, currencyCode: true, subtotalMinor: true, discountMinor: true, taxMinor: true, totalMinor: true, paidMinor: true, balanceDueMinor: true, issuedAt: true, dueAt: true, updatedAt: true }
      });
    } else {
      rows = await tx.auditEvent.findMany({
        where: { firmId, OR: [{ matterId: null }, { matter: matterWhere }] },
        take: limit,
        orderBy: { occurredAt: "desc" },
        select: { eventId: true, eventType: true, category: true, outcome: true, actorType: true, matterId: true, occurredAt: true }
      });
    }
    const exportDigest = sha256Digest(rows);
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: eventId2,
        eventType: "data.export_prepared",
        category: "integration",
        outcome: "succeeded",
        actorUserId: userId,
        actorType: "user",
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: { requestDigest, exportDigest, scope, rowCount: rows.length }
      }
    });
    return {
      scope,
      rowCount: rows.length,
      digest: exportDigest,
      ...projectedExportRows(scope, rows),
      replayed: false
    };
  });
}

// features/keystone/lib/local-fixture.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function ownership() {
  try {
    const file = (0, import_node_path.resolve)(process.env.LAW_FIRM_FIXTURE_OWNERSHIP_PATH || "");
    const runtime = (0, import_node_fs.realpathSync)((0, import_node_path.join)(process.cwd(), ".runtime")) + import_node_path.sep;
    const stat = (0, import_node_fs.lstatSync)(file);
    if (!file.startsWith(runtime) || (0, import_node_fs.realpathSync)(file) !== file || !stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 511) !== 384 || stat.size > 65536) return null;
    const v = JSON.parse((0, import_node_fs.readFileSync)(file, "utf8"));
    if (v.version !== 1 || v.root !== (0, import_node_path.dirname)(file) || v.datadir !== (0, import_node_path.join)(v.root, "pgdata") || !/^[a-z_][a-z0-9_]{0,62}$/.test(v.role) || !Array.isArray(v.databases) || !v.databases.length || v.databases.length > 64 || !v.databases.every((n) => typeof n === "string" && /^runtime_law_firm_ephemeral_[a-z0-9_]+$/.test(n))) return null;
    const data = (0, import_node_fs.lstatSync)(v.datadir);
    if (!data.isDirectory() || data.isSymbolicLink() || data.uid !== stat.uid || (0, import_node_fs.realpathSync)(v.datadir) !== v.datadir) return null;
    if (Object.entries(process.env).some(([k, value]) => /^(SMTP|S3_|AWS_|STRIPE|PAYPAL|OPENAI|OPENROUTER|ANTHROPIC|TWILIO|RESEND|SENDGRID)/.test(k) && Boolean(value))) return null;
    const url = new URL(process.env.DATABASE_URL || "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !v.databases.includes(url.pathname.slice(1)) || url.username !== v.role || Number(url.port) !== v.port) return null;
    return v;
  } catch {
    return null;
  }
}
async function requireOwnedOfflineDatabase(client) {
  const own = ownership();
  if (!own) throw new Error("An owned offline database is required.");
  const [row] = await client.$queryRawUnsafe(`SELECT (
    current_database() = ANY($1::text[]) AND current_user = $2 AND session_user = $2
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname=current_user)
      THEN current_setting('data_directory', true) = $3 ELSE false END
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AND inet_server_port() = $4
  ) AS allowed`, own.databases, own.role, own.datadir, own.port);
  if (row?.allowed !== true) throw new Error("Owned offline server, database owner or data directory mismatch.");
}
async function isLocalFixtureFirm(client, firmId) {
  const own = ownership();
  if (!own) return false;
  const [row] = await client.$queryRawUnsafe(`SELECT (
    f."isDemo" = true AND f.status = 'active'
    AND current_database() = ANY($2::text[])
    AND current_user = $3 AND session_user = $3
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname = current_user)
      THEN current_setting('data_directory', true) = $4 ELSE false END
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AND inet_server_port() = $5
    AND NOT EXISTS (SELECT 1 FROM "IntegrationConnection" c WHERE c."firm" = f.id AND c.status = 'active')
  ) AS allowed FROM "Firm" f WHERE f.id = $1`, firmId, own.databases, own.role, own.datadir, own.port);
  return row?.allowed === true;
}
async function requireLocalFixtureFirm(client, firmId) {
  if (!await isLocalFixtureFirm(client, firmId)) throw new Error("Fictional consultation service is unavailable outside the owned offline workspace.");
}

// features/keystone/mutations/syntheticScenario.ts
var SYNTHETIC_DEMO_MARKER = "synthetic-onboarding-demo";
var SYNTHETIC_DEMO_CONFIRMATION = "synthetic";
var DEMO_CONTACT_EMAIL = "synthetic.client@example.invalid";
var DEMO_MATTER_NUMBER = "DEMO-0001";
var DEMO_CHECK_NUMBER = "CONFLICT-DEMO-0001";
var DEMO_INVOICE_NUMBER = "INV-DEMO-0001";
var DEMO_PAYMENT_NUMBER = "PAY-DEMO-0001";
var DEMO_PAYMENT_IDEMPOTENCY_KEY = "synthetic-onboarding-demo-payment-0001";
async function applySyntheticDemoScenario(tx, args) {
  const { firmId, actorUserId } = args;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`synthetic-demo:${firmId}`}))`;
  await requireLocalFixtureFirm(tx, firmId);
  const now = Date.now();
  const openedAt = new Date(now - 14 * 24 * 60 * 60 * 1e3);
  const invoiceDueAt = new Date(now + 14 * 24 * 60 * 60 * 1e3);
  const practiceArea = await tx.practiceArea.findFirst({ where: { firmId, code: "GENERAL" } });
  let contact = await tx.contact.findFirst({ where: { firmId, primaryEmail: DEMO_CONTACT_EMAIL } });
  contact ??= await tx.contact.create({
    data: {
      firmId,
      contactType: "person",
      status: "client",
      firstName: "Synthetic",
      lastName: "Client",
      primaryEmail: DEMO_CONTACT_EMAIL,
      conflictSearchAliases: ["Synthetic Demo Client"]
    }
  });
  const matter = await tx.matter.upsert({
    where: { firmId_matterNumber: { firmId, matterNumber: DEMO_MATTER_NUMBER } },
    update: {},
    create: {
      firmId,
      matterNumber: DEMO_MATTER_NUMBER,
      title: "Synthetic onboarding matter",
      status: "proposed",
      confidentiality: "standard",
      clientId: contact.id,
      practiceAreaId: practiceArea?.id ?? null,
      responsibleAttorneyId: actorUserId,
      description: "Synthetic onboarding fixture; not a real client or legal matter.",
      openedAt,
      customData: { demoMarker: SYNTHETIC_DEMO_MARKER }
    }
  });
  await tx.matter.updateMany({ where: { id: matter.id, openedAt: null }, data: { openedAt } });
  await tx.matterTeamMember.upsert({
    where: { matterId_userId: { matterId: matter.id, userId: actorUserId } },
    update: { status: "active", canAccessRestricted: true },
    create: {
      firmId,
      matterId: matter.id,
      userId: actorUserId,
      teamRole: "responsible_attorney",
      status: "active",
      canAccessRestricted: true,
      canEdit: true,
      canBill: true
    }
  });
  await tx.matter.update({
    where: { id: matter.id },
    data: { authorizedUsers: { connect: { id: actorUserId } } }
  });
  const conflictCheck = await tx.conflictCheck.upsert({
    where: { firmId_checkNumber: { firmId, checkNumber: DEMO_CHECK_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      checkNumber: DEMO_CHECK_NUMBER,
      status: "requested",
      requestedById: actorUserId,
      searchScope: "contacts_and_matters",
      searchVersion: "v1",
      summary: "Synthetic conflict workflow fixture."
    }
  });
  if (!await tx.conflictSearchTerm.count({ where: { checkId: conflictCheck.id } })) {
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        matterId: matter.id,
        checkId: conflictCheck.id,
        term: "Synthetic Client",
        normalizedTerm: "synthetic client",
        termType: "person",
        sourceContactId: contact.id
      }
    });
  }
  const invoice = await tx.invoice.upsert({
    where: { firmId_invoiceNumber: { firmId, invoiceNumber: DEMO_INVOICE_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      clientId: contact.id,
      invoiceNumber: DEMO_INVOICE_NUMBER,
      status: "draft",
      currencyCode: "USD",
      subtotalMinor: 25e3,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 25e3,
      paidMinor: 0,
      balanceDueMinor: 25e3,
      dueAt: invoiceDueAt,
      memo: "Synthetic local invoice fixture."
    }
  });
  await tx.invoice.updateMany({ where: { id: invoice.id, dueAt: null }, data: { dueAt: invoiceDueAt } });
  if (!await tx.invoiceLine.count({ where: { invoiceId: invoice.id } })) {
    await tx.invoiceLine.create({
      data: {
        firmId,
        matterId: matter.id,
        invoiceId: invoice.id,
        lineType: "flat_fee",
        description: "Synthetic fixed-fee service",
        quantity: 1,
        unitAmountMinor: 25e3,
        subtotalMinor: 25e3,
        discountMinor: 0,
        taxMinor: 0,
        lineTotalMinor: 25e3,
        currencyCode: "USD"
      }
    });
  }
  const payment = await tx.payment.upsert({
    where: { firmId_paymentNumber: { firmId, paymentNumber: DEMO_PAYMENT_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      invoiceId: invoice.id,
      payerId: contact.id,
      paymentNumber: DEMO_PAYMENT_NUMBER,
      idempotencyKey: DEMO_PAYMENT_IDEMPOTENCY_KEY,
      paymentType: "operating",
      status: "pending",
      amountMinor: 25e3,
      refundedMinor: 0,
      currencyCode: "USD",
      receivedById: actorUserId
    }
  });
  const services = [
    { code: "LEASE", name: "Lease document intake", description: "Fictional appointment for a lease-document intake exercise. No legal advice or representation.", consultationFeeMinor: 12500, consultationMinutes: 30 },
    { code: "BUSINESS", name: "Business document intake", description: "Fictional appointment for a business-document intake exercise. No legal advice or representation.", consultationFeeMinor: 18e3, consultationMinutes: 60 },
    { code: "ESTATE", name: "Estate document intake", description: "Fictional appointment for an estate-document intake exercise. No legal advice or representation.", consultationFeeMinor: 15e3, consultationMinutes: 45 }
  ];
  for (const data of services) {
    await tx.practiceArea.upsert({ where: { firmId_code: { firmId, code: data.code } }, update: {}, create: { firmId, status: "active", isPublic: true, ...data } });
  }
  for (const [index, names] of [["Avery", "Stone"], ["Morgan", "Reed"], ["Jordan", "Lane"]].entries()) {
    const email = `${names.join(".").toLowerCase()}@example.invalid`;
    let client = await tx.contact.findFirst({ where: { firmId, primaryEmail: email } });
    client ??= await tx.contact.create({ data: { firmId, firstName: names[0], lastName: names[1], primaryEmail: email, contactType: "person", status: "client", conflictSearchAliases: [] } });
    const service = await tx.practiceArea.findUnique({ where: { firmId_code: { firmId, code: services[index].code } } });
    const record = await tx.matter.upsert({ where: { firmId_matterNumber: { firmId, matterNumber: `HP-2026-00${index + 1}` } }, update: {}, create: { firmId, clientId: client.id, practiceAreaId: service.id, matterNumber: `HP-2026-00${index + 1}`, title: ["Cedar Street lease documents", "Willow workshop formation documents", "Oak Avenue estate documents"][index], status: "proposed", confidentiality: "standard", responsibleAttorneyId: actorUserId, description: "Fictional local record. No attorney-client relationship or legal review is asserted.", customData: { demoMarker: SYNTHETIC_DEMO_MARKER } } });
    await tx.matterTeamMember.upsert({ where: { matterId_userId: { matterId: record.id, userId: actorUserId } }, update: {}, create: { firmId, matterId: record.id, userId: actorUserId, status: "active", teamRole: "observer", canAccessRestricted: true, canEdit: true, canBill: true } });
    await tx.matter.update({ where: { id: record.id }, data: { authorizedUsers: { connect: { id: actorUserId } } } });
  }
  return {
    contactId: contact.id,
    matterId: matter.id,
    conflictCheckId: conflictCheck.id,
    invoiceId: invoice.id,
    paymentId: payment.id
  };
}
async function seedSyntheticDemoScenario(_root, args, context) {
  const session = context.session;
  if (!isInteractiveHumanSession(session) || session.data.status !== "active") {
    throw new Error("An active human administrator with onboarding authority is required to seed the synthetic demo.");
  }
  if (args.synthetic !== true) {
    throw new Error(`Synthetic demo seeding requires explicit confirmation: ${SYNTHETIC_DEMO_CONFIRMATION}: true.`);
  }
  const firmId = activeFirmId(session);
  if (!firmId) throw new Error("An active firm is required to seed the synthetic demo.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageOnboarding");
    const firm = await tx.firm.findUnique({ where: { id: firmId } });
    if (!firm || firm.status !== "active") throw new Error("The active firm must be published before seeding the synthetic demo.");
    const result = await applySyntheticDemoScenario(tx, { firmId, actorUserId: session.itemId });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "firm.synthetic_demo_seeded",
      category: "legal_workflow",
      outcome: "succeeded",
      actorUserId: session.itemId,
      matterId: result.matterId,
      metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER }
    });
    return { firmId, ...result };
  });
}
async function viewerCanSeedSyntheticDemo(_root, _args, context) {
  const session = context.session;
  if (!isInteractiveHumanSession(session) || !permissions.canManageOnboarding({ session })) return false;
  try {
    await requireOwnedOfflineDatabase(context.prisma);
    return true;
  } catch {
    return false;
  }
}

// features/keystone/mutations/roleWorkflows.ts
var standardFirmRoles = [
  {
    name: "Attorney",
    permissions: [
      "canAccessDashboard",
      "canReadPeople",
      "canReadIntake",
      "canManageIntake",
      "canRunConflictChecks",
      "canResolveConflicts",
      "canReadMatters",
      "canManageMatters",
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
      "canReadPayments",
      "canReadPortal",
      "canManagePortal"
    ]
  },
  {
    name: "Paralegal",
    permissions: [
      "canAccessDashboard",
      "canReadPeople",
      "canReadIntake",
      "canManageIntake",
      "canRunConflictChecks",
      "canReadMatters",
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
      "canReadPortal"
    ]
  },
  {
    name: "Billing",
    permissions: [
      "canAccessDashboard",
      "canReadPeople",
      "canReadMatters",
      "canReadBilling",
      "canManageBilling",
      "canReadTrust",
      "canManageTrust",
      "canReadPayments",
      "canManagePayments",
      "canReadPortal"
    ]
  },
  {
    name: "Intake coordinator",
    permissions: [
      "canAccessDashboard",
      "canReadPeople",
      "canReadIntake",
      "canManageIntake",
      "canRunConflictChecks",
      "canReadCalendar",
      "canManageCalendar",
      "canReadTasks",
      "canManageTasks",
      "canReadCommunications",
      "canManageCommunications"
    ]
  }
];
function standardRolePermissionData(role) {
  const granted = new Set(role.permissions);
  return Object.fromEntries(permissionKeys.map((permission) => [permission, granted.has(permission)]));
}
var administrativePermissions = ["canAccessDashboard", "canManagePeople", "canManageRoles", "canManageFirm"];
function grantedPermissions(value) {
  if (!Array.isArray(value) || value.length > permissionKeys.length) throw new Error("Granted permissions must be a list of role permissions.");
  const granted = /* @__PURE__ */ new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || !permissionKeys.includes(entry)) throw new Error("Granted permissions contain an unknown permission.");
    granted.add(entry);
  }
  return granted;
}
function isAdministrative(role) {
  return role.status === "active" && administrativePermissions.every((permission) => role[permission] === true);
}
async function updateFirmRoleAuthority(_root, args, context) {
  const session = context.session;
  if (!isInteractiveHumanSession(session) || !permissions.canManageRoles({ session })) {
    throw new Error("Changing role authority requires an interactive role-management session.");
  }
  const firmId = activeFirmId(session);
  if (!firmId) throw new Error("An active firm session is required.");
  const roleId = typeof args.roleId === "string" ? args.roleId.trim() : "";
  if (!roleId) throw new Error("Role is required.");
  const reason = typeof args.reason === "string" ? args.reason.trim() : "";
  if (reason.length < 3 || reason.length > 2e3) throw new Error("Reason must be between 3 and 2000 characters.");
  const nextStatus = args.status?.trim() || null;
  if (nextStatus && !["active", "archived"].includes(nextStatus)) throw new Error("Role status must be active or archived.");
  const granted = grantedPermissions(args.grantedPermissions);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageRoles");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-administrator:${firmId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Role" WHERE id = ${roleId} AND firm = ${firmId} FOR UPDATE`;
    const role = await tx.role.findFirst({ where: { id: roleId, firmId } });
    if (!role) throw new Error("Role is unavailable in the active firm.");
    const next = {
      status: nextStatus ?? role.status,
      ...Object.fromEntries(permissionKeys.map((permission) => [permission, granted.has(permission)]))
    };
    const changedPermissions = permissionKeys.filter((permission) => Boolean(role[permission]) !== next[permission]);
    if (!changedPermissions.length && next.status === role.status) throw new Error("The requested role authority is unchanged.");
    const actorMembership = await tx.firmMembership.findFirst({
      where: { firmId, userId: session.itemId, status: "active" },
      select: { roleId: true }
    });
    if (actorMembership?.roleId === roleId && (next.status !== "active" || !next.canManageRoles || !next.canManagePeople)) {
      throw new Error("Administrators cannot remove their own role or people management through their own role.");
    }
    if (isAdministrative(role) && !isAdministrative(next)) {
      const remaining = await tx.firmMembership.count({
        where: {
          firmId,
          status: "active",
          roleId: { not: roleId },
          role: { firmId, status: "active", canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true },
          user: { status: "active", activeFirmId: firmId },
          firm: { status: "active" }
        }
      });
      if (remaining === 0) throw new Error("The firm must retain another active administrator before this role change.");
    }
    const updated = await tx.role.update({
      where: { id: roleId },
      data: next,
      select: { id: true, name: true, status: true }
    });
    const affectedMemberships = await tx.firmMembership.count({ where: { firmId, roleId, status: { in: ["active", "invited", "suspended"] } } });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: session.itemId,
      actorType: "user",
      eventType: "staff.role_authority_changed",
      category: "authorization",
      metadata: {
        roleId,
        previousStatus: role.status,
        nextStatus: updated.status,
        changedPermissions,
        grantedPermissions: permissionKeys.filter((permission) => next[permission]),
        affectedMemberships,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { roleId: updated.id, name: updated.name, status: updated.status, changedPermissions, affectedMemberships };
  });
}

// features/keystone/mutations/onboarding.ts
function bounded2(value, label, max) {
  const text23 = value?.trim();
  if (!text23 || text23.length > max) throw new Error(`${label} is required and must be ${max} characters or fewer.`);
  return text23;
}
function optionalBounded(value, label, maximum) {
  const result = value?.trim() || null;
  if (result && result.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return result;
}
function optionalEmail(value) {
  const email = value?.trim().toLowerCase() || null;
  if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Support email must be valid.");
  }
  return email;
}
function optionalBrandColor(value) {
  const color = value?.trim().toLowerCase() || null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) throw new Error("Brand color must be a six-digit hexadecimal color.");
  return color;
}
function logoIcon(value) {
  const safe = sanitizeStoreLogoSvg(value?.trim() || DEFAULT_STORE_LOGO_ICON);
  if (!safe) throw new Error("Logo must be a safe SVG document.");
  return safe;
}
function slug(value) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Firm slug must contain lowercase letters, numbers, and single hyphens.");
  }
  return normalized;
}
function timezone(value) {
  const normalized = bounded2(value, "Timezone", 100);
  try {
    Intl.DateTimeFormat("en", { timeZone: normalized }).format();
    return normalized;
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
}
function currency(value) {
  const normalized = value?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error("Currency must be a three-letter code.");
  return normalized;
}
async function completeFirmOnboarding(_root, args, context) {
  const session = context.session;
  if (!isInteractiveHumanSession(session) || session.data.status !== "active") {
    throw new Error("An active human administrator is required for onboarding.");
  }
  const firmName = bounded2(args.firmName, "Firm name", 200);
  const firmSlug = slug(args.firmSlug);
  const displayName2 = optionalBounded(args.firmDisplayName, "Display name", 120) ?? firmName;
  const shortName = optionalBounded(args.firmShortName, "Short name", 40) ?? displayName2.slice(0, 40);
  const brandTagline = optionalBounded(args.brandTagline, "Brand tagline", 180);
  const brandColor = optionalBrandColor(args.brandColor);
  const supportEmail = optionalEmail(args.supportEmail);
  const firmLogoIcon = logoIcon(args.logoIcon);
  const firmLogoColor = normalizeStoreLogoColor(args.logoColor ?? "0");
  const officeName = bounded2(args.officeName, "Office name", 200);
  const officeCode = bounded2(args.officeCode, "Office code", 30).toUpperCase();
  const defaultTimezone = timezone(args.timezone);
  const defaultCurrency = currency(args.currencyCode);
  const practiceAreaName = bounded2(args.practiceAreaName || "General Practice", "Practice area name", 200);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-onboarding:${session.itemId}`}))`;
    const user = await tx.user.findUnique({
      where: { id: session.itemId },
      include: {
        activeFirm: true,
        bootstrapRole: true,
        firmMemberships: { include: { firm: true, role: true } }
      }
    });
    if (!user || user.status !== "active") throw new Error("Bootstrap user is unavailable.");
    const activeMembership = user.firmMemberships.find(
      (membership2) => membership2.status === "active" && membership2.firmId === user.activeFirmId
    );
    if (user.activeFirm && activeMembership) {
      await assertCurrentCommandActor(tx, context, "canManageOnboarding");
      if (user.activeFirm.status !== "active" || activeMembership.role?.status !== "active" || activeMembership.role?.firmId !== user.activeFirm.id || !activeMembership.role?.canManageOnboarding) throw new Error("Current onboarding authority is required.");
      if (args.seedSyntheticDemo === true) {
        await assertCurrentCommandActor(tx, context, "canManageOnboarding");
        const demoScenario2 = await applySyntheticDemoScenario(tx, {
          firmId: user.activeFirm.id,
          actorUserId: user.id
        });
        await recordAuditEvent(tx, {
          firmId: user.activeFirm.id,
          eventType: "firm.synthetic_demo_seeded",
          category: "legal_workflow",
          outcome: "succeeded",
          actorUserId: user.id,
          matterId: demoScenario2.matterId,
          metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER }
        });
        return {
          firm: user.activeFirm,
          office: null,
          membership: activeMembership,
          role: activeMembership.role,
          replayed: true,
          demoScenario: demoScenario2
        };
      }
      return {
        firm: user.activeFirm,
        office: null,
        membership: activeMembership,
        role: activeMembership.role,
        replayed: true,
        demoScenario: null
      };
    }
    if (user.bootstrapRole?.status !== "active" || !user.bootstrapRole?.canManageOnboarding || user.bootstrapRole?.firmId) throw new Error("Current bootstrap onboarding authority is required.");
    if (user.activeFirmId || user.firmMemberships.some((membership2) => membership2.status !== "invited")) {
      throw new Error("Bootstrap user has a partial firm assignment that requires administrator review.");
    }
    const duplicate = await tx.firm.findUnique({ where: { slug: firmSlug } });
    if (duplicate) throw new Error("Firm slug is already in use.");
    if (args.seedSyntheticDemo === true) await requireOwnedOfflineDatabase(tx);
    const firm = await tx.firm.create({
      data: {
        name: firmName,
        displayName: displayName2,
        shortName,
        brandTagline: brandTagline ?? "",
        brandColor: brandColor ?? "",
        supportEmail: supportEmail ?? "",
        logoIcon: firmLogoIcon,
        logoColor: firmLogoColor,
        slug: firmSlug,
        status: "onboarding",
        isDemo: args.seedSyntheticDemo === true,
        defaultTimezone,
        defaultCurrency
      }
    });
    const office = await tx.office.create({
      data: {
        firmId: firm.id,
        name: officeName,
        code: officeCode,
        status: "active",
        timezone: defaultTimezone
      }
    });
    const role = await tx.role.create({
      data: {
        firmId: firm.id,
        name: "Firm administrator",
        status: "active",
        ...Object.fromEntries(permissionKeys.map((permission) => [permission, true]))
      }
    });
    await tx.role.createMany({
      data: standardFirmRoles.map((standard) => ({
        firmId: firm.id,
        name: standard.name,
        status: "active",
        ...standardRolePermissionData(standard)
      }))
    });
    const now = /* @__PURE__ */ new Date();
    const membership = await tx.firmMembership.create({
      data: {
        firmId: firm.id,
        userId: user.id,
        roleId: role.id,
        primaryOfficeId: office.id,
        status: "active",
        title: "Administrator",
        startedAt: now
      }
    });
    await Promise.all([
      tx.user.update({
        where: { id: user.id },
        data: { activeFirmId: firm.id, onboardingStatus: "completed" }
      }),
      tx.practiceArea.create({
        data: {
          firmId: firm.id,
          name: practiceAreaName,
          code: "GENERAL",
          status: "active",
          description: "Firm-configured default practice area; review before operational use."
        }
      }),
      tx.firm.update({ where: { id: firm.id }, data: { status: "active" } })
    ]);
    await recordAuditEvent(tx, {
      firmId: firm.id,
      eventType: "firm.onboarding_completed",
      category: "authorization",
      actorUserId: user.id,
      metadata: { firmId: firm.id, officeId: office.id, roleId: role.id, membershipId: membership.id }
    });
    let demoScenario = null;
    if (args.seedSyntheticDemo === true) {
      demoScenario = await applySyntheticDemoScenario(tx, {
        firmId: firm.id,
        actorUserId: user.id
      });
      await recordAuditEvent(tx, {
        firmId: firm.id,
        eventType: "firm.synthetic_demo_seeded",
        category: "legal_workflow",
        outcome: "succeeded",
        actorUserId: user.id,
        matterId: demoScenario.matterId,
        metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER }
      });
    }
    return {
      firm: { ...firm, status: "active" },
      office,
      membership,
      role,
      replayed: false,
      demoScenario: demoScenario ?? null
    };
  });
}

// features/keystone/mutations/staffWorkflows.ts
var import_node_crypto13 = require("node:crypto");
function requireString(value, label, maximum) {
  const text23 = typeof value === "string" ? value.trim() : "";
  if (!text23 || text23.length > maximum) throw new Error(`${label} is required and must be ${maximum} characters or fewer.`);
  return text23;
}
function normalizeEmail(value) {
  const email = requireString(value, "Staff email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Staff email must be valid.");
  return email;
}
var invitationIdentitySelect = {
  id: true,
  status: true,
  bootstrapKey: true,
  bootstrapRoleId: true,
  passwordResetRedeemedAt: true,
  _count: { select: { firmMemberships: true } }
};
function isUnclaimedInvitationIdentity(user) {
  return user.status === "invited" && !user.bootstrapKey && !user.bootstrapRoleId && !user.passwordResetRedeemedAt && user._count.firmMemberships === 0;
}
function boundedReason3(value) {
  const reason = requireString(value, "Reason", 2e3);
  if (reason.length < 3) throw new Error("Reason must be at least 3 characters.");
  return reason;
}
async function inviteFirmMember(_root, args, context) {
  if (!isInteractiveHumanSession(context.session) || !permissions.canManagePeople({ session: context.session }) || !permissions.canManageRoles({ session: context.session })) {
    throw new Error("Managing staff invitations requires people- and role-management permission.");
  }
  const firmId = activeFirmId(context.session);
  const actorUserId = context.session?.itemId;
  if (!firmId || !actorUserId) throw new Error("An active firm session is required.");
  const name = requireString(args.name, "Staff name", 200);
  const email = normalizeEmail(args.email);
  const roleId = requireString(args.roleId, "Role", 200);
  const officeId = args.officeId ? requireString(args.officeId, "Office", 200) : null;
  const prisma = context.prisma;
  const [role, office, existing] = await Promise.all([
    prisma.role.findFirst({ where: { id: roleId, firmId, status: "active" }, select: { id: true, name: true } }),
    officeId ? prisma.office.findFirst({ where: { id: officeId, firmId, status: "active" }, select: { id: true } }) : Promise.resolve(null),
    prisma.user.findUnique({ where: { email }, select: invitationIdentitySelect })
  ]);
  if (!role) throw new Error("The selected active role is unavailable in this firm.");
  if (officeId && !office) throw new Error("The selected active office is unavailable in this firm.");
  if (existing) {
    throw new Error("A user with this email already exists. Use account recovery or an administrator-assisted membership review.");
  }
  const created = await context.sudo().db.User.createOne({
    data: { name, email, password: `Of!${(0, import_node_crypto13.randomBytes)(30).toString("base64url")}9a`, status: "invited" }
  });
  const membership = await runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    await assertCurrentCommandActor(tx, context, "canManageRoles");
    await tx.$executeRaw`SELECT id FROM "Role" WHERE id = ${roleId} AND firm = ${firmId} FOR SHARE`;
    const currentRole = await tx.role.findFirst({ where: { id: roleId, firmId, status: "active" }, select: { id: true } });
    if (!currentRole) throw new Error("The selected active role is unavailable in this firm.");
    if (officeId) {
      await tx.$executeRaw`SELECT id FROM "Office" WHERE id = ${officeId} AND firm = ${firmId} FOR SHARE`;
      const currentOffice = await tx.office.findFirst({ where: { id: officeId, firmId, status: "active" }, select: { id: true } });
      if (!currentOffice) throw new Error("The selected active office is unavailable in this firm.");
    }
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${created.id} FOR UPDATE`;
    const identity = await tx.user.findUnique({ where: { id: created.id }, select: invitationIdentitySelect });
    if (!identity || !isUnclaimedInvitationIdentity(identity)) throw new Error("This user already has a firm membership.");
    await tx.user.update({ where: { id: created.id }, data: { activeFirmId: firmId } });
    const result = await tx.firmMembership.create({
      data: {
        firmId,
        userId: created.id,
        roleId,
        primaryOfficeId: officeId,
        status: "invited"
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId,
      actorType: "user",
      eventType: "staff.invitation_issued",
      category: "authorization",
      metadata: {
        membershipId: result.id,
        invitationDigest: sha256Digest({ email, roleId, officeId, invitedUserId: created.id })
      }
    });
    return result;
  });
  return { membership, userId: created.id, email };
}
async function changeFirmMemberAccess(_root, args, context) {
  if (!permissions.canManagePeople({ session: context.session })) {
    throw new Error("Managing firm membership requires people-management permission.");
  }
  const firmId = activeFirmId(context.session);
  const actorUserId = context.session?.itemId;
  if (!firmId || !actorUserId) throw new Error("An active firm session is required.");
  const membershipId = requireString(args.membershipId, "Membership", 200);
  const reason = boundedReason3(args.reason);
  const roleId = args.roleId ? requireString(args.roleId, "Role", 200) : null;
  const officeProvided = args.changeOffice === true;
  const officeId = args.officeId ? requireString(args.officeId, "Office", 200) : null;
  const toStatus = args.toStatus?.trim() || null;
  if (toStatus && !["active", "suspended", "ended"].includes(toStatus)) {
    throw new Error("Membership status must be active, suspended, or ended.");
  }
  if (!roleId && !officeProvided && !toStatus) throw new Error("A role, office, or status change is required.");
  if (roleId && !permissions.canManageRoles({ session: context.session })) {
    throw new Error("Changing a firm role requires role-management permission.");
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    if (roleId) await assertCurrentCommandActor(tx, context, "canManageRoles");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-membership:${firmId}:${membershipId}`}))`;
    const membership = await tx.firmMembership.findFirst({
      where: { id: membershipId, firmId },
      select: {
        id: true,
        userId: true,
        status: true,
        roleId: true,
        primaryOfficeId: true,
        startedAt: true,
        role: { select: { canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true } }
      }
    });
    if (!membership) throw new Error("Firm membership is unavailable in the active firm.");
    const roleChanged = Boolean(roleId && roleId !== membership.roleId);
    const officeChanged = officeProvided && officeId !== membership.primaryOfficeId;
    const statusChanged = Boolean(toStatus && toStatus !== membership.status);
    if (!roleChanged && !officeChanged && !statusChanged) throw new Error("The requested membership access is unchanged.");
    if (membership.userId === actorUserId && (roleChanged || statusChanged)) {
      throw new Error("Administrators cannot change their own role or membership status.");
    }
    const role = roleId ? await tx.role.findFirst({
      where: { id: roleId, firmId, status: "active" },
      select: { id: true, canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true }
    }) : null;
    if (roleId && !role) throw new Error("The selected active role is unavailable in this firm.");
    if (officeProvided && officeId) {
      const office = await tx.office.findFirst({ where: { id: officeId, firmId, status: "active" }, select: { id: true } });
      if (!office) throw new Error("The selected active office is unavailable in this firm.");
    }
    if (statusChanged && toStatus) {
      if (membership.status === "invited" && toStatus === "active") {
        throw new Error("Invited membership activates only after the user redeems the password setup link.");
      }
      assertLifecycleTransition("membership", membership.status, toStatus);
    }
    const nextStatus = toStatus ?? membership.status;
    const nextRole = role ?? membership.role;
    const currentlyAdministrative = membership.status === "active" && membership.role.canAccessDashboard && membership.role.canManagePeople && membership.role.canManageRoles && membership.role.canManageFirm;
    const remainsAdministrative = nextStatus === "active" && nextRole.canAccessDashboard && nextRole.canManagePeople && nextRole.canManageRoles && nextRole.canManageFirm;
    if (currentlyAdministrative && !remainsAdministrative) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-administrator:${firmId}`}))`;
      const otherAdministrators = await tx.firmMembership.count({
        where: {
          firmId,
          id: { not: membershipId },
          status: "active",
          role: { firmId, status: "active", canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true },
          user: { status: "active", activeFirmId: firmId },
          firm: { status: "active" }
        }
      });
      if (otherAdministrators === 0) throw new Error("The firm must retain another active administrator before this change.");
    }
    const changed = await tx.firmMembership.update({
      where: { id: membershipId },
      data: {
        ...roleChanged && roleId ? { roleId } : {},
        ...officeChanged ? { primaryOfficeId: officeId } : {},
        ...statusChanged && toStatus ? {
          status: toStatus,
          endedAt: toStatus === "ended" ? /* @__PURE__ */ new Date() : null,
          startedAt: toStatus === "active" && !membership.startedAt ? /* @__PURE__ */ new Date() : void 0
        } : {}
      },
      select: {
        id: true,
        status: true,
        role: { select: { id: true, name: true } },
        primaryOffice: { select: { id: true, name: true } }
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId,
      actorType: "user",
      eventType: "staff.membership_access_changed",
      category: "authorization",
      metadata: {
        membershipId,
        previousStatus: membership.status,
        nextStatus: changed.status,
        previousRoleId: membership.roleId,
        nextRoleId: changed.role.id,
        previousOfficeId: membership.primaryOfficeId,
        nextOfficeId: changed.primaryOffice?.id ?? null,
        reasonDigest: sha256Digest(reason)
      }
    });
    return changed;
  });
}

// features/keystone/mutations/consultationLifecycle.ts
var consultationOutcomes = /* @__PURE__ */ new Set(["pending", "recommend_engagement", "decline", "follow_up"]);
var reservedStatuses = ["requested", "scheduled"];
function instant(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}
async function lockHosts(tx, firmId, hostIds) {
  for (const hostId of [...new Set(hostIds.filter(Boolean))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-host:${firmId}:${hostId}`}))`;
  }
}
function projection(row) {
  return { id: row.id, status: row.status };
}
async function scheduleConsultation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  const startsAt = instant(args.startsAt, "Start");
  const endsAt = instant(args.endsAt, "End");
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1e3) {
    throw new Error("A consultation must end after it starts and last at most eight hours.");
  }
  const location = optionalBoundedText(args.location, "Location", 300);
  const reason = optionalBoundedText(args.reason, "Scheduling reason", 2e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.consultation.findFirst({ where: { id: args.consultationId, firmId }, select: { id: true, hostId: true } });
    if (!reference) throw new Error("Consultation was not found in the active firm.");
    await lockHosts(tx, firmId, [reference.hostId, args.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, firmId } });
    if (!consultation || consultation.hostId !== reference.hostId) throw new Error("Consultation changed concurrently; reload before retrying.");
    if (consultation.status !== "scheduled") assertLifecycleTransition("consultation", consultation.status, "scheduled");
    const host = await tx.firmMembership.findFirst({
      where: { firmId, userId: args.hostId, status: "active", role: { status: "active", canManageIntake: true }, user: { status: "active" } },
      select: { userId: true }
    });
    if (!host) throw new Error("The host must be an active firm member who can take consultations.");
    const office = args.officeId ? await tx.office.findFirst({ where: { id: args.officeId, firmId, status: "active" }, select: { id: true, timezone: true } }) : null;
    if (args.officeId && !office) throw new Error("The selected active office is unavailable in this firm.");
    const overlapping = await tx.consultation.count({
      where: { firmId, hostId: host.userId, id: { not: consultation.id }, status: { in: reservedStatuses }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }
    });
    if (overlapping) throw new Error("The host already has a consultation at that time.");
    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: "scheduled",
        startsAt,
        endsAt,
        hostId: host.userId,
        ...office ? { officeId: office.id, timezone: office.timezone || consultation.timezone } : {},
        ...location != null ? { location } : {}
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: consultation.status === "scheduled" ? "consultation.rescheduled" : "consultation.scheduled",
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: {
        consultationId: consultation.id,
        previous: { status: consultation.status, hostId: consultation.hostId, startsAt: consultation.startsAt?.toISOString() ?? null, endsAt: consultation.endsAt?.toISOString() ?? null },
        next: { hostId: host.userId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
        ...reason ? { reasonDigest: sha256Digest(reason) } : {}
      }
    });
    return projection(updated);
  });
}
async function transitionConsultation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (!["completed", "cancelled", "no_show"].includes(args.toStatus)) throw new Error("Consultations close as completed, cancelled or no-show.");
  const outcome = args.outcome?.trim() || null;
  if (outcome && !consultationOutcomes.has(outcome)) throw new Error("Unsupported consultation outcome.");
  if (outcome && args.toStatus !== "completed") throw new Error("Only a completed consultation records an outcome.");
  const reason = args.toStatus === "cancelled" ? boundedReason(args.reason, "Cancellation reason", 3, 2e3) : optionalBoundedText(args.reason, "Reason", 2e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.consultation.findFirst({ where: { id: args.consultationId, firmId }, select: { id: true, hostId: true } });
    if (!reference) throw new Error("Consultation was not found in the active firm.");
    await lockHosts(tx, firmId, [reference.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, firmId } });
    if (!consultation) throw new Error("Consultation changed concurrently; reload before retrying.");
    assertLifecycleTransition("consultation", consultation.status, args.toStatus);
    if (args.toStatus !== "cancelled" && (!consultation.startsAt || consultation.startsAt > /* @__PURE__ */ new Date())) {
      throw new Error("A consultation can be completed or marked no-show only after its scheduled start.");
    }
    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: args.toStatus,
        ...outcome ? { outcome } : {},
        ...args.toStatus === "cancelled" ? { cancellationReason: reason ?? "" } : {}
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: `consultation.${args.toStatus}`,
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: { consultationId: consultation.id, fromStatus: consultation.status, outcome, ...reason ? { reasonDigest: sha256Digest(reason) } : {} }
    });
    return projection(updated);
  });
}
async function cancelOwnConsultation(_root, args, context) {
  const session = context.session;
  if (!isInteractiveHumanSession(session)) throw new Error("Sign in to manage your consultation.");
  const reason = optionalBoundedText(args.reason, "Cancellation reason", 1e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    const account2 = await tx.user.findFirst({ where: { id: session.itemId, status: "active" }, select: { id: true } });
    const reference = account2 ? await tx.consultation.findFirst({ where: { id: args.consultationId, accountId: account2.id }, select: { id: true, firmId: true, hostId: true } }) : null;
    if (!reference) throw new Error("This consultation is unavailable.");
    await lockHosts(tx, reference.firmId, [reference.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, accountId: session.itemId } });
    if (!consultation || !reservedStatuses.includes(consultation.status)) throw new Error("This consultation can no longer be cancelled online.");
    if (consultation.startsAt && consultation.startsAt <= /* @__PURE__ */ new Date()) throw new Error("This consultation has already started; contact the firm.");
    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: { status: "cancelled", cancellationReason: reason ? `Cancelled by client: ${reason}` : "Cancelled by client" },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId: consultation.firmId,
      actorUserId: session.itemId,
      actorType: "customer",
      eventType: "consultation.cancelled_by_client",
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: { consultationId: consultation.id, fromStatus: consultation.status }
    });
    return projection(updated);
  });
}

// features/keystone/mutations/retainerWorkflows.ts
var feeStructures = /* @__PURE__ */ new Set(["hourly", "flat_fee", "contingency", "hybrid", "pro_bono"]);
function optionalMinor(value, label) {
  if (value == null) return null;
  if (!isGraphqlInt(value) || value < 0) throw new Error(`${label} must be a non-negative whole minor-unit amount.`);
  return value;
}
async function lockRetainer(tx, firmId, matterId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${matterId}`}))`;
}
async function prepareRetainerAgreement(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const agreementNumber = String(args.agreementNumber ?? "").trim();
  if (!agreementNumber || agreementNumber.length > 100) throw new Error("Agreement number is required and must be 100 characters or fewer.");
  if (!feeStructures.has(args.feeStructure)) throw new Error("Unsupported fee structure.");
  const currencyCode = String(args.currencyCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Agreement currency must be a three-letter code.");
  const initialRetainerMinor = optionalMinor(args.initialRetainerMinor, "Initial retainer");
  const evergreenThresholdMinor = optionalMinor(args.evergreenThresholdMinor, "Evergreen threshold");
  const replenishmentAmountMinor = optionalMinor(args.replenishmentAmountMinor, "Replenishment amount");
  const contingencyBasisPoints = args.contingencyBasisPoints ?? null;
  if (contingencyBasisPoints != null && (!Number.isInteger(contingencyBasisPoints) || contingencyBasisPoints < 0 || contingencyBasisPoints > 1e4)) {
    throw new Error("Contingency must be between 0 and 10,000 basis points.");
  }
  if (["contingency", "hybrid"].includes(args.feeStructure) !== (contingencyBasisPoints != null)) {
    throw new Error("Contingency basis points are required for contingency and hybrid fees, and only for them.");
  }
  const termsSummary = optionalBoundedText(args.termsSummary, "Terms summary", 4e3) ?? "";
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await lockRetainer(tx, firmId, args.matterId);
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canBill");
    const [matter, clientParties, rateCard, ledger, duplicate] = await Promise.all([
      tx.matter.findFirst({
        where: { id: args.matterId, firmId, status: { notIn: ["closing", "closed", "declined"] } },
        select: { id: true, clientId: true }
      }),
      tx.matterParty.count({ where: { firmId, matterId: args.matterId, contactId: args.clientId, partyRole: "client", status: "active" } }),
      args.rateCardId ? tx.rateCard.findFirst({ where: { id: args.rateCardId, firmId, status: "active", OR: [{ matterId: null }, { matterId: args.matterId }] }, select: { id: true, currencyCode: true } }) : null,
      args.trustLedgerAccountId ? tx.trustLedgerAccount.findFirst({ where: { id: args.trustLedgerAccountId, firmId, matterId: args.matterId, clientId: args.clientId, status: "active" }, select: { id: true, currencyCode: true } }) : null,
      tx.retainerAgreement.findFirst({ where: { firmId, agreementNumber }, select: { id: true } })
    ]);
    if (!matter) throw new Error("Only an open matter in the active firm can receive a fee agreement.");
    if (matter.clientId !== args.clientId && !clientParties) throw new Error("The agreement client must be this matter's client.");
    if (args.rateCardId && !rateCard) throw new Error("Rate card must be active and apply to this matter.");
    if (rateCard && rateCard.currencyCode !== currencyCode) throw new Error("Rate card currency must match the agreement currency.");
    if (args.trustLedgerAccountId && !ledger) throw new Error("Trust ledger must be an active ledger for this matter and client.");
    if (ledger && ledger.currencyCode !== currencyCode) throw new Error("Trust ledger currency must match the agreement currency.");
    if (duplicate) throw new Error("Agreement number is already in use in this firm.");
    const agreement = await tx.retainerAgreement.create({
      data: {
        firmId,
        matterId: matter.id,
        clientId: args.clientId,
        rateCardId: rateCard?.id ?? null,
        trustLedgerAccountId: ledger?.id ?? null,
        agreementNumber,
        status: "draft",
        feeStructure: args.feeStructure,
        currencyCode,
        initialRetainerMinor,
        evergreenThresholdMinor,
        replenishmentAmountMinor,
        contingencyBasisPoints,
        termsSummary
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "billing.retainer_prepared",
      category: "financial",
      matterId: matter.id,
      contactId: args.clientId,
      metadata: {
        retainerId: agreement.id,
        termsDigest: sha256Digest({ agreementNumber, feeStructure: args.feeStructure, currencyCode, rateCardId: rateCard?.id ?? null, trustLedgerAccountId: ledger?.id ?? null, initialRetainerMinor, evergreenThresholdMinor, replenishmentAmountMinor, contingencyBasisPoints, termsSummary })
      }
    });
    return agreement;
  });
}
async function transitionRetainerAgreement(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  if (!["sent", "accepted", "active", "completed", "terminated"].includes(args.toStatus)) throw new Error("Unsupported fee agreement status.");
  const reason = args.toStatus === "terminated" ? boundedReason(args.reason, "Termination reason", 5, 2e3) : optionalBoundedText(args.reason, "Reason", 2e3);
  const effectiveAt = args.effectiveAt ? new Date(args.effectiveAt) : null;
  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) throw new Error("Effective date is invalid.");
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    const reference = await tx.retainerAgreement.findFirst({ where: { id: args.retainerId, firmId }, select: { id: true, matterId: true } });
    if (!reference) throw new Error("Fee agreement was not found in the active firm.");
    await lockRetainer(tx, firmId, reference.matterId);
    await assertMatterAccess(tx, firmId, reference.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, reference.matterId, userId, "canBill");
    const agreement = await tx.retainerAgreement.findFirst({ where: { id: reference.id, firmId } });
    if (!agreement || agreement.matterId !== reference.matterId) throw new Error("Fee agreement changed concurrently; reload before retrying.");
    assertLifecycleTransition("retainer", agreement.status, args.toStatus);
    const now = /* @__PURE__ */ new Date();
    const data = { status: args.toStatus };
    if (args.toStatus === "sent") data.sentAt = now;
    if (args.toStatus === "accepted") {
      if (!args.signedDocumentVersionId) throw new Error("Acceptance requires the signed agreement's document version.");
      const version = await tx.documentVersion.findFirst({
        where: { id: args.signedDocumentVersionId, firmId, document: { matterId: agreement.matterId, status: { notIn: ["archived", "disposed"] } } },
        select: { id: true }
      });
      if (!version) throw new Error("The signed agreement must be a document version on this matter.");
      data.signedDocumentVersionId = version.id;
      data.acceptedAt = now;
    }
    if (args.toStatus === "active") {
      if (!agreement.signedDocumentVersionId || !agreement.acceptedAt) throw new Error("Only an accepted agreement with signed evidence can become active.");
      if ((agreement.initialRetainerMinor ?? 0) > 0 && !agreement.trustLedgerAccountId) {
        throw new Error("An agreement that takes a retainer deposit needs the client's trust ledger before it becomes active.");
      }
      if (agreement.trustLedgerAccountId) {
        const ledger = await tx.trustLedgerAccount.findFirst({ where: { id: agreement.trustLedgerAccountId, firmId, status: "active" }, select: { id: true } });
        if (!ledger) throw new Error("The agreement's trust ledger is no longer active.");
      }
      data.effectiveAt = effectiveAt ?? now;
    }
    if (args.toStatus === "terminated") data.terminatedAt = now;
    const updated = await tx.retainerAgreement.update({ where: { id: agreement.id }, data, select: { id: true, status: true } });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: `billing.retainer_${args.toStatus}`,
      category: "financial",
      matterId: agreement.matterId,
      contactId: agreement.clientId,
      metadata: {
        retainerId: agreement.id,
        fromStatus: agreement.status,
        toStatus: args.toStatus,
        signedDocumentVersionId: data.signedDocumentVersionId ?? agreement.signedDocumentVersionId ?? null,
        ...reason ? { reasonDigest: sha256Digest(reason) } : {}
      }
    });
    return updated;
  });
}

// features/keystone/mutations/docketWorkflows.ts
var entryTypes = /* @__PURE__ */ new Set(["filing", "order", "hearing", "notice", "service", "correspondence", "other"]);
function optionalInstant(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}
function normalizeEntry(fields) {
  const title = String(fields.title ?? "").trim();
  if (!title || title.length > 300) throw new Error("Docket entry title is required and must be 300 characters or fewer.");
  if (!entryTypes.has(fields.entryType)) throw new Error("Unsupported docket entry type.");
  const occurredAt = optionalInstant(fields.occurredAt, "Entry date");
  if (!occurredAt) throw new Error("Entry date is required.");
  const sourceUrl = optionalBoundedText(fields.sourceUrl, "Source URL", 2e3) ?? "";
  if (sourceUrl) {
    let parsed;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error("Source URL must be a valid https URL.");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Source URL must be a valid https URL.");
  }
  return {
    title,
    entryType: fields.entryType,
    occurredAt,
    filedAt: optionalInstant(fields.filedAt, "Filed date"),
    enteredAt: optionalInstant(fields.enteredAt, "Entered date"),
    description: optionalBoundedText(fields.description, "Description", 8e3) ?? "",
    externalEntryId: optionalBoundedText(fields.externalEntryId, "Court entry number", 200) ?? "",
    sourceUrl
  };
}
async function sameMatterVersion(tx, firmId, matterId, versionId) {
  if (!versionId) return null;
  const version = await tx.documentVersion.findFirst({
    where: { id: versionId, firmId, document: { matterId } },
    select: { id: true }
  });
  if (!version) throw new Error("The supporting document must be a version on this docket's matter.");
  return version.id;
}
async function recordDocketEntry(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const entry = normalizeEntry(args);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const docket = await tx.docket.findFirst({ where: { id: args.docketId, firmId }, select: { id: true, matterId: true, status: true } });
    if (!docket) throw new Error("Docket was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${docket.id}`}))`;
    await assertMatterAccess(tx, firmId, docket.matterId, userId);
    if (docket.status === "closed") throw new Error("A closed docket cannot receive new entries.");
    const documentVersionId = await sameMatterVersion(tx, firmId, docket.matterId, args.documentVersionId);
    const created = await tx.docketEntry.create({
      data: { firmId, matterId: docket.matterId, docketId: docket.id, status: "draft", isVerified: false, documentVersionId, ...entry },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_recorded",
      category: "legal_workflow",
      matterId: docket.matterId,
      metadata: { docketEntryId: created.id, docketId: docket.id, entryDigest: sha256Digest({ ...entry, documentVersionId }) }
    });
    return created;
  });
}
async function reviseDocketEntry(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const entry = normalizeEntry(args);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const reference = await tx.docketEntry.findFirst({ where: { id: args.entryId, firmId }, select: { id: true, docketId: true } });
    if (!reference) throw new Error("Docket entry was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${reference.docketId}`}))`;
    const current = await tx.docketEntry.findFirst({ where: { id: reference.id, firmId } });
    if (!current) throw new Error("Docket entry changed concurrently; reload before retrying.");
    await assertMatterAccess(tx, firmId, current.matterId, userId);
    if (current.isVerified || current.status !== "draft") throw new Error("Only an unverified draft docket entry can be revised.");
    const documentVersionId = await sameMatterVersion(tx, firmId, current.matterId, args.documentVersionId);
    const updated = await tx.docketEntry.update({ where: { id: current.id }, data: { ...entry, documentVersionId }, select: { id: true, status: true } });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_revised",
      category: "legal_workflow",
      matterId: current.matterId,
      metadata: { docketEntryId: current.id, entryDigest: sha256Digest({ ...entry, documentVersionId }) }
    });
    return updated;
  });
}
async function verifyDocketEntry(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  if (!["filed", "entered", "rejected", "withdrawn"].includes(args.toStatus)) throw new Error("Unsupported docket entry outcome.");
  const reason = boundedReason(args.reason, "Verification note", 3, 2e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const reference = await tx.docketEntry.findFirst({ where: { id: args.entryId, firmId }, select: { id: true, docketId: true } });
    if (!reference) throw new Error("Docket entry was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${reference.docketId}`}))`;
    const current = await tx.docketEntry.findFirst({ where: { id: reference.id, firmId } });
    if (!current) throw new Error("Docket entry changed concurrently; reload before retrying.");
    await assertMatterAccess(tx, firmId, current.matterId, userId);
    if (current.isVerified) throw new Error("This docket entry is already verified.");
    assertLifecycleTransition("docketEntry", current.status, args.toStatus);
    if (args.toStatus === "filed" && !current.filedAt) throw new Error("Record the court's filed date before verifying a filing.");
    if (args.toStatus === "entered" && !current.enteredAt) throw new Error("Record the court's entered date before verifying an entry.");
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.docketEntry.update({
      where: { id: current.id },
      data: { status: args.toStatus, isVerified: true, verifiedById: userId, verifiedAt: now },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_verified",
      category: "legal_workflow",
      matterId: current.matterId,
      metadata: { docketEntryId: current.id, fromStatus: current.status, toStatus: args.toStatus, reasonDigest: sha256Digest(reason) }
    });
    return updated;
  });
}

// features/keystone/mutations/partyWorkflows.ts
var import_node_crypto14 = require("node:crypto");
var intakeRoles = /* @__PURE__ */ new Set(["prospective_client", "adverse_party", "related_party", "witness", "referrer", "other"]);
var matterRoles = /* @__PURE__ */ new Set(["client", "claimant", "respondent", "opposing_party", "witness", "expert", "counsel", "adjudicator", "other"]);
var matterSides = /* @__PURE__ */ new Set(["our_client", "adverse", "neutral", "unknown"]);
var closedIntakeStatuses = ["converted", "declined", "withdrawn"];
function contactName(contact) {
  return contact.contactType === "organization" ? contact.organizationName.trim() : `${contact.firstName} ${contact.lastName}`.trim();
}
async function activeContact(tx, firmId, contactId) {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, firmId, status: { not: "archived" } },
    select: { id: true, contactType: true, firstName: true, lastName: true, organizationName: true }
  });
  if (!contact) throw new Error("Contact is unavailable in the active firm.");
  return contact;
}
async function requireConflictReReview(tx, input) {
  const term = contactName(input.contact) || "Unnamed party";
  const normalizedTerm = term.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim() || "unnamed party";
  const check = await tx.conflictCheck.create({
    data: {
      firmId: input.firmId,
      intakeId: input.intakeId ?? null,
      matterId: input.matterId ?? null,
      checkNumber: `PARTY-${(0, import_node_crypto14.randomUUID)()}`,
      status: "requested",
      requestedById: input.userId,
      searchScope: "contacts_and_matters",
      searchVersion: "manual-v1",
      summary: input.cause
    },
    select: { id: true }
  });
  await tx.conflictSearchTerm.create({
    data: {
      firmId: input.firmId,
      matterId: input.matterId ?? null,
      checkId: check.id,
      term,
      normalizedTerm,
      termType: input.contact.contactType === "organization" ? "organization" : "person",
      sourceContactId: input.contact.id
    }
  });
  return check.id;
}
async function addIntakeParticipant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (!intakeRoles.has(args.participantRole)) throw new Error("Unsupported intake participant role.");
  const notes = optionalBoundedText(args.notes, "Notes", 2e3) ?? "";
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId }, select: { id: true, status: true } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (closedIntakeStatuses.includes(intake.status)) throw new Error("A closed or converted intake's parties are fixed; maintain them on the matter.");
    const contact = await activeContact(tx, firmId, args.contactId);
    const duplicate = await tx.intakeParticipant.findFirst({
      where: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: args.participantRole, status: "active" },
      select: { id: true }
    });
    if (duplicate) throw new Error("This contact already has that role on the intake.");
    const participant = await tx.intakeParticipant.create({
      data: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: args.participantRole, status: "active", notes },
      select: { id: true, status: true }
    });
    const conflictCheckId = await requireConflictReReview(tx, {
      firmId,
      userId,
      intakeId: intake.id,
      contact,
      cause: "Party added to intake; review conflicts for the new party."
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "intake.participant_added",
      category: "legal_workflow",
      intakeId: intake.id,
      contactId: contact.id,
      metadata: { participantId: participant.id, participantRole: args.participantRole, conflictCheckId }
    });
    return { ...participant, conflictCheckId };
  });
}
async function changeIntakeParticipant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  const reason = boundedReason(args.reason, "Change reason", 3, 2e3);
  if (args.participantRole && !intakeRoles.has(args.participantRole)) throw new Error("Unsupported intake participant role.");
  const notes = optionalBoundedText(args.notes, "Notes", 2e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.intakeParticipant.findFirst({ where: { id: args.participantId, firmId }, select: { id: true, intakeId: true } });
    if (!reference) throw new Error("Intake participant was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${reference.intakeId}`}))`;
    const participant = await tx.intakeParticipant.findFirst({ where: { id: reference.id, firmId }, include: { intake: { select: { status: true } } } });
    if (!participant || participant.status !== "active") throw new Error("Only an active intake participant can be changed.");
    if (closedIntakeStatuses.includes(participant.intake.status)) throw new Error("A closed or converted intake's parties are fixed; maintain them on the matter.");
    const roleChanged = Boolean(args.participantRole && args.participantRole !== participant.participantRole);
    if (!args.remove && !roleChanged && notes == null) throw new Error("A role, notes or removal change is required.");
    const updated = await tx.intakeParticipant.update({
      where: { id: participant.id },
      data: args.remove ? { status: "removed" } : { ...roleChanged ? { participantRole: args.participantRole } : {}, ...notes != null ? { notes } : {} },
      select: { id: true, status: true }
    });
    const conflictCheckId = roleChanged && !args.remove ? await requireConflictReReview(tx, {
      firmId,
      userId,
      intakeId: participant.intakeId,
      contact: await activeContact(tx, firmId, participant.contactId),
      cause: "Intake party role changed; review conflicts for the corrected relationship."
    }) : null;
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: args.remove ? "intake.participant_removed" : "intake.participant_changed",
      category: "legal_workflow",
      intakeId: participant.intakeId,
      contactId: participant.contactId,
      metadata: { participantId: participant.id, previousRole: participant.participantRole, nextRole: roleChanged ? args.participantRole : participant.participantRole, conflictCheckId, reasonDigest: sha256Digest(reason) }
    });
    return { ...updated, conflictCheckId };
  });
}
async function addMatterParty(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  if (!matterRoles.has(args.partyRole)) throw new Error("Unsupported matter party role.");
  const side = args.side?.trim() || "unknown";
  if (!matterSides.has(side)) throw new Error("Unsupported matter party side.");
  if (args.isPrimaryClient && args.partyRole !== "client") throw new Error("Only a client party can be the primary client.");
  const notes = optionalBoundedText(args.notes, "Notes", 2e3) ?? "";
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canEdit");
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, status: true, clientId: true } });
    if (!matter || ["closed", "declined"].includes(matter.status)) throw new Error("Parties can be added only to an active matter.");
    if (args.isPrimaryClient && args.contactId !== matter.clientId) throw new Error("The primary client party must match the matter client.");
    const contact = await activeContact(tx, firmId, args.contactId);
    for (const relatedId of [args.representedById, args.counselContactId]) {
      if (relatedId) await activeContact(tx, firmId, relatedId);
    }
    const [duplicate, primary] = await Promise.all([
      tx.matterParty.findFirst({ where: { firmId, matterId: matter.id, contactId: contact.id, partyRole: args.partyRole, status: "active" }, select: { id: true } }),
      args.isPrimaryClient ? tx.matterParty.findFirst({ where: { firmId, matterId: matter.id, isPrimaryClient: true, status: "active" }, select: { id: true } }) : null
    ]);
    if (duplicate) throw new Error("This contact already has that role on the matter.");
    if (primary) throw new Error("The matter already has an active primary client party.");
    const party = await tx.matterParty.create({
      data: {
        firmId,
        matterId: matter.id,
        contactId: contact.id,
        partyRole: args.partyRole,
        side,
        status: "active",
        representedById: args.representedById || null,
        counselContactId: args.counselContactId || null,
        isPrimaryClient: Boolean(args.isPrimaryClient),
        notes
      },
      select: { id: true, status: true }
    });
    const conflictCheckId = await requireConflictReReview(tx, {
      firmId,
      userId,
      matterId: matter.id,
      contact,
      cause: "Party added to matter; review conflicts for the new party."
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "matter.party_added",
      category: "legal_workflow",
      matterId: matter.id,
      contactId: contact.id,
      metadata: { partyId: party.id, partyRole: args.partyRole, side, conflictCheckId }
    });
    return { ...party, conflictCheckId };
  });
}
async function changeMatterParty(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  const reason = boundedReason(args.reason, "Change reason", 3, 2e3);
  if (args.partyRole && !matterRoles.has(args.partyRole)) throw new Error("Unsupported matter party role.");
  if (args.side && !matterSides.has(args.side)) throw new Error("Unsupported matter party side.");
  const notes = optionalBoundedText(args.notes, "Notes", 2e3);
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    const reference = await tx.matterParty.findFirst({ where: { id: args.partyId, firmId }, select: { id: true, matterId: true } });
    if (!reference) throw new Error("Matter party was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${reference.matterId}`}))`;
    await assertMatterAccess(tx, firmId, reference.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, reference.matterId, userId, "canEdit");
    const party = await tx.matterParty.findFirst({ where: { id: reference.id, firmId } });
    if (!party || party.status !== "active") throw new Error("Only an active matter party can be changed.");
    const roleChanged = Boolean(args.partyRole && args.partyRole !== party.partyRole);
    const sideChanged = Boolean(args.side && args.side !== party.side);
    if (!args.remove && !roleChanged && !sideChanged && notes == null) throw new Error("A role, side, notes or removal change is required.");
    const matter = await tx.matter.findFirst({ where: { id: party.matterId, firmId }, select: { clientId: true, status: true } });
    if (!matter || ["closed", "declined"].includes(matter.status)) throw new Error("Only parties on an active matter can be changed.");
    if (party.isPrimaryClient && party.contactId !== matter.clientId) throw new Error("Inconsistent primary client requires reviewed correction.");
    if ((args.remove || roleChanged) && (party.isPrimaryClient || party.partyRole === "client" && party.contactId === matter.clientId)) {
      throw new Error("The authoritative matter client cannot be removed or replaced through party maintenance.");
    }
    const updated = await tx.matterParty.update({
      where: { id: party.id },
      data: args.remove ? { status: "removed", isPrimaryClient: false } : { ...roleChanged ? { partyRole: args.partyRole } : {}, ...sideChanged ? { side: args.side } : {}, ...notes != null ? { notes } : {} },
      select: { id: true, status: true }
    });
    const conflictCheckId = (roleChanged || sideChanged) && !args.remove ? await requireConflictReReview(tx, {
      firmId,
      userId,
      matterId: party.matterId,
      contact: await activeContact(tx, firmId, party.contactId),
      cause: "Matter party relationship changed; review conflicts for the corrected relationship."
    }) : null;
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: args.remove ? "matter.party_removed" : "matter.party_changed",
      category: "legal_workflow",
      matterId: party.matterId,
      contactId: party.contactId,
      metadata: {
        partyId: party.id,
        previous: { partyRole: party.partyRole, side: party.side },
        next: { partyRole: roleChanged ? args.partyRole : party.partyRole, side: sideChanged ? args.side : party.side },
        conflictCheckId,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { ...updated, conflictCheckId };
  });
}

// features/keystone/lib/portal-auth.ts
var import_node_crypto15 = require("node:crypto");
var import_zod2 = require("zod");

// features/keystone/lib/portal-read-error.ts
var PortalReadError = class extends Error {
  constructor(code) {
    super(code === "invalid_session" ? "Portal session is invalid or expired." : code === "invalid_cursor" ? "Portal page is unavailable." : "Shared item is unavailable.");
    this.code = code;
    this.name = "PortalReadError";
  }
};

// features/keystone/lib/portal-auth.ts
async function authenticatePortalSession(rawToken, prisma, pepper) {
  const client = prismaWithoutGraphQLErrorConversion(prisma);
  const parsed = parseCredential(rawToken);
  if (!parsed || parsed.kind !== "portal_session") return null;
  const digest2 = credentialDigest("portal_session", rawToken, pepper);
  const session = await client.portalSession.findUnique({
    where: { tokenDigest: digest2 },
    include: { portalAccount: { include: {
      firm: { select: { id: true, status: true } },
      contact: { select: { id: true, firmId: true, status: true } }
    } } }
  });
  const now = /* @__PURE__ */ new Date();
  if (!session || session.status !== "active" || session.expiresAt <= now || session.portalAccount?.id !== session.portalAccountId || session.portalAccount?.status !== "active" || session.portalAccount?.contact?.id !== session.portalAccount.contactId || session.portalAccount?.contact?.firmId !== session.firmId || !session.portalAccount?.contact?.status || session.portalAccount.contact.status === "archived" || session.portalAccount?.firmId !== session.firmId || session.portalAccount?.firm?.id !== session.firmId || session.portalAccount?.firm?.status !== "active") {
    return null;
  }
  await client.portalSession.update({
    where: { id: session.id },
    data: { lastUsedAt: now }
  });
  return {
    sessionId: session.id,
    firmId: session.firmId,
    portalAccountId: session.portalAccountId,
    contactId: session.portalAccount.contactId
  };
}
var PORTAL_INVOICE_LINE_LIMIT = 200;
var PORTAL_THREAD_MESSAGE_LIMIT = 50;
var portalCursor = import_zod2.z.object({ a: import_zod2.z.string(), g: import_zod2.z.string().datetime(), i: import_zod2.z.string().min(1).max(64) });
async function recordPortalRead(client, identity, share) {
  await client.auditEvent.create({
    data: {
      firmId: identity.firmId,
      eventId: (0, import_node_crypto15.randomUUID)(),
      eventType: "portal.resource_read",
      category: "authorization",
      outcome: "succeeded",
      actorType: "portal_account",
      matterId: share.matterId,
      contactId: identity.contactId,
      occurredAt: /* @__PURE__ */ new Date(),
      metadata: {
        portalAccountId: identity.portalAccountId,
        portalShareId: share.id,
        portalMatterAccessId: share.matterAccessId,
        grantVersion: share.grantVersion,
        policyRevision: share.policyRevision,
        resourceType: share.resourceType
      }
    }
  });
}
async function readPortalSharedResource(rawToken, shareId, prisma, pepper) {
  return runSerializableTransaction(prisma, (tx) => readPortalSharedResourceInTransaction(rawToken, shareId, tx, pepper));
}
async function readPortalSharedResourceInTransaction(rawToken, shareId, prisma, pepper) {
  const client = prismaWithoutGraphQLErrorConversion(prisma);
  const identity = await authenticatePortalSession(rawToken, client, pepper);
  if (!identity) throw new PortalReadError("invalid_session");
  const now = /* @__PURE__ */ new Date();
  const value = await client.portalShare.findFirst({
    where: { ...portalShareCandidateWhere(identity, now), id: shareId },
    select: portalShareHeaderSelect
  });
  const share = boundPortalShare(value, identity, now);
  if (!share || share.id !== shareId || !await portalShareIsCurrent(client, share)) {
    throw new PortalReadError("unavailable_resource");
  }
  const current = await client.portalShare.findFirst({
    where: boundPortalShareWhere(share, identity, now),
    select: { id: true }
  });
  if (!current || current.id !== share.id) throw new PortalReadError("unavailable_resource");
  if (share.resourceType === "document") {
    const resource3 = await client.document.findFirst({
      where: {
        id: share.documentId,
        firmId: identity.firmId,
        matterId: share.matterId,
        status: "active",
        confidentiality: "client_shareable"
      },
      select: { id: true, title: true, category: true, status: true, updatedAt: true }
    });
    if (!resource3 || resource3.id !== share.documentId) throw new Error("Shared document is unavailable.");
    await recordPortalRead(client, identity, share);
    return {
      resourceType: share.resourceType,
      document: resource3,
      documentVersion: null,
      invoice: null,
      communicationThread: null
    };
  }
  if (share.resourceType === "document_version") {
    const resource3 = await client.documentVersion.findFirst({
      where: {
        id: share.documentVersionId,
        firmId: identity.firmId,
        document: {
          id: share.documentVersion?.documentId,
          firmId: identity.firmId,
          matterId: share.matterAccess.matterId,
          status: "active",
          confidentiality: "client_shareable"
        }
      },
      select: {
        id: true,
        versionNumber: true,
        fileName: true,
        mediaType: true,
        byteSize: true,
        checksumSha256: true,
        createdAt: true
      }
    });
    if (!resource3 || resource3.id !== share.documentVersionId) throw new Error("Shared document version is unavailable.");
    await recordPortalRead(client, identity, share);
    return {
      resourceType: share.resourceType,
      document: null,
      documentVersion: resource3,
      invoice: null,
      communicationThread: null
    };
  }
  if (share.resourceType === "invoice") {
    const resource3 = await client.invoice.findFirst({
      where: {
        id: share.invoiceId,
        firmId: identity.firmId,
        matterId: share.matterId,
        status: { in: ["issued", "partially_paid", "paid", "overdue"] }
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currencyCode: true,
        totalMinor: true,
        paidMinor: true,
        balanceDueMinor: true,
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        issuedAt: true,
        dueAt: true,
        // Issued lines are immutable billing snapshots of the same invoice/matter.
        lines: {
          where: { firmId: identity.firmId, matterId: share.matterId },
          orderBy: [{ serviceDate: "asc" }, { id: "asc" }],
          take: PORTAL_INVOICE_LINE_LIMIT + 1,
          select: { id: true, description: true, serviceDate: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true, currencyCode: true }
        }
      }
    });
    if (!resource3 || resource3.id !== share.invoiceId) throw new Error("Shared invoice is unavailable.");
    await recordPortalRead(client, identity, share);
    const { lines, ...invoice } = resource3;
    return {
      resourceType: share.resourceType,
      document: null,
      documentVersion: null,
      invoice: { ...invoice, lines: lines.slice(0, PORTAL_INVOICE_LINE_LIMIT), hasMoreLines: lines.length > PORTAL_INVOICE_LINE_LIMIT },
      communicationThread: null
    };
  }
  const resource2 = await client.communicationThread.findFirst({
    where: {
      id: share.communicationThreadId,
      firmId: identity.firmId,
      matterId: share.matterId,
      status: "open"
    },
    select: { id: true, subject: true, primaryChannel: true, status: true, lastMessageAt: true }
  });
  if (!resource2 || resource2.id !== share.communicationThreadId) throw new Error("Shared communication thread is unavailable.");
  const messages = await client.communicationMessage.findMany({
    where: {
      threadId: resource2.id,
      firmId: identity.firmId,
      matterId: share.matterId,
      OR: [
        { direction: "inbound", status: "received", senderContactId: identity.contactId },
        {
          direction: "outbound",
          status: { in: ["sent", "delivered"] },
          deliveries: { some: { recipientContactId: identity.contactId, status: { in: ["sent", "delivered"] } } }
        }
      ]
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: PORTAL_THREAD_MESSAGE_LIMIT + 1,
    select: { id: true, direction: true, subject: true, body: true, sentAt: true, receivedAt: true, createdAt: true }
  });
  await recordPortalRead(client, identity, share);
  return {
    resourceType: share.resourceType,
    document: null,
    documentVersion: null,
    invoice: null,
    communicationThread: {
      ...resource2,
      messages: messages.slice(0, PORTAL_THREAD_MESSAGE_LIMIT).reverse(),
      hasOlderMessages: messages.length > PORTAL_THREAD_MESSAGE_LIMIT
    }
  };
}

// features/keystone/mutations/portalPolicyWorkflows.ts
function boundedId(value) {
  if (!value || value !== value.trim() || value.length > 200) throw new Error("An exact bounded target identifier is required.");
  return value;
}
async function recordPortalDiscoveryPolicy(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageFirm", { humanOnly: true });
  const policy = normalizePortalPolicy(args.mode, args.statuses);
  const reason = boundedReason(args.reason, "Policy review reason", 5, 2e3);
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0 || args.expectedRevision >= 2147483647) throw new Error("Invalid policy revision.");
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageFirm");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await assertCurrentPortalActor(tx, firmId, userId, ["canManageFirm"]);
    const latest = await tx.portalDiscoveryPolicy.findFirst({ where: { firmId }, orderBy: { revision: "desc" } });
    if ((latest?.revision ?? 0) !== args.expectedRevision) throw new Error("Policy changed; reload before recording a revision.");
    const data = { firmId, revision: args.expectedRevision + 1, ...policy, reasonDigest: sha256Digest(reason), recordedById: userId, recordedAt: /* @__PURE__ */ new Date() };
    const recorded = await tx.portalDiscoveryPolicy.create({ data });
    await recordAuditEvent(tx, { firmId, actorUserId: userId, category: "authorization", eventType: "portal.discovery_policy_recorded", metadata: { revision: data.revision, mode: policy.mode, statuses: policy.statuses, admission: policy.admission, reasonDigest: data.reasonDigest } });
    return recorded;
  });
}
async function executePortalGrant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  requirePermission(context, "canReadMatters", { humanOnly: true });
  requirePermission(context, "canReadPortal", { humanOnly: true });
  if (!["grant", "revoke"].includes(args.operation)) throw new Error("Unsupported matter-grant command.");
  const reason = boundedReason(args.reason, "Grant intent reason", 5, 2e3);
  const key = boundedId(args.idempotencyKey);
  const portalAccountId = boundedId(args.portalAccountId);
  const matterId = boundedId(args.matterId);
  const contactId = boundedId(args.contactId);
  const grantId = args.grantId ? boundedId(args.grantId) : null;
  if (!Number.isSafeInteger(args.policyRevision) || args.policyRevision < 1 || !Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0 || args.expectedVersion >= 2147483647) throw new Error("Explicit policy revision and grant version are required.");
  const capabilities = {
    canReadDocuments: args.canReadDocuments === true,
    canUploadDocuments: args.canUploadDocuments === true,
    canReadInvoices: args.canReadInvoices === true,
    canReadMessages: args.canReadMessages === true
  };
  if (args.operation === "revoke" && (Object.values(capabilities).some(Boolean) || args.expiresAt || !grantId)) throw new Error("Revocation requires only an exact grant and reason.");
  if (args.operation === "grant" && !Object.values(capabilities).some(Boolean)) throw new Error("At least one explicit capability is required.");
  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Invalid expiration.");
  const intentDigest = sha256Digest({ operation: args.operation, firmId, actorId: userId, portalAccountId, contactId, matterId, grantId, policyRevision: args.policyRevision, expectedVersion: args.expectedVersion, capabilities, expiresAt: expiresAt?.toISOString() ?? null, reason });
  return runSerializableTransaction(context.prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
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
      const grant2 = await tx.portalMatterAccess.findFirst({ where: { id: prior.grantId, firmId, portalAccountId, matterId } });
      if (!grant2 || grant2.version !== prior.resultVersion || grant2.status !== (args.operation === "grant" ? "active" : "revoked")) throw new Error("Intent completed but current grant changed; inspect history instead of replaying.");
      if (args.operation === "grant" && grant2.expiresAt && grant2.expiresAt <= /* @__PURE__ */ new Date()) throw new Error("Completed grant has expired; create a new reviewed intent.");
      return { grant: portalGrantProjection(grant2), replayed: true, intentId: prior.id };
    }
    if (expiresAt && (expiresAt <= /* @__PURE__ */ new Date() || expiresAt.getTime() > Date.now() + 366 * 864e5)) throw new Error("Expiration must be future and within 366 days.");
    const existing = await tx.portalMatterAccess.findFirst({ where: { firmId, portalAccountId, matterId }, orderBy: [{ grantedAt: "desc" }, { id: "asc" }] });
    const activeCount = await tx.portalMatterAccess.count({ where: { firmId, portalAccountId, matterId, status: "active" } });
    if (activeCount > 1 || activeCount === 1 && existing?.status !== "active") throw new Error("Legacy grant set is inconsistent; explicitly review/revoke account access before regranting.");
    if ((existing?.id ?? null) !== grantId || (existing?.version ?? 0) !== args.expectedVersion) throw new Error("Grant target/version changed; reload before retrying.");
    const now = new Date(Math.max(Date.now(), (existing?.grantedAt?.getTime() ?? 0) + 1));
    let grant;
    if (args.operation === "revoke") {
      if (!existing || !["active", "expired"].includes(existing.status)) throw new Error("Grant is not revocable in its current state.");
      const changed = await tx.portalMatterAccess.updateMany({ where: { id: existing.id, version: args.expectedVersion, status: existing.status }, data: { status: "revoked", version: args.expectedVersion + 1, revokedById: userId, revokedAt: now, revocationReason: reason, updatedAt: now } });
      if (changed.count !== 1) throw new Error("Grant changed concurrently.");
      await tx.portalShare.updateMany({ where: { firmId, matterAccessId: existing.id, status: "active" }, data: { status: "revoked", revokedById: userId, revokedAt: now, updatedAt: now } });
      grant = await tx.portalMatterAccess.findUnique({ where: { id: existing.id } });
    } else {
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
async function portalPolicyWorkspace(_root, args, context) {
  const canReadPortal = permissions.canReadPortal({ session: context.session });
  const entryPermission = canReadPortal ? "canReadPortal" : "canManageFirm";
  const { firmId, userId } = requirePermission(context, entryPermission, { humanOnly: true });
  const tx = prismaWithoutGraphQLErrorConversion(context.prisma);
  await assertCurrentPortalActor(tx, firmId, userId, [entryPermission]);
  const policy = await currentPortalPolicy(tx, firmId);
  const latest = await tx.portalDiscoveryPolicy.findFirst({ where: { firmId }, orderBy: { revision: "desc" } });
  const policyHistory = await tx.portalDiscoveryPolicy.findMany({ where: { firmId }, orderBy: { revision: "desc" }, take: 12, select: { revision: true, mode: true, statuses: true, admission: true } });
  const currentCapability = async (key) => {
    if (!permissions[key]({ session: context.session })) return false;
    try {
      await assertCurrentPortalActor(tx, firmId, userId, [key]);
      return true;
    } catch {
      return false;
    }
  };
  const canConfigure = await currentCapability("canManageFirm");
  const canManage = await currentCapability("canManagePortal");
  const base = { policy, policyHistory, latestRevision: latest?.revision ?? 0, latestChoice: latest?.mode ?? "legacy_unconfigured", latestAdmission: latest?.admission ?? "unconfigured", canConfigure, canManage, items: [], total: 0, page: 1, hasNext: false, accounts: [], grants: [], history: [], selection: null };
  if (!canReadPortal) return { ...base, state: "portal_read_denied" };
  if (!policy) return { ...base, state: "unconfigured" };
  if (!permissions.canReadMatters({ session: context.session })) return { ...base, state: "matter_read_denied" };
  await assertCurrentPortalActor(tx, firmId, userId, ["canReadPortal", "canReadMatters"]);
  const search = args.search?.trim() ?? "";
  if (search.length > 100 || args.status && !policy.statuses.includes(args.status)) throw new Error("Invalid directory search or policy status.");
  const page = args.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1 || (page - 1) * 12 > 2147483647) throw new Error("Invalid bounded directory page.");
  const where = { status: { in: args.status ? [args.status] : policy.statuses }, ...search ? { matterNumber: { contains: search, mode: "insensitive" } } : {} };
  const api = context.query.Matter;
  const [total, items, accounts] = await Promise.all([
    api.count({ where }),
    api.findMany({ where, orderBy: [{ matterNumber: "asc" }, { id: "asc" }], take: 12, skip: (page - 1) * 12, query: "id matterNumber status" }),
    context.query.PortalAccount.findMany({ where: { status: { equals: "active" } }, orderBy: [{ id: "asc" }], take: 12, query: "id status contact { id }" })
  ]);
  let grants = [], history = [];
  let selection = null;
  if (args.matterId && args.portalAccountId) {
    const selected = await api.findOne({ where: { id: boundedId(args.matterId) }, query: "id matterNumber status" });
    if (!selected) throw new Error("Selected target is unavailable.");
    selection = { id: selected.id, matterNumber: selected.matterNumber, status: selected.status };
    grants = await context.query.PortalMatterAccess.findMany({ where: { matter: { id: { equals: selected.id } }, portalAccount: { id: { equals: boundedId(args.portalAccountId) } } }, orderBy: [{ grantedAt: "desc" }, { id: "asc" }], take: 12, query: "id status version policyRevision canReadDocuments canUploadDocuments canReadInvoices canReadMessages expiresAt" });
    history = await context.query.PortalGrantIntent.findMany({ where: { matter: { id: { equals: selected.id } }, portalAccount: { id: { equals: args.portalAccountId } }, actor: { id: { equals: userId } } }, orderBy: [{ completedAt: "desc" }, { id: "asc" }], take: 12, query: "id operation policyRevision resultVersion completedAt grant { id }" });
  }
  return { ...base, state: "ready", selection, items, total, page, hasNext: page * 12 < total, accounts: accounts.filter((account2) => account2.contact?.id).map((account2) => ({ id: account2.id, contactId: account2.contact.id })), grants, history };
}

// features/keystone/mutations/portalWorkflows.ts
function normalizedEmail(value) {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid portal email address is required.");
  }
  return email;
}
function futureDate(value, defaultDays, maxDays) {
  const date = value ? new Date(value) : new Date(Date.now() + defaultDays * 24 * 60 * 6e4);
  if (Number.isNaN(date.getTime()) || date <= /* @__PURE__ */ new Date() || date.getTime() > Date.now() + maxDays * 24 * 60 * 6e4) {
    throw new Error(`Expiration must be in the future and within ${maxDays} days.`);
  }
  return date;
}
async function invitePortalAccount(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  const email = normalizedEmail(args.email);
  const expiresAt = futureDate(args.expiresAt, 2, 7);
  const invite = issueCredential("portal_invite");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-invite:${firmId}:${email}`}))`;
    const contact = await tx.contact.findFirst({ where: { id: args.contactId, firmId }, select: { id: true } });
    if (!contact) throw new Error("Portal contact was not found in the active firm.");
    const existing = await tx.portalAccount.findFirst({ where: { firmId, email } });
    if (existing && existing.contactId !== contact.id) {
      throw new Error("Portal email is already assigned to another contact in this firm.");
    }
    if (existing) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${existing.id}`}))`;
    const now = /* @__PURE__ */ new Date();
    const revokedSessions = existing ? await tx.portalSession.updateMany({
      where: { portalAccountId: existing.id, status: "active" },
      data: { status: "revoked", revokedAt: now }
    }) : { count: 0 };
    const account2 = existing ? await tx.portalAccount.update({
      where: { id: existing.id },
      data: {
        status: "invited",
        resetTokenDigest: "",
        resetExpiresAt: null,
        inviteTokenDigest: invite.digest,
        inviteTokenPrefix: invite.prefix,
        inviteExpiresAt: expiresAt,
        invitedAt: now,
        suspendedAt: null,
        closedAt: null
      }
    }) : await tx.portalAccount.create({
      data: {
        firmId,
        contactId: contact.id,
        email,
        status: "invited",
        inviteTokenDigest: invite.digest,
        inviteTokenPrefix: invite.prefix,
        inviteExpiresAt: expiresAt,
        invitedAt: now
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.account_invited",
      category: "authorization",
      actorUserId: userId,
      contactId: contact.id,
      metadata: {
        portalAccountId: account2.id,
        inviteExpiresAt: expiresAt.toISOString(),
        previousStatus: existing?.status ?? null,
        activeSessionsRevoked: revokedSessions.count
      }
    });
    return { account: account2, inviteToken: invite.token };
  });
}
async function acceptPortalInvitation(_root, args, context) {
  const parsed = parseCredential(args.inviteToken);
  if (!parsed || parsed.kind !== "portal_invite") throw new Error("Portal invitation is invalid or expired.");
  const digest2 = credentialDigest("portal_invite", args.inviteToken);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-invite:${digest2}`}))`;
    const reference = await tx.portalAccount.findUnique({ where: { inviteTokenDigest: digest2 }, select: { id: true, firmId: true } });
    if (!reference) throw new Error("Portal invitation is invalid or expired.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${reference.firmId}:${reference.id}`}))`;
    const account2 = await tx.portalAccount.findUnique({ where: { inviteTokenDigest: digest2 }, include: { firm: { select: { status: true } }, contact: { select: { status: true, firmId: true } } } });
    if (!account2 || account2.status !== "invited" || account2.firm?.status !== "active" || account2.contact?.firmId !== account2.firmId || !account2.contact?.status || account2.contact.status === "archived" || !account2.inviteExpiresAt || account2.inviteExpiresAt <= /* @__PURE__ */ new Date()) {
      throw new Error("Portal invitation is invalid or expired.");
    }
    const sessionCredential = issueCredential("portal_session");
    const now = /* @__PURE__ */ new Date();
    const accepted = await tx.portalAccount.update({
      where: { id: account2.id },
      data: {
        status: "active",
        acceptedAt: now,
        resetTokenDigest: "",
        resetExpiresAt: null,
        inviteTokenDigest: null,
        inviteTokenPrefix: "",
        inviteExpiresAt: null
      }
    });
    const session = await tx.portalSession.create({
      data: {
        firmId: account2.firmId,
        portalAccountId: account2.id,
        tokenDigest: sessionCredential.digest,
        tokenPrefix: sessionCredential.prefix,
        status: "active",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 6e4)
      }
    });
    await recordAuditEvent(tx, {
      firmId: account2.firmId,
      eventType: "portal.invitation_accepted",
      category: "authentication",
      contactId: account2.contactId,
      metadata: { portalAccountId: account2.id, portalSessionId: session.id }
    });
    return { account: accepted, sessionToken: sessionCredential.token, expiresAt: session.expiresAt };
  });
}
var PORTAL_SIGNIN_TTL_MS = 15 * 6e4;
var PORTAL_SESSION_TTL_MS = 7 * 24 * 60 * 6e4;
async function grantPortalMatterAccess(_root, args, context) {
  const result = await executePortalGrant(_root, { ...args, operation: "grant" }, context);
  return result.grant;
}
var resourceFields = {
  document: {
    field: "documentId",
    model: "document",
    portalPermission: "canReadDocuments",
    staffPermission: "canReadDocuments",
    where: (matterId) => ({ matterId, status: "active", confidentiality: "client_shareable" })
  },
  document_version: {
    field: "documentVersionId",
    model: "documentVersion",
    portalPermission: "canReadDocuments",
    staffPermission: "canReadDocuments",
    where: (matterId) => ({ document: { matterId, status: "active", confidentiality: "client_shareable" } })
  },
  invoice: {
    field: "invoiceId",
    model: "invoice",
    portalPermission: "canReadInvoices",
    staffPermission: "canReadBilling",
    where: (matterId) => ({ matterId, status: { in: ["issued", "partially_paid", "paid", "overdue"] } })
  },
  communication_thread: {
    field: "communicationThreadId",
    model: "communicationThread",
    portalPermission: "canReadMessages",
    staffPermission: "canReadCommunications",
    where: (matterId) => ({ matterId, status: "open" })
  }
};
async function sharePortalResource(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  const definition = resourceFields[args.resourceType];
  if (!definition) throw new Error("Unsupported portal resource type.");
  if (!permissions[definition.staffPermission]({ session: context.session })) {
    throw new Error("The current role cannot read the requested resource type.");
  }
  const expiresAt = args.expiresAt ? futureDate(args.expiresAt, 30, 366) : null;
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    const target = await tx.portalMatterAccess.findFirst({
      where: { id: args.portalMatterAccessId, firmId },
      select: { portalAccountId: true, matterId: true }
    });
    if (!target) throw new Error("Current portal matter access was not found.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${target.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access:${firmId}:${target.portalAccountId}:${target.matterId}`}))`;
    const access = await tx.portalMatterAccess.findFirst({
      where: {
        id: args.portalMatterAccessId,
        firmId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }]
      },
      select: {
        ...portalShareHeaderSelect.matterAccess.select,
        portalAccount: { select: { id: true, firmId: true, contactId: true, status: true } }
      }
    });
    if (!access || access.portalAccount.status !== "active") {
      throw new Error("Current portal matter access was not found.");
    }
    if (access.portalAccount.id !== access.portalAccountId || access.portalAccount.firmId !== firmId || access.portalAccountId !== target.portalAccountId || access.matterId !== target.matterId) {
      throw new Error("Current portal matter access was not found.");
    }
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters", definition.staffPermission]);
    await assertPortalMatterScope(tx, firmId, access.matterId, userId);
    await assertPortalAccountTarget(tx, firmId, access.portalAccountId, access.contactId ?? access.portalAccount.contactId, true);
    if (!await policyGrantIsCurrent(tx, access)) throw new Error("Grant policy or issuer authority changed; review a new grant before sharing.");
    if (!access[definition.portalPermission]) throw new Error("Portal matter access lacks the requested resource capability.");
    const resource2 = await tx[definition.model].findFirst({
      where: {
        id: args.resourceId,
        firmId,
        ...definition.where(access.matterId),
        ...args.resourceType === "document_version" ? { document: { firmId, matterId: access.matterId, status: "active", confidentiality: "client_shareable" } } : {}
      },
      select: { id: true }
    });
    if (!resource2) throw new Error("Portal resource was not found in the exact matter scope.");
    const share = await tx.portalShare.create({
      data: {
        firmId,
        matterId: access.matterId,
        portalAccountId: access.portalAccountId,
        matterAccessId: access.id,
        grantVersion: access.version,
        policyRevision: access.policyRevision,
        contactId: access.portalAccount.contactId,
        status: "active",
        resourceType: args.resourceType,
        [definition.field]: resource2.id,
        grantedById: userId,
        grantedAt: new Date(Math.max(Date.now(), access.grantedAt.getTime())),
        expiresAt
      }
    });
    const identity = { firmId, portalAccountId: access.portalAccountId, contactId: access.portalAccount.contactId };
    const stored = boundPortalShare(await tx.portalShare.findFirst({ where: { id: share.id, firmId }, select: portalShareHeaderSelect }), identity);
    if (!stored || stored.matterAccessId !== access.id || stored.matterAccess.version !== access.version || !await portalShareIsCurrent(tx, stored) || !await tx.portalShare.findFirst({ where: boundPortalShareWhere(stored, identity, /* @__PURE__ */ new Date()), select: { id: true } })) {
      throw new Error("Portal share exact binding could not be confirmed.");
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.resource_shared",
      category: "authorization",
      actorUserId: userId,
      matterId: access.matterId,
      contactId: access.portalAccount.contactId,
      metadata: {
        portalShareId: share.id,
        resourceType: args.resourceType,
        resourceId: resource2.id,
        portalMatterAccessId: access.id,
        grantVersion: access.version,
        policyRevision: access.policyRevision
      }
    });
    return share;
  });
}
async function revokePortalGrant(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  if (args.grantType === "matter_access") {
    const result = await executePortalGrant(_root, { ...args, grantId: args.id, operation: "revoke" }, context);
    return { id: result.grant.id, status: result.grant.status, replayed: result.replayed };
  }
  const reason = boundedReason(args.reason, "Portal revocation reason", 5, 2e3);
  if (!(/* @__PURE__ */ new Set(["account", "matter_access", "share"])).has(args.grantType)) {
    throw new Error("Unsupported portal grant type.");
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal"]);
    const now = /* @__PURE__ */ new Date();
    if (args.grantType === "account") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${args.id}`}))`;
      const account2 = await tx.portalAccount.findFirst({ where: { id: args.id, firmId } });
      if (!account2) throw new Error("Portal account was not found in the active firm.");
      if (account2.status === "closed") return { id: account2.id, status: account2.status, replayed: true };
      await Promise.all([
        tx.portalAccount.update({ where: { id: account2.id }, data: { status: "closed", closedAt: now, resetTokenDigest: "", resetExpiresAt: null, inviteTokenDigest: null, inviteTokenPrefix: "", inviteExpiresAt: null } }),
        tx.portalSession.updateMany({ where: { portalAccountId: account2.id, status: "active" }, data: { status: "revoked", revokedAt: now } }),
        tx.portalMatterAccess.updateMany({ where: { firmId, portalAccountId: account2.id, status: "active" }, data: { status: "revoked", version: { increment: 1 }, revokedById: userId, revokedAt: now, revocationReason: reason } }),
        tx.portalShare.updateMany({ where: { portalAccountId: account2.id, status: "active" }, data: { status: "revoked", revokedById: userId, revokedAt: now } })
      ]);
      await recordAuditEvent(tx, {
        firmId,
        eventType: "portal.account_closed",
        category: "authorization",
        actorUserId: userId,
        contactId: account2.contactId,
        metadata: { portalAccountId: account2.id, reasonDigest: sha256Digest(reason) }
      });
      return { id: account2.id, status: "closed", replayed: false };
    }
    const target = await tx.portalShare.findFirst({ where: { id: args.id, firmId }, select: { portalAccountId: true, matterId: true } });
    if (!target) throw new Error("Portal share was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${target.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access:${firmId}:${target.portalAccountId}:${target.matterId}`}))`;
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters"]);
    const share = await tx.portalShare.findFirst({ where: { id: args.id, firmId, portalAccountId: target.portalAccountId, matterId: target.matterId } });
    if (!share) throw new Error("Portal share was not found in the active firm.");
    await assertPortalMatterScope(tx, firmId, share.matterId, userId);
    if (share.status === "revoked") return { id: share.id, status: share.status, replayed: true };
    await tx.portalShare.update({
      where: { id: share.id },
      data: { status: "revoked", revokedById: userId, revokedAt: now }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.share_revoked",
      category: "authorization",
      actorUserId: userId,
      matterId: share.matterId,
      metadata: { portalShareId: share.id, reasonDigest: sha256Digest(reason) }
    });
    return { id: share.id, status: "revoked", replayed: false };
  });
}
async function portalSharedResource(_root, args, context) {
  return readPortalSharedResource(args.sessionToken, args.shareId, context.prisma);
}

// features/keystone/mutations/trustWorkflows.ts
function assertThreeWayTrustBalance(submittedBookBalanceMinor, balances) {
  if (![submittedBookBalanceMinor, balances.bankControlBalanceMinor, balances.clientLedgerBalanceMinor].every(isGraphqlInt)) {
    throw new Error("Trust reconciliation balances exceed the supported database integer range.");
  }
  if (submittedBookBalanceMinor !== balances.bankControlBalanceMinor) {
    throw new Error("Submitted cashbook/control balance does not match the posted trust ledger as of the period end.");
  }
  if (balances.clientLedgerBalanceMinor !== balances.bankControlBalanceMinor) {
    throw new Error("Trust reconciliation requires the cashbook/control balance to equal the total individual client/matter ledger liabilities.");
  }
}
async function trustBalancesAsOf(tx, trustAccountId, periodEnd) {
  const where = { trustAccountId, occurredAt: { lte: periodEnd } };
  const [bankDebits, bankCredits, liabilityCredits, liabilityDebits] = await Promise.all([
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: "bank_control", direction: "debit" },
      _sum: { amountMinor: true }
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: "bank_control", direction: "credit" },
      _sum: { amountMinor: true }
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: "client_liability", direction: "credit" },
      _sum: { amountMinor: true }
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: "client_liability", direction: "debit" },
      _sum: { amountMinor: true }
    })
  ]);
  const bankControlBalanceMinor = (bankDebits._sum.amountMinor ?? 0) - (bankCredits._sum.amountMinor ?? 0);
  const clientLedgerBalanceMinor = (liabilityCredits._sum.amountMinor ?? 0) - (liabilityDebits._sum.amountMinor ?? 0);
  if (!isGraphqlInt(bankControlBalanceMinor) || !isGraphqlInt(clientLedgerBalanceMinor)) {
    throw new Error("Trust reconciliation balances exceed the supported database integer range.");
  }
  return { bankControlBalanceMinor, clientLedgerBalanceMinor };
}
async function setTrustAccountBankIdentity(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const institution = String(args.financialInstitutionName).trim();
  const lastFour = String(args.bankAccountLastFour).trim();
  const externalReference = String(args.externalAccountReference ?? "").trim();
  const accountTypes = /* @__PURE__ */ new Set(["trust", "pooled_trust", "dedicated_client", "other"]);
  if (!accountTypes.has(args.accountType)) throw new Error("Unsupported trust account classification.");
  const reason = boundedReason(args.reason, "Trust bank-identity reason", 5, 2e3);
  if (!institution || institution.length > 300) throw new Error("Financial institution is required and must be 300 characters or fewer.");
  if (!/^\d{4}$/.test(lastFour)) throw new Error("Bank-account identity requires exactly the final four digits.");
  if (externalReference.length > 500) throw new Error("External account reference must be 500 characters or fewer.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`;
    const office = args.officeId ? await tx.office.findFirst({ where: { id: args.officeId, firmId }, select: { id: true } }) : null;
    if (args.officeId && !office) throw new Error("Trust account office was not found in the active firm.");
    const account2 = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId },
      select: {
        id: true,
        status: true,
        transactions: { select: { id: true }, take: 1 },
        reconciliations: { select: { id: true }, take: 1 }
      }
    });
    if (!account2) throw new Error("Trust account is unavailable in the active firm.");
    if (account2.status !== "pending" || account2.transactions.length || account2.reconciliations.length) {
      throw new Error("Bank identity can be set only while the trust account is pending and has no posting or reconciliation evidence.");
    }
    const updated = await tx.trustAccount.update({
      where: { id: account2.id },
      data: {
        financialInstitutionName: institution,
        bankAccountLastFour: lastFour,
        accountType: args.accountType,
        officeId: office?.id ?? null,
        externalAccountReference: externalReference
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.bank_identity_set",
      category: "financial",
      metadata: {
        trustAccountId: account2.id,
        institutionDigest: sha256Digest(institution),
        bankAccountLastFour: lastFour,
        accountType: args.accountType,
        officeId: office?.id ?? null,
        externalReferenceDigest: externalReference ? sha256Digest(externalReference) : null,
        reasonDigest: sha256Digest(reason)
      }
    });
    return updated;
  });
}
async function transitionTrustAccount(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const reason = boundedReason(args.reason, "Trust account transition reason", 5, 2e3);
  if (!["active", "frozen", "closed"].includes(args.toStatus)) throw new Error("Unsupported trust account status.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`;
    const account2 = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId },
      select: {
        id: true,
        status: true,
        financialInstitutionName: true,
        bankAccountLastFour: true,
        openedAt: true,
        ledgerAccounts: { where: { status: { not: "closed" } }, select: { id: true }, take: 1 }
      }
    });
    if (!account2) throw new Error("Trust account is unavailable in the active firm.");
    if (account2.status === args.toStatus) throw new Error("Trust account is already in the requested status.");
    assertLifecycleTransition("trustAccount", account2.status, args.toStatus);
    if (args.toStatus === "active" && (!account2.financialInstitutionName || !account2.bankAccountLastFour)) {
      throw new Error("Activation requires the financial institution and bank-account last four digits.");
    }
    if (args.toStatus === "closed" && account2.ledgerAccounts.length) {
      throw new Error("Close every client trust ledger before closing the trust account.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.trustAccount.update({
      where: { id: account2.id },
      data: {
        status: args.toStatus,
        openedAt: args.toStatus === "active" && !account2.openedAt ? now : void 0,
        closedAt: args.toStatus === "closed" ? now : null
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.account_status_changed",
      category: "financial",
      metadata: { trustAccountId: account2.id, fromStatus: account2.status, toStatus: updated.status, reasonDigest: sha256Digest(reason) }
    });
    return updated;
  });
}
async function transitionTrustLedgerAccount(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const reason = boundedReason(args.reason, "Trust ledger transition reason", 5, 2e3);
  if (!["active", "frozen", "closed"].includes(args.toStatus)) throw new Error("Unsupported trust ledger status.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    const ledger = await tx.trustLedgerAccount.findFirst({
      where: { id: args.ledgerAccountId, firmId },
      select: { id: true, status: true, trustAccountId: true, matterId: true }
    });
    if (!ledger) throw new Error("Trust ledger is unavailable in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${ledger.trustAccountId}`}))`;
    if (ledger.matterId) await assertMatterAccess(tx, firmId, ledger.matterId, userId);
    const current = await tx.trustLedgerAccount.findUnique({ where: { id: ledger.id }, select: { status: true } });
    if (!current || current.status !== ledger.status) throw new Error("Trust ledger changed concurrently; reload before retrying.");
    if (ledger.status === args.toStatus) throw new Error("Trust ledger is already in the requested status.");
    assertLifecycleTransition("trustLedgerAccount", ledger.status, args.toStatus);
    if (args.toStatus === "closed") {
      const [credits, debits] = await Promise.all([
        tx.trustLedgerEntry.aggregate({
          where: { ledgerAccountId: ledger.id, accountingBucket: "client_liability", direction: "credit" },
          _sum: { amountMinor: true }
        }),
        tx.trustLedgerEntry.aggregate({
          where: { ledgerAccountId: ledger.id, accountingBucket: "client_liability", direction: "debit" },
          _sum: { amountMinor: true }
        })
      ]);
      if ((credits._sum.amountMinor ?? 0) !== (debits._sum.amountMinor ?? 0)) {
        throw new Error("A client trust ledger must have a zero balance before closing.");
      }
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.trustLedgerAccount.update({
      where: { id: ledger.id },
      data: {
        status: args.toStatus,
        freezeReason: args.toStatus === "frozen" ? reason : "",
        closedAt: args.toStatus === "closed" ? now : null
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.ledger_status_changed",
      category: "financial",
      metadata: {
        ledgerAccountId: ledger.id,
        trustAccountId: ledger.trustAccountId,
        fromStatus: ledger.status,
        toStatus: updated.status,
        reasonDigest: sha256Digest(reason)
      }
    });
    return updated;
  });
}
async function prepareTrustReconciliation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const periodStart = new Date(args.periodStart);
  const periodEnd = new Date(args.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
    throw new Error("Reconciliation requires a valid period with an end after its start.");
  }
  if (!isGraphqlInt(args.statementBalanceMinor) || !isGraphqlInt(args.bookBalanceMinor)) {
    throw new Error("Reconciliation balances must be supported database integer minor-unit amounts.");
  }
  const currencyCode = String(args.currencyCode).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Reconciliation currency must be a three-letter code.");
  const notes = String(args.notes ?? "").trim();
  if (notes.length > 4e3) throw new Error("Reconciliation notes must be 4000 characters or fewer.");
  const differenceMinor = args.statementBalanceMinor - args.bookBalanceMinor;
  if (!isGraphqlInt(differenceMinor)) throw new Error("Reconciliation difference exceeds the supported database integer range.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${args.trustAccountId}`}))`;
    const account2 = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId, status: "active" },
      select: { id: true, currencyCode: true }
    });
    if (!account2) throw new Error("Only an active trust account can be reconciled.");
    if (account2.currencyCode !== currencyCode) throw new Error("Reconciliation currency must match the trust account.");
    const balances = await trustBalancesAsOf(tx, account2.id, periodEnd);
    assertThreeWayTrustBalance(args.bookBalanceMinor, balances);
    const reconciliation = await tx.trustReconciliation.create({
      data: {
        firmId,
        trustAccountId: account2.id,
        status: "draft",
        periodStart,
        periodEnd,
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        differenceMinor,
        currencyCode,
        createdById: userId,
        notes
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.reconciliation_created",
      category: "financial",
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: account2.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        clientLedgerBalanceMinor: balances.clientLedgerBalanceMinor,
        differenceMinor
      }
    });
    return reconciliation;
  });
}
async function transitionTrustReconciliation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const reason = boundedReason(args.reason, "Reconciliation transition reason", 5, 2e3);
  if (!["draft", "in_review", "completed", "reopened"].includes(args.toStatus)) {
    throw new Error("Unsupported reconciliation status.");
  }
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    const reference = await tx.trustReconciliation.findFirst({
      where: { id: args.reconciliationId, firmId },
      select: { id: true, trustAccountId: true }
    });
    if (!reference) throw new Error("Trust reconciliation is unavailable in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${reference.trustAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${reference.trustAccountId}`}))`;
    const reconciliation = await tx.trustReconciliation.findFirst({
      where: { id: reference.id, firmId },
      select: {
        id: true,
        status: true,
        trustAccountId: true,
        differenceMinor: true,
        bookBalanceMinor: true,
        periodStart: true,
        periodEnd: true,
        createdById: true,
        trustAccount: { select: { status: true } }
      }
    });
    if (!reconciliation) throw new Error("Trust reconciliation changed concurrently; reload before retrying.");
    if (reconciliation.status === args.toStatus) throw new Error("Reconciliation is already in the requested status.");
    assertLifecycleTransition("trustReconciliation", reconciliation.status, args.toStatus);
    if (args.toStatus === "in_review" && reconciliation.trustAccount.status !== "active") {
      throw new Error("Only an active trust account can enter reconciliation review.");
    }
    if (args.toStatus === "completed") {
      if (reconciliation.differenceMinor !== 0) throw new Error("A reconciliation with a non-zero difference cannot be completed.");
      const balances = await trustBalancesAsOf(tx, reconciliation.trustAccountId, reconciliation.periodEnd);
      assertThreeWayTrustBalance(reconciliation.bookBalanceMinor, balances);
      if (!reconciliation.createdById || reconciliation.createdById === userId) {
        throw new Error("A reconciliation with identified preparation evidence requires an independent reviewer.");
      }
      if (reconciliation.periodEnd <= reconciliation.periodStart) throw new Error("Reconciliation period dates are invalid.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.trustReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: args.toStatus,
        reviewedById: args.toStatus === "completed" ? userId : void 0,
        reviewedAt: args.toStatus === "completed" ? now : void 0,
        completedAt: args.toStatus === "completed" ? now : args.toStatus === "reopened" ? null : void 0
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.reconciliation_status_changed",
      category: "financial",
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: reconciliation.trustAccountId,
        fromStatus: reconciliation.status,
        toStatus: updated.status,
        differenceMinor: reconciliation.differenceMinor,
        clientLedgerBalanceMinor: args.toStatus === "completed" ? reconciliation.bookBalanceMinor : null,
        reasonDigest: sha256Digest(reason)
      }
    });
    return updated;
  });
}
async function reviseTrustReconciliation(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageTrust", { humanOnly: true });
  const reason = boundedReason(args.reason, "Reconciliation revision reason", 5, 2e3);
  const expectedUpdatedAt = new Date(args.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error("The reconciliation version you reviewed is required.");
  if (!isGraphqlInt(args.statementBalanceMinor) || !isGraphqlInt(args.bookBalanceMinor)) {
    throw new Error("Reconciliation balances must be supported database integer minor-unit amounts.");
  }
  const differenceMinor = args.statementBalanceMinor - args.bookBalanceMinor;
  if (!isGraphqlInt(differenceMinor)) throw new Error("Reconciliation difference exceeds the supported database integer range.");
  const notes = args.notes == null ? null : String(args.notes).trim();
  if (notes && notes.length > 4e3) throw new Error("Reconciliation notes must be 4000 characters or fewer.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    const reference = await tx.trustReconciliation.findFirst({
      where: { id: args.reconciliationId, firmId },
      select: { id: true, trustAccountId: true }
    });
    if (!reference) throw new Error("Trust reconciliation is unavailable in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${reference.trustAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${reference.trustAccountId}`}))`;
    const reconciliation = await tx.trustReconciliation.findFirst({
      where: { id: reference.id, firmId },
      select: {
        id: true,
        status: true,
        trustAccountId: true,
        periodEnd: true,
        statementBalanceMinor: true,
        bookBalanceMinor: true,
        differenceMinor: true,
        createdById: true,
        updatedAt: true,
        trustAccount: { select: { status: true } }
      }
    });
    if (!reconciliation) throw new Error("Trust reconciliation changed concurrently; reload before retrying.");
    if (!["draft", "reopened"].includes(reconciliation.status)) {
      throw new Error("Only a draft or reopened reconciliation can be revised; reopen a completed period through review first.");
    }
    if (reconciliation.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new Error("This reconciliation changed after you reviewed it; reload before revising.");
    }
    if (reconciliation.trustAccount.status !== "active") throw new Error("Only an active trust account can be reconciled.");
    const balances = await trustBalancesAsOf(tx, reconciliation.trustAccountId, reconciliation.periodEnd);
    assertThreeWayTrustBalance(args.bookBalanceMinor, balances);
    const updated = await tx.trustReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        differenceMinor,
        ...notes == null ? {} : { notes },
        createdById: userId,
        reviewedById: null,
        reviewedAt: null,
        completedAt: null
      },
      select: { id: true, status: true }
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: "user",
      eventType: "trust.reconciliation_revised",
      category: "financial",
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: reconciliation.trustAccountId,
        status: reconciliation.status,
        previousPreparerId: reconciliation.createdById,
        previous: {
          statementBalanceMinor: reconciliation.statementBalanceMinor,
          bookBalanceMinor: reconciliation.bookBalanceMinor,
          differenceMinor: reconciliation.differenceMinor
        },
        next: {
          statementBalanceMinor: args.statementBalanceMinor,
          bookBalanceMinor: args.bookBalanceMinor,
          differenceMinor
        },
        clientLedgerBalanceMinor: balances.clientLedgerBalanceMinor,
        reasonDigest: sha256Digest(reason)
      }
    });
    return updated;
  });
}

// features/platform/lib/money.ts
function currencyFractionDigits(currencyCode) {
  const currency2 = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency2)) return null;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency2 }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return null;
  }
}
function formatMinorUnits(amountMinor, currencyCode, locale = "en") {
  const currency2 = currencyCode.trim().toUpperCase();
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: currency2 });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** fractionDigits);
}
function formatMoneyLabel(amountMinor, currencyCode, missing = "Amount unavailable") {
  if (amountMinor === null || amountMinor === void 0 || amountMinor === "") return missing;
  const minor = Number(amountMinor);
  if (!Number.isSafeInteger(minor)) return missing;
  const currency2 = String(currencyCode ?? "").trim().toUpperCase();
  if (currencyFractionDigits(currency2) === null) {
    return `${minor.toLocaleString("en")} minor units${currency2 ? ` (${currency2})` : ""}`;
  }
  return formatMinorUnits(minor, currency2);
}

// features/keystone/mutations/practiceOverview.ts
function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
}
function displayName(contact) {
  return String(contact?.displayName ?? "No contact name");
}
async function intakeOverview(context) {
  if (!permissions.canReadIntake({ session: context.session })) {
    return { metrics: [], queue: [] };
  }
  const [activeCount, records] = await Promise.all([
    context.query.Intake.count({
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } }
    }),
    context.query.Intake.findMany({
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } },
      orderBy: { receivedAt: "desc" },
      take: 6,
      query: "id intakeNumber title status receivedAt primaryContact { id displayName } assignedTo { id name }"
    })
  ]);
  return {
    metrics: [{ key: "active-intakes", label: "Active intakes", value: activeCount, href: "/dashboard/platform/intake" }],
    queue: records.map((record) => ({
      id: record.id,
      kind: "Intake",
      title: record.title,
      subtitle: `${record.intakeNumber} \xB7 ${displayName(record.primaryContact)}`,
      status: record.status,
      at: iso(record.receivedAt),
      href: `/dashboard/platform/intake#pipeline-${record.id}`,
      canAct: permissions.canManageIntake({ session: context.session })
    }))
  };
}
async function matterOverview(context) {
  if (!permissions.canReadMatters({ session: context.session })) {
    return { metrics: [], queue: [] };
  }
  const [openCount, records] = await Promise.all([
    context.query.Matter.count({
      where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } }
    }),
    context.query.Matter.findMany({
      where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      query: "id matterNumber title status confidentiality updatedAt client { id displayName } responsibleAttorney { id name }"
    })
  ]);
  return {
    metrics: [{ key: "open-matters", label: "Open matters", value: openCount, href: "/dashboard/platform/matters" }],
    queue: records.map((record) => ({
      id: record.id,
      kind: record.confidentiality === "restricted" ? "Restricted matter" : "Matter",
      title: record.title,
      subtitle: `${record.matterNumber} \xB7 ${displayName(record.client)}`,
      status: record.status,
      at: iso(record.updatedAt),
      href: `/dashboard/platform/matters#active-${record.id}`,
      canAct: permissions.canManageMatters({ session: context.session })
    }))
  };
}
function compareQueueItems(left, right) {
  const leftTime = left.at ? left.at.getTime() : Number.NaN;
  const rightTime = right.at ? right.at.getTime() : Number.NaN;
  const leftDated = !Number.isNaN(leftTime);
  const rightDated = !Number.isNaN(rightTime);
  if (leftDated !== rightDated) return leftDated ? -1 : 1;
  if (leftDated && leftTime !== rightTime) return leftTime - rightTime;
  return left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}
async function workOverview(context) {
  const canReadCalendar2 = permissions.canReadCalendar({ session: context.session });
  const canReadTasks2 = permissions.canReadTasks({ session: context.session });
  const [deadlineCount, deadlines, taskCount, tasks] = await Promise.all([
    canReadCalendar2 ? context.query.Deadline.count({ where: { status: { in: ["draft", "pending"] } } }) : 0,
    canReadCalendar2 ? context.query.Deadline.findMany({
      where: { status: { in: ["draft", "pending"] } },
      orderBy: { dueAt: "asc" },
      take: 5,
      query: "id title status dueAt isVerified matter { id matterNumber title } assignedTo { id name }"
    }) : [],
    canReadTasks2 ? context.query.LegalTask.count({ where: { status: { in: ["open", "in_progress", "blocked"] } } }) : 0,
    canReadTasks2 ? context.query.LegalTask.findMany({
      where: { status: { in: ["open", "in_progress", "blocked"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 5,
      query: "id title status priority dueAt matter { id matterNumber title } assignedTo { id name }"
    }) : []
  ]);
  const queue = [
    ...deadlines.map((record) => ({
      id: record.id,
      kind: record.isVerified ? "Verified deadline" : "Unverified deadline",
      title: record.title,
      subtitle: record.matter?.matterNumber ?? "Matter unavailable",
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/work#deadlines-${record.id}`,
      canAct: permissions.canManageCalendar({ session: context.session })
    })),
    ...tasks.map((record) => ({
      id: record.id,
      kind: "Task",
      title: record.title,
      subtitle: record.matter?.matterNumber ?? "Matter unavailable",
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/work#tasks-${record.id}`,
      canAct: permissions.canManageTasks({ session: context.session })
    }))
  ].sort(compareQueueItems).slice(0, 8);
  return {
    metrics: [
      ...canReadCalendar2 ? [{ key: "open-deadlines", label: "Open deadlines", value: deadlineCount, href: "/dashboard/platform/work" }] : [],
      ...canReadTasks2 ? [{ key: "open-tasks", label: "Open tasks", value: taskCount, href: "/dashboard/platform/work" }] : []
    ],
    queue
  };
}
async function billingOverview(context) {
  const canReadBilling2 = permissions.canReadBilling({ session: context.session }) || permissions.canManageBilling({ session: context.session });
  if (!canReadBilling2) {
    return { metrics: [], queue: [] };
  }
  const [unbilledTime, outstandingInvoices, invoices] = await Promise.all([
    context.query.TimeEntry.count({
      where: { isBillable: { equals: true }, status: { in: ["draft", "submitted", "approved"] } }
    }),
    context.query.Invoice.count({
      where: { status: { in: ["issued", "partially_paid", "overdue"] } }
    }),
    context.query.Invoice.findMany({
      where: { status: { in: ["draft", "approved", "issued", "partially_paid", "overdue"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 6,
      query: "id invoiceNumber status totalMinor balanceDueMinor currencyCode dueAt client { id displayName } matter { id matterNumber title }"
    })
  ]);
  return {
    metrics: [
      { key: "unbilled-time", label: "Unbilled entries", value: unbilledTime, href: "/dashboard/platform/time-expenses" },
      { key: "outstanding-invoices", label: "Outstanding bills", value: outstandingInvoices, href: "/dashboard/platform/billing" }
    ],
    queue: invoices.map((record) => ({
      id: record.id,
      kind: "Invoice",
      title: `${record.invoiceNumber} \xB7 ${displayName(record.client)}`,
      subtitle: `${formatMoneyLabel(record.balanceDueMinor, record.currencyCode)} due`,
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/billing#invoices-${record.id}`,
      canAct: permissions.canManageBilling({ session: context.session })
    }))
  };
}
async function governanceOverview(context) {
  if (!permissions.canReadRetention({ session: context.session }) && !permissions.canManageRetention({ session: context.session })) {
    return { metrics: [], queue: [] };
  }
  const [holdCount, holds] = await Promise.all([
    context.query.RetentionHold.count({ where: { status: { equals: "active" } } }),
    context.query.RetentionHold.findMany({
      where: { status: { equals: "active" } },
      orderBy: { effectiveAt: "desc" },
      take: 5,
      query: "id name status effectiveAt matter { id matterNumber title } document { id title }"
    })
  ]);
  return {
    metrics: [{ key: "active-holds", label: "Active holds", value: holdCount, href: "/dashboard/platform/governance" }],
    queue: holds.map((record) => ({
      id: record.id,
      kind: "Legal hold",
      title: record.name,
      subtitle: record.matter?.matterNumber ?? record.document?.title ?? "Firm-level hold",
      status: record.status,
      at: iso(record.effectiveAt),
      href: `/dashboard/platform/governance#holds-${record.id}`,
      canAct: permissions.canManageRetention({ session: context.session })
    }))
  };
}
async function practiceOverview(_root, _args, context) {
  const firmId = activeFirmId(context.session);
  if (!firmId || !permissions.canAccessDashboard({ session: context.session })) {
    throw new Error("An active firm dashboard session is required.");
  }
  const [intake, matters, work, billing, governance] = await Promise.all([
    intakeOverview(context),
    matterOverview(context),
    workOverview(context),
    billingOverview(context),
    governanceOverview(context)
  ]);
  return {
    firmId,
    firmName: String(context.session?.data?.activeFirm?.name ?? "Active firm"),
    generatedAt: /* @__PURE__ */ new Date(),
    metrics: [...intake.metrics, ...matters.metrics, ...work.metrics, ...billing.metrics, ...governance.metrics],
    intakeQueue: intake.queue,
    matterQueue: matters.queue,
    workQueue: work.queue,
    billingQueue: billing.queue,
    governanceQueue: governance.queue
  };
}

// features/platform/lib/datetime.ts
function validTimeZone(timeZone) {
  const zone = typeof timeZone === "string" ? timeZone.trim() : "";
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}
function parseInstant(value) {
  if (value === null || value === void 0 || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatInstant(value, timeZone, { includeTime = true, missing = "Not recorded" } = {}) {
  const date = parseInstant(value);
  if (!date) return missing;
  const zone = validTimeZone(timeZone) ?? "UTC";
  return new Intl.DateTimeFormat("en", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}
  }).format(date);
}

// features/shared/dispatch-outcome.ts
function communicationDispatchState(status, errorCode) {
  if (errorCode === "smtp_outcome_unknown") return { status: "unknown", guidance: "Unknown \u2014 do not resend until reconciled." };
  if (errorCode === "smtp_not_dispatched") return { status: "not_dispatched", guidance: "Not dispatched. Review the original intent and authority; no automatic retry." };
  if (errorCode === "smtp_send_admitted") return { status: "in_flight", guidance: "Admitted; acceptance is not yet confirmed. Do not resend." };
  if (status === "sent") return { status: "relay_accepted", guidance: "Accepted by the relay; final delivery is not confirmed." };
  return { status, guidance: status === "pending" ? "Queued; no final delivery outcome." : "" };
}
function webhookDispatchState(status, lastError) {
  if (lastError?.startsWith("outcome_unknown:")) return { status: "unknown", guidance: "Unknown \u2014 do not resend until reconciled." };
  if (lastError?.startsWith("not_dispatched:")) return { status: "not_dispatched", guidance: "Not dispatched. Review the original intent and authority before any new admission." };
  if (lastError === "admitted:awaiting_observation") return { status: "in_flight", guidance: "Admitted; remote outcome is not confirmed. Do not resend." };
  if (lastError === "claimed:not_admitted") return { status: "claimed", guidance: "Claimed, but not admitted for transport." };
  return { status, guidance: "" };
}

// features/keystone/mutations/practiceWorkspace.ts
var CATEGORIES = /* @__PURE__ */ new Set([
  "intake",
  "matters",
  "contacts",
  "work",
  "documents",
  "communications",
  "time-expenses",
  "billing",
  "accounting",
  "portal",
  "governance",
  "reports",
  "data",
  "integrations"
]);
var iso2 = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
};
var money = (minor, currency2) => formatMoneyLabel(minor, currency2);
var matterLabel = (record) => record.matter?.matterNumber ?? "Firm-level";
var practiceWorkspaceSources = {
  intake: [
    {
      key: "pipeline",
      title: "Intake pipeline",
      description: "Prospects requiring screening, consultation, or an engagement decision.",
      model: "Intake",
      permissions: ["canReadIntake"],
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } },
      orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
      query: "id intakeNumber title status receivedAt primaryContact { displayName }",
      kind: "Intake",
      map: (record) => ({ id: record.id, title: record.title || record.intakeNumber, subtitle: [record.primaryContact?.displayName ?? "Client unavailable", record.intakeNumber].join(" \xB7 "), status: record.status, at: iso2(record.receivedAt) })
    },
    {
      key: "conflicts",
      title: "Conflict review status",
      description: "Conflict checks awaiting review, oldest first. Review each check in the conflict review panel.",
      model: "ConflictCheck",
      permissions: ["canReadIntake", "canRunConflictChecks", "canResolveConflicts"],
      where: { status: { in: ["requested", "running", "review_required"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      query: "status createdAt intake { intakeNumber title primaryContact { displayName } } matter { matterNumber title }",
      kind: "Conflict check",
      previewOnly: true,
      map: (record) => ({
        id: "conflict-preview",
        title: record.intake?.title ?? (record.matter ? `${record.matter.matterNumber} \xB7 ${record.matter.title}` : "Conflict check"),
        subtitle: record.intake ? [record.intake.primaryContact?.displayName ?? "Client unavailable", record.intake.intakeNumber].join(" \xB7 ") : record.matter ? "Matter conflict check" : "Awaiting conflict review",
        status: record.status,
        at: iso2(record.createdAt)
      })
    }
  ],
  matters: [
    {
      key: "active",
      title: "Active matter register",
      description: "Authorized matters that are proposed, open, held, or closing.",
      model: "Matter",
      permissions: ["canReadMatters"],
      where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } },
      orderBy: { updatedAt: "desc" },
      query: "id matterNumber title status confidentiality updatedAt client { displayName } responsibleAttorney { name }",
      kind: "Matter",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${record.matterNumber} \xB7 ${record.client?.displayName ?? "No client"}${record.confidentiality === "restricted" ? " \xB7 restricted" : ""}`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "walls",
      title: "Access decisions",
      description: "Ethical walls requiring approval or currently restricting matter access.",
      model: "EthicalWall",
      permissions: ["canReadMatters"],
      where: { status: { in: ["draft", "active"] } },
      orderBy: { updatedAt: "desc" },
      query: "id name status effectiveAt matter { matterNumber title } membersCount",
      kind: "Ethical wall",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.matter?.matterNumber ?? "Matter"} \xB7 ${record.membersCount ?? 0} decisions`, status: record.status, at: iso2(record.effectiveAt) })
    }
  ],
  contacts: [
    {
      key: "directory",
      title: "People and organizations",
      description: "Firm-owned identities with relationship context for intake and matters.",
      model: "Contact",
      permissions: ["canReadPeople"],
      where: { status: { not: { equals: "archived" } } },
      orderBy: { updatedAt: "desc" },
      query: "id displayName contactType status primaryEmail updatedAt",
      kind: "Contact",
      map: (record) => ({ id: record.id, title: record.displayName, subtitle: `${record.contactType} \xB7 ${record.primaryEmail || "No primary email"}`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "relationships",
      title: "Matter relationships",
      description: "Matter-specific roles and sides; contact identity is never flattened into one global role.",
      model: "MatterParty",
      permissions: ["canReadMatters"],
      where: { status: { equals: "active" } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id partyRole side status updatedAt",
      kind: "Matter party",
      map: (record) => ({ id: record.id, title: `${String(record.partyRole).replaceAll("_", " ")} relationship`, subtitle: `${String(record.side).replaceAll("_", " ")} side`, status: record.status, at: iso2(record.updatedAt) })
    }
  ],
  work: [
    {
      key: "consultations",
      title: "Consultation calendar",
      description: "Requested and scheduled prospective-client meetings visible to the current intake role.",
      model: "Consultation",
      permissions: ["canReadIntake"],
      where: { status: { in: ["requested", "scheduled"] } },
      orderBy: { startsAt: "asc" },
      query: "id status startsAt endsAt timezone location intake { intakeNumber title } host { name }",
      kind: "Consultation",
      map: (record) => ({ id: record.id, title: record.intake?.title ?? "Prospective-client consultation", subtitle: `${formatInstant(record.startsAt, record.timezone)} \xB7 ${record.intake?.intakeNumber ?? "Intake"} \xB7 ${record.host?.name ?? "unassigned host"}${record.location ? ` \xB7 ${record.location}` : ""}`, status: record.status, at: iso2(record.startsAt) })
    },
    {
      key: "docket",
      title: "Docket activity",
      description: "Recent filings, hearings, orders, and notices with source verification state.",
      model: "DocketEntry",
      permissions: ["canReadCalendar", "canReadMatters"],
      where: { status: { in: ["draft", "filed", "entered"] } },
      orderBy: { occurredAt: "desc" },
      query: "id title entryType status occurredAt isVerified matter { matterNumber } docket { docketNumber }",
      kind: "Docket entry",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} \xB7 ${record.docket?.docketNumber ?? "docket"} \xB7 ${record.isVerified ? "verified" : "unverified"}`, status: record.status, at: iso2(record.occurredAt) })
    },
    {
      key: "deadlines",
      title: "Deadline review",
      description: "Upcoming obligations with source and verification state visible before action.",
      model: "Deadline",
      permissions: ["canReadCalendar", "canReadMatters"],
      where: { status: { in: ["draft", "pending"] } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      query: "id title status dueAt timezone isVerified source matter { matterNumber } assignedTo { name }",
      kind: "Deadline",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `Due ${formatInstant(record.dueAt, record.timezone)} \xB7 ${matterLabel(record)} \xB7 ${record.isVerified ? "verified" : "requires verification"} \xB7 ${record.assignedTo?.name ?? "unassigned"}`, status: record.status, at: iso2(record.dueAt) })
    },
    {
      key: "tasks",
      title: "Assigned work",
      description: "Open, in-progress, and blocked work ordered by due date.",
      model: "LegalTask",
      permissions: ["canReadTasks", "canReadMatters"],
      where: { status: { in: ["open", "in_progress", "blocked"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      query: "id title status priority dueAt blockedReason matter { matterNumber } assignedTo { name }",
      kind: "Task",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} \xB7 ${record.priority} \xB7 ${record.assignedTo?.name ?? "unassigned"}`, status: record.status, at: iso2(record.dueAt) })
    }
  ],
  documents: [
    {
      key: "documents",
      title: "Document work",
      description: "Logical documents with immutable version history and current publication state.",
      model: "Document",
      permissions: ["canReadDocuments", "canManageDocuments"],
      where: { status: { in: ["draft", "active", "archived"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id title status category updatedAt",
      kind: "Document",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${record.category} \xB7 document metadata`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "signatures",
      title: "Signature handoffs",
      description: "Open signature requests; each opens to its exact document version and signers.",
      model: "SignatureRequest",
      permissions: ["canReadDocuments", "canManageDocuments"],
      where: { status: { in: ["draft", "sent", "partially_signed"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id title status updatedAt",
      kind: "Signature request",
      map: (record) => ({ id: record.id, title: record.title || "Signature request", subtitle: "Signature request \xB7 open for document version and signers", status: record.status, at: iso2(record.updatedAt) })
    }
  ],
  communications: [
    {
      key: "drafts",
      title: "Drafts ready for review",
      description: "Outbound drafts that can be queued only after recipients and controlled deliveries exist.",
      model: "CommunicationMessage",
      permissions: ["canReadCommunications", "canManageCommunications"],
      where: { status: { equals: "draft" } },
      orderBy: { updatedAt: "desc" },
      query: "id subject direction channel status updatedAt matter { matterNumber } thread { subject } deliveriesCount",
      kind: "Message",
      map: (record) => ({ id: record.id, title: record.subject || record.thread?.subject || "Untitled draft", subtitle: `${matterLabel(record)} \xB7 ${record.channel} \xB7 ${record.deliveriesCount ?? 0} controlled deliveries`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "threads",
      title: "Conversation queue",
      description: "Open matter and intake threads, ordered by recent activity.",
      model: "CommunicationThread",
      permissions: ["canReadCommunications", "canReadMatters"],
      where: { status: { equals: "open" } },
      orderBy: { lastMessageAt: "desc" },
      query: "id subject status primaryChannel lastMessageAt matter { matterNumber } intake { intakeNumber } messagesCount",
      kind: "Thread",
      map: (record) => ({ id: record.id, title: record.subject, subtitle: `${record.matter?.matterNumber ?? record.intake?.intakeNumber ?? "Firm-level"} \xB7 ${record.primaryChannel} \xB7 ${record.messagesCount ?? 0} messages`, status: record.status, at: iso2(record.lastMessageAt) })
    },
    {
      key: "delivery",
      title: "Delivery follow-up",
      description: "Failed, bounced, and pending provider handoffs requiring operator attention.",
      model: "CommunicationDelivery",
      permissions: ["canReadCommunications"],
      where: { status: { in: ["pending", "failed", "bounced"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id status channel errorCode attemptCount lastAttemptAt message { subject }",
      kind: "Delivery",
      map: (record) => ({ id: record.id, title: record.message?.subject ? `Delivery \xB7 ${record.message.subject}` : "Message delivery", subtitle: `${record.channel} \xB7 ${record.attemptCount ?? 0} attempts \xB7 ${communicationDispatchState(record.status, record.errorCode).guidance}`, status: communicationDispatchState(record.status, record.errorCode).status, at: iso2(record.lastAttemptAt) })
    }
  ],
  "time-expenses": [
    {
      key: "time",
      title: "Time review",
      description: "Draft, submitted, and approved unbilled work with matter scope preserved.",
      model: "TimeEntry",
      permissions: ["canReadBilling", "canManageBilling"],
      where: { status: { in: ["draft", "submitted", "approved"] } },
      orderBy: { workDate: "desc" },
      query: "id description status workDate durationMinutes amountMinor currencyCode isBillable matter { matterNumber } user { name }",
      kind: "Time entry",
      map: (record) => ({ id: record.id, title: record.description, subtitle: `${matterLabel(record)} \xB7 ${record.durationMinutes} min \xB7 ${record.isBillable ? formatMoneyLabel(record.amountMinor, record.currencyCode, "billable \xB7 unpriced") : "non-billable"}`, status: record.status, at: iso2(record.workDate) })
    },
    {
      key: "expenses",
      title: "Expense review",
      description: "Submitted costs and disbursements awaiting approval or billing.",
      model: "Expense",
      permissions: ["canReadBilling", "canManageBilling"],
      where: { status: { in: ["draft", "submitted", "approved"] } },
      orderBy: { incurredAt: "desc" },
      query: "id description status incurredAt amountMinor currencyCode isBillable matter { matterNumber } vendor { displayName }",
      kind: "Expense",
      map: (record) => ({ id: record.id, title: record.description, subtitle: `${matterLabel(record)} \xB7 ${money(record.amountMinor, record.currencyCode)} \xB7 ${record.vendor?.displayName ?? "No vendor"}`, status: record.status, at: iso2(record.incurredAt) })
    }
  ],
  billing: [
    {
      key: "invoices",
      title: "Billing and collections",
      description: "Draft bills, issued balances, and overdue receivables.",
      model: "Invoice",
      permissions: ["canReadBilling", "canManageBilling"],
      where: { status: { in: ["draft", "approved", "issued", "partially_paid", "overdue"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      query: "id invoiceNumber status totalMinor paidMinor balanceDueMinor currencyCode dueAt client { displayName } matter { matterNumber } linesCount",
      kind: "Invoice",
      map: (record) => ({ id: record.id, title: `${record.invoiceNumber} \xB7 ${record.client?.displayName ?? "Client"}`, subtitle: `${matterLabel(record)} \xB7 ${money(record.balanceDueMinor, record.currencyCode)} due \xB7 ${record.linesCount ?? 0} lines`, status: record.status, at: iso2(record.dueAt) })
    },
    {
      key: "payments",
      title: "Payments and refunds",
      description: "Receipts and provider state that still require capture, settlement, allocation, or review.",
      model: "Payment",
      permissions: ["canReadPayments", "canManagePayments", "canReadBilling"],
      where: { status: { in: ["pending", "authorized", "captured"] } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      query: "id paymentNumber status createdAt",
      kind: "Payment",
      map: (record) => ({ id: record.id, title: record.paymentNumber, subtitle: "Payment awaiting capture, settlement or allocation", status: record.status, at: iso2(record.createdAt) })
    }
  ],
  accounting: [
    {
      key: "accounts",
      title: "Trust account control",
      description: "Trust accounts and operating state; balances are derived from append-only entries.",
      model: "TrustAccount",
      permissions: ["canReadTrust", "canManageTrust"],
      orderBy: { updatedAt: "desc" },
      query: "id name accountType status currencyCode bankAccountLastFour updatedAt ledgerAccountsCount reconciliationsCount",
      kind: "Trust account",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.accountType} \xB7 ${record.currencyCode} \xB7 \u2022\u2022\u2022\u2022${record.bankAccountLastFour || "----"}`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "ledgers",
      title: "Client and matter ledgers",
      description: "Active subledgers available for exact client-liability postings.",
      model: "TrustLedgerAccount",
      permissions: ["canReadTrust", "canManageTrust"],
      where: { status: { in: ["active", "frozen"] } },
      orderBy: { updatedAt: "desc" },
      query: "id ledgerNumber status currencyCode updatedAt trustAccount { id name } client { displayName } matter { matterNumber }",
      kind: "Client ledger",
      map: (record) => ({ id: record.id, title: `${record.ledgerNumber} \xB7 ${record.client?.displayName ?? "Client"}`, subtitle: `${record.trustAccount?.name ?? "Trust account"} \xB7 ${record.currencyCode} \xB7 ${record.matter?.matterNumber ?? "client-level"}`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "reconciliation",
      title: "Reconciliation queue",
      description: "Open periods and differences requiring independent review.",
      model: "TrustReconciliation",
      permissions: ["canReadTrust", "canManageTrust"],
      where: { status: { in: ["draft", "in_review", "reopened"] } },
      orderBy: { periodEnd: "asc" },
      query: "id status periodStart periodEnd differenceMinor currencyCode trustAccount { name } reviewedBy { name }",
      kind: "Reconciliation",
      map: (record) => ({ id: record.id, title: record.trustAccount?.name ?? "Trust reconciliation", subtitle: `${money(record.differenceMinor, record.currencyCode)} difference \xB7 ${record.reviewedBy?.name ?? "unreviewed"}`, status: record.status, at: iso2(record.periodEnd) })
    }
  ],
  portal: [
    {
      key: "accounts",
      title: "Client access",
      description: "Invitations and active client identities without exposing tokens.",
      model: "PortalAccount",
      permissions: ["canReadPortal", "canManagePortal"],
      where: { status: { in: ["invited", "active", "suspended"] } },
      orderBy: { updatedAt: "desc" },
      query: "id email status invitedAt lastLoginAt contact { displayName } matterAccessesCount sharesCount",
      kind: "Portal account",
      map: (record) => ({ id: record.id, title: record.contact?.displayName ?? record.email, subtitle: `${record.email} \xB7 ${record.matterAccessesCount ?? 0} matter grants \xB7 ${record.sharesCount ?? 0} shares`, status: record.status, at: iso2(record.lastLoginAt ?? record.invitedAt) })
    },
    {
      key: "grants",
      title: "Matter grants",
      description: "Exact matter capabilities available to active portal accounts.",
      model: "PortalMatterAccess",
      permissions: ["canReadPortal", "canManagePortal"],
      where: { status: { equals: "active" } },
      orderBy: { updatedAt: "desc" },
      query: "id status expiresAt updatedAt portalAccount { email contact { displayName } } matter { matterNumber title } canReadDocuments canUploadDocuments canReadInvoices canReadMessages",
      kind: "Matter grant",
      map: (record) => ({ id: record.id, title: record.portalAccount?.contact?.displayName ?? record.portalAccount?.email ?? "Portal account", subtitle: `${matterLabel(record)} \xB7 exact capabilities`, status: record.status, at: iso2(record.expiresAt ?? record.updatedAt) })
    },
    {
      key: "shares",
      title: "Active resource shares",
      description: "Exact documents, invoices, versions, and conversations currently shared with clients.",
      model: "PortalShare",
      permissions: ["canReadPortal", "canManagePortal"],
      where: { status: { equals: "active" } },
      orderBy: { grantedAt: "desc" },
      query: "id status resourceType grantedAt expiresAt portalAccount { email contact { displayName } } matter { matterNumber title }",
      kind: "Portal share",
      map: (record) => ({ id: record.id, title: record.portalAccount?.contact?.displayName ?? record.portalAccount?.email ?? "Portal account", subtitle: `${matterLabel(record)} \xB7 ${record.resourceType.replaceAll("_", " ")}`, status: record.status, at: iso2(record.expiresAt ?? record.grantedAt) })
    },
    {
      key: "eligible-contacts",
      title: "Eligible contacts",
      description: "Current contacts available for a portal invitation.",
      model: "Contact",
      permissions: ["canReadPeople", "canManagePortal"],
      where: { status: { not: { equals: "archived" } } },
      orderBy: { updatedAt: "desc" },
      query: "id displayName contactType status primaryEmail updatedAt",
      kind: "Contact",
      map: (record) => ({ id: record.id, title: record.displayName, subtitle: record.primaryEmail || "No primary email", status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "eligible-matters",
      title: "Readable matter preview",
      description: "Open matters you can read. Whether a client can be given access is decided by the access policy above.",
      model: "Matter",
      permissions: ["canReadMatters"],
      where: { status: { in: ["open", "on_hold", "closing"] } },
      orderBy: { updatedAt: "desc" },
      query: "id matterNumber status updatedAt",
      kind: "Matter",
      map: (record) => ({ id: record.id, title: record.matterNumber, subtitle: "Readable matter \xB7 check the access policy before granting", status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "shareable-documents",
      title: "Shareable documents",
      description: "Client-shareable documents available within authorized matters.",
      model: "Document",
      permissions: ["canReadDocuments", "canManagePortal"],
      where: { status: { equals: "active" }, confidentiality: { equals: "client_shareable" } },
      orderBy: { updatedAt: "desc" },
      query: "id title status category updatedAt matter { matterNumber }",
      kind: "Document",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} \xB7 ${record.category}`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "shareable-invoices",
      title: "Shareable invoices",
      description: "Issued client bills available within authorized matters.",
      model: "Invoice",
      permissions: ["canReadBilling", "canManagePortal"],
      where: { status: { in: ["issued", "partially_paid", "paid", "overdue"] } },
      orderBy: { updatedAt: "desc" },
      query: "id invoiceNumber status balanceDueMinor currencyCode updatedAt matter { matterNumber } client { displayName }",
      kind: "Invoice",
      map: (record) => ({ id: record.id, title: record.invoiceNumber, subtitle: `${matterLabel(record)} \xB7 ${money(record.balanceDueMinor, record.currencyCode)} due`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "shareable-threads",
      title: "Shareable conversations",
      description: "Open matter conversations available within authorized matters.",
      model: "CommunicationThread",
      permissions: ["canReadCommunications", "canManagePortal"],
      where: { status: { equals: "open" } },
      orderBy: { lastMessageAt: "desc" },
      query: "id subject status primaryChannel lastMessageAt matter { matterNumber }",
      kind: "Thread",
      map: (record) => ({ id: record.id, title: record.subject, subtitle: `${matterLabel(record)} \xB7 ${record.primaryChannel}`, status: record.status, at: iso2(record.lastMessageAt) })
    }
  ],
  governance: [
    {
      key: "holds",
      title: "Legal holds",
      description: "Active matter, document, and contact holds that block disposition.",
      model: "RetentionHold",
      permissions: ["canReadRetention", "canManageRetention"],
      where: { status: { equals: "active" } },
      orderBy: { effectiveAt: "desc" },
      query: "id name status effectiveAt matter { matterNumber } document { title } contact { displayName } policy { name }",
      kind: "Legal hold",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.matter?.matterNumber ?? record.document?.title ?? record.contact?.displayName ?? "Firm-level"} \xB7 ${record.policy?.name ?? "manual"}`, status: record.status, at: iso2(record.effectiveAt) })
    },
    {
      key: "evidence",
      title: "Retention evidence",
      description: "Recent append-only hold, archive, restoration, and disposition actions.",
      model: "RetentionAction",
      permissions: ["canReadRetention"],
      orderBy: { occurredAt: "desc" },
      query: "id actionType resourceType occurredAt matter { matterNumber } document { title } performedBy { name }",
      kind: "Retention action",
      map: (record) => ({ id: record.id, title: `${record.actionType} \xB7 ${record.resourceType}`, subtitle: `${record.matter?.matterNumber ?? record.document?.title ?? "Scoped record"} \xB7 ${record.performedBy?.name ?? "system"}`, status: "completed", at: iso2(record.occurredAt) })
    }
  ],
  data: [
    {
      key: "connections",
      title: "Import sources",
      description: "Connections that contacts can be imported from.",
      model: "IntegrationConnection",
      permissions: ["canManageIntegrations"],
      where: { status: { equals: "active" } },
      orderBy: { updatedAt: "desc" },
      query: "id name provider category status updatedAt externalLinksCount",
      kind: "Import connection",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.provider} \xB7 ${record.category} \xB7 ${record.externalLinksCount ?? 0} linked records`, status: record.status, at: iso2(record.updatedAt) })
    },
    {
      key: "links",
      title: "Imported records",
      description: "Records linked to their original source.",
      model: "ExternalRecordLink",
      permissions: ["canReadIntegrations", "canManageIntegrations"],
      orderBy: { updatedAt: "desc" },
      query: "id resourceType externalId status lastSyncedAt updatedAt connection { name provider } matter { matterNumber } contact { displayName }",
      kind: "External link",
      map: (record) => ({ id: record.id, title: `${record.resourceType} \xB7 ${record.externalId}`, subtitle: `${record.connection?.name ?? record.connection?.provider ?? "Provider"} \xB7 ${record.matter?.matterNumber ?? record.contact?.displayName ?? "Firm record"}`, status: record.status, at: iso2(record.lastSyncedAt ?? record.updatedAt) })
    },
    {
      key: "exports",
      title: "Export evidence",
      description: "Recent audited transfer and integration events available to bounded export tooling.",
      model: "AuditEvent",
      permissions: ["canViewAudit"],
      where: { category: { in: ["integration", "legal_workflow", "financial"] } },
      orderBy: { occurredAt: "desc" },
      query: "id eventType category outcome occurredAt matter { matterNumber } actorUser { name }",
      kind: "Audit evidence",
      map: (record) => ({ id: record.id, title: record.eventType, subtitle: `${record.category} \xB7 ${record.matter?.matterNumber ?? "Firm-level"} \xB7 ${record.actorUser?.name ?? "system"}`, status: record.outcome, at: iso2(record.occurredAt) })
    }
  ],
  integrations: [
    {
      key: "connections",
      title: "Provider health",
      description: "Configured provider connections, sync health, and reauthorization needs.",
      model: "IntegrationConnection",
      permissions: ["canReadIntegrations", "canManageIntegrations"],
      orderBy: { updatedAt: "desc" },
      query: "id name provider category status lastSyncedAt lastErrorAt updatedAt office { name } externalLinksCount",
      kind: "Connection",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.provider} \xB7 ${record.category} \xB7 ${record.office?.name ?? "all offices"}`, status: record.status, at: iso2(record.lastErrorAt ?? record.lastSyncedAt ?? record.updatedAt) })
    },
    {
      key: "webhooks",
      title: "Webhook deliveries",
      description: "Queued, sent, unresolved and rejected deliveries. A delivery with an unknown outcome must be checked, not resent.",
      model: "WebhookDelivery",
      permissions: ["canReadIntegrations", "canManageIntegrations"],
      where: { status: { in: ["pending", "processing", "failed", "dead_letter"] } },
      orderBy: { updatedAt: "desc" },
      query: "id eventId eventType status lastError attemptCount nextAttemptAt updatedAt subscription { name } matter { matterNumber }",
      kind: "Webhook delivery",
      map: (record) => ({ id: record.id, title: record.eventType, subtitle: `${record.subscription?.name ?? "Subscription"} \xB7 ${record.eventId} \xB7 ${record.attemptCount ?? 0} attempts \xB7 ${webhookDispatchState(record.status, record.lastError).guidance}`, status: webhookDispatchState(record.status, record.lastError).status, at: iso2(record.nextAttemptAt ?? record.updatedAt) })
    },
    {
      key: "credentials",
      title: "Machine access review",
      description: "Scoped API keys without secret material.",
      model: "ApiKey",
      permissions: ["canReadMachineCredentials", "canManageMachineCredentials"],
      where: { status: { equals: "active" } },
      orderBy: { expiresAt: "asc" },
      query: "id name prefix status scopes expiresAt lastUsedAt owner { name }",
      kind: "API key",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.prefix}\u2026 \xB7 ${(record.scopes ?? []).join(", ") || "no scopes"} \xB7 ${record.owner?.name ?? "firm-owned"}`, status: record.status, at: iso2(record.expiresAt ?? record.lastUsedAt) })
    }
  ]
};
function workspaceItemHref(category, source, recordId) {
  if (source.previewOnly) return `/dashboard/platform/${category}#${source.key}`;
  if (source.kind === "Matter") return `/dashboard/platform/matters/${encodeURIComponent(recordId)}`;
  return `/dashboard/platform/${category}#${source.key}-${recordId}`;
}
function mapWorkspaceRecord(category, source, record, ordinal, canAct) {
  return {
    ...source.map(record),
    id: source.previewOnly ? `conflict-preview-${ordinal}` : record.id,
    kind: source.kind,
    href: workspaceItemHref(category, source, String(record.id ?? "")),
    canAct: source.previewOnly ? false : canAct
  };
}
var actionPermissions = {
  Intake: "canManageIntake",
  "Conflict check": "canResolveConflicts",
  Matter: "canManageMatters",
  Deadline: "canManageCalendar",
  Task: "canManageTasks",
  Message: "canManageCommunications",
  Document: "canManageDocuments",
  "Time entry": "canManageBilling",
  Expense: "canManageBilling",
  Invoice: "canManageBilling",
  "Legal hold": "canManageRetention",
  Connection: "canManageIntegrations",
  "Trust account": "canManageTrust",
  "Client ledger": "canManageTrust",
  Reconciliation: "canManageTrust"
};
async function loadSource(context, category, source) {
  const allowed = source.permissions.some((permission) => permissions[permission]({ session: context.session }));
  if (!allowed) return null;
  const api = context.query[source.model];
  const [total, records] = await Promise.all([
    api.count({ where: source.where ?? {} }),
    api.findMany({
      where: source.where ?? {},
      orderBy: source.orderBy ?? { updatedAt: "desc" },
      take: 12,
      query: source.query
    })
  ]);
  const actionPermission2 = actionPermissions[source.kind];
  const canAct = actionPermission2 ? permissions[actionPermission2]({ session: context.session }) : false;
  return {
    key: source.key,
    title: source.title,
    description: source.description,
    total,
    items: records.map((record, index) => mapWorkspaceRecord(category, source, record, index + 1, canAct))
  };
}
async function practiceWorkspace(_root, args, context) {
  const category = args.category?.trim().toLowerCase();
  if (!CATEGORIES.has(category)) throw new Error("Practice workspace category is unsupported.");
  if (!activeFirmId(context.session) || !permissions.canAccessDashboard({ session: context.session })) {
    throw new Error("An active firm dashboard session is required.");
  }
  if (category === "reports") {
    const overview = await practiceOverview(null, null, context);
    const queues = [
      ["intake", "Intake conversion", "Current prospective-client work.", overview.intakeQueue, ["active-intakes"]],
      ["matters", "Matter inventory", "Current authorized matter inventory.", overview.matterQueue, ["open-matters"]],
      ["work", "Deadline and work pressure", "Upcoming authorized work.", overview.workQueue, ["open-deadlines", "open-tasks"]],
      ["billing", "Receivables", "Outstanding bill activity.", overview.billingQueue, ["outstanding-invoices"]],
      ["governance", "Hold exposure", "Active retention holds.", overview.governanceQueue, ["active-holds"]]
    ];
    return {
      category,
      generatedAt: overview.generatedAt,
      metrics: overview.metrics.map((metric) => ({ ...metric, href: "/dashboard/platform/reports" })),
      sections: queues.map(([key, title, description, items, metricKeys]) => ({
        key,
        title,
        description,
        total: overview.metrics.filter((metric) => metricKeys.includes(metric.key)).reduce((total, metric) => total + metric.value, 0),
        items: items.map((item) => ({ ...item, href: `/dashboard/platform/reports#${key}-${item.id}` }))
      })),
      notices: ["Reports include only records available to the active firm, role, matter assignment, and ethical-wall state."]
    };
  }
  const loaded = await Promise.all((practiceWorkspaceSources[category] ?? []).map((source) => loadSource(context, category, source)));
  const sections = loaded.filter((section) => Boolean(section));
  return {
    category,
    generatedAt: /* @__PURE__ */ new Date(),
    metrics: sections.map((section) => ({
      key: section.key,
      label: section.title,
      value: section.total,
      href: `/dashboard/platform/${category}#${section.key}`
    })),
    sections,
    notices: sections.length ? ["Only records visible to your active firm, role, matter assignment, and ethical-wall state are included."] : ["Your current role does not expose records for this workspace."]
  };
}

// features/platform/billing/lib/ratePricing.ts
function within(at, from, to) {
  if (from && new Date(from).getTime() > at) return false;
  if (to && new Date(to).getTime() < at) return false;
  return true;
}
function resolveHourlyRate(rules2, target) {
  const at = new Date(target.workDate).getTime();
  if (Number.isNaN(at)) return null;
  let best = null;
  for (const rule of rules2) {
    const card = rule.rateCard;
    if (!card || card.status !== "active") continue;
    if (card.matter && card.matter.id !== target.matterId) continue;
    if (rule.matter && rule.matter.id !== target.matterId) continue;
    if (rule.user && rule.user.id !== target.userId) continue;
    if (rule.practiceArea && rule.practiceArea.id !== target.practiceAreaId) continue;
    if (!within(at, card.effectiveFrom, card.effectiveTo) || !within(at, rule.effectiveFrom, rule.effectiveTo)) continue;
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0) continue;
    const score = (rule.matter ? 8 : 0) + (rule.user ? 4 : 0) + (rule.practiceArea ? 2 : 0) + (card.matter ? 1 : 0);
    if (!best || score > best.score || score === best.score && (rule.priority ?? 100) < (best.rule.priority ?? 100)) best = { rule, score };
  }
  return best?.rule ?? null;
}
function priceMinutes(rateMinor, minutes) {
  return Math.round(rateMinor * minutes / 60);
}

// features/keystone/mutations/practiceWorkflows.ts
function durableKey2(value) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) {
    throw new Error("Idempotency key must be between 12 and 160 characters.");
  }
  return key;
}
async function transitionMatterRecord(options) {
  const { firmId, userId } = requirePermission(options.context, options.permission, { humanOnly: options.humanOnly });
  const reason = optionalBoundedText(options.reason, "Transition reason", 2e3);
  const prisma = options.context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, options.context, options.permission);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${options.model}:${firmId}:${options.id}`}))`;
    const item = await tx[options.model].findFirst({
      where: { id: options.id, firmId },
      ...options.model === "legalTask" ? { include: { dependsOn: { select: { id: true, status: true } } } } : {}
    });
    if (!item) throw new Error("The selected work record was not found in the active firm.");
    await assertMatterAccess(tx, firmId, item.matterId, userId);
    if (options.model === "timeEntry" || options.model === "expense") {
      await assertMatterTeamCapability(tx, firmId, item.matterId, userId, "canBill");
    }
    if (item.status === options.toStatus) return { item, replayed: true };
    assertLifecycleTransition(options.lifecycle, item.status, options.toStatus);
    const additional = options.validate ? await options.validate(tx, item, userId, reason) : {};
    const updated = await tx[options.model].update({
      where: { id: item.id },
      data: { status: options.toStatus, ...additional }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `${options.model}.${options.toStatus}`,
      category: options.model === "timeEntry" || options.model === "expense" ? "financial" : "legal_workflow",
      actorUserId: userId,
      matterId: item.matterId,
      metadata: { recordId: item.id, fromStatus: item.status, toStatus: options.toStatus, reasonDigest: reason ? sha256Digest(reason) : null }
    });
    return { item: updated, replayed: false };
  });
}
async function transitionIntake(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (args.toStatus === "converted") throw new Error("Intake conversion requires the atomic convertIntakeToMatter operation.");
  const reason = optionalBoundedText(args.reason, "Intake transition reason", 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (intake.status === args.toStatus) return { intake, replayed: true };
    assertLifecycleTransition("intake", intake.status, args.toStatus);
    if (["consultation", "decision"].includes(args.toStatus)) {
      const [cleared, unresolved] = await Promise.all([
        tx.conflictCheck.count({ where: { firmId, intakeId: intake.id, status: "cleared" } }),
        tx.conflictCheck.count({
          where: { firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } }
        })
      ]);
      if (!cleared || unresolved) throw new Error("Intake cannot advance without a cleared conflict review and no blocking check.");
    }
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.intake.update({
      where: { id: intake.id },
      data: {
        status: args.toStatus,
        ...["declined", "withdrawn"].includes(args.toStatus) ? { declineReason: reason ?? "" } : {},
        ...["declined", "withdrawn"].includes(args.toStatus) ? { decidedAt: now } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `intake.${args.toStatus}`,
      category: "legal_workflow",
      actorUserId: userId,
      intakeId: intake.id,
      metadata: { fromStatus: intake.status, toStatus: args.toStatus, reasonDigest: reason ? sha256Digest(reason) : null }
    });
    return { intake: updated, replayed: false };
  });
}
var intakePartyMapping = {
  prospective_client: { partyRole: "client", side: "our_client" },
  adverse_party: { partyRole: "opposing_party", side: "adverse" },
  related_party: { partyRole: "other", side: "unknown" },
  witness: { partyRole: "witness", side: "neutral" },
  other: { partyRole: "other", side: "unknown" }
};
async function convertIntakeToMatter(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  requirePermission(context, "canManageIntake", { humanOnly: true });
  requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!String(args.matterNumber).trim() || String(args.matterNumber).length > 100) throw new Error("Matter number is required.");
  if (!String(args.title).trim() || String(args.title).length > 500) throw new Error("Matter title is required.");
  const reason = boundedReason(args.reason, "Conversion reason", 10, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake-conversion:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId }, include: { convertedMatter: true } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (intake.convertedMatter) {
      if (intake.status !== "converted") throw new Error("Existing intake conversion evidence is inconsistent.");
    } else if (intake.status !== "decision") {
      throw new Error("Intake must be at the engagement decision stage before conversion.");
    }
    const [clearedChecks, blockingChecks, attorney, office, practiceArea] = await Promise.all([
      tx.conflictCheck.findMany({ where: { firmId, intakeId: intake.id, status: "cleared" }, select: { id: true } }),
      tx.conflictCheck.count({ where: { firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } } }),
      tx.user.findFirst({ where: { id: args.responsibleAttorneyId, status: "active", firmMemberships: { some: { firmId, status: "active" } } }, select: { id: true } }),
      args.officeId ? tx.office.findFirst({ where: { id: args.officeId, firmId }, select: { id: true } }) : null,
      args.practiceAreaId ? tx.practiceArea.findFirst({ where: { id: args.practiceAreaId, firmId, status: "active" }, select: { id: true } }) : null
    ]);
    if (!clearedChecks.length || blockingChecks) throw new Error("Conversion requires a cleared conflict review and no blocking check.");
    if (!attorney) throw new Error("Responsible attorney must be active in the firm.");
    if (args.officeId && !office) throw new Error("Office was not found in the active firm.");
    if (args.practiceAreaId && !practiceArea) throw new Error("Practice area was not found in the active firm.");
    if (intake.convertedMatter) {
      const existing = intake.convertedMatter;
      if (existing.clientId !== intake.primaryContactId || existing.matterNumber !== args.matterNumber.trim() || existing.title !== args.title.trim() || existing.responsibleAttorneyId !== attorney.id || (existing.officeId ?? null) !== (office?.id ?? null) || (existing.practiceAreaId ?? null) !== (practiceArea?.id ?? null)) {
        throw new Error("Existing intake conversion cannot be replayed with different matter identity or authority.");
      }
      return { matter: existing, replayed: true };
    }
    const numberTaken = await tx.matter.findFirst({ where: { firmId, matterNumber: args.matterNumber.trim() }, select: { id: true } });
    if (numberTaken) throw new Error("Matter number is already in use in this firm.");
    const now = /* @__PURE__ */ new Date();
    const matter = await tx.matter.create({
      data: {
        firmId,
        matterNumber: args.matterNumber.trim(),
        title: args.title.trim(),
        status: "proposed",
        confidentiality: "standard",
        clientId: intake.primaryContactId,
        responsibleAttorneyId: attorney.id,
        officeId: office?.id ?? null,
        practiceAreaId: practiceArea?.id ?? null,
        openedAt: now
      }
    });
    const clearedCheckIds = clearedChecks.map((check) => check.id);
    const openedMatter = await tx.matter.update({
      where: { id: matter.id },
      data: {
        status: "open",
        openedAt: now,
        authorizedUsers: { connect: { id: attorney.id } }
      }
    });
    await Promise.all([
      tx.matterTeamMember.create({
        data: {
          firmId,
          matterId: matter.id,
          userId: attorney.id,
          officeId: office?.id ?? null,
          teamRole: "responsible_attorney",
          status: "active",
          canAccessRestricted: true,
          canEdit: true,
          canBill: true,
          assignedAt: now
        }
      }),
      tx.conflictCheck.updateMany({ where: { firmId, id: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictSearchTerm.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictMatch.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictDisposition.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.intake.update({
        where: { id: intake.id },
        data: { status: "converted", decidedAt: now, convertedMatterId: matter.id }
      }),
      tx.matterStatusEvent.create({
        data: {
          firmId,
          matterId: matter.id,
          fromStatus: "proposed",
          toStatus: "open",
          action: "intake.converted",
          reason,
          actorUserId: userId,
          occurredAt: now
        }
      })
    ]);
    const participants = await tx.intakeParticipant.findMany({
      where: { firmId, intakeId: intake.id, status: "active" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { contactId: true, participantRole: true }
    });
    const partyKeys = /* @__PURE__ */ new Set();
    const partyIds = [];
    const clientParticipants = participants.some((participant) => participant.contactId === intake.primaryContactId && participant.participantRole === "prospective_client") ? participants : [{ contactId: intake.primaryContactId, participantRole: "prospective_client" }, ...participants];
    for (const participant of clientParticipants) {
      const party = intakePartyMapping[participant.participantRole];
      if (!party) continue;
      const isPrimaryClient = participant.contactId === intake.primaryContactId && party.partyRole === "client";
      const key = `${participant.contactId}:${party.partyRole}`;
      if (partyKeys.has(key)) continue;
      partyKeys.add(key);
      const created = await tx.matterParty.create({
        data: {
          firmId,
          matterId: matter.id,
          contactId: participant.contactId,
          partyRole: party.partyRole,
          side: party.side,
          status: "active",
          isPrimaryClient,
          notes: ""
        },
        select: { id: true }
      });
      partyIds.push(created.id);
    }
    await tx.contact.updateMany({
      where: { id: intake.primaryContactId, firmId, status: { in: ["prospective_client", "former_client", "other"] } },
      data: { status: "client" }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "intake.converted_to_matter",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: matter.id,
      intakeId: intake.id,
      contactId: intake.primaryContactId,
      metadata: { responsibleAttorneyId: attorney.id, conflictCheckIds: clearedCheckIds, matterPartyIds: partyIds, reasonDigest: sha256Digest(reason) }
    });
    return { matter: openedMatter, replayed: false };
  });
}
async function reviseDraftDeadline(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const reason = boundedReason(args.reason, "Deadline revision reason", 5, 2e3);
  const title = args.title?.trim();
  const timezone2 = args.timezone?.trim();
  const dueAt = args.dueAt ? new Date(args.dueAt) : null;
  if (title != null && (!title || title.length > 500)) throw new Error("Deadline title is invalid.");
  if (timezone2 != null && (!timezone2 || timezone2.length > 100)) throw new Error("Deadline timezone is invalid.");
  if (args.dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Deadline due date is invalid.");
  if (title == null && timezone2 == null && dueAt == null) throw new Error("Deadline revision requires a changed snapshot field.");
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deadline:${firmId}:${args.deadlineId}`}))`;
    const deadline = await tx.deadline.findFirst({ where: { id: args.deadlineId, firmId } });
    if (!deadline || deadline.status !== "draft" || deadline.isVerified) {
      throw new Error("Only an unverified draft deadline can be revised.");
    }
    await assertMatterAccess(tx, firmId, deadline.matterId, userId);
    const updated = await tx.deadline.update({
      where: { id: deadline.id },
      data: {
        ...title != null ? { title } : {},
        ...timezone2 != null ? { timezone: timezone2 } : {},
        ...dueAt != null ? { dueAt } : {}
      }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "deadline.draft_revised",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: deadline.matterId,
      metadata: { deadlineId: deadline.id, reasonDigest: sha256Digest(reason) }
    });
    return updated;
  });
}
async function transitionDeadline(_root, args, context) {
  return transitionMatterRecord({
    context,
    permission: "canManageCalendar",
    model: "deadline",
    lifecycle: "deadline",
    id: args.deadlineId,
    toStatus: args.toStatus,
    reason: args.reason,
    humanOnly: true,
    validate: async (_tx, item, userId, reason) => {
      if (args.toStatus === "waived" && !reason) throw new Error("Deadline waiver requires a reason.");
      if (args.toStatus === "completed" && !item.isVerified) throw new Error("An unverified deadline cannot be completed.");
      if (args.toStatus === "pending" && !reason) throw new Error("Deadline verification requires a reason.");
      const now = /* @__PURE__ */ new Date();
      return {
        ...args.toStatus === "completed" ? { completedAt: now } : {},
        ...args.toStatus === "pending" ? {
          isVerified: true,
          verifiedById: userId,
          verifiedAt: now
        } : {}
      };
    }
  });
}
async function transitionLegalTask(_root, args, context) {
  return transitionMatterRecord({
    context,
    permission: "canManageTasks",
    model: "legalTask",
    lifecycle: "legalTask",
    id: args.taskId,
    toStatus: args.toStatus,
    reason: args.reason,
    validate: async (_tx, item, _userId, reason) => {
      if (args.toStatus === "completed" && item.dependsOn?.some((dependency) => dependency.status !== "completed")) {
        throw new Error("Task cannot be completed while dependencies remain unfinished.");
      }
      if (args.toStatus === "blocked" && !reason) throw new Error("Blocking a task requires a reason.");
      return {
        completedAt: args.toStatus === "completed" ? /* @__PURE__ */ new Date() : null,
        blockedReason: args.toStatus === "blocked" ? reason : ""
      };
    }
  });
}
async function transitionTimeEntry(_root, args, context) {
  if (!["submitted", "approved", "draft", "written_off"].includes(args.toStatus)) {
    throw new Error("Time billing state can change only through invoice assembly and issue operations.");
  }
  if (args.toStatus === "written_off") boundedReason(args.reason, "Time write-off reason", 5, 2e3);
  return transitionMatterRecord({
    context,
    permission: "canManageBilling",
    model: "timeEntry",
    lifecycle: "timeEntry",
    id: args.timeEntryId,
    toStatus: args.toStatus,
    reason: args.reason,
    humanOnly: true,
    validate: async (tx, item, userId) => args.toStatus === "approved" ? { approvedById: userId, approvedAt: /* @__PURE__ */ new Date(), ...await priceUnpricedTime(tx, item) } : args.toStatus === "draft" ? { approvedById: null, approvedAt: null } : {}
  });
}
async function priceUnpricedTime(tx, item) {
  if (!item?.isBillable || item.amountMinor !== null && item.amountMinor !== void 0) return {};
  const matter = await tx.matter.findFirst({ where: { id: item.matterId, firmId: item.firmId }, select: { practiceAreaId: true } });
  const rows = await tx.rateRule.findMany({
    where: { firmId: item.firmId, rateType: "hourly", rateCard: { status: "active" } },
    take: 500,
    select: { id: true, amountMinor: true, currencyCode: true, priority: true, effectiveFrom: true, effectiveTo: true, matterId: true, userId: true, practiceAreaId: true, rateCard: { select: { id: true, name: true, status: true, matterId: true, effectiveFrom: true, effectiveTo: true } } }
  });
  const rules2 = rows.map((row) => ({
    id: row.id,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    priority: row.priority,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    matter: row.matterId ? { id: row.matterId } : null,
    user: row.userId ? { id: row.userId } : null,
    practiceArea: row.practiceAreaId ? { id: row.practiceAreaId } : null,
    rateCard: row.rateCard ? { id: row.rateCard.id, name: row.rateCard.name, status: row.rateCard.status, matter: row.rateCard.matterId ? { id: row.rateCard.matterId } : null, effectiveFrom: row.rateCard.effectiveFrom?.toISOString() ?? null, effectiveTo: row.rateCard.effectiveTo?.toISOString() ?? null } : null
  }));
  const rule = resolveHourlyRate(rules2, { matterId: item.matterId, userId: item.userId ?? null, practiceAreaId: matter?.practiceAreaId ?? null, workDate: item.workDate ?? item.createdAt });
  if (!rule) return {};
  return { rateMinor: rule.amountMinor, amountMinor: priceMinutes(rule.amountMinor, Number(item.durationMinutes) || 0), currencyCode: rule.currencyCode };
}
async function transitionExpense(_root, args, context) {
  if (!["submitted", "approved", "draft", "written_off"].includes(args.toStatus)) {
    throw new Error("Expense billing and reimbursement states require their controlled financial operations.");
  }
  if (args.toStatus === "written_off") boundedReason(args.reason, "Expense write-off reason", 5, 2e3);
  return transitionMatterRecord({
    context,
    permission: "canManageBilling",
    model: "expense",
    lifecycle: "expense",
    id: args.expenseId,
    toStatus: args.toStatus,
    reason: args.reason,
    humanOnly: true,
    validate: async (_tx, _item, userId) => args.toStatus === "approved" ? { approvedById: userId, approvedAt: /* @__PURE__ */ new Date() } : args.toStatus === "draft" ? { approvedById: null, approvedAt: null } : {}
  });
}
async function assembleDraftInvoice(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const key = durableKey2(args.idempotencyKey);
  const retainerId = args.retainerId?.trim() || null;
  const timeEntryIds = [...new Set(args.timeEntryIds ?? [])].sort();
  const expenseIds = [...new Set(args.expenseIds ?? [])].sort();
  if (!timeEntryIds.length && !expenseIds.length) throw new Error("Invoice assembly requires approved time or expense sources.");
  if (timeEntryIds.length + expenseIds.length > 200) throw new Error("Invoice assembly is limited to 200 source records per draft.");
  const requestDigest = sha256Digest({
    invoiceNumber: args.invoiceNumber.trim(),
    matterId: args.matterId,
    clientId: args.clientId,
    timeEntryIds,
    expenseIds,
    ...retainerId ? { retainerId } : {}
  });
  const eventId2 = `invoice-assembly:${firmId}:${key}`;
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId2}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: eventId2 } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Invoice idempotency key was reused with a different payload.");
      }
      const invoice2 = await tx.invoice.findFirst({ where: { id: replay.metadata?.invoiceId, firmId } });
      if (!invoice2) throw new Error("Invoice replay evidence references a missing invoice.");
      await assertMatterAccess(tx, firmId, invoice2.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, invoice2.matterId, userId, "canBill");
      return { invoice: invoice2, replayed: true };
    }
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canBill");
    const sourceLockKeys = [
      ...timeEntryIds.map((id2) => `billing-source:${firmId}:time:${id2}`),
      ...expenseIds.map((id2) => `billing-source:${firmId}:expense:${id2}`)
    ].sort();
    for (const sourceLockKey of sourceLockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceLockKey}))`;
    }
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId, clientId: args.clientId }, select: { id: true } });
    if (!matter) throw new Error("Invoice client must match the selected active-firm matter.");
    const [timeEntries, expenses] = await Promise.all([
      tx.timeEntry.findMany({ where: { id: { in: timeEntryIds }, firmId, matterId: args.matterId, status: "approved", isBillable: true, invoiceLine: null } }),
      tx.expense.findMany({ where: { id: { in: expenseIds }, firmId, matterId: args.matterId, status: "approved", isBillable: true, invoiceLine: null } })
    ]);
    if (timeEntries.length !== timeEntryIds.length || expenses.length !== expenseIds.length) {
      throw new Error("Every invoice source must be approved, billable, unbilled, and scoped to the selected matter.");
    }
    const currencies = new Set([...timeEntries, ...expenses].map((item) => item.currencyCode));
    if (currencies.size !== 1) throw new Error("Invoice sources must use one currency.");
    const currencyCode = String([...currencies][0]);
    if (retainerId) {
      const retainer = await tx.retainerAgreement.findFirst({
        where: { id: retainerId, firmId, matterId: args.matterId, clientId: args.clientId, status: "active", currencyCode },
        select: { id: true }
      });
      if (!retainer) throw new Error("The fee agreement must be active for this matter, client and currency.");
    }
    const sourceLines = [
      ...timeEntries.map((entry) => ({ type: "time", sourceId: entry.id, description: entry.description, amountMinor: entry.amountMinor, serviceDate: entry.workDate })),
      ...expenses.map((expense) => ({ type: "expense", sourceId: expense.id, description: expense.description, amountMinor: expense.amountMinor, serviceDate: expense.incurredAt }))
    ];
    if (sourceLines.some((line) => !isGraphqlInt(line.amountMinor) || line.amountMinor < 0)) {
      throw new Error("Every invoice source requires a non-negative database-range minor-unit snapshot amount.");
    }
    const totalMinor = sourceLines.reduce((total, line) => total + line.amountMinor, 0);
    if (!isGraphqlInt(totalMinor)) throw new Error("Invoice source total exceeds the supported database integer range.");
    const invoice = await tx.invoice.create({
      data: {
        firmId,
        matterId: args.matterId,
        clientId: args.clientId,
        invoiceNumber: args.invoiceNumber.trim(),
        status: "draft",
        currencyCode,
        subtotalMinor: totalMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor,
        paidMinor: 0,
        balanceDueMinor: totalMinor,
        ...retainerId ? { retainerId } : {}
      }
    });
    for (const line of sourceLines) {
      await tx.invoiceLine.create({
        data: {
          firmId,
          matterId: args.matterId,
          invoiceId: invoice.id,
          lineType: line.type,
          description: line.description,
          quantity: 1,
          unitAmountMinor: line.amountMinor,
          subtotalMinor: line.amountMinor,
          discountMinor: 0,
          taxMinor: 0,
          lineTotalMinor: line.amountMinor,
          currencyCode,
          sourceRecordId: line.sourceId,
          serviceDate: line.serviceDate,
          ...line.type === "time" ? { timeEntryId: line.sourceId } : { expense: { connect: { id: line.sourceId } } }
        }
      });
    }
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: eventId2,
        eventType: "invoice.draft_assembled",
        category: "financial",
        outcome: "succeeded",
        actorUserId: userId,
        actorType: "user",
        matterId: args.matterId,
        invoiceId: invoice.id,
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: { requestDigest, invoiceId: invoice.id, sourceCount: sourceLines.length }
      }
    });
    return { invoice, replayed: false };
  });
}

// features/keystone/mutations/documentVersionWorkflows.ts
var ingestSources = /* @__PURE__ */ new Set(["upload", "generated", "import"]);
var versionableStatuses = /* @__PURE__ */ new Set(["draft", "active"]);
var MAX_SIGNATURE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1e3;
function idempotencyKey2(value, label) {
  const key = value?.trim() ?? "";
  if (!/^[A-Za-z0-9:_-]{16,200}$/.test(key)) {
    throw new Error(`${label} must be 16-200 letters, digits, colons, underscores or hyphens.`);
  }
  return key;
}
function fileName(value) {
  const name = value?.trim() ?? "";
  const hasControlCharacter = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!name || name.length > 255 || /[\\/]/.test(name) || hasControlCharacter || name === "." || name === "..") {
    throw new Error("File name must be 1-255 characters without path separators or control characters.");
  }
  return name;
}
function objectKey(value, firmId, documentId) {
  const key = value?.trim() ?? "";
  const prefix = `firms/${firmId}/documents/${documentId}/`;
  if (key.length > 1024 || !key.startsWith(prefix) || key.length === prefix.length || key.split("/").some((segment) => !segment || segment === "." || segment === "..") || !/^[A-Za-z0-9._~/-]+$/.test(key)) {
    throw new Error(`Object key must be a storage path under ${prefix} without traversal segments.`);
  }
  return key;
}
function mediaType(value) {
  const type = value?.trim().toLowerCase() ?? "";
  if (type.length > 255 || !/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(type)) {
    throw new Error("Media type must be a single type/subtype value.");
  }
  return type;
}
function checksum(value) {
  const digest2 = value?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(digest2)) throw new Error("Checksum must be a SHA-256 hex digest.");
  return digest2;
}
function byteSize(value) {
  if (!isGraphqlInt(value) || value < 1) throw new Error("Byte size must be a positive 32-bit integer.");
  return value;
}
async function lockDocument(tx, firmId, documentId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document:${firmId}:${documentId}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-document:${firmId}:${documentId}`}))`;
}
async function loadVersionableDocument(tx, firmId, documentId, userId) {
  const document2 = await tx.document.findFirst({ where: { id: documentId, firmId } });
  if (!document2) throw new Error("Document was not found in the active firm.");
  if (document2.matterId) await assertMatterAccess(tx, firmId, document2.matterId, userId);
  if (!versionableStatuses.has(document2.status)) {
    throw new Error("Versions can be recorded only on draft or active documents.");
  }
  return document2;
}
async function ingestDocumentVersion(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const key = idempotencyKey2(args.idempotencyKey, "Version idempotency key");
  const source = args.source?.trim() || "upload";
  if (!ingestSources.has(source)) {
    throw new Error("Only uploaded, generated or imported versions can be recorded by staff; provider sources require their adapter.");
  }
  const version = {
    fileName: fileName(args.fileName),
    objectKey: objectKey(args.objectKey, firmId, args.documentId),
    mediaType: mediaType(args.mediaType),
    byteSize: byteSize(args.byteSize),
    checksumSha256: checksum(args.checksumSha256),
    source,
    notes: optionalBoundedText(args.notes, "Version notes", 2e3) ?? "",
    sourceMessageId: args.sourceMessageId ?? null
  };
  const makeCurrent = Boolean(args.makeCurrent);
  const versionKey = `${firmId}:${args.documentId}:${key}`;
  const requestDigest = sha256Digest({ documentId: args.documentId, ...version, makeCurrent });
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await lockDocument(tx, firmId, args.documentId);
    const document2 = await loadVersionableDocument(tx, firmId, args.documentId, userId);
    const existing = await tx.documentVersion.findFirst({ where: { versionKey } });
    if (existing) {
      const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: `document-version:${versionKey}` } });
      if (existing.firmId !== firmId || existing.documentId !== document2.id || replay?.metadata?.requestDigest !== requestDigest) {
        throw new Error("Version idempotency key was already used with a different payload.");
      }
      return { version: existing, document: document2, replayed: true };
    }
    if (version.sourceMessageId) {
      const message = await tx.communicationMessage.findFirst({
        where: { id: version.sourceMessageId, firmId, matterId: document2.matterId ?? null },
        select: { id: true }
      });
      if (!message) throw new Error("Source message must belong to the same firm and matter as the document.");
    }
    const latest = await tx.documentVersion.aggregate({
      where: { firmId, documentId: document2.id },
      _max: { versionNumber: true }
    });
    const versionNumber = (latest?._max?.versionNumber ?? 0) + 1;
    const created = await tx.documentVersion.create({
      data: {
        firmId,
        matterId: document2.matterId ?? null,
        documentId: document2.id,
        versionKey,
        versionNumber,
        fileName: version.fileName,
        objectKey: version.objectKey,
        mediaType: version.mediaType,
        byteSize: version.byteSize,
        checksumSha256: version.checksumSha256,
        source: version.source,
        createdById: userId,
        sourceMessageId: version.sourceMessageId,
        notes: version.notes
      }
    });
    const updatedDocument = makeCurrent ? await tx.document.update({ where: { id: document2.id }, data: { currentVersionId: created.id } }) : document2;
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: `document-version:${versionKey}`,
        eventType: "document.version_recorded",
        category: "legal_workflow",
        outcome: "succeeded",
        ...workflowActor(context, userId),
        matterId: document2.matterId ?? null,
        documentId: document2.id,
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: {
          versionId: created.id,
          versionNumber,
          checksumSha256: version.checksumSha256,
          byteSize: version.byteSize,
          source: version.source,
          madeCurrent: makeCurrent,
          ...makeCurrent ? { previousCurrentVersionId: document2.currentVersionId ?? null } : {},
          requestDigest
        }
      }
    });
    return { version: created, document: updatedDocument, replayed: false };
  });
}
async function setDocumentCurrentVersion(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Current version reason", 5, 2e3);
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await lockDocument(tx, firmId, args.documentId);
    const document2 = await loadVersionableDocument(tx, firmId, args.documentId, userId);
    const version = await tx.documentVersion.findFirst({
      where: { id: args.versionId, firmId, documentId: document2.id },
      select: { id: true, versionNumber: true, checksumSha256: true }
    });
    if (!version) throw new Error("Current version must be an immutable version of this same document.");
    if (document2.currentVersionId === version.id) return { document: document2, replayed: true };
    const updated = await tx.document.update({
      where: { id: document2.id },
      data: { currentVersionId: version.id }
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "document.current_version_set",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: document2.matterId ?? null,
      documentId: document2.id,
      metadata: {
        versionId: version.id,
        versionNumber: version.versionNumber,
        checksumSha256: version.checksumSha256,
        previousCurrentVersionId: document2.currentVersionId ?? null,
        reasonDigest: sha256Digest(reason)
      }
    });
    return { document: updated, replayed: false };
  });
}
async function prepareSignatureRequest(_root, args, context) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const key = idempotencyKey2(args.idempotencyKey, "Signature request idempotency key");
  const title = optionalBoundedText(args.title, "Signature request title", 300);
  if (!title) throw new Error("Signature request title is required.");
  const message = optionalBoundedText(args.message, "Signature request message", 5e3) ?? "";
  let expiresAt = null;
  if (args.expiresAt) {
    expiresAt = new Date(args.expiresAt);
    const remaining = expiresAt.getTime() - Date.now();
    if (Number.isNaN(remaining) || remaining <= 0 || remaining > MAX_SIGNATURE_LIFETIME_MS) {
      throw new Error("Signature request expiry must be in the future and within one year.");
    }
  }
  const auditId = `signature-request-prepared:${key}`;
  const requestDigest = sha256Digest({
    documentVersionId: args.documentVersionId,
    title,
    message,
    expiresAt: expiresAt?.toISOString() ?? null,
    integrationConnectionId: args.integrationConnectionId ?? null
  });
  const prisma = context.prisma;
  return runSerializableTransaction(prisma, async (tx) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    const identity = await tx.documentVersion.findFirst({
      where: { id: args.documentVersionId, firmId },
      select: { documentId: true }
    });
    if (!identity) throw new Error("Document version was not found in the active firm.");
    await lockDocument(tx, firmId, identity.documentId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-prepare:${firmId}:${key}`}))`;
    const document2 = await loadVersionableDocument(tx, firmId, identity.documentId, userId);
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditId } });
    if (replay) {
      const request2 = await tx.signatureRequest.findFirst({ where: { id: replay.metadata?.signatureRequestId ?? "", firmId } });
      if (!request2 || replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Signature request idempotency key was already used with a different payload.");
      }
      return { request: request2, replayed: true };
    }
    if (document2.currentVersionId !== args.documentVersionId) {
      throw new Error("Signature requests must be prepared from the document's exact current version.");
    }
    let connection = null;
    if (args.integrationConnectionId) {
      connection = await tx.integrationConnection.findFirst({
        where: { id: args.integrationConnectionId, firmId, status: "active", category: "signature" },
        select: { id: true, provider: true }
      });
      if (!connection) throw new Error("Signature connection must be an active signature integration in the active firm.");
    }
    const request = await tx.signatureRequest.create({
      data: {
        firmId,
        matterId: document2.matterId ?? null,
        documentVersionId: args.documentVersionId,
        title,
        status: "draft",
        provider: connection?.provider ?? "",
        integrationConnectionId: connection?.id ?? null,
        message,
        expiresAt
      }
    });
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditId,
        eventType: "signature.request_prepared",
        category: "legal_workflow",
        outcome: "succeeded",
        ...workflowActor(context, userId),
        matterId: document2.matterId ?? null,
        documentId: document2.id,
        occurredAt: /* @__PURE__ */ new Date(),
        metadata: {
          signatureRequestId: request.id,
          documentVersionId: args.documentVersionId,
          integrationConnectionId: connection?.id ?? null,
          requestDigest
        }
      }
    });
    return { request, replayed: false };
  });
}

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/customerConsultations.ts
var import_node_crypto16 = require("node:crypto");

// features/storefront/lib/first-contact.ts
var FIXTURE_FIRST_CONTACT_NOTICE = "Fictional local appointment. No legal advice or attorney-client relationship. Share only what is reasonably necessary to assess fit. Do not send documents, account numbers, medical records, or unnecessary confidential details.";
var FIRST_CONTACT_ACKNOWLEDGMENT = "I understand that submitting this request does not create an attorney-client relationship, the firm has not agreed to represent me, and I should not rely on this form for emergencies or deadlines.";
function firstContactVersion(mode, liveVersion = 0) {
  return mode === "fixture" ? "fixture-v1" : `live-v${liveVersion}`;
}
var FirstContactValidationError = class extends Error {
};
function bounded3(value, label, maximum, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new FirstContactValidationError(`${label} is required.`);
  if (result.length > maximum) throw new FirstContactValidationError(`${label} must be ${maximum} characters or fewer.`);
  return result;
}
function validateFirstContact(input) {
  return {
    jurisdiction: bounded3(input.jurisdiction, "State or jurisdiction", 120),
    opposingParties: bounded3(input.opposingParties, "Opposing or related parties", 500),
    keyDeadline: bounded3(input.keyDeadline, "Known deadline", 120, false),
    summary: bounded3(input.summary, "Brief description", 800, false)
  };
}
function hasNamedOpposingParty(opposingParties) {
  return !/^none(?: known)?\.?$/i.test(opposingParties.trim());
}

// features/keystone/mutations/customerConsultations.ts
async function servicingFirm(tx) {
  await tx.$executeRaw`SELECT id FROM "Firm" WHERE status = 'active' ORDER BY id FOR SHARE`;
  const firms = await tx.firm.findMany({ where: { status: "active" }, take: 2 });
  if (firms.length !== 1) return null;
  const firm = firms[0];
  if (firm.isDemo && !await isLocalFixtureFirm(tx, firm.id)) return null;
  return firm;
}
async function publicFirm(tx, capability) {
  const firm = await servicingFirm(tx);
  if (!firm) return null;
  if (await isLocalFixtureFirm(tx, firm.id)) return { firm, mode: "fixture", policy: null };
  if (firm.isDemo) return null;
  const policy = await tx.publicSitePolicy.findFirst({ where: { firmId: firm.id, status: "published" } });
  if (!policy?.publicAccountsEnabled || !String(policy.privacyNotice ?? "").trim()) return null;
  if (capability === "booking" && (!policy.publicBookingEnabled || !String(policy.firstContactNotice ?? "").trim())) return null;
  return { firm, mode: "live", policy };
}
async function account(tx, context) {
  const session = context.session;
  if (!isHumanIdentitySession(session) || session.listKey !== "User") throw new Error("Sign in to your account.");
  await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${session.itemId} FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: session.itemId }, select: { id: true, name: true, email: true, status: true } });
  if (!user || user.status !== "active") throw new Error("Sign in to your account.");
  return user;
}
function dto(row) {
  return { id: row.id, serviceTitle: row.serviceTitle, feeMinor: row.feeMinor, currencyCode: row.currencyCode, status: row.status, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, timezone: row.timezone || "UTC" };
}
var serviceSelect = { id: true, code: true, publicSlug: true, name: true, description: true, consultationFeeMinor: true, consultationMinutes: true };
function serviceDto(service, firm) {
  return { ...service, publicSlug: service.publicSlug ?? "", currencyCode: firm.defaultCurrency };
}
var CATALOG_PAGE_SIZE = 24;
var HISTORY_PAGE_SIZE = 20;
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function decodeCursor(cursor, keys) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(String(cursor).slice(0, 512), "base64url").toString("utf8"));
    if (value && typeof value === "object" && keys.every((key) => typeof value[key] === "string" && value[key].length <= 256)) return value;
  } catch {
  }
  throw new Error("This page is unavailable. Start again from the first page.");
}
async function consultationCatalogPage(_root, args, context) {
  return runSerializableTransaction(context.prisma, async (tx) => {
    const admitted = await publicFirm(tx, "booking");
    if (!admitted) return { services: [], nextCursor: null };
    const { firm } = admitted;
    const after = decodeCursor(args.cursor, ["s", "i"]);
    const rows = await tx.practiceArea.findMany({
      where: { AND: [
        { firmId: firm.id, status: "active", isPublic: true, publicSlug: { not: null } },
        after ? { OR: [{ publicSlug: { gt: after.s } }, { publicSlug: after.s, id: { gt: after.i } }] } : {}
      ] },
      orderBy: [{ publicSlug: "asc" }, { id: "asc" }],
      take: CATALOG_PAGE_SIZE + 1,
      select: serviceSelect
    });
    const page = rows.slice(0, CATALOG_PAGE_SIZE);
    const last = page.at(-1);
    return { services: page.map((service) => serviceDto(service, firm)), nextCursor: rows.length > CATALOG_PAGE_SIZE && last ? encodeCursor({ s: last.publicSlug, i: last.id }) : null };
  });
}
async function consultationCatalog(root, _args, context) {
  return (await consultationCatalogPage(root, {}, context)).services;
}
async function consultationService(_root, args, context) {
  if (Boolean(args.slug) === Boolean(args.id)) throw new Error("Provide a service slug or ID.");
  return runSerializableTransaction(context.prisma, async (tx) => {
    const admitted = await publicFirm(tx, "booking");
    if (!admitted) return null;
    const { firm } = admitted;
    const target = args.slug ? { publicSlug: String(args.slug).slice(0, 80) } : { id: String(args.id) };
    const service = await tx.practiceArea.findFirst({ where: { ...target, firmId: firm.id, status: "active", isPublic: true }, select: serviceSelect });
    return service ? serviceDto(service, firm) : null;
  });
}
async function registerConsultationAccount(_root, args, context) {
  if (context.session?.itemId) throw new Error("Sign out before creating an account.");
  const name = args.name?.trim(), email = args.email?.trim().toLowerCase();
  if (!name || name.length > 120 || !email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.password.length < 12 || args.password.length > 1e3) throw new Error("Enter a name, valid email and password of at least 12 characters.");
  if (!await publicFirm(context.prisma, "accounts")) throw new Error("Account registration is unavailable.");
  try {
    const user = await context.sudo().db.User.createOne({ data: { name, email, password: args.password, status: "active", onboardingStatus: "completed" } });
    return { id: user.id };
  } catch {
    throw new Error("Account could not be created. Use another email or sign in.");
  }
}
var BOOKING_LEAD_MS = 60 * 6e4;
var BOOKING_HORIZON_MS = 14 * 864e5;
var SLOT_STEP_MINUTES = 30;
var CANDIDATE_STEP_MS = 15 * 6e4;
var MAX_OFFERED_SLOTS = 300;
var CONSULTATION_HOURS = { open: 9 * 60, close: 17 * 60, weekdays: /* @__PURE__ */ new Set([1, 2, 3, 4, 5]) };
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function validTimezone(value, fallback = "UTC") {
  const zone = typeof value === "string" && value ? value : fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
    return zone;
  } catch {
    return "UTC";
  }
}
function localClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return { weekday: WEEKDAYS.indexOf(part("weekday")), minute: Number(part("hour")) * 60 + Number(part("minute")), day: `${part("year")}-${part("month")}-${part("day")}` };
}
function insideConsultationHours(start, end, timeZone) {
  if (start.getUTCSeconds() || start.getUTCMilliseconds()) return false;
  const from = localClock(start, timeZone), to = localClock(end, timeZone);
  return CONSULTATION_HOURS.weekdays.has(from.weekday) && from.day === to.day && from.minute % SLOT_STEP_MINUTES === 0 && from.minute >= CONSULTATION_HOURS.open && to.minute <= CONSULTATION_HOURS.close && to.minute > from.minute;
}
function withinHorizon(start, now) {
  return start.getTime() >= now + BOOKING_LEAD_MS && start.getTime() <= now + BOOKING_HORIZON_MS;
}
async function eligibleHosts(tx, firm) {
  const hosts = [];
  let after;
  for (let page = 0; page < 32; page++) {
    const memberships = await tx.firmMembership.findMany({
      where: { firmId: firm.id, status: "active", user: { status: "active" }, role: { firmId: firm.id, status: "active", canManageIntake: true }, OR: [{ primaryOfficeId: null }, { primaryOffice: { status: "active" } }], ...after ? { id: { gt: after } } : {} },
      orderBy: { id: "asc" },
      take: 100,
      select: { id: true, userId: true, primaryOfficeId: true, primaryOffice: { select: { status: true, timezone: true } } }
    });
    for (const membership of memberships) {
      const session = await loadActiveHumanSession(tx, membership.userId, firm.id);
      if (!session) continue;
      hosts.push({ userId: membership.userId, officeId: membership.primaryOfficeId ?? null, timezone: validTimezone(membership.primaryOffice?.timezone, validTimezone(firm.defaultTimezone)), session });
    }
    if (memberships.length < 100) return hosts;
    after = memberships[memberships.length - 1].id;
  }
  throw new Error("Consultation capacity could not be fully checked. Contact the firm.");
}
function requireConfiguredConsultationCalendar(admitted) {
  if (admitted.mode === "fixture") return;
  if (admitted.mode === "live" && admitted.policy?.status === "published" && admitted.policy.publicBookingEnabled) return;
  throw new Error("Online consultation scheduling is unavailable. Contact the firm.");
}
function busyWhere(firmId, hostId, start, end) {
  return { firmId, hostId, status: { in: ["requested", "scheduled"] }, startsAt: { lt: end }, endsAt: { gt: start } };
}
async function consultationAvailability(_root, args, context) {
  return runSerializableTransaction(context.prisma, async (tx) => {
    await account(tx, context);
    const admitted = await publicFirm(tx, "booking");
    if (!admitted) throw new Error("Consultation booking is unavailable.");
    const { firm } = admitted;
    requireConfiguredConsultationCalendar(admitted);
    const service = await tx.practiceArea.findFirst({ where: { id: args.serviceId, firmId: firm.id, status: "active", isPublic: true } });
    if (!service) throw new Error("Service is unavailable.");
    const timezone2 = validTimezone(firm.defaultTimezone);
    const now = Date.now();
    const hosts = await eligibleHosts(tx, firm);
    const busy = /* @__PURE__ */ new Map();
    for (const host of hosts) {
      const intervals = [];
      let after;
      let complete = false;
      for (let page = 0; page < 64; page++) {
        const rows = await tx.consultation.findMany({ where: { ...busyWhere(firm.id, host.userId, new Date(now), new Date(now + BOOKING_HORIZON_MS + 864e5)), ...after ? { id: { gt: after } } : {} }, select: { id: true, startsAt: true, endsAt: true }, orderBy: { id: "asc" }, take: 256 });
        intervals.push(...rows.map((row) => ({ start: row.startsAt.getTime(), end: row.endsAt.getTime() })));
        if (rows.length < 256) {
          complete = true;
          break;
        }
        after = rows[rows.length - 1].id;
      }
      if (!complete) throw new Error("Consultation capacity could not be fully checked. Contact the firm.");
      busy.set(host.userId, intervals);
    }
    const slots = [];
    const first = Math.ceil((now + BOOKING_LEAD_MS) / CANDIDATE_STEP_MS) * CANDIDATE_STEP_MS;
    for (let at = first; at <= now + BOOKING_HORIZON_MS && slots.length < MAX_OFFERED_SLOTS; at += CANDIDATE_STEP_MS) {
      const start = new Date(at), end = new Date(at + service.consultationMinutes * 6e4);
      const open = hosts.some((host) => insideConsultationHours(start, end, host.timezone) && !(busy.get(host.userId) ?? []).some((interval) => interval.start < end.getTime() && interval.end > start.getTime()));
      if (open) slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    }
    return { timezone: timezone2, slots };
  });
}
function currentAcknowledgment({ mode, policy }) {
  const notice = mode === "fixture" ? FIXTURE_FIRST_CONTACT_NOTICE : String(policy.firstContactNotice).trim();
  return {
    version: firstContactVersion(mode, Number(policy?.firstContactNoticeVersion ?? 0)),
    noticeDigest: sha256Digest(notice),
    acknowledgmentDigest: sha256Digest(FIRST_CONTACT_ACKNOWLEDGMENT),
    privacyNoticeVersion: policy ? Number(policy.privacyNoticeVersion ?? 0) : null
  };
}
async function bookClientConsultation(_root, args, context) {
  if (!context.session?.itemId) throw new Error("Sign in to book a consultation.");
  if (!/^[a-f0-9-]{36}$/i.test(args.requestKey)) throw new Error("Invalid consultation request.");
  let firstContact;
  try {
    firstContact = validateFirstContact(args);
  } catch (error) {
    if (error instanceof FirstContactValidationError) throw new Error(error.message);
    throw error;
  }
  const { summary } = firstContact;
  const start = new Date(args.startsAt);
  if (!Number.isFinite(start.getTime())) throw new Error("Select an available time.");
  return runSerializableTransaction(context.prisma, async (tx) => {
    const user = await account(tx, context);
    const firm = await servicingFirm(tx);
    if (!firm) throw new Error("Consultation servicing is unavailable.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-request:${firm.id}:${args.requestKey}`}))`;
    const fingerprint = sha256Digest({ accountId: user.id, serviceId: args.serviceId, startsAt: start.toISOString(), ...firstContact, acknowledgmentVersion: args.acknowledgmentVersion });
    const prior = await tx.consultation.findUnique({ where: { firmId_requestKey: { firmId: firm.id, requestKey: args.requestKey } } });
    if (prior) {
      if (prior.accountId !== user.id || prior.requestDigest !== fingerprint) throw new Error("Request reference is unavailable for this account or has changed.");
      return dto(prior);
    }
    const admitted = await publicFirm(tx, "booking");
    if (!admitted || admitted.firm.id !== firm.id) throw new Error("Consultation booking is unavailable.");
    const { mode } = admitted;
    requireConfiguredConsultationCalendar(admitted);
    const acknowledgment = currentAcknowledgment(admitted);
    if (args.acknowledgmentVersion !== acknowledgment.version) throw new Error("The first-contact notice has changed. Review it and submit again.");
    const service = await tx.practiceArea.findFirst({ where: { id: args.serviceId, firmId: firm.id, status: "active", isPublic: true } });
    if (!service) throw new Error("Service is unavailable.");
    const end = new Date(start.getTime() + service.consultationMinutes * 6e4);
    if (!withinHorizon(start, Date.now())) throw new Error("Select an available time within the next fourteen days.");
    const hosts = await eligibleHosts(tx, firm);
    if (!hosts.length) throw new Error("No consultation host is available.");
    let receiver = null;
    let insideHours = false;
    for (const host of hosts) {
      if (!insideConsultationHours(start, end, host.timezone)) continue;
      insideHours = true;
      await assertCurrentCommandActor(tx, context.withSession(host.session), "canManageIntake");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-host:${firm.id}:${host.userId}`}))`;
      if (!await tx.consultation.count({ where: busyWhere(firm.id, host.userId, start, end) })) {
        receiver = host;
        break;
      }
    }
    if (!insideHours) throw new Error("Select an available time.");
    if (!receiver) throw new Error("This time is no longer available. Choose another time.");
    const suffix = (0, import_node_crypto16.randomUUID)().slice(0, 8).toUpperCase();
    const contact = await tx.contact.create({ data: { firmId: firm.id, firstName: user.name, lastName: "", contactType: "person", status: "prospective_client", primaryEmail: user.email, conflictSearchAliases: [] } });
    const intake = await tx.intake.create({ data: { firmId: firm.id, intakeNumber: `INT-${suffix}`, title: `${service.name} consultation`, status: "new", source: "website", primaryContactId: contact.id, openedById: receiver.userId, assignedToId: receiver.userId, officeId: receiver.officeId, summary, adversePartySummary: firstContact.opposingParties } });
    await tx.intakeParticipant.create({ data: { firmId: firm.id, intakeId: intake.id, contactId: contact.id, participantRole: "prospective_client", status: "active" } });
    const acceptedAt = /* @__PURE__ */ new Date();
    const snapshot = { version: 2, serviceId: service.id, title: service.name, description: service.description, minutes: service.consultationMinutes, feeMinor: service.consultationFeeMinor, currencyCode: firm.defaultCurrency, isLocalFixture: mode === "fixture", relationship: "none", acknowledgmentVersion: acknowledgment.version };
    await tx.intakeSubmission.create({ data: { firmId: firm.id, intakeId: intake.id, submittedByContactId: contact.id, status: "submitted", schemaVersion: "consultation-v2", formSchema: { fields: ["service", "startsAt", "jurisdiction", "opposingParties", "keyDeadline", "summary", "acknowledgment"] }, responses: { service: snapshot, startsAt: start.toISOString(), jurisdiction: firstContact.jurisdiction, opposingParties: firstContact.opposingParties, keyDeadline: firstContact.keyDeadline || null, summary, acknowledgment: { ...acknowledgment, acceptedAt: acceptedAt.toISOString() } }, submittedAt: acceptedAt } });
    const check = await tx.conflictCheck.create({ data: { firmId: firm.id, intakeId: intake.id, checkNumber: `CHK-${suffix}`, status: "requested", requestedById: receiver.userId, searchScope: "contacts_and_matters", searchVersion: "v1" } });
    await tx.conflictSearchTerm.create({ data: { firmId: firm.id, checkId: check.id, term: user.name, normalizedTerm: user.name.toLowerCase(), termType: "person", sourceContactId: contact.id } });
    if (hasNamedOpposingParty(firstContact.opposingParties)) {
      await tx.conflictSearchTerm.create({ data: { firmId: firm.id, checkId: check.id, term: firstContact.opposingParties, normalizedTerm: firstContact.opposingParties.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim(), termType: "other", includeAliases: false } });
    }
    const row = await tx.consultation.create({ data: { firmId: firm.id, intakeId: intake.id, accountId: user.id, requestKey: args.requestKey, requestDigest: fingerprint, serviceTitle: service.name, serviceSnapshot: snapshot, feeMinor: service.consultationFeeMinor, currencyCode: firm.defaultCurrency, startsAt: start, endsAt: end, status: "requested", timezone: receiver.timezone, hostId: receiver.userId, officeId: receiver.officeId, participants: { connect: { id: contact.id } } } });
    await recordAuditEvent(tx, { firmId: firm.id, actorUserId: user.id, actorType: "customer", eventType: "consultation.requested", category: "legal_workflow", intakeId: intake.id, metadata: { consultationId: row.id, requestDigest: fingerprint, isLocalFixture: mode === "fixture", acknowledgmentVersion: acknowledgment.version } });
    return dto(row);
  });
}
async function customerConsultationPage(_root, args, context) {
  return runSerializableTransaction(context.prisma, async (tx) => {
    const user = await account(tx, context);
    const firm = await servicingFirm(tx);
    if (!firm) throw new Error("Appointment history is temporarily unavailable.");
    const after = decodeCursor(args.cursor, ["a", "c", "i"]);
    if (after && after.a !== user.id) throw new Error("This page is unavailable. Start again from the first page.");
    const keyset = after ? { OR: [{ createdAt: { lt: new Date(after.c) } }, { createdAt: new Date(after.c), id: { gt: after.i } }] } : {};
    const rows = await tx.consultation.findMany({
      where: { AND: [{ accountId: user.id, firmId: firm.id }, keyset] },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: HISTORY_PAGE_SIZE + 1
    });
    const page = rows.slice(0, HISTORY_PAGE_SIZE);
    const last = page.at(-1);
    return { appointments: page.map(dto), nextCursor: rows.length > HISTORY_PAGE_SIZE && last ? encodeCursor({ a: user.id, c: last.createdAt.toISOString(), i: last.id }) : null };
  });
}
async function customerConsultations(root, _args, context) {
  return (await customerConsultationPage(root, {}, context)).appointments;
}
async function customerConsultation(_root, args, context) {
  return runSerializableTransaction(context.prisma, async (tx) => {
    const user = await account(tx, context);
    const firm = await servicingFirm(tx);
    if (!firm) throw new Error("Appointment history is temporarily unavailable.");
    const row = await tx.consultation.findFirst({ where: { id: args.id, accountId: user.id, firmId: firm.id } });
    return row ? dto(row) : null;
  });
}

// features/keystone/mutations/index.ts
var graphql3 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql3`
      input TrustLedgerPostingEntryInput {
        ledgerAccountId: ID
        accountingBucket: String!
        direction: String!
        amountMinor: Int!
        currencyCode: String
        memo: String
      }

      input TrustTransactionPostingInput {
        idempotencyKey: String!
        trustAccountId: ID!
        transactionType: String!
        currencyCode: String!
        occurredAt: DateTime!
        description: String!
        reversesTransactionId: ID
        sourcePaymentId: ID
        sourceRefundId: ID
        entries: [TrustLedgerPostingEntryInput!]!
      }

      enum ConflictCheckCommandTarget { running review_required failed cancelled }
      enum InvoiceCommandTarget { approved issued overdue void }
      enum DocumentCommandTarget { active archived }

      type ControlledRecordProjection {
        id: ID!
        status: String!
      }

      type ConflictEvidenceProjection {
        id: ID!
      }

      type TrustTransactionProjection {
        id: ID!
        transactionNumber: String!
        status: String!
        occurredAt: DateTime!
      }

      type CredentialProjection {
        id: ID!
        name: String!
        prefix: String
        status: String!
        expiresAt: DateTime
      }

      type OAuthClientProjection {
        id: ID!
        name: String!
        clientId: String!
        status: String!
      }

      type MatterProjection {
        id: ID!
        matterNumber: String!
        title: String!
        status: String!
      }

      type IntakeProjection {
        id: ID!
        intakeNumber: String!
        title: String!
        status: String!
      }

      type InvoiceProjection {
        id: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        totalMinor: Int!
        balanceDueMinor: Int!
        dueAt: DateTime
      }

      type PaymentProjection {
        id: ID!
        paymentNumber: String!
        status: String!
        currencyCode: String!
        amountMinor: Int!
        refundedMinor: Int!
      }

      type PaymentAllocationProjection {
        id: ID!
        allocationType: String!
        currencyCode: String!
        amountMinor: Int!
      }

      type RefundProjection {
        id: ID!
        refundNumber: String!
        status: String!
        currencyCode: String!
        amountMinor: Int!
      }

      type PortalAccountProjection {
        id: ID!
        email: String!
        status: String!
      }

      type PortalMatterAccessProjection {
        id: ID!
        status: String!
        version: Int!
        policyRevision: Int!
        canReadDocuments: Boolean!
        canUploadDocuments: Boolean!
        canReadInvoices: Boolean!
        canReadMessages: Boolean!
        expiresAt: DateTime
      }

      type PortalDiscoveryPolicyProjection {
        revision: Int!
        mode: String!
        admission: String!
        statuses: [String!]!
      }
      type PortalDirectoryMatter { id: ID! matterNumber: String! status: String! }
      type PortalDirectoryAccount { id: ID! contactId: ID! }
      type PortalIntentHistory { id: ID! operation: String! policyRevision: Int! resultVersion: Int! completedAt: DateTime! }
      type PortalPolicyWorkspace {
        state: String! policy: PortalDiscoveryPolicyProjection policyHistory: [PortalDiscoveryPolicyProjection!]!
        latestRevision: Int! latestChoice: String! latestAdmission: String!
        canConfigure: Boolean! canManage: Boolean!
        total: Int! page: Int! hasNext: Boolean!
        items: [PortalDirectoryMatter!]! accounts: [PortalDirectoryAccount!]! selection: PortalDirectoryMatter
        grants: [PortalMatterAccessProjection!]! history: [PortalIntentHistory!]!
      }
      input PortalGrantCommandInput {
        operation: String! idempotencyKey: String! policyRevision: Int! expectedVersion: Int!
        portalAccountId: ID! contactId: ID! matterId: ID! grantId: ID
        canReadDocuments: Boolean canUploadDocuments: Boolean canReadInvoices: Boolean canReadMessages: Boolean
        expiresAt: DateTime reason: String!
      }
      type PortalGrantCommandResult { grant: PortalMatterAccessProjection! replayed: Boolean! intentId: ID! }

      type PortalShareProjection {
        id: ID!
        status: String!
        resourceType: String!
        expiresAt: DateTime
      }

      type DecisionProjection {
        id: ID!
        outcome: String!
      }

      type EvidenceProjection {
        id: ID!
        eventType: String
        actionType: String
        occurredAt: DateTime!
      }

      type TrustPostingResult {
        transaction: TrustTransactionProjection!
        replayed: Boolean!
      }

      input AgentActionRequestInput {
        idempotencyKey: String!
        agentPrincipalId: ID!
        grantId: ID!
        matterId: ID
        actionType: String!
        requestEnvelope: JSON
        contactId: ID
        intakeId: ID
        documentId: ID
        invoiceId: ID
        paymentId: ID
        trustTransactionId: ID
        deadlineId: ID
        taskId: ID
      }

      type AgentActionRequestResult {
        action: ControlledRecordProjection!
        replayed: Boolean!
      }

      type AgentActionReviewResult {
        action: ControlledRecordProjection!
        replayed: Boolean!
      }

      type IssuedApiKey {
        credential: CredentialProjection!
        secret: String!
      }

      type ApiKeyRevocationResult {
        credential: CredentialProjection!
        replayed: Boolean!
      }

      type IssuedOAuthClient {
        client: OAuthClientProjection!
        clientSecret: String!
      }

      type OAuthClientRevocationResult {
        client: OAuthClientProjection!
        replayed: Boolean!
      }

      type IssuedAgentCredential {
        credential: CredentialProjection!
        secret: String!
      }

      type AgentCredentialRevocationResult {
        credential: CredentialProjection!
        replayed: Boolean!
      }

      type ConflictCheckFinalizationResult {
        check: ControlledRecordProjection!
        replayed: Boolean!
      }

      type EthicalWallTransitionResult {
        wall: ControlledRecordProjection!
        replayed: Boolean!
      }

      type MatterTransitionResult {
        matter: MatterProjection!
        event: EvidenceProjection
        replayed: Boolean!
      }

      type IntakeTransitionResult {
        intake: IntakeProjection!
        replayed: Boolean!
      }

      type MatterConversionResult {
        matter: MatterProjection!
        replayed: Boolean!
      }

      type DeadlineTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type LegalTaskTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type TimeEntryTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type ExpenseTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type DraftInvoiceAssemblyResult {
        invoice: InvoiceProjection!
        replayed: Boolean!
      }

      type InvoiceTransitionResult {
        invoice: InvoiceProjection!
        replayed: Boolean!
      }

      type PaymentTransitionResult {
        payment: PaymentProjection!
        replayed: Boolean!
      }

      type PaymentAllocationResult {
        allocation: PaymentAllocationProjection!
        replayed: Boolean!
      }

      type RefundResult {
        refund: RefundProjection!
        replayed: Boolean!
      }

      type PortalInvitationResult {
        account: PortalAccountProjection!
        inviteToken: String!
      }

      type PortalAcceptanceResult {
        account: PortalAccountProjection!
        sessionToken: String!
        expiresAt: DateTime!
      }

      type PortalRevocationResult {
        id: ID!
        status: String!
        replayed: Boolean!
      }

      type RetentionHoldPlacementResult {
        hold: ControlledRecordProjection!
        action: EvidenceProjection!
      }

      type RetentionHoldReleaseResult {
        hold: ControlledRecordProjection!
        replayed: Boolean!
      }

      type RetentionDisposalResult {
        document: ControlledRecordProjection!
        action: EvidenceProjection
        replayed: Boolean!
      }

      type IntegrationTransitionResult {
        connection: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationDeliveryTransitionResult {
        delivery: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationMessageQueueResult {
        message: ControlledRecordProjection!
        replayed: Boolean!
      }

      type SignatureSignerSetupResult {
        id: ID!
        status: String!
      }

      type SignatureTransitionResult {
        request: ControlledRecordProjection!
        signer: ControlledRecordProjection
        event: EvidenceProjection!
        replayed: Boolean!
      }

      type AgentGrantAuthorityResult {
        grant: ControlledRecordProjection!
        authorityDigest: String!
      }

      type DocumentTransitionResult {
        document: ControlledRecordProjection!
        replayed: Boolean!
      }

      enum DocumentVersionIngestSource { upload generated import }
      enum CommunicationParticipantRole { staff client external_counsel third_party }

      type DocumentVersionProjection {
        id: ID!
        versionNumber: Int!
      }

      type DocumentVersionIngestResult {
        version: DocumentVersionProjection!
        document: ControlledRecordProjection!
        replayed: Boolean!
      }

      type SignatureRequestPreparationResult {
        request: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationParticipantResult {
        participant: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationDeliveryPreparationResult {
        message: ControlledRecordProjection!
        deliveries: [ControlledRecordProjection!]!
        replayed: Boolean!
      }

      type IntakeStartProjection {
        id: ID!
        intakeNumber: String!
        status: String!
      }

      type ConflictCheckStartProjection {
        id: ID!
        checkNumber: String!
        status: String!
      }

      type ClientIntakeStartResult {
        intake: IntakeStartProjection!
        contact: ConflictEvidenceProjection!
        conflictCheck: ConflictCheckStartProjection!
      }

      type StaffInvitationResult {
        membership: ControlledRecordProjection!
        userId: ID!
        email: String!
      }

      type PartyChangeResult {
        id: ID!
        status: String!
        conflictCheckId: ID
      }

      type FirmRoleAuthorityResult {
        roleId: ID!
        name: String!
        status: String!
        changedPermissions: [String!]!
        affectedMemberships: Int!
      }

      type FirmOnboardingResult {
        firm: ControlledRecordProjection!
        office: ControlledRecordProjection
        membership: ControlledRecordProjection!
        role: ControlledRecordProjection!
        replayed: Boolean!
        demoScenario: SyntheticDemoScenarioResult
      }

      type SyntheticDemoScenarioResult {
        firmId: ID!
        contactId: ID!
        matterId: ID!
        conflictCheckId: ID!
        invoiceId: ID!
        paymentId: ID!
      }

      input ContactImportRowInput {
        sourceId: String
        contactType: String
        firstName: String
        lastName: String
        organizationName: String
        email: String
        phone: String
        status: String
      }

      type ContactImportNormalizedRow {
        sourceId: String!
        contactType: String!
        firstName: String!
        lastName: String!
        organizationName: String!
        email: String!
        phone: String!
        status: String!
      }

      type ContactImportPreviewRow {
        rowNumber: Int!
        valid: Boolean!
        errors: [String!]!
        normalized: ContactImportNormalizedRow!
      }

      type ContactImportPreview {
        valid: Boolean!
        rowCount: Int!
        errorCount: Int!
        digest: String!
        rows: [ContactImportPreviewRow!]!
      }

      type ContactImportResult {
        importedCount: Int!
        contactIds: [ID!]!
        replayed: Boolean!
      }

      type ContactExportRow {
        id: ID!
        contactType: String!
        status: String!
        firstName: String!
        lastName: String!
        organizationName: String!
        primaryEmail: String!
        primaryPhone: String!
        updatedAt: DateTime!
      }

      type MatterExportRow {
        id: ID!
        matterNumber: String!
        title: String!
        status: String!
        confidentiality: String!
        clientId: ID!
        officeId: ID
        practiceAreaId: ID
        responsibleAttorneyId: ID
        openedAt: DateTime
        closedAt: DateTime
        updatedAt: DateTime!
      }

      type TimeEntryExportRow {
        id: ID!
        matterId: ID!
        userId: ID!
        status: String!
        workDate: DateTime!
        durationMinutes: Int!
        description: String!
        isBillable: Boolean!
        rateMinor: Int
        amountMinor: Int!
        currencyCode: String!
      }

      type InvoiceExportRow {
        id: ID!
        matterId: ID!
        clientId: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        subtotalMinor: Int!
        discountMinor: Int!
        taxMinor: Int!
        totalMinor: Int!
        paidMinor: Int!
        balanceDueMinor: Int!
        issuedAt: DateTime
        dueAt: DateTime
        updatedAt: DateTime!
      }

      type AuditExportRow {
        eventId: String!
        eventType: String!
        category: String!
        outcome: String!
        actorType: String!
        matterId: ID
        occurredAt: DateTime!
      }

      type PracticeExportResult {
        scope: String!
        rowCount: Int!
        digest: String!
        contacts: [ContactExportRow!]!
        matters: [MatterExportRow!]!
        timeEntries: [TimeEntryExportRow!]!
        invoices: [InvoiceExportRow!]!
        auditEvents: [AuditExportRow!]!
        replayed: Boolean!
      }

      type PortalSharedDocument {
        id: ID!
        title: String!
        category: String!
        status: String!
        updatedAt: DateTime!
      }

      type PortalSharedDocumentVersion {
        id: ID!
        versionNumber: Int!
        fileName: String!
        mediaType: String!
        byteSize: Int!
        checksumSha256: String!
        createdAt: DateTime!
      }

      type PortalSharedInvoice {
        id: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        totalMinor: Int!
        paidMinor: Int!
        balanceDueMinor: Int!
        issuedAt: DateTime
        dueAt: DateTime
      }

      type PortalSharedCommunicationThread {
        id: ID!
        subject: String!
        primaryChannel: String!
        status: String!
        lastMessageAt: DateTime
      }

      type PortalSharedResource {
        resourceType: String!
        document: PortalSharedDocument
        documentVersion: PortalSharedDocumentVersion
        invoice: PortalSharedInvoice
        communicationThread: PortalSharedCommunicationThread
      }

      type PracticeOverviewMetric {
        key: String!
        label: String!
        value: Int!
        href: String!
      }

      type PracticeOverviewQueueItem {
        id: ID!
        kind: String!
        title: String!
        subtitle: String!
        status: String!
        at: DateTime
        href: String!
        canAct: Boolean!
      }

      type PracticeOverview {
        firmId: ID!
        firmName: String!
        generatedAt: DateTime!
        metrics: [PracticeOverviewMetric!]!
        intakeQueue: [PracticeOverviewQueueItem!]!
        matterQueue: [PracticeOverviewQueueItem!]!
        workQueue: [PracticeOverviewQueueItem!]!
        billingQueue: [PracticeOverviewQueueItem!]!
        governanceQueue: [PracticeOverviewQueueItem!]!
      }

      type PracticeWorkspaceSection {
        key: String!
        title: String!
        description: String!
        total: Int!
        items: [PracticeOverviewQueueItem!]!
      }

      type PracticeWorkspace {
        category: String!
        generatedAt: DateTime!
        metrics: [PracticeOverviewMetric!]!
        sections: [PracticeWorkspaceSection!]!
        notices: [String!]!
      }

      type ConsultationService { id: ID!, code: String!, publicSlug: String!, name: String!, description: String!, consultationFeeMinor: Int!, consultationMinutes: Int!, currencyCode: String! }
      type ConsultationCatalogPage { services: [ConsultationService!]!, nextCursor: String }
      type ConsultationSlot { startsAt: String!, endsAt: String! }
      type ConsultationAvailability { timezone: String!, slots: [ConsultationSlot!]! }
      type CustomerConsultation { id: ID!, serviceTitle: String!, feeMinor: Int!, currencyCode: String!, status: String!, startsAt: String, endsAt: String, timezone: String! }
      type CustomerConsultationPage { appointments: [CustomerConsultation!]!, nextCursor: String }
      type CustomerAccountRegistration { id: ID! }
      type Query {
        consultationCatalog: [ConsultationService!]!
        consultationCatalogPage(cursor: String): ConsultationCatalogPage!
        consultationService(slug: String, id: ID): ConsultationService
        consultationAvailability(serviceId: ID!): ConsultationAvailability!
        customerConsultations: [CustomerConsultation!]!
        customerConsultationPage(cursor: String): CustomerConsultationPage!
        customerConsultation(id: ID!): CustomerConsultation
        redirectToInit: Boolean
        viewerCanAccessDashboard: Boolean!
        viewerCanRunConflictChecks: Boolean!
        viewerCanResolveConflicts: Boolean!
        viewerNeedsFirmOnboarding: Boolean!
        viewerCanSeedSyntheticDemo: Boolean!
        practiceOverview: PracticeOverview!
        practiceWorkspace(category: String!): PracticeWorkspace!
        previewContactImport(rows: [ContactImportRowInput!]!): ContactImportPreview!
        portalSharedResource(sessionToken: String!, shareId: ID!): PortalSharedResource!
        portalPolicyWorkspace(search: String, status: String, page: Int, matterId: ID, portalAccountId: ID): PortalPolicyWorkspace!
      }

      type Mutation {
        registerConsultationAccount(name: String!, email: String!, password: String!): CustomerAccountRegistration!
        bookClientConsultation(serviceId: ID!, startsAt: String!, requestKey: String!, summary: String, jurisdiction: String!, opposingParties: String!, keyDeadline: String, acknowledgmentVersion: String!): CustomerConsultation!
        setTrustAccountBankIdentity(
          trustAccountId: ID!
          financialInstitutionName: String!
          bankAccountLastFour: String!
          accountType: String!
          officeId: ID
          externalAccountReference: String
          reason: String!
        ): ControlledRecordProjection!
        prepareTrustReconciliation(
          trustAccountId: ID!
          periodStart: DateTime!
          periodEnd: DateTime!
          statementBalanceMinor: Int!
          bookBalanceMinor: Int!
          currencyCode: String!
          notes: String
        ): ControlledRecordProjection!
        transitionTrustAccount(
          trustAccountId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionTrustLedgerAccount(
          ledgerAccountId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionTrustReconciliation(
          reconciliationId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        reviseTrustReconciliation(
          reconciliationId: ID!
          expectedUpdatedAt: DateTime!
          statementBalanceMinor: Int!
          bookBalanceMinor: Int!
          notes: String
          reason: String!
        ): ControlledRecordProjection!
        postTrustTransaction(data: TrustTransactionPostingInput!): TrustPostingResult!
        requestAgentAction(data: AgentActionRequestInput!): AgentActionRequestResult!
        reviewAgentAction(
          actionId: ID!
          decision: String!
          reason: String
          approvalExpiresAt: DateTime
        ): AgentActionReviewResult!
        executeAgentAction(actionId: ID!): AgentActionRequestResult!
        transitionAgentPrincipal(principalId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        updateAgentGrantAuthority(
          grantId: ID!
          toStatus: String!
          capabilities: [String!]
          reason: String!
          startsAt: DateTime
          expiresAt: DateTime
        ): AgentGrantAuthorityResult!
        issueApiKey(
          name: String!
          scopes: [String!]!
          ownerId: ID
          expiresAt: DateTime
        ): IssuedApiKey!
        revokeApiKey(id: ID!, reason: String!): ApiKeyRevocationResult!
        issueOAuthClient(
          name: String!
          redirectUris: [String!]!
          scopes: [String!]!
          description: String
        ): IssuedOAuthClient!
        revokeOAuthClient(id: ID!, reason: String!): OAuthClientRevocationResult!
        issueAgentCredential(
          agentPrincipalId: ID!
          name: String!
          capabilities: [String!]!
          expiresAt: DateTime
        ): IssuedAgentCredential!
        revokeAgentCredential(id: ID!, reason: String!): AgentCredentialRevocationResult!

        setMatterTeamAccess(
          matterId: ID!
          userId: ID!
          teamRole: String!
          status: String!
          canAccessRestricted: Boolean
          canEdit: Boolean
          canBill: Boolean
          reason: String!
        ): ControlledRecordProjection!
        setEthicalWallMember(
          wallId: ID!
          userId: ID!
          decision: String!
          status: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionEthicalWall(
          wallId: ID!
          toStatus: String!
          reason: String!
        ): EthicalWallTransitionResult!

        requestConflictCheck(
          checkNumber: String!
          intakeId: ID
          matterId: ID
          initialTerm: String!
          termType: String!
        ): ControlledRecordProjection!
        addConflictSearchTerm(
          checkId: ID!
          term: String!
          normalizedTerm: String!
          termType: String!
          sourceContactId: ID
          includeAliases: Boolean
        ): ConflictEvidenceProjection!
        addConflictMatch(
          checkId: ID!
          matchType: String!
          matchedContactId: ID
          matchedMatterId: ID
          matchedMatterPartyId: ID
          score: Int
        ): ConflictEvidenceProjection!
        transitionConflictCheck(
          checkId: ID!
          toStatus: ConflictCheckCommandTarget!
          summary: String
        ): ConflictCheckFinalizationResult!
        recordConflictDisposition(
          checkId: ID!
          matchId: ID
          outcome: String!
          rationale: String!
          conditions: String
          policyReference: String
        ): DecisionProjection!
        finalizeConflictCheck(
          checkId: ID!
          outcome: String!
          summary: String!
        ): ConflictCheckFinalizationResult!
        transitionMatter(
          matterId: ID!
          toStatus: String!
          reason: String
        ): MatterTransitionResult!
        changeMatterConfidentiality(
          matterId: ID!
          confidentiality: String!
          reason: String!
        ): MatterTransitionResult!
        transitionIntake(
          intakeId: ID!
          toStatus: String!
          reason: String
        ): IntakeTransitionResult!
        convertIntakeToMatter(
          intakeId: ID!
          matterNumber: String!
          title: String!
          responsibleAttorneyId: ID!
          officeId: ID
          practiceAreaId: ID
          reason: String!
        ): MatterConversionResult!
        reviseDraftDeadline(
          deadlineId: ID!
          title: String
          dueAt: DateTime
          timezone: String
          reason: String!
        ): ControlledRecordProjection!
        transitionDeadline(
          deadlineId: ID!
          toStatus: String!
          reason: String
        ): DeadlineTransitionResult!
        transitionLegalTask(
          taskId: ID!
          toStatus: String!
          reason: String
        ): LegalTaskTransitionResult!
        transitionTimeEntry(
          timeEntryId: ID!
          toStatus: String!
          reason: String
        ): TimeEntryTransitionResult!
        transitionExpense(
          expenseId: ID!
          toStatus: String!
          reason: String
        ): ExpenseTransitionResult!
        assembleDraftInvoice(
          idempotencyKey: String!
          invoiceNumber: String!
          matterId: ID!
          clientId: ID!
          timeEntryIds: [ID!]
          expenseIds: [ID!]
          retainerId: ID
        ): DraftInvoiceAssemblyResult!

        transitionInvoice(
          invoiceId: ID!
          toStatus: InvoiceCommandTarget!
          reason: String
          dueAt: DateTime
        ): InvoiceTransitionResult!
        transitionPayment(
          paymentId: ID!
          toStatus: String!
          eventId: String!
          providerPaymentId: String
          failureReason: String
        ): PaymentTransitionResult!
        recordManualPayment(
          idempotencyKey: String!
          payerId: ID!
          invoiceId: ID
          amountMinor: Int!
          currencyCode: String!
          method: String!
          receivedAt: DateTime!
          reference: String
        ): PaymentTransitionResult!
        allocatePayment(
          paymentId: ID!
          invoiceId: ID!
          amountMinor: Int!
          idempotencyKey: String!
          note: String
        ): PaymentAllocationResult!
        reversePaymentAllocation(
          allocationId: ID!
          idempotencyKey: String!
          reason: String!
        ): PaymentAllocationResult!
        requestRefund(
          paymentId: ID!
          amountMinor: Int!
          reason: String!
          explanation: String!
          idempotencyKey: String!
        ): RefundResult!
        reviewRefund(
          refundId: ID!
          decision: String!
          reason: String!
        ): RefundResult!
        recordRefundProviderOutcome(
          refundId: ID!
          toStatus: String!
          eventId: String!
          providerRefundId: String
          failureReason: String
        ): RefundResult!

        recordPortalDiscoveryPolicy(expectedRevision: Int!, mode: String!, statuses: [String!]!, reason: String!): PortalDiscoveryPolicyProjection!
        executePortalGrant(data: PortalGrantCommandInput!): PortalGrantCommandResult!
        invitePortalAccount(
          contactId: ID!
          email: String!
          expiresAt: DateTime
        ): PortalInvitationResult!
        acceptPortalInvitation(inviteToken: String!): PortalAcceptanceResult!
        grantPortalMatterAccess(
          idempotencyKey: String!
          policyRevision: Int!
          expectedVersion: Int!
          contactId: ID!
          grantId: ID
          reason: String!
          portalAccountId: ID!
          matterId: ID!
          canReadDocuments: Boolean
          canUploadDocuments: Boolean
          canReadInvoices: Boolean
          canReadMessages: Boolean
          expiresAt: DateTime
        ): PortalMatterAccessProjection!
        sharePortalResource(
          portalMatterAccessId: ID!
          resourceType: String!
          resourceId: ID!
          expiresAt: DateTime
        ): PortalShareProjection!
        revokePortalGrant(
          id: ID!
          grantType: String!
          reason: String!
          idempotencyKey: String
          policyRevision: Int
          expectedVersion: Int
          contactId: ID
          portalAccountId: ID
          matterId: ID
        ): PortalRevocationResult!

        transitionRetentionPolicy(policyId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        assignDocumentRetentionPolicy(documentId: ID!, policyId: ID!, reason: String!): ControlledRecordProjection!
        placeRetentionHold(
          policyId: ID
          matterId: ID
          documentId: ID
          contactId: ID
          name: String!
          reason: String!
          authorityReference: String
        ): RetentionHoldPlacementResult!
        releaseRetentionHold(holdId: ID!, reason: String!): RetentionHoldReleaseResult!
        disposeRetainedDocument(
          documentId: ID!
          reason: String!
          confirmation: String!
        ): RetentionDisposalResult!

        rotateIntegrationCredential(
          connectionId: ID!
          credentialType: String!
          secret: String!
        ): ControlledRecordProjection!
        transitionIntegrationConnection(
          connectionId: ID!
          toStatus: String!
          reason: String!
        ): IntegrationTransitionResult!
        enqueueWebhookDelivery(
          connectionId: ID!
          subscriptionId: ID!
          eventId: String!
          eventType: String!
          matterId: ID
          payload: JSON
        ): ControlledRecordProjection!
        queueCommunicationMessage(
          messageId: ID!
          reason: String!
        ): CommunicationMessageQueueResult!
        transitionCommunicationDelivery(
          deliveryId: ID!
          toStatus: String!
          providerEventId: String!
          providerMessageId: String
          errorCode: String
          errorMessage: String
        ): CommunicationDeliveryTransitionResult!
        transitionDocument(
          documentId: ID!
          toStatus: DocumentCommandTarget!
          reason: String!
        ): DocumentTransitionResult!
        addDocumentSigner(
          requestId: ID!
          contactId: ID
          portalAccountId: ID
          name: String!
          email: String!
          signingOrder: Int
          providerSignerId: String
        ): SignatureSignerSetupResult!
        transitionDocumentSigner(
          signerId: ID!
          toStatus: String!
          providerEventId: String!
          evidenceDigest: String!
        ): SignatureTransitionResult!
        transitionSignatureRequest(
          requestId: ID!
          toStatus: String!
          providerEventId: String!
          actorReference: String
          evidenceDigest: String!
        ): SignatureTransitionResult!
        ingestDocumentVersion(
          documentId: ID!
          idempotencyKey: String!
          fileName: String!
          objectKey: String!
          mediaType: String!
          byteSize: Int!
          checksumSha256: String!
          source: DocumentVersionIngestSource
          sourceMessageId: ID
          notes: String
          makeCurrent: Boolean
        ): DocumentVersionIngestResult!
        setDocumentCurrentVersion(
          documentId: ID!
          versionId: ID!
          reason: String!
        ): DocumentTransitionResult!
        prepareSignatureRequest(
          documentVersionId: ID!
          idempotencyKey: String!
          title: String!
          message: String
          expiresAt: DateTime
          integrationConnectionId: ID
        ): SignatureRequestPreparationResult!
        rotateWebhookSigningSecret(
          subscriptionId: ID!
          secret: String!
        ): ControlledRecordProjection!
        addCommunicationParticipant(
          threadId: ID!
          participantRole: CommunicationParticipantRole!
          userId: ID
          contactId: ID
          portalAccountId: ID
          contactMethodId: ID
        ): CommunicationParticipantResult!
        removeCommunicationParticipant(
          participantId: ID!
          reason: String!
        ): CommunicationParticipantResult!
        prepareCommunicationDeliveries(
          messageId: ID!
          participantIds: [ID!]!
          integrationConnectionId: ID
          reason: String!
        ): CommunicationDeliveryPreparationResult!

        applyContactImport(
          connectionId: ID!
          idempotencyKey: String!
          rows: [ContactImportRowInput!]!
        ): ContactImportResult!
        preparePracticeExport(
          scope: String!
          idempotencyKey: String!
          limit: Int
        ): PracticeExportResult!

        startClientIntake(
          contactType: String!
          firstName: String
          lastName: String
          organizationName: String
          email: String
          phone: String
          title: String!
          source: String
          summary: String
          adversePartySummary: String
          officeId: ID
          practiceAreaId: ID
          assignedToId: ID
        ): ClientIntakeStartResult!

        inviteFirmMember(
          name: String!
          email: String!
          roleId: ID!
          officeId: ID
        ): StaffInvitationResult!
        changeFirmMemberAccess(
          membershipId: ID!
          roleId: ID
          officeId: ID
          changeOffice: Boolean!
          toStatus: String
          reason: String!
        ): ControlledRecordProjection!
        updateFirmRoleAuthority(
          roleId: ID!
          grantedPermissions: [String!]!
          status: String
          reason: String!
        ): FirmRoleAuthorityResult!
        scheduleConsultation(
          consultationId: ID!
          startsAt: DateTime!
          endsAt: DateTime!
          hostId: ID!
          officeId: ID
          location: String
          reason: String
        ): ControlledRecordProjection!
        transitionConsultation(
          consultationId: ID!
          toStatus: String!
          outcome: String
          reason: String
        ): ControlledRecordProjection!
        cancelOwnConsultation(consultationId: ID!, reason: String): ControlledRecordProjection!
        prepareRetainerAgreement(
          matterId: ID!
          clientId: ID!
          agreementNumber: String!
          feeStructure: String!
          currencyCode: String!
          rateCardId: ID
          trustLedgerAccountId: ID
          initialRetainerMinor: Int
          evergreenThresholdMinor: Int
          replenishmentAmountMinor: Int
          contingencyBasisPoints: Int
          termsSummary: String
        ): ControlledRecordProjection!
        transitionRetainerAgreement(
          retainerId: ID!
          toStatus: String!
          signedDocumentVersionId: ID
          effectiveAt: DateTime
          reason: String
        ): ControlledRecordProjection!
        recordDocketEntry(
          docketId: ID!
          title: String!
          entryType: String!
          occurredAt: DateTime!
          filedAt: DateTime
          enteredAt: DateTime
          description: String
          externalEntryId: String
          sourceUrl: String
          documentVersionId: ID
        ): ControlledRecordProjection!
        reviseDocketEntry(
          entryId: ID!
          title: String!
          entryType: String!
          occurredAt: DateTime!
          filedAt: DateTime
          enteredAt: DateTime
          description: String
          externalEntryId: String
          sourceUrl: String
          documentVersionId: ID
        ): ControlledRecordProjection!
        verifyDocketEntry(entryId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        addIntakeParticipant(intakeId: ID!, contactId: ID!, participantRole: String!, notes: String): PartyChangeResult!
        changeIntakeParticipant(participantId: ID!, participantRole: String, notes: String, remove: Boolean, reason: String!): PartyChangeResult!
        addMatterParty(
          matterId: ID!
          contactId: ID!
          partyRole: String!
          side: String
          representedById: ID
          counselContactId: ID
          isPrimaryClient: Boolean
          notes: String
        ): PartyChangeResult!
        changeMatterParty(partyId: ID!, partyRole: String, side: String, notes: String, remove: Boolean, reason: String!): PartyChangeResult!

        completeFirmOnboarding(
          firmName: String!
          firmSlug: String!
          firmDisplayName: String
          firmShortName: String
          brandTagline: String
          brandColor: String
          supportEmail: String
          logoIcon: String
          logoColor: String
          officeName: String!
          officeCode: String!
          timezone: String!
          currencyCode: String!
          practiceAreaName: String
          seedSyntheticDemo: Boolean
        ): FirmOnboardingResult!

        seedSyntheticDemoScenario(
          synthetic: Boolean!
        ): SyntheticDemoScenarioResult!
      }
    `,
    resolvers: {
      Query: {
        consultationCatalog,
        consultationCatalogPage,
        consultationService,
        consultationAvailability,
        customerConsultations,
        customerConsultationPage,
        customerConsultation,
        redirectToInit: redirectToInit_default,
        viewerCanAccessDashboard: (_root, _args, context) => permissions.canAccessDashboard({ session: context.session }),
        viewerCanRunConflictChecks: (_root, _args, context) => permissions.canRunConflictChecks({ session: context.session }),
        viewerCanResolveConflicts: (_root, _args, context) => (!context.session?.authenticationType || context.session.authenticationType === "human") && permissions.canResolveConflicts({ session: context.session }),
        viewerNeedsFirmOnboarding: (_root, _args, context) => Boolean(context.session?.itemId && !activeFirmId(context.session)),
        viewerCanSeedSyntheticDemo,
        practiceOverview,
        practiceWorkspace,
        previewContactImport,
        portalSharedResource,
        portalPolicyWorkspace
      },
      Mutation: {
        registerConsultationAccount,
        bookClientConsultation,
        postTrustTransaction,
        prepareTrustReconciliation,
        setTrustAccountBankIdentity,
        transitionTrustAccount,
        transitionTrustLedgerAccount,
        reviseTrustReconciliation,
        transitionTrustReconciliation,
        requestAgentAction,
        reviewAgentAction,
        executeAgentAction,
        transitionAgentPrincipal,
        updateAgentGrantAuthority,
        issueApiKey,
        revokeApiKey,
        issueOAuthClient,
        revokeOAuthClient,
        issueAgentCredential,
        revokeAgentCredential,
        setMatterTeamAccess,
        setEthicalWallMember,
        transitionEthicalWall,
        requestConflictCheck,
        addConflictSearchTerm,
        addConflictMatch,
        transitionConflictCheck,
        recordConflictDisposition,
        finalizeConflictCheck,
        transitionMatter,
        changeMatterConfidentiality,
        transitionIntake,
        convertIntakeToMatter,
        reviseDraftDeadline,
        transitionDeadline,
        transitionLegalTask,
        transitionTimeEntry,
        transitionExpense,
        assembleDraftInvoice,
        transitionInvoice,
        transitionPayment,
        allocatePayment,
        recordManualPayment,
        reversePaymentAllocation,
        requestRefund,
        reviewRefund,
        recordRefundProviderOutcome,
        recordPortalDiscoveryPolicy,
        executePortalGrant: (_root, { data }, context) => executePortalGrant(_root, data, context),
        invitePortalAccount,
        acceptPortalInvitation,
        grantPortalMatterAccess,
        sharePortalResource,
        revokePortalGrant,
        transitionRetentionPolicy,
        assignDocumentRetentionPolicy,
        placeRetentionHold,
        releaseRetentionHold,
        disposeRetainedDocument,
        rotateIntegrationCredential,
        transitionIntegrationConnection,
        enqueueWebhookDelivery,
        queueCommunicationMessage,
        transitionCommunicationDelivery,
        transitionDocument,
        addDocumentSigner,
        transitionDocumentSigner,
        transitionSignatureRequest,
        ingestDocumentVersion,
        setDocumentCurrentVersion,
        prepareSignatureRequest,
        rotateWebhookSigningSecret,
        addCommunicationParticipant,
        removeCommunicationParticipant,
        prepareCommunicationDeliveries,
        applyContactImport,
        preparePracticeExport,
        startClientIntake,
        inviteFirmMember,
        changeFirmMemberAccess,
        updateFirmRoleAuthority,
        scheduleConsultation,
        transitionConsultation,
        cancelOwnConsultation,
        prepareRetainerAgreement,
        transitionRetainerAgreement,
        recordDocketEntry,
        reviseDocketEntry,
        verifyDocketEntry,
        addIntakeParticipant,
        changeIntakeParticipant,
        addMatterParty,
        changeMatterParty,
        completeFirmOnboarding,
        seedSyntheticDemoScenario
      }
    }
  });
}

// features/keystone/index.ts
var isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
function runtimeEnvironment(name, buildFallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production" && !isProductionBuild) {
    throw new Error(`${name} is required in production.`);
  }
  return buildFallback;
}
var databaseURL = runtimeEnvironment(
  "DATABASE_URL",
  "postgresql://localhost/openfront_law_firm_build"
);
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: runtimeEnvironment(
    "SESSION_SECRET",
    "local-build-only-session-secret-do-not-deploy"
  )
};
var initialPermissions = Object.fromEntries(
  permissionKeys.map((permission) => [permission, true])
);
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      bootstrapKey: "openfront-law-firm-initial-user",
      status: "active",
      bootstrapRole: {
        create: {
          name: "Bootstrap administrator",
          status: "active",
          ...initialPermissions
        }
      }
    }
  },
  passwordResetLink: {
    // Staff (any firm membership or the bootstrap principal) recover on the dashboard;
    // storefront customers recover on /account/reset.
    async sendToken({ itemId, identity, token, context }) {
      const purpose = await passwordResetPurpose(context.sudo().prisma, String(itemId));
      await sendPasswordResetEmail(token, identity, void 0, purpose);
    }
  },
  sessionData: `
    name
    email
    status
    activeFirm { id name displayName shortName brandTagline brandColor supportEmail status }
    role: bootstrapRole {
      id
      name
      status
      firm { id }
      ${permissionKeys.join("\n")}
    }
    firmMemberships {
      id
      status
      firm { id }
      role {
        id
        name
        status
        firm { id }
        ${permissionKeys.join("\n")}
      }
    }
  `
});
var keystone_default = withAuth(
  (0, import_core21.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session })
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      debug: false,
      playground: false,
      apolloConfig: {
        introspection: false,
        includeStacktraceInErrorResponses: false
      },
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
