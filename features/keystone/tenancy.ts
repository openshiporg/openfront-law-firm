import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { activeFirmId } from "./access";
import { accessibleMatterStorageWhere } from "./lib/matter-access";
import {
  assertInitialLifecycleState,
  assertLifecycleTransition,
  type LifecycleKey,
} from "./lib/lifecycles";
import { prismaWithoutGraphQLErrorConversion } from "./lib/transactions";

export const denyAll = () => false;

export function assignActiveFirm(
  resolvedData: Record<string, unknown>,
  context: { session?: unknown },
) {
  const firmId = activeFirmId(context.session as never);
  if (!firmId) return resolvedData;

  return {
    ...resolvedData,
    firm: { connect: { id: firmId } },
  };
}

function objects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  return value && typeof value === "object" ? [value as Record<string, unknown>] : [];
}

export function relationshipConnectionIds(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const input = value as Record<string, unknown>;
  const candidates = [...objects(input.connect), ...objects(input.set)];
  return [...new Set(candidates.flatMap((candidate) =>
    typeof candidate.id === "string" ? [candidate.id] : [],
  ))];
}

function connectedId(value: unknown) {
  return relationshipConnectionIds(value)[0] ?? null;
}

export function validateActiveFirm({
  resolvedData,
  item,
  context,
  addValidationError,
}: {
  resolvedData?: Record<string, unknown>;
  item?: Record<string, unknown>;
  context: { session?: unknown };
  addValidationError: (message: string) => void;
}) {
  const firmId = activeFirmId(context.session as never);
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

const modelMetadata = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const financialAuditLists = new Set([
  "RateCard", "RateRule", "TimeEntry", "Expense", "RetainerAgreement", "Invoice", "InvoiceLine",
  "TrustAccount", "TrustLedgerAccount", "TrustReconciliation", "Payment",
]);
const integrationAuditLists = new Set([
  "IntegrationConnection", "ExternalRecordLink", "WebhookSubscription", "WebhookDelivery",
]);

function delegateName(modelName: string) {
  return `${modelName[0].toLowerCase()}${modelName.slice(1)}`;
}

function modelHasField(modelName: string, fieldName: string) {
  return modelMetadata.get(modelName)?.fields.some((field) => field.name === fieldName) ?? false;
}

async function validateMatterAccess({
  matterId,
  firmId,
  context,
  addValidationError,
}: {
  matterId: string;
  firmId: string;
  context: any;
  addValidationError: (message: string) => void;
}) {
  const userId = context.session?.itemId;
  if (!userId) {
    addValidationError("An authenticated firm member is required for matter-scoped data.");
    return;
  }

  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      ...accessibleMatterStorageWhere(firmId, userId),
    },
    select: { id: true },
  });
  if (!matter) addValidationError("The selected matter is not accessible in the active firm.");
}

