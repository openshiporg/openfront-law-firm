import { list } from "@keystone-6/core";
import {
  checkbox,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  secretText,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadCredentials = ({ session }: any) =>
  permissions.canReadMachineCredentials({ session }) ||
  permissions.canManageMachineCredentials({ session });

const credentialEvidenceAccess = {
  operation: {
    query: canReadCredentials,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  filter: {
    query: rules.activeFirmOwned,
    update: () => false,
    delete: () => false,
  },
};

const credentialMetadataAccess = {
  read: canReadCredentials,
  create: denyAll,
  update: denyAll,
};

export const ApiKey = list({
  db: uniqueConstraints(["firmId", "name"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["name", "prefix", "status", "owner", "expiresAt", "lastUsedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    owner: requiredRelationship("User.apiKeys"),
    name: text({ validation: { isRequired: true } }),
    prefix: text({ isIndexed: "unique", validation: { isRequired: true } }),
    secretDigest: secretText("API key digest", true),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    scopes: json({
      defaultValue: [],
      access: credentialMetadataAccess,
      ui: { description: "Allowlisted machine scopes only; never inferred from a role name." },
    }),
    expiresAt: timestamp(),
    lastUsedAt: timestamp(),
    createdBy: requiredRelationship("User"),
    revokedBy: relationship({ ref: "User" }),
    revokedAt: timestamp(),
    revocationReason: text({ access: credentialMetadataAccess }),
    ...trackingFields,
  },
});

export const OAuthClient = list({
  db: uniqueConstraints(["firmId", "name"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["name", "clientId", "status", "owner", "createdAt"] },
  },
  fields: {
    firm: firmRelationship(),
    owner: requiredRelationship("User.oauthClients"),
    name: text({ validation: { isRequired: true } }),
    clientId: text({ isIndexed: "unique", validation: { isRequired: true } }),
    clientSecretDigest: secretText("OAuth client secret digest", true),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    isConfidential: checkbox({ defaultValue: true }),
    redirectUris: json({ defaultValue: [], access: credentialMetadataAccess }),
    allowedScopes: json({ defaultValue: [], access: credentialMetadataAccess }),
    description: text({ access: credentialMetadataAccess, ui: { displayMode: "textarea" } }),
    createdBy: requiredRelationship("User"),
    revokedBy: relationship({ ref: "User" }),
    revokedAt: timestamp(),
    tokens: readOnlyRelationship("OAuthToken.client", true),
    consents: readOnlyRelationship("OAuthConsent.client", true),
    ...trackingFields,
  },
});

export const OAuthConsent = list({
  db: uniqueConstraints(["clientId", "userId", "firmId"]),
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["client", "user", "status", "grantedAt", "revokedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    client: requiredRelationship("OAuthClient.consents"),
    user: requiredRelationship("User.oauthConsents"),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    scopes: json({ defaultValue: [], access: credentialMetadataAccess }),
    consentDigest: text({ validation: { isRequired: true } }),
    grantedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    revokedAt: timestamp(),
    ...trackingFields,
  },
});

export const OAuthToken = list({
  access: credentialEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["tokenType", "client", "status", "user", "expiresAt", "consumedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    client: requiredRelationship("OAuthClient.tokens"),
    user: requiredRelationship("User.oauthTokens"),
    consent: relationship({ ref: "OAuthConsent" }),
    tokenType: select({
      type: "enum",
      options: [
        { label: "Authorization code", value: "authorization_code" },
        { label: "Access token", value: "access_token" },
        { label: "Refresh token", value: "refresh_token" },
      ],
      validation: { isRequired: true },
    }),
    tokenDigest: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    tokenPrefix: text({ isIndexed: true, validation: { isRequired: true } }),
    familyId: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending consent", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Consumed", value: "consumed" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    scopes: json({ defaultValue: [], access: credentialMetadataAccess }),
    redirectUri: text({ access: credentialMetadataAccess }),
    state: secretText("OAuth state"),
    codeChallenge: secretText("PKCE code challenge"),
    codeChallengeMethod: select({
      type: "enum",
      options: [{ label: "S256", value: "S256" }],
    }),
    parentToken: relationship({ ref: "OAuthToken.replacementTokens" }),
    replacementTokens: readOnlyRelationship("OAuthToken.parentToken", true),
    expiresAt: timestamp({ validation: { isRequired: true } }),
    consumedAt: timestamp(),
    revokedAt: timestamp(),
    lastUsedAt: timestamp(),
    ...trackingFields,
  },
});
