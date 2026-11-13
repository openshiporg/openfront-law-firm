import { permissions } from "../access";
import { User } from "./User";
import { Role } from "./Role";
import { Firm, Office, FirmMembership } from "./tenancy";
import { ApiKey, OAuthClient, OAuthConsent, OAuthToken } from "./authentication";
import { Contact, Address, ContactMethod } from "./contacts";
import { Intake, IntakeParticipant, IntakeSubmission, Consultation } from "./intake";
import { ConflictCheck, ConflictSearchTerm, ConflictMatch, ConflictDisposition } from "./conflicts";
import {
  PracticeArea,
  Matter,
  MatterParty,
  MatterTeamMember,
  EthicalWall,
  EthicalWallMember,
  MatterStatusEvent,
} from "./matters";
import { Court, Docket, DocketEntry, Deadline, LegalTask } from "./calendaring";
import {
  CommunicationThread,
  CommunicationParticipant,
  CommunicationMessage,
} from "./communications";
import {
  Document,
  DocumentVersion,
  SignatureRequest,
  DocumentSigner,
  SignatureEvent,
} from "./documents";
import {
  RateCard,
  RateRule,
  TimeEntry,
  Expense,
  RetainerAgreement,
  Invoice,
  InvoiceLine,
} from "./billing";
import {
  TrustAccount,
  TrustLedgerAccount,
  TrustTransaction,
  TrustLedgerEntry,
  TrustBalanceSnapshot,
  TrustReconciliation,
} from "./trust";
import { Payment, PaymentAllocation, Refund } from "./payments";
import { PaymentProvider } from "./PaymentProvider";
import { PortalAccount, PortalMatterAccess, PortalShare, PortalSession } from "./portal";
import { PortalDiscoveryPolicy, PortalGrantIntent } from "./portalPolicy";
import {
  IntegrationConnection,
  ExternalRecordLink,
  WebhookSubscription,
  WebhookDelivery,
  WebhookDeliveryAttempt,
} from "./integrations";
import { RetentionPolicy, RetentionHold, RetentionAction, AuditEvent } from "./governance";
import { AttorneyProfile, PublicSitePolicy } from "./publicSite";
import {
  AgentPrincipal,
  AgentCredential,
  AgentGrant,
  AgentAction,
  AgentActionEvent,
} from "./agents";

const modelDefinitions = {
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
  PaymentProvider,
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
  AttorneyProfile,
};

type AnyFn = (...args: any[]) => any;

// Whether the session may run the list's query operation (the same test that gates reading it).
async function canQueryList(listKey: string, args: { context: unknown; session: unknown }) {
  const access = (modelDefinitions as Record<string, any>)[listKey]?.access;
  if (!access) return true;
  const call = { operation: "query", listKey, ...args };
  try {
    const operation = typeof access === "function" ? access : typeof access.operation === "function" ? access.operation : access.operation?.query;
    if (operation !== undefined && operation !== true && !(typeof operation === "function" ? await operation(call) : operation)) return false;
    const filter = access.filter?.query;
    if (typeof filter === "function" && (await filter(call)) === false) return false;
    return operation !== false;
  } catch {
    return false;
  }
}

// A field may be filtered or ordered by exactly the sessions that may read it, and a relation
// by exactly the sessions that may read the list it points at. Otherwise a where-filter on a
// count or list reads through to values the session cannot see. People rows are private to
// people readers, so every User field except id follows canReadPeople.
function guardField(listKey: string, fieldKey: string, fieldFn: AnyFn, defaults: { filter: boolean; order: boolean }): AnyFn {
  return (config: unknown) => {
    const field = fieldFn(config);
    const gate = (own: unknown, fallback: boolean) => {
      const base = own === undefined ? fallback : own;
      if (base === false) return false;
      return async (args: { context: unknown; session: any }) => {
        if (typeof base === "function" && !(await base(args))) return false;
        const call = { operation: "read", listKey, fieldKey, ...args };
        const access = field.access;
        const read = typeof access === "function" ? access : access?.read;
        try {
          if (typeof read === "function" ? !(await read(call)) : read === false) return false;
        } catch {
          return false;
        }
        if (listKey === "User" && fieldKey !== "id" && !permissions.canReadPeople({ session: args.session })) return false;
        if (field.dbField?.kind === "relation" && !(await canQueryList(field.dbField.list, args))) return false;
        return true;
      };
    };
    return { ...field, isFilterable: gate(field.isFilterable, defaults.filter), isOrderable: gate(field.isOrderable, defaults.order) };
  };
}

export const models = Object.fromEntries(
  Object.entries(modelDefinitions).map(([key, model]) => [
    key,
    {
      ...model,
      graphql: { maxTake: 100, ...model.graphql },
      fields: Object.fromEntries(
        Object.entries(model.fields as Record<string, unknown>).map(([fieldKey, fieldFn]) => [
          fieldKey,
          typeof fieldFn === "function"
            ? guardField(key, fieldKey, fieldFn as AnyFn, {
                filter: (model as any).defaultIsFilterable ?? true,
                order: (model as any).defaultIsOrderable ?? true,
              })
            : fieldFn,
        ]),
      ),
    },
  ]),
) as typeof modelDefinitions;

export default models;
