import { checkbox, relationship, text } from "@keystone-6/core/fields";

import {
  permissionKeys,
  permissions,
  rules,
  type AccessArgs,
  type PermissionKey,
} from "../access";
import { denyAll } from "../tenancy";

export function uniqueConstraints(...constraints: readonly (readonly string[])[]) {
  return {
    extendPrismaSchema(schema: string) {
      const closingBrace = schema.lastIndexOf("}");
      if (closingBrace < 0) throw new Error("Unable to add Prisma unique constraints.");
      const directives = constraints
        .map((fields) => `  @@unique([${fields.join(", ")}])`)
        .join("\n");
      return `${schema.slice(0, closingBrace)}${directives}\n${schema.slice(closingBrace)}`;
    },
  };
}

// Permissions are chosen when a role is created. Later changes go through
// updateFirmRoleAuthority, which keeps an active firm administrator.
export const permissionFields = Object.fromEntries(
  permissionKeys.map((permission) => [permission, checkbox({ defaultValue: false, access: { update: denyAll } })]),
);

export function requireRelationshipPrismaField(field: string) {
  return field.replaceAll("?", "");
}

export function requiredRelationship(ref: string) {
  return relationship({
    ref,
    db: {
      foreignKey: true,
      extendPrismaSchema: requireRelationshipPrismaField,
    },
  });
}

export function readOnlyRelationship(ref: string, many = false) {
  const config = {
    ref,
    access: { create: denyAll, update: denyAll },
    graphql: { omit: { create: true, update: true } },
    ui: {
      createView: { fieldMode: "hidden" as const },
      itemView: { fieldMode: "read" as const },
    },
  };
  return many ? relationship({ ...config, many: true }) : relationship(config);
}

export function firmRelationship(ref = "Firm") {
  return relationship({
    ref,
    db: {
      foreignKey: true,
      extendPrismaSchema: requireRelationshipPrismaField,
    },
    access: { create: denyAll, update: denyAll },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" },
    },
  });
}

export function scopedAccess(
  readPermission: PermissionKey,
  managePermission: PermissionKey,
  filter: (args: AccessArgs) => boolean | Record<string, unknown> = rules.activeFirmOwned,
  options: { allowDelete?: boolean } = {},
) {
  return {
    operation: {
      query: permissions[readPermission],
      create: permissions[managePermission],
      update: permissions[managePermission],
      delete: options.allowDelete ? permissions[managePermission] : denyAll,
    },
    filter: {
      query: filter,
      update: filter,
      delete: filter,
    },
  };
}

export const immutableUpdateDeleteGraphql = {
  omit: { update: true, delete: true },
} as const;

export const systemEvidenceGraphql = {
  omit: { create: true, update: true, delete: true },
} as const;

export function secretText(label: string, required = false) {
  return text({
    label,
    validation: required ? { isRequired: true } : undefined,
    graphql: { omit: { read: true } },
    access: { read: denyAll, create: denyAll, update: denyAll },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "hidden" },
      listView: { fieldMode: "hidden" },
    },
  });
}
