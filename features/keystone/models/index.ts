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
  CommunicationDelivery,
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
import { PublicSitePolicy } from "./publicSite";
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
};

export const models = Object.fromEntries(
  Object.entries(modelDefinitions).map(([key, model]) => [
    key,
    {
      ...model,
      graphql: { maxTake: 100, ...model.graphql },
    },
  ]),
) as typeof modelDefinitions;

export default models;