async function validateConnectedRelationships(args: any) {
  const { listKey, resolvedData, item, context, addValidationError, operation } = args;
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const firmId = activeFirmId(context.session as never);
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
          canAccessRestricted: true,
        },
        select: { id: true },
      });
      if (!teamMember) {
        addValidationError("An explicit restricted-access team assignment is required before restricting a matter.");
      }
    }
  }

  const sourceHasMatter = sourceModel.fields.some((field) => field.name === "matterId");
  // Keystone lists every field in resolvedData, with undefined for fields the operation
  // did not touch, so only a defined value means the matter scope is being changed.
  const matterWasSupplied = changedFields(resolvedData).includes("matter");
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
    if (resolvedData[relation.name] === undefined) continue;
    const ids = relationshipConnectionIds(resolvedData[relation.name]);
    if (ids.length === 0) continue;

    if (relation.type === "Firm") {
      if (ids.some((id) => id !== firmId)) {
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
      const userWhere = listKey === "FirmMembership" && relation.name === "user"
        ? { id: { in: ids } }
        : {
            id: { in: ids },
            status: "active",
            firmMemberships: { some: { firmId, status: "active" } },
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
    const select = targetHasMatter ? { id: true, matterId: true } : { id: true };
    const targets = await targetDelegate.findMany({
      where: { id: { in: ids }, firmId },
      select,
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

/** Fields an update actually sets: Keystone lists every field in resolvedData, untouched ones as undefined. */
export function changedFields(resolvedData: Record<string, unknown> | undefined | null) {
  return Object.keys(resolvedData ?? {}).filter((field) => resolvedData?.[field] !== undefined);
}

export function activeFirmRelationshipHooks(
  options: { lifecycle?: LifecycleKey; allowBootstrapCreate?: boolean } = {},
) {
  const validate = async (args: any) => {
    await validateConnectedRelationships(args);
    const nextStatus = args.resolvedData?.status;
    const currentStatus = args.item?.status;
    const isBootstrapCreate =
      options.allowBootstrapCreate && args.operation === "create" && !args.context.session?.itemId;
    if (options.lifecycle && args.operation === "create" && typeof nextStatus === "string" && !isBootstrapCreate) {
      try {
        assertInitialLifecycleState(options.lifecycle, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid initial lifecycle state.");
      }
    }
    if (
      options.lifecycle &&
      args.operation === "update" &&
      typeof nextStatus === "string" &&
      typeof currentStatus === "string" &&
      nextStatus !== currentStatus
    ) {
      try {
        assertLifecycleTransition(options.lifecycle, currentStatus, nextStatus);
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid lifecycle transition.");
      }
    }
  };

  return { validate: { create: validate, update: validate } };
}

export function firmOwnedHooks(
  options: { lifecycle?: LifecycleKey; allowBootstrapCreate?: boolean; controlledStatus?: boolean } = {},
) {
  const validate = async (args: any) => {
    const isBootstrapCreate =
      options.allowBootstrapCreate &&
      args.operation === "create" &&
      !args.context.session?.itemId &&
      !activeFirmId(args.context.session as never);
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
    if (
      options.lifecycle &&
      args.operation === "update" &&
      typeof nextStatus === "string" &&
      typeof currentStatus === "string" &&
      nextStatus !== currentStatus
    ) {
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

  const beforeOperation = (args: any) => {
    const isBootstrapCreate =
      options.allowBootstrapCreate && args.operation === "create" && !args.context.session?.itemId;
    if (isBootstrapCreate) return;
    const firmId = activeFirmId(args.context.session as never);
    const recordFirmId = args.item?.firmId;
    if (!firmId || (recordFirmId && recordFirmId !== firmId)) {
      throw new Error("The operation requires the record's active firm context.");
    }
  };

  const afterOperation = async (args: any) => {
    const firmId = activeFirmId(args.context.session as never);
    const actorUserId = args.context.session?.itemId;
    const record = args.item ?? args.originalItem;
    if (!firmId || !actorUserId || !record?.id || args.listKey === "AuditEvent") return;
    const audit = prismaWithoutGraphQLErrorConversion(args.context.prisma as any)?.auditEvent;
    if (!audit?.create) return;
    const matterId = args.listKey === "Matter" ? record.id : record.matterId ?? null;
    const authenticationType = args.context.session?.authenticationType ?? "human";
    try {
      await audit.create({
        data: {
          firmId,
          eventId: randomUUID(),
          eventType: `record.${args.operation}`,
          category: financialAuditLists.has(args.listKey)
            ? "financial"
            : integrationAuditLists.has(args.listKey) ? "integration" : "legal_workflow",
          outcome: "succeeded",
          actorUserId: authenticationType === "agent" ? null : actorUserId,
          actorAgentId: args.context.session?.agentPrincipalId ?? null,
          actorType: authenticationType === "human" ? "user" : authenticationType,
          matterId,
          occurredAt: new Date(),
          metadata: {
            listKey: args.listKey,
            recordId: record.id,
            operation: args.operation,
            credentialId: args.context.session?.credentialId ?? null,
            oauthClientId: args.context.session?.oauthClientId ?? null,
          },
        },
      });
    } catch {
      // High-risk workflows write audit evidence inside their controlled transaction.
      // Low-risk CRUD telemetry is explicitly non-authoritative, but operators still
      // need a bounded signal they can alert on without leaking record contents.
      console.error("Low-risk audit telemetry persistence failed", {
        listKey: args.listKey,
        operation: args.operation,
      });
    }
  };

  return {
    resolveInput: {
      create: ({ resolvedData, context }: any) => assignActiveFirm(resolvedData, context),
    },
    validate: {
      create: validate,
      update: validate,
    },
    beforeOperation: {
      create: beforeOperation,
      update: beforeOperation,
      delete: beforeOperation,
    },
    afterOperation: {
      create: afterOperation,
      update: afterOperation,
      delete: afterOperation,
    },
  };
}
