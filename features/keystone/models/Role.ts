import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { activeFirmId, isSignedIn, permissions } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { permissionFields, readOnlyRelationship } from "./fields";
import { trackingFields } from "./trackingFields";

export const Role = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: denyAll,
    },
    filter: {
      query: ({ session }) => {
        if (!session?.itemId) return false;
        const firmId = activeFirmId(session);
        const ownRoles = {
          OR: [
            { assignedTo: { some: { id: { equals: session.itemId } } } },
            ...(firmId ? [{
              memberships: {
                some: {
                  user: { id: { equals: session.itemId } },
                  firm: { id: { equals: firmId } },
                  status: { equals: "active" },
                },
              },
            }] : []),
          ],
        };
        if (!firmId || !permissions.canManageRoles({ session })) return ownRoles;
        return { OR: [{ firm: { id: { equals: firmId } } }, ownRoles] };
      },
      update: ({ session }) => {
        const firmId = activeFirmId(session);
        return firmId ? { firm: { id: { equals: firmId } } } : false;
      },
      delete: () => false,
    },
  },
  hooks: firmOwnedHooks({ allowBootstrapCreate: true }),
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: true,
    listView: { initialColumns: ["name", "status", "firm", "assignedTo"] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
      // Archiving can strand administrators; use updateFirmRoleAuthority.
      access: { update: denyAll },
    }),
    // Null only for the one-time bootstrap role; normal creates are bound by the role hook.
    firm: relationship({
      ref: "Firm.roles",
      db: { foreignKey: true },
      access: { create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    ...permissionFields,
    assignedTo: relationship({
      ref: "User.bootstrapRole",
      many: true,
      access: { create: denyAll, update: denyAll },
    }),
    memberships: readOnlyRelationship("FirmMembership.role", true),
    ...trackingFields,
  },
});
