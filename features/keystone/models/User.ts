import { randomUUID } from "node:crypto";

import { graphql, list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { password, relationship, select, text, virtual } from "@keystone-6/core/fields";

import { isHumanIdentitySession, isInteractiveHuman, isInteractiveHumanSession, isSignedIn, permissions, rules, type Session } from "../access";
import { activeFirmRelationshipHooks } from "../tenancy";
import { sha256Digest } from "../lib/digests";
import { readOnlyRelationship } from "./fields";
import { trackingFields } from "./trackingFields";

const userRelationshipHooks = activeFirmRelationshipHooks({ lifecycle: "user", allowBootstrapCreate: true });

const DashboardAdmission = graphql.object<{ canAccessDashboard: boolean; canManageOnboarding: boolean }>()({
  name: "UserDashboardAdmission",
  fields: {
    canAccessDashboard: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    canManageOnboarding: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
  },
});

/** Only the signed-in person, from their own interactive session, sees their admission. */
export function viewerDashboardAdmission(session: Session | null | undefined, userId: string) {
  if (!isHumanIdentitySession(session) || session.itemId !== userId) return null;
  return {
    canAccessDashboard: permissions.canAccessDashboard({ session }),
    canManageOnboarding: permissions.canManageOnboarding({ session }),
  };
}

export const User = list({
  // createAuth.initFirstItem requires UserCreateInput to exist; operation access
  // denies ordinary generated creates and the controlled staff workflow uses sudo db API.
  access: {
    operation: {
      query: isSignedIn,
      create: denyAll,
      update: isInteractiveHuman,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdateOwnIdentity,
      delete: () => false,
    },
  },
  hooks: {
    ...userRelationshipHooks,
    async afterOperation(args: any) {
      if (
        args.operation !== "update" ||
        !args.resolvedData?.password ||
        args.originalItem?.status !== "invited"
      ) return;

      const userId = String(args.item.id);
      const invitedMembership = await args.context.prisma.firmMembership.findFirst({
        where: { userId, status: "invited" },
        orderBy: { createdAt: "asc" },
        select: { firmId: true },
      });
      const firmId = String(
        args.item.activeFirmId ?? args.originalItem.activeFirmId ?? invitedMembership?.firmId ?? "",
      );
      if (!firmId) return;
      const now = new Date();
      await args.context.prisma.$transaction(async (tx: any) => {
        await tx.user.update({ where: { id: userId }, data: { status: "active" } });
        await tx.firmMembership.updateMany({
          where: { userId, firmId, status: "invited" },
          data: { status: "active", startedAt: now, endedAt: null, updatedAt: now },
        });
        await tx.auditEvent.create({
          data: {
            firmId,
            eventId: randomUUID(),
            actorUserId: userId,
            actorType: "user",
            eventType: "staff.invitation_accepted",
            category: "authentication",
            outcome: "succeeded",
            occurredAt: now,
            metadata: {
              acceptanceDigest: sha256Digest({ userId, firmId, acceptedAt: now.toISOString() }),
            },
          },
        });
      });
    },
  },
  ui: {
    // Generated creates are always denied; staff join through People & access invitations.
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "email", "status", "activeFirm"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    // Login email is a global credential. Generated updates cannot change it, even for
    // the owner, until a verified change flow exists; recovery goes to the current address.
    email: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      isFilterable: false,
      isOrderable: false,
      access: { update: denyAll },
    }),
    password: password({
      access: {
        read: denyAll,
        // Only the person themselves, from an interactive session. Setup, reset and
        // init flows use Keystone's one-use tokens through sudo and are unaffected.
        update: ({ session, item }) =>
          isInteractiveHumanSession(session) && session.itemId === String(item.id),
      },
      validation: {
        isRequired: true,
        length: { min: 12, max: 1000 },
        rejectCommon: true,
      },
    }),
    bootstrapKey: text({
      isIndexed: "unique",
      defaultValue: null,
      db: { isNullable: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
      },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Deactivated", value: "deactivated" },
      ],
      defaultValue: "invited",
      validation: { isRequired: true },
      access: { update: denyAll },
    }),
    onboardingStatus: select({
      type: "enum",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" },
      ],
      defaultValue: "not_started",
      validation: { isRequired: true },
    }),
    bootstrapRole: relationship({
      ref: "Role.assignedTo",
      // Legacy top-level role is reserved for the one-time bootstrap principal.
      // Ongoing firm authority comes only from FirmMembership.role.
      db: { foreignKey: { map: "role" } },
      access: { create: denyAll, update: denyAll },
    }),
    // The shared Openfront dashboard admits viewers through `authenticatedItem.role`.
    // This projects only the viewer's own current admission flags, derived per request
    // from the same membership authority Keystone access uses; it carries no firm powers.
    role: virtual({
      field: graphql.field({
        type: DashboardAdmission,
        resolve: (item, _args, context) => viewerDashboardAdmission(context.session as Session | undefined, String(item.id)),
      }),
      ui: {
        query: "{ canAccessDashboard canManageOnboarding }",
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    activeFirm: relationship({
      ref: "Firm.activeUsers",
      // Selection changes affect current administrator viability. Generated
      // nested/bulk/self writes cannot bypass the controlled setup/join path.
      access: { create: permissions.canManageFirm, update: denyAll },
    }),
    firmMemberships: readOnlyRelationship("FirmMembership.user", true),
    consultations: readOnlyRelationship("Consultation.account", true),
    apiKeys: readOnlyRelationship("ApiKey.owner", true),
    oauthClients: readOnlyRelationship("OAuthClient.owner", true),
    oauthConsents: readOnlyRelationship("OAuthConsent.user", true),
    oauthTokens: readOnlyRelationship("OAuthToken.user", true),
    authorizedMatters: readOnlyRelationship("Matter.authorizedUsers", true),
    blockedMatters: readOnlyRelationship("Matter.blockedUsers", true),
    ...trackingFields,
  },
});
