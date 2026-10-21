import { timestamp } from "@keystone-6/core/fields";

const denyWrite = () => false;

export const trackingFields = {
  createdAt: timestamp({
    access: { create: denyWrite, update: denyWrite },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" },
    },
  }),
  updatedAt: timestamp({
    access: { create: denyWrite, update: denyWrite },
    db: { updatedAt: true },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" },
    },
  }),
};
