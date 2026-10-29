import { list } from "@keystone-6/core";
import { checkbox, json, select, text } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { firmOwnedHooks } from "../tenancy";
import { firmRelationship, uniqueConstraints } from "./fields";
import { trackingFields } from "./trackingFields";

export const PaymentProvider = list({
  access: { operation: { query: ({ session }: any) => permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }), create: permissions.canManagePayments, update: permissions.canManagePayments, delete: permissions.canManagePayments } },
  // One provider per code per firm (each firm has its own operating and trust accounts).
  db: uniqueConstraints(["firmId", "code"]),
  hooks: firmOwnedHooks(),
  fields: {
    firm: firmRelationship(),
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: true, validation: { isRequired: true, match: { regex: /^pp_[a-zA-Z0-9-_]+$/ } } }),
    account: select({ type: "enum", options: [{ label: "Operating", value: "operating" }, { label: "Trust / IOLTA", value: "trust" }], validation: { isRequired: true } }),
    isInstalled: checkbox({ defaultValue: false }),
    credentials: json({ defaultValue: {} }),
    metadata: json({ defaultValue: {} }),
    createPaymentFunction: text({ validation: { isRequired: true } }), capturePaymentFunction: text({ validation: { isRequired: true } }),
    refundPaymentFunction: text({ validation: { isRequired: true } }), getPaymentStatusFunction: text({ validation: { isRequired: true } }),
    generatePaymentLinkFunction: text({ validation: { isRequired: true } }), handleWebhookFunction: text({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
