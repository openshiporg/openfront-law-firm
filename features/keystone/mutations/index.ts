import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";

import { activeFirmId, permissions } from "../access";

import {
  setEthicalWallMember,
  setMatterTeamAccess,
  transitionEthicalWall,
} from "./accessWorkflows";
import { requestAgentAction, reviewAgentAction } from "./agentActions";
import { executeAgentAction } from "./executeAgentAction";
import { transitionAgentPrincipal, updateAgentGrantAuthority } from "./grantWorkflows";
import {
  issueAgentCredential,
  issueApiKey,
  issueOAuthClient,
  revokeAgentCredential,
  revokeApiKey,
  revokeOAuthClient,
} from "./credentials";
import {
  applyContactImport,
  preparePracticeExport,
  previewContactImport,
} from "./dataWorkflows";
import {
  allocatePayment,
  recordManualPayment,
  recordRefundProviderOutcome,
  requestRefund,
  reversePaymentAllocation,
  reviewRefund,
  transitionInvoice,
  transitionPayment,
} from "./billingWorkflows";
import {
  addConflictMatch,
  addConflictSearchTerm,
  changeMatterConfidentiality,
  finalizeConflictCheck,
  recordConflictDisposition,
  requestConflictCheck,
  transitionConflictCheck,
  transitionMatter,
} from "./legalWorkflows";
import { completeFirmOnboarding } from "./onboarding";
import { seedSyntheticDemoScenario, viewerCanSeedSyntheticDemo } from "./syntheticScenario";
import { startClientIntake } from "./intakeWorkflows";
import { changeFirmMemberAccess, inviteFirmMember } from "./staffWorkflows";
import { updateFirmRoleAuthority } from "./roleWorkflows";
import { cancelOwnConsultation, scheduleConsultation, transitionConsultation } from "./consultationLifecycle";
import { prepareRetainerAgreement, transitionRetainerAgreement } from "./retainerWorkflows";
import { recordDocketEntry, reviseDocketEntry, verifyDocketEntry } from "./docketWorkflows";
import { addIntakeParticipant, addMatterParty, changeIntakeParticipant, changeMatterParty } from "./partyWorkflows";
import {
  acceptPortalInvitation,
  grantPortalMatterAccess,
  invitePortalAccount,
  portalSharedResource,
  revokePortalGrant,
  sharePortalResource,
} from "./portalWorkflows";
import { postTrustTransaction } from "./postTrustTransaction";
import { executePortalGrant, portalPolicyWorkspace, recordPortalDiscoveryPolicy } from "./portalPolicyWorkflows";
import {
  prepareTrustReconciliation,
  setTrustAccountBankIdentity,
  transitionTrustAccount,
  transitionTrustLedgerAccount,
  reviseTrustReconciliation,
  transitionTrustReconciliation,
} from "./trustWorkflows";
import { practiceOverview } from "./practiceOverview";
import { practiceWorkspace } from "./practiceWorkspace";
import {
  assembleDraftInvoice,
  convertIntakeToMatter,
  reviseDraftDeadline,
  transitionDeadline,
  transitionExpense,
  transitionIntake,
  transitionLegalTask,
  transitionTimeEntry,
} from "./practiceWorkflows";
import {
  addDocumentSigner,
  enqueueWebhookDelivery,
  queueCommunicationMessage,
  rotateIntegrationCredential,
  rotateWebhookSigningSecret,
  transitionCommunicationDelivery,
  transitionDocument,
  transitionIntegrationConnection,
  transitionDocumentSigner,
  transitionSignatureRequest,
} from "./providerWorkflows";
import { ingestDocumentVersion, prepareSignatureRequest, setDocumentCurrentVersion } from "./documentVersionWorkflows";
import { addCommunicationParticipant, prepareCommunicationDeliveries, removeCommunicationParticipant } from "./communicationWorkflows";
import {
  assignDocumentRetentionPolicy,
  disposeRetainedDocument,
  placeRetentionHold,
  releaseRetentionHold,
  transitionRetentionPolicy,
} from "./retentionWorkflows";
import redirectToInit from "./redirectToInit";
import { consultationCatalog, consultationCatalogPage, consultationService, consultationAvailability, registerConsultationAccount, bookClientConsultation, customerConsultations, customerConsultationPage, customerConsultation } from "./customerConsultations";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      input TrustLedgerPostingEntryInput {
        ledgerAccountId: ID
        accountingBucket: String!
        direction: String!
        amountMinor: Int!
        currencyCode: String
        memo: String
      }

      input TrustTransactionPostingInput {
        idempotencyKey: String!
        trustAccountId: ID!
        transactionType: String!
        currencyCode: String!
        occurredAt: DateTime!
        description: String!
        reversesTransactionId: ID
        sourcePaymentId: ID
        sourceRefundId: ID
        entries: [TrustLedgerPostingEntryInput!]!
      }

      enum ConflictCheckCommandTarget { running review_required failed cancelled }
      enum InvoiceCommandTarget { approved issued overdue void }
      enum DocumentCommandTarget { active archived }

      type ControlledRecordProjection {
        id: ID!
        status: String!
      }

      type ConflictEvidenceProjection {
        id: ID!
      }

      type TrustTransactionProjection {
        id: ID!
        transactionNumber: String!
        status: String!
        occurredAt: DateTime!
      }

      type CredentialProjection {
        id: ID!
        name: String!
        prefix: String
        status: String!
        expiresAt: DateTime
      }

      type OAuthClientProjection {
        id: ID!
        name: String!
        clientId: String!
        status: String!
      }

      type MatterProjection {
        id: ID!
        matterNumber: String!
        title: String!
        status: String!
      }

      type IntakeProjection {
        id: ID!
        intakeNumber: String!
        title: String!
        status: String!
      }

      type InvoiceProjection {
        id: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        totalMinor: Int!
        balanceDueMinor: Int!
        dueAt: DateTime
      }

      type PaymentProjection {
        id: ID!
        paymentNumber: String!
        status: String!
        currencyCode: String!
        amountMinor: Int!
        refundedMinor: Int!
      }

      type PaymentAllocationProjection {
        id: ID!
        allocationType: String!
        currencyCode: String!
        amountMinor: Int!
      }

      type RefundProjection {
        id: ID!
        refundNumber: String!
        status: String!
        currencyCode: String!
        amountMinor: Int!
      }

      type PortalAccountProjection {
        id: ID!
        email: String!
        status: String!
      }

      type PortalMatterAccessProjection {
        id: ID!
        status: String!
        version: Int!
        policyRevision: Int!
        canReadDocuments: Boolean!
        canUploadDocuments: Boolean!
        canReadInvoices: Boolean!
        canReadMessages: Boolean!
        expiresAt: DateTime
      }

      type PortalDiscoveryPolicyProjection {
        revision: Int!
        mode: String!
        admission: String!
        statuses: [String!]!
      }
      type PortalDirectoryMatter { id: ID! matterNumber: String! status: String! }
      type PortalDirectoryAccount { id: ID! contactId: ID! }
      type PortalIntentHistory { id: ID! operation: String! policyRevision: Int! resultVersion: Int! completedAt: DateTime! }
      type PortalPolicyWorkspace {
        state: String! policy: PortalDiscoveryPolicyProjection policyHistory: [PortalDiscoveryPolicyProjection!]!
        latestRevision: Int! latestChoice: String! latestAdmission: String!
        canConfigure: Boolean! canManage: Boolean!
        total: Int! page: Int! hasNext: Boolean!
        items: [PortalDirectoryMatter!]! accounts: [PortalDirectoryAccount!]! selection: PortalDirectoryMatter
        grants: [PortalMatterAccessProjection!]! history: [PortalIntentHistory!]!
      }
      input PortalGrantCommandInput {
        operation: String! idempotencyKey: String! policyRevision: Int! expectedVersion: Int!
        portalAccountId: ID! contactId: ID! matterId: ID! grantId: ID
        canReadDocuments: Boolean canUploadDocuments: Boolean canReadInvoices: Boolean canReadMessages: Boolean
        expiresAt: DateTime reason: String!
      }
      type PortalGrantCommandResult { grant: PortalMatterAccessProjection! replayed: Boolean! intentId: ID! }

      type PortalShareProjection {
        id: ID!
        status: String!
        resourceType: String!
        expiresAt: DateTime
      }

      type DecisionProjection {
        id: ID!
        outcome: String!
      }

      type EvidenceProjection {
        id: ID!
        eventType: String
        actionType: String
        occurredAt: DateTime!
      }

      type TrustPostingResult {
        transaction: TrustTransactionProjection!
        replayed: Boolean!
      }

      input AgentActionRequestInput {
        idempotencyKey: String!
        agentPrincipalId: ID!
        grantId: ID!
        matterId: ID
        actionType: String!
        requestEnvelope: JSON
        contactId: ID
        intakeId: ID
        documentId: ID
        invoiceId: ID
        paymentId: ID
        trustTransactionId: ID
        deadlineId: ID
        taskId: ID
      }

      type AgentActionRequestResult {
        action: ControlledRecordProjection!
        replayed: Boolean!
      }

      type AgentActionReviewResult {
        action: ControlledRecordProjection!
        replayed: Boolean!
      }

      type IssuedApiKey {
        credential: CredentialProjection!
        secret: String!
      }

      type ApiKeyRevocationResult {
        credential: CredentialProjection!
        replayed: Boolean!
      }

      type IssuedOAuthClient {
        client: OAuthClientProjection!
        clientSecret: String!
      }

      type OAuthClientRevocationResult {
        client: OAuthClientProjection!
        replayed: Boolean!
      }

      type IssuedAgentCredential {
        credential: CredentialProjection!
        secret: String!
      }

      type AgentCredentialRevocationResult {
        credential: CredentialProjection!
        replayed: Boolean!
      }

      type ConflictCheckFinalizationResult {
        check: ControlledRecordProjection!
        replayed: Boolean!
      }

      type EthicalWallTransitionResult {
        wall: ControlledRecordProjection!
        replayed: Boolean!
      }

      type MatterTransitionResult {
        matter: MatterProjection!
        event: EvidenceProjection
        replayed: Boolean!
      }

      type IntakeTransitionResult {
        intake: IntakeProjection!
        replayed: Boolean!
      }

      type MatterConversionResult {
        matter: MatterProjection!
        replayed: Boolean!
      }

      type DeadlineTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type LegalTaskTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type TimeEntryTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type ExpenseTransitionResult {
        item: ControlledRecordProjection!
        replayed: Boolean!
      }

      type DraftInvoiceAssemblyResult {
        invoice: InvoiceProjection!
        replayed: Boolean!
      }

      type InvoiceTransitionResult {
        invoice: InvoiceProjection!
        replayed: Boolean!
      }

      type PaymentTransitionResult {
        payment: PaymentProjection!
        replayed: Boolean!
      }

      type PaymentAllocationResult {
        allocation: PaymentAllocationProjection!
        replayed: Boolean!
      }

      type RefundResult {
        refund: RefundProjection!
        replayed: Boolean!
      }

      type PortalInvitationResult {
        account: PortalAccountProjection!
        inviteToken: String!
      }

      type PortalAcceptanceResult {
        account: PortalAccountProjection!
        sessionToken: String!
        expiresAt: DateTime!
      }

      type PortalRevocationResult {
        id: ID!
        status: String!
        replayed: Boolean!
      }

      type RetentionHoldPlacementResult {
        hold: ControlledRecordProjection!
        action: EvidenceProjection!
      }

      type RetentionHoldReleaseResult {
        hold: ControlledRecordProjection!
        replayed: Boolean!
      }

      type RetentionDisposalResult {
        document: ControlledRecordProjection!
        action: EvidenceProjection
        replayed: Boolean!
      }

      type IntegrationTransitionResult {
        connection: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationDeliveryTransitionResult {
        delivery: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationMessageQueueResult {
        message: ControlledRecordProjection!
        replayed: Boolean!
      }

      type SignatureSignerSetupResult {
        id: ID!
        status: String!
      }

      type SignatureTransitionResult {
        request: ControlledRecordProjection!
        signer: ControlledRecordProjection
        event: EvidenceProjection!
        replayed: Boolean!
      }

      type AgentGrantAuthorityResult {
        grant: ControlledRecordProjection!
        authorityDigest: String!
      }

      type DocumentTransitionResult {
        document: ControlledRecordProjection!
        replayed: Boolean!
      }

      enum DocumentVersionIngestSource { upload generated import }
      enum CommunicationParticipantRole { staff client external_counsel third_party }

      type DocumentVersionProjection {
        id: ID!
        versionNumber: Int!
      }

      type DocumentVersionIngestResult {
        version: DocumentVersionProjection!
        document: ControlledRecordProjection!
        replayed: Boolean!
      }

      type SignatureRequestPreparationResult {
        request: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationParticipantResult {
        participant: ControlledRecordProjection!
        replayed: Boolean!
      }

      type CommunicationDeliveryPreparationResult {
        message: ControlledRecordProjection!
        deliveries: [ControlledRecordProjection!]!
        replayed: Boolean!
      }

      type IntakeStartProjection {
        id: ID!
        intakeNumber: String!
        status: String!
      }

      type ConflictCheckStartProjection {
        id: ID!
        checkNumber: String!
        status: String!
      }

      type ClientIntakeStartResult {
        intake: IntakeStartProjection!
        contact: ConflictEvidenceProjection!
        conflictCheck: ConflictCheckStartProjection!
      }

      type StaffInvitationResult {
        membership: ControlledRecordProjection!
        userId: ID!
        email: String!
      }

      type PartyChangeResult {
        id: ID!
        status: String!
        conflictCheckId: ID
      }

      type FirmRoleAuthorityResult {
        roleId: ID!
        name: String!
        status: String!
        changedPermissions: [String!]!
        affectedMemberships: Int!
      }

      type FirmOnboardingResult {
        firm: ControlledRecordProjection!
        office: ControlledRecordProjection
        membership: ControlledRecordProjection!
        role: ControlledRecordProjection!
        replayed: Boolean!
        demoScenario: SyntheticDemoScenarioResult
      }

      type SyntheticDemoScenarioResult {
        firmId: ID!
        contactId: ID!
        matterId: ID!
        conflictCheckId: ID!
        invoiceId: ID!
        paymentId: ID!
      }

      input ContactImportRowInput {
        sourceId: String
        contactType: String
        firstName: String
        lastName: String
        organizationName: String
        email: String
        phone: String
        status: String
      }

      type ContactImportNormalizedRow {
        sourceId: String!
        contactType: String!
        firstName: String!
        lastName: String!
        organizationName: String!
        email: String!
        phone: String!
        status: String!
      }

      type ContactImportPreviewRow {
        rowNumber: Int!
        valid: Boolean!
        errors: [String!]!
        normalized: ContactImportNormalizedRow!
      }

      type ContactImportPreview {
        valid: Boolean!
        rowCount: Int!
        errorCount: Int!
        digest: String!
        rows: [ContactImportPreviewRow!]!
      }

      type ContactImportResult {
        importedCount: Int!
        contactIds: [ID!]!
        replayed: Boolean!
      }

      type ContactExportRow {
        id: ID!
        contactType: String!
        status: String!
        firstName: String!
        lastName: String!
        organizationName: String!
        primaryEmail: String!
        primaryPhone: String!
        updatedAt: DateTime!
      }

      type MatterExportRow {
        id: ID!
        matterNumber: String!
        title: String!
        status: String!
        confidentiality: String!
        clientId: ID!
        officeId: ID
        practiceAreaId: ID
        responsibleAttorneyId: ID
        openedAt: DateTime
        closedAt: DateTime
        updatedAt: DateTime!
      }

      type TimeEntryExportRow {
        id: ID!
        matterId: ID!
        userId: ID!
        status: String!
        workDate: DateTime!
        durationMinutes: Int!
        description: String!
        isBillable: Boolean!
        rateMinor: Int
        amountMinor: Int!
        currencyCode: String!
      }

      type InvoiceExportRow {
        id: ID!
        matterId: ID!
        clientId: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        subtotalMinor: Int!
        discountMinor: Int!
        taxMinor: Int!
        totalMinor: Int!
        paidMinor: Int!
        balanceDueMinor: Int!
        issuedAt: DateTime
        dueAt: DateTime
        updatedAt: DateTime!
      }

      type AuditExportRow {
        eventId: String!
        eventType: String!
        category: String!
        outcome: String!
        actorType: String!
        matterId: ID
        occurredAt: DateTime!
      }

      type PracticeExportResult {
        scope: String!
        rowCount: Int!
        digest: String!
        contacts: [ContactExportRow!]!
        matters: [MatterExportRow!]!
        timeEntries: [TimeEntryExportRow!]!
        invoices: [InvoiceExportRow!]!
        auditEvents: [AuditExportRow!]!
        replayed: Boolean!
      }

      type PortalSharedDocument {
        id: ID!
        title: String!
        category: String!
        status: String!
        updatedAt: DateTime!
      }

      type PortalSharedDocumentVersion {
        id: ID!
        versionNumber: Int!
        fileName: String!
        mediaType: String!
        byteSize: Int!
        checksumSha256: String!
        createdAt: DateTime!
      }

      type PortalSharedInvoice {
        id: ID!
        invoiceNumber: String!
        status: String!
        currencyCode: String!
        totalMinor: Int!
        paidMinor: Int!
        balanceDueMinor: Int!
        issuedAt: DateTime
        dueAt: DateTime
      }

      type PortalSharedCommunicationThread {
        id: ID!
        subject: String!
        primaryChannel: String!
        status: String!
        lastMessageAt: DateTime
      }

      type PortalSharedResource {
        resourceType: String!
        document: PortalSharedDocument
        documentVersion: PortalSharedDocumentVersion
        invoice: PortalSharedInvoice
        communicationThread: PortalSharedCommunicationThread
      }

      type PracticeOverviewMetric {
        key: String!
        label: String!
        value: Int!
        href: String!
      }

      type PracticeOverviewQueueItem {
        id: ID!
        kind: String!
        title: String!
        subtitle: String!
        status: String!
        at: DateTime
        href: String!
        canAct: Boolean!
      }

      type PracticeOverview {
        firmId: ID!
        firmName: String!
        generatedAt: DateTime!
        metrics: [PracticeOverviewMetric!]!
        intakeQueue: [PracticeOverviewQueueItem!]!
        matterQueue: [PracticeOverviewQueueItem!]!
        workQueue: [PracticeOverviewQueueItem!]!
        billingQueue: [PracticeOverviewQueueItem!]!
        governanceQueue: [PracticeOverviewQueueItem!]!
      }

      type PracticeWorkspaceSection {
        key: String!
        title: String!
        description: String!
        total: Int!
        items: [PracticeOverviewQueueItem!]!
      }

      type PracticeWorkspace {
        category: String!
        generatedAt: DateTime!
        metrics: [PracticeOverviewMetric!]!
        sections: [PracticeWorkspaceSection!]!
        notices: [String!]!
      }

      type ConsultationService { id: ID!, code: String!, publicSlug: String!, name: String!, description: String!, consultationFeeMinor: Int!, consultationMinutes: Int!, currencyCode: String! }
      type ConsultationCatalogPage { services: [ConsultationService!]!, nextCursor: String }
      type ConsultationSlot { startsAt: String!, endsAt: String! }
      type ConsultationAvailability { timezone: String!, slots: [ConsultationSlot!]! }
      type CustomerConsultation { id: ID!, serviceTitle: String!, feeMinor: Int!, currencyCode: String!, status: String!, startsAt: String, endsAt: String, timezone: String! }
      type CustomerConsultationPage { appointments: [CustomerConsultation!]!, nextCursor: String }
      type CustomerAccountRegistration { id: ID! }
      type Query {
        consultationCatalog: [ConsultationService!]!
        consultationCatalogPage(cursor: String): ConsultationCatalogPage!
        consultationService(slug: String, id: ID): ConsultationService
        consultationAvailability(serviceId: ID!): ConsultationAvailability!
        customerConsultations: [CustomerConsultation!]!
        customerConsultationPage(cursor: String): CustomerConsultationPage!
        customerConsultation(id: ID!): CustomerConsultation
        redirectToInit: Boolean
        viewerCanAccessDashboard: Boolean!
        viewerCanRunConflictChecks: Boolean!
        viewerCanResolveConflicts: Boolean!
        viewerNeedsFirmOnboarding: Boolean!
        viewerCanSeedSyntheticDemo: Boolean!
        practiceOverview: PracticeOverview!
        practiceWorkspace(category: String!): PracticeWorkspace!
        previewContactImport(rows: [ContactImportRowInput!]!): ContactImportPreview!
        portalSharedResource(sessionToken: String!, shareId: ID!): PortalSharedResource!
        portalPolicyWorkspace(search: String, status: String, page: Int, matterId: ID, portalAccountId: ID): PortalPolicyWorkspace!
      }

      type Mutation {
        registerConsultationAccount(name: String!, email: String!, password: String!): CustomerAccountRegistration!
        bookClientConsultation(serviceId: ID!, startsAt: String!, requestKey: String!, summary: String, jurisdiction: String!, opposingParties: String!, keyDeadline: String, acknowledgmentVersion: String!): CustomerConsultation!
        setTrustAccountBankIdentity(
          trustAccountId: ID!
          financialInstitutionName: String!
          bankAccountLastFour: String!
          accountType: String!
          officeId: ID
          externalAccountReference: String
          reason: String!
        ): ControlledRecordProjection!
        prepareTrustReconciliation(
          trustAccountId: ID!
          periodStart: DateTime!
          periodEnd: DateTime!
          statementBalanceMinor: Int!
          bookBalanceMinor: Int!
          currencyCode: String!
          notes: String
        ): ControlledRecordProjection!
        transitionTrustAccount(
          trustAccountId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionTrustLedgerAccount(
          ledgerAccountId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionTrustReconciliation(
          reconciliationId: ID!
          toStatus: String!
          reason: String!
        ): ControlledRecordProjection!
        reviseTrustReconciliation(
          reconciliationId: ID!
          expectedUpdatedAt: DateTime!
          statementBalanceMinor: Int!
          bookBalanceMinor: Int!
          notes: String
          reason: String!
        ): ControlledRecordProjection!
        postTrustTransaction(data: TrustTransactionPostingInput!): TrustPostingResult!
        requestAgentAction(data: AgentActionRequestInput!): AgentActionRequestResult!
        reviewAgentAction(
          actionId: ID!
          decision: String!
          reason: String
          approvalExpiresAt: DateTime
        ): AgentActionReviewResult!
        executeAgentAction(actionId: ID!): AgentActionRequestResult!
        transitionAgentPrincipal(principalId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        updateAgentGrantAuthority(
          grantId: ID!
          toStatus: String!
          capabilities: [String!]
          reason: String!
          startsAt: DateTime
          expiresAt: DateTime
        ): AgentGrantAuthorityResult!
        issueApiKey(
          name: String!
          scopes: [String!]!
          ownerId: ID
          expiresAt: DateTime
        ): IssuedApiKey!
        revokeApiKey(id: ID!, reason: String!): ApiKeyRevocationResult!
        issueOAuthClient(
          name: String!
          redirectUris: [String!]!
          scopes: [String!]!
          description: String
        ): IssuedOAuthClient!
        revokeOAuthClient(id: ID!, reason: String!): OAuthClientRevocationResult!
        issueAgentCredential(
          agentPrincipalId: ID!
          name: String!
          capabilities: [String!]!
          expiresAt: DateTime
        ): IssuedAgentCredential!
        revokeAgentCredential(id: ID!, reason: String!): AgentCredentialRevocationResult!

        setMatterTeamAccess(
          matterId: ID!
          userId: ID!
          teamRole: String!
          status: String!
          canAccessRestricted: Boolean
          canEdit: Boolean
          canBill: Boolean
          reason: String!
        ): ControlledRecordProjection!
        setEthicalWallMember(
          wallId: ID!
          userId: ID!
          decision: String!
          status: String!
          reason: String!
        ): ControlledRecordProjection!
        transitionEthicalWall(
          wallId: ID!
          toStatus: String!
          reason: String!
        ): EthicalWallTransitionResult!

        requestConflictCheck(
          checkNumber: String!
          intakeId: ID
          matterId: ID
          initialTerm: String!
          termType: String!
        ): ControlledRecordProjection!
        addConflictSearchTerm(
          checkId: ID!
          term: String!
          normalizedTerm: String!
          termType: String!
          sourceContactId: ID
          includeAliases: Boolean
        ): ConflictEvidenceProjection!
        addConflictMatch(
          checkId: ID!
          matchType: String!
          matchedContactId: ID
          matchedMatterId: ID
          matchedMatterPartyId: ID
          score: Int
        ): ConflictEvidenceProjection!
        transitionConflictCheck(
          checkId: ID!
          toStatus: ConflictCheckCommandTarget!
          summary: String
        ): ConflictCheckFinalizationResult!
        recordConflictDisposition(
          checkId: ID!
          matchId: ID
          outcome: String!
          rationale: String!
          conditions: String
          policyReference: String
        ): DecisionProjection!
        finalizeConflictCheck(
          checkId: ID!
          outcome: String!
          summary: String!
        ): ConflictCheckFinalizationResult!
        transitionMatter(
          matterId: ID!
          toStatus: String!
          reason: String
        ): MatterTransitionResult!
        changeMatterConfidentiality(
          matterId: ID!
          confidentiality: String!
          reason: String!
        ): MatterTransitionResult!
        transitionIntake(
          intakeId: ID!
          toStatus: String!
          reason: String
        ): IntakeTransitionResult!
        convertIntakeToMatter(
          intakeId: ID!
          matterNumber: String!
          title: String!
          responsibleAttorneyId: ID!
          officeId: ID
          practiceAreaId: ID
          reason: String!
        ): MatterConversionResult!
        reviseDraftDeadline(
          deadlineId: ID!
          title: String
          dueAt: DateTime
          timezone: String
          reason: String!
        ): ControlledRecordProjection!
        transitionDeadline(
          deadlineId: ID!
          toStatus: String!
          reason: String
        ): DeadlineTransitionResult!
        transitionLegalTask(
          taskId: ID!
          toStatus: String!
          reason: String
        ): LegalTaskTransitionResult!
        transitionTimeEntry(
          timeEntryId: ID!
          toStatus: String!
          reason: String
        ): TimeEntryTransitionResult!
        transitionExpense(
          expenseId: ID!
          toStatus: String!
          reason: String
        ): ExpenseTransitionResult!
        assembleDraftInvoice(
          idempotencyKey: String!
          invoiceNumber: String!
          matterId: ID!
          clientId: ID!
          timeEntryIds: [ID!]
          expenseIds: [ID!]
          retainerId: ID
        ): DraftInvoiceAssemblyResult!

        transitionInvoice(
          invoiceId: ID!
          toStatus: InvoiceCommandTarget!
          reason: String
          dueAt: DateTime
        ): InvoiceTransitionResult!
        transitionPayment(
          paymentId: ID!
          toStatus: String!
          eventId: String!
          providerPaymentId: String
          failureReason: String
        ): PaymentTransitionResult!
        recordManualPayment(
          idempotencyKey: String!
          payerId: ID!
          invoiceId: ID
          amountMinor: Int!
          currencyCode: String!
          method: String!
          receivedAt: DateTime!
          reference: String
        ): PaymentTransitionResult!
        allocatePayment(
          paymentId: ID!
          invoiceId: ID!
          amountMinor: Int!
          idempotencyKey: String!
          note: String
        ): PaymentAllocationResult!
        reversePaymentAllocation(
          allocationId: ID!
          idempotencyKey: String!
          reason: String!
        ): PaymentAllocationResult!
        requestRefund(
          paymentId: ID!
          amountMinor: Int!
          reason: String!
          explanation: String!
          idempotencyKey: String!
        ): RefundResult!
        reviewRefund(
          refundId: ID!
          decision: String!
          reason: String!
        ): RefundResult!
        recordRefundProviderOutcome(
          refundId: ID!
          toStatus: String!
          eventId: String!
          providerRefundId: String
          failureReason: String
        ): RefundResult!

        recordPortalDiscoveryPolicy(expectedRevision: Int!, mode: String!, statuses: [String!]!, reason: String!): PortalDiscoveryPolicyProjection!
        executePortalGrant(data: PortalGrantCommandInput!): PortalGrantCommandResult!
        invitePortalAccount(
          contactId: ID!
          email: String!
          expiresAt: DateTime
        ): PortalInvitationResult!
        acceptPortalInvitation(inviteToken: String!): PortalAcceptanceResult!
        grantPortalMatterAccess(
          idempotencyKey: String!
          policyRevision: Int!
          expectedVersion: Int!
          contactId: ID!
          grantId: ID
          reason: String!
          portalAccountId: ID!
          matterId: ID!
          canReadDocuments: Boolean
          canUploadDocuments: Boolean
          canReadInvoices: Boolean
          canReadMessages: Boolean
          expiresAt: DateTime
        ): PortalMatterAccessProjection!
        sharePortalResource(
          portalMatterAccessId: ID!
          resourceType: String!
          resourceId: ID!
          expiresAt: DateTime
        ): PortalShareProjection!
        revokePortalGrant(
          id: ID!
          grantType: String!
          reason: String!
          idempotencyKey: String
          policyRevision: Int
          expectedVersion: Int
          contactId: ID
          portalAccountId: ID
          matterId: ID
        ): PortalRevocationResult!

        transitionRetentionPolicy(policyId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        assignDocumentRetentionPolicy(documentId: ID!, policyId: ID!, reason: String!): ControlledRecordProjection!
        placeRetentionHold(
          policyId: ID
          matterId: ID
          documentId: ID
          contactId: ID
          name: String!
          reason: String!
          authorityReference: String
        ): RetentionHoldPlacementResult!
        releaseRetentionHold(holdId: ID!, reason: String!): RetentionHoldReleaseResult!
        disposeRetainedDocument(
          documentId: ID!
          reason: String!
          confirmation: String!
        ): RetentionDisposalResult!

        rotateIntegrationCredential(
          connectionId: ID!
          credentialType: String!
          secret: String!
        ): ControlledRecordProjection!
        transitionIntegrationConnection(
          connectionId: ID!
          toStatus: String!
          reason: String!
        ): IntegrationTransitionResult!
        enqueueWebhookDelivery(
          connectionId: ID!
          subscriptionId: ID!
          eventId: String!
          eventType: String!
          matterId: ID
          payload: JSON
        ): ControlledRecordProjection!
        queueCommunicationMessage(
          messageId: ID!
          reason: String!
        ): CommunicationMessageQueueResult!
        transitionCommunicationDelivery(
          deliveryId: ID!
          toStatus: String!
          providerEventId: String!
          providerMessageId: String
          errorCode: String
          errorMessage: String
        ): CommunicationDeliveryTransitionResult!
        transitionDocument(
          documentId: ID!
          toStatus: DocumentCommandTarget!
          reason: String!
        ): DocumentTransitionResult!
        addDocumentSigner(
          requestId: ID!
          contactId: ID
          portalAccountId: ID
          name: String!
          email: String!
          signingOrder: Int
          providerSignerId: String
        ): SignatureSignerSetupResult!
        transitionDocumentSigner(
          signerId: ID!
          toStatus: String!
          providerEventId: String!
          evidenceDigest: String!
        ): SignatureTransitionResult!
        transitionSignatureRequest(
          requestId: ID!
          toStatus: String!
          providerEventId: String!
          actorReference: String
          evidenceDigest: String!
        ): SignatureTransitionResult!
        ingestDocumentVersion(
          documentId: ID!
          idempotencyKey: String!
          fileName: String!
          objectKey: String!
          mediaType: String!
          byteSize: Int!
          checksumSha256: String!
          source: DocumentVersionIngestSource
          sourceMessageId: ID
          notes: String
          makeCurrent: Boolean
        ): DocumentVersionIngestResult!
        setDocumentCurrentVersion(
          documentId: ID!
          versionId: ID!
          reason: String!
        ): DocumentTransitionResult!
        prepareSignatureRequest(
          documentVersionId: ID!
          idempotencyKey: String!
          title: String!
          message: String
          expiresAt: DateTime
          integrationConnectionId: ID
        ): SignatureRequestPreparationResult!
        rotateWebhookSigningSecret(
          subscriptionId: ID!
          secret: String!
        ): ControlledRecordProjection!
        addCommunicationParticipant(
          threadId: ID!
          participantRole: CommunicationParticipantRole!
          userId: ID
          contactId: ID
          portalAccountId: ID
          contactMethodId: ID
        ): CommunicationParticipantResult!
        removeCommunicationParticipant(
          participantId: ID!
          reason: String!
        ): CommunicationParticipantResult!
        prepareCommunicationDeliveries(
          messageId: ID!
          participantIds: [ID!]!
          integrationConnectionId: ID
          reason: String!
        ): CommunicationDeliveryPreparationResult!

        applyContactImport(
          connectionId: ID!
          idempotencyKey: String!
          rows: [ContactImportRowInput!]!
        ): ContactImportResult!
        preparePracticeExport(
          scope: String!
          idempotencyKey: String!
          limit: Int
        ): PracticeExportResult!

        startClientIntake(
          contactType: String!
          firstName: String
          lastName: String
          organizationName: String
          email: String
          phone: String
          title: String!
          source: String
          summary: String
          adversePartySummary: String
          officeId: ID
          practiceAreaId: ID
          assignedToId: ID
        ): ClientIntakeStartResult!

        inviteFirmMember(
          name: String!
          email: String!
          roleId: ID!
          officeId: ID
        ): StaffInvitationResult!
        changeFirmMemberAccess(
          membershipId: ID!
          roleId: ID
          officeId: ID
          changeOffice: Boolean!
          toStatus: String
          reason: String!
        ): ControlledRecordProjection!
        updateFirmRoleAuthority(
          roleId: ID!
          grantedPermissions: [String!]!
          status: String
          reason: String!
        ): FirmRoleAuthorityResult!
        scheduleConsultation(
          consultationId: ID!
          startsAt: DateTime!
          endsAt: DateTime!
          hostId: ID!
          officeId: ID
          location: String
          reason: String
        ): ControlledRecordProjection!
        transitionConsultation(
          consultationId: ID!
          toStatus: String!
          outcome: String
          reason: String
        ): ControlledRecordProjection!
        cancelOwnConsultation(consultationId: ID!, reason: String): ControlledRecordProjection!
        prepareRetainerAgreement(
          matterId: ID!
          clientId: ID!
          agreementNumber: String!
          feeStructure: String!
          currencyCode: String!
          rateCardId: ID
          trustLedgerAccountId: ID
          initialRetainerMinor: Int
          evergreenThresholdMinor: Int
          replenishmentAmountMinor: Int
          contingencyBasisPoints: Int
          termsSummary: String
        ): ControlledRecordProjection!
        transitionRetainerAgreement(
          retainerId: ID!
          toStatus: String!
          signedDocumentVersionId: ID
          effectiveAt: DateTime
          reason: String
        ): ControlledRecordProjection!
        recordDocketEntry(
          docketId: ID!
          title: String!
          entryType: String!
          occurredAt: DateTime!
          filedAt: DateTime
          enteredAt: DateTime
          description: String
          externalEntryId: String
          sourceUrl: String
          documentVersionId: ID
        ): ControlledRecordProjection!
        reviseDocketEntry(
          entryId: ID!
          title: String!
          entryType: String!
          occurredAt: DateTime!
          filedAt: DateTime
          enteredAt: DateTime
          description: String
          externalEntryId: String
          sourceUrl: String
          documentVersionId: ID
        ): ControlledRecordProjection!
        verifyDocketEntry(entryId: ID!, toStatus: String!, reason: String!): ControlledRecordProjection!
        addIntakeParticipant(intakeId: ID!, contactId: ID!, participantRole: String!, notes: String): PartyChangeResult!
        changeIntakeParticipant(participantId: ID!, participantRole: String, notes: String, remove: Boolean, reason: String!): PartyChangeResult!
        addMatterParty(
          matterId: ID!
          contactId: ID!
          partyRole: String!
          side: String
          representedById: ID
          counselContactId: ID
          isPrimaryClient: Boolean
          notes: String
        ): PartyChangeResult!
        changeMatterParty(partyId: ID!, partyRole: String, side: String, notes: String, remove: Boolean, reason: String!): PartyChangeResult!

        completeFirmOnboarding(
          firmName: String!
          firmSlug: String!
          firmDisplayName: String
          firmShortName: String
          brandTagline: String
          brandColor: String
          supportEmail: String
          logoIcon: String
          logoColor: String
          officeName: String!
          officeCode: String!
          timezone: String!
          currencyCode: String!
          practiceAreaName: String
          seedSyntheticDemo: Boolean
        ): FirmOnboardingResult!

        seedSyntheticDemoScenario(
          synthetic: Boolean!
        ): SyntheticDemoScenarioResult!
      }
    `,
    resolvers: {
      Query: {
        consultationCatalog,
        consultationCatalogPage,
        consultationService,
        consultationAvailability,
        customerConsultations,
        customerConsultationPage,
        customerConsultation,
        redirectToInit,
        viewerCanAccessDashboard: (_root: unknown, _args: unknown, context: any) =>
          permissions.canAccessDashboard({ session: context.session }),
        viewerCanRunConflictChecks: (_root: unknown, _args: unknown, context: any) => permissions.canRunConflictChecks({ session: context.session }),
        viewerCanResolveConflicts: (_root: unknown, _args: unknown, context: any) => (!context.session?.authenticationType || context.session.authenticationType === 'human') && permissions.canResolveConflicts({ session: context.session }),
        viewerNeedsFirmOnboarding: (_root: unknown, _args: unknown, context: any) =>
          Boolean(context.session?.itemId && !activeFirmId(context.session)),
        viewerCanSeedSyntheticDemo,
        practiceOverview,
        practiceWorkspace,
        previewContactImport,
        portalSharedResource,
        portalPolicyWorkspace,
      },
      Mutation: {
        registerConsultationAccount,
        bookClientConsultation,
        postTrustTransaction,
        prepareTrustReconciliation,
        setTrustAccountBankIdentity,
        transitionTrustAccount,
        transitionTrustLedgerAccount,
        reviseTrustReconciliation,
        transitionTrustReconciliation,
        requestAgentAction,
        reviewAgentAction,
        executeAgentAction,
        transitionAgentPrincipal,
        updateAgentGrantAuthority,
        issueApiKey,
        revokeApiKey,
        issueOAuthClient,
        revokeOAuthClient,
        issueAgentCredential,
        revokeAgentCredential,
        setMatterTeamAccess,
        setEthicalWallMember,
        transitionEthicalWall,
        requestConflictCheck,
        addConflictSearchTerm,
        addConflictMatch,
        transitionConflictCheck,
        recordConflictDisposition,
        finalizeConflictCheck,
        transitionMatter,
        changeMatterConfidentiality,
        transitionIntake,
        convertIntakeToMatter,
        reviseDraftDeadline,
        transitionDeadline,
        transitionLegalTask,
        transitionTimeEntry,
        transitionExpense,
        assembleDraftInvoice,
        transitionInvoice,
        transitionPayment,
        allocatePayment,
        recordManualPayment,
        reversePaymentAllocation,
        requestRefund,
        reviewRefund,
        recordRefundProviderOutcome,
        recordPortalDiscoveryPolicy,
        executePortalGrant: (_root: unknown, { data }: { data: Parameters<typeof executePortalGrant>[1] }, context: any) => executePortalGrant(_root, data, context),
        invitePortalAccount,
        acceptPortalInvitation,
        grantPortalMatterAccess,
        sharePortalResource,
        revokePortalGrant,
        transitionRetentionPolicy,
        assignDocumentRetentionPolicy,
        placeRetentionHold,
        releaseRetentionHold,
        disposeRetainedDocument,
        rotateIntegrationCredential,
        transitionIntegrationConnection,
        enqueueWebhookDelivery,
        queueCommunicationMessage,
        transitionCommunicationDelivery,
        transitionDocument,
        addDocumentSigner,
        transitionDocumentSigner,
        transitionSignatureRequest,
        ingestDocumentVersion,
        setDocumentCurrentVersion,
        prepareSignatureRequest,
        rotateWebhookSigningSecret,
        addCommunicationParticipant,
        removeCommunicationParticipant,
        prepareCommunicationDeliveries,
        applyContactImport,
        preparePracticeExport,
        startClientIntake,
        inviteFirmMember,
        changeFirmMemberAccess,
        updateFirmRoleAuthority,
        scheduleConsultation,
        transitionConsultation,
        cancelOwnConsultation,
        prepareRetainerAgreement,
        transitionRetainerAgreement,
        recordDocketEntry,
        reviseDocketEntry,
        verifyDocketEntry,
        addIntakeParticipant,
        changeIntakeParticipant,
        addMatterParty,
        changeMatterParty,
        completeFirmOnboarding,
        seedSyntheticDemoScenario,
      },
    },
  });
}
