import { list } from "@keystone-6/core";
import { integer, json, text, timestamp } from "@keystone-6/core/fields";
import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, requiredRelationship, systemEvidenceGraphql, uniqueConstraints } from "./fields";

export const PortalDiscoveryPolicy = list({
  db: uniqueConstraints(["firmId", "revision"]),
  graphql: systemEvidenceGraphql,
  access: {
    operation: { query: ({ session }) => permissions.canReadPortal({ session }) || permissions.canManageFirm({ session }), create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: rules.activeFirmOwned },
  },
  hooks: firmOwnedHooks(),
  fields: {
    firm: firmRelationship(),
    revision: integer({ validation: { isRequired: true, min: 1 } }),
    mode: text({ validation: { isRequired: true } }),
    statuses: json(),
    admission: text({ validation: { isRequired: true } }),
    reasonDigest: text({ validation: { isRequired: true } }),
    recordedBy: requiredRelationship("User"),
    recordedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const PortalGrantIntent = list({
  db: uniqueConstraints(["firmId", "actorId", "idempotencyKey"]),
  graphql: systemEvidenceGraphql,
  access: {
    operation: { query: permissions.canReadPortal, create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: (args: any) => {
      const scope = rules.canReadPortalRecord(args);
      return scope === false ? false : { AND: [scope, { actor: { id: { equals: args.session.itemId } } }] };
    } },
  },
  hooks: firmOwnedHooks(),
  fields: {
    firm: firmRelationship(),
    actor: requiredRelationship("User"),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount"),
    contact: requiredRelationship("Contact"),
    grant: requiredRelationship("PortalMatterAccess"),
    idempotencyKey: text({ validation: { isRequired: true }, isFilterable: false, isOrderable: false }),
    intentDigest: text({ validation: { isRequired: true } }),
    operation: text({ validation: { isRequired: true } }),
    policyRevision: integer({ validation: { isRequired: true } }),
    resultVersion: integer({ validation: { isRequired: true } }),
    completedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields,
  },
});
