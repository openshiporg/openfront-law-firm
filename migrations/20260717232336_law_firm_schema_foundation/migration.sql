-- CreateEnum
CREATE TYPE "UserStatusType" AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "RoleStatusType" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "FirmStatusType" AS ENUM ('onboarding', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "OfficeStatusType" AS ENUM ('active', 'inactive', 'closed');

-- CreateEnum
CREATE TYPE "FirmMembershipStatusType" AS ENUM ('invited', 'active', 'suspended', 'ended');

-- CreateEnum
CREATE TYPE "ContactContactTypeType" AS ENUM ('person', 'organization');

-- CreateEnum
CREATE TYPE "ContactStatusType" AS ENUM ('prospective_client', 'client', 'former_client', 'opposing', 'other', 'archived');

-- CreateEnum
CREATE TYPE "AddressAddressTypeType" AS ENUM ('home', 'work', 'billing', 'mailing', 'other');

-- CreateEnum
CREATE TYPE "ContactMethodMethodTypeType" AS ENUM ('email', 'phone', 'portal', 'other');

-- CreateEnum
CREATE TYPE "IntakeStatusType" AS ENUM ('new', 'screening', 'conflict_review', 'consultation', 'decision', 'converted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "IntakeSourceType" AS ENUM ('website', 'referral', 'phone', 'walk_in', 'import', 'other');

-- CreateEnum
CREATE TYPE "IntakeParticipantParticipantRoleType" AS ENUM ('prospective_client', 'adverse_party', 'related_party', 'witness', 'referrer', 'other');

-- CreateEnum
CREATE TYPE "IntakeParticipantStatusType" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "IntakeSubmissionStatusType" AS ENUM ('submitted', 'under_review', 'accepted', 'superseded');

-- CreateEnum
CREATE TYPE "ConsultationStatusType" AS ENUM ('requested', 'scheduled', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "ConsultationOutcomeType" AS ENUM ('pending', 'recommend_engagement', 'decline', 'follow_up');

-- CreateEnum
CREATE TYPE "ConflictCheckStatusType" AS ENUM ('requested', 'running', 'review_required', 'cleared', 'conflict_found', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ConflictCheckSearchScopeType" AS ENUM ('active_firm', 'contacts', 'matters', 'contacts_and_matters');

-- CreateEnum
CREATE TYPE "ConflictSearchTermTermTypeType" AS ENUM ('person', 'organization', 'alias', 'matter', 'other');

-- CreateEnum
CREATE TYPE "ConflictMatchStatusType" AS ENUM ('potential', 'reviewing', 'cleared', 'escalated');

-- CreateEnum
CREATE TYPE "ConflictMatchMatchTypeType" AS ENUM ('exact_name', 'alias', 'fuzzy_name', 'related_party', 'matter_text', 'manual');

-- CreateEnum
CREATE TYPE "ConflictDispositionOutcomeType" AS ENUM ('clear', 'conflict', 'needs_more_information', 'approved_exception');

-- CreateEnum
CREATE TYPE "PracticeAreaStatusType" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "MatterStatusType" AS ENUM ('proposed', 'pending_conflict', 'open', 'on_hold', 'closing', 'closed', 'declined');

-- CreateEnum
CREATE TYPE "MatterConfidentialityType" AS ENUM ('standard', 'restricted');

-- CreateEnum
CREATE TYPE "MatterBillingTypeType" AS ENUM ('hourly', 'flat_fee', 'contingency', 'pro_bono', 'other');

-- CreateEnum
CREATE TYPE "MatterPartyPartyRoleType" AS ENUM ('client', 'claimant', 'respondent', 'opposing_party', 'witness', 'expert', 'counsel', 'adjudicator', 'other');

-- CreateEnum
CREATE TYPE "MatterPartySideType" AS ENUM ('our_client', 'adverse', 'neutral', 'unknown');

-- CreateEnum
CREATE TYPE "MatterPartyStatusType" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "MatterTeamMemberTeamRoleType" AS ENUM ('responsible_attorney', 'attorney', 'paralegal', 'assistant', 'billing', 'observer');

-- CreateEnum
CREATE TYPE "MatterTeamMemberStatusType" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "EthicalWallStatusType" AS ENUM ('draft', 'active', 'lifted');

-- CreateEnum
CREATE TYPE "EthicalWallMemberDecisionType" AS ENUM ('allowed', 'blocked');

-- CreateEnum
CREATE TYPE "EthicalWallMemberStatusType" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "CourtCourtTypeType" AS ENUM ('federal', 'state', 'local', 'administrative', 'arbitration', 'other');

-- CreateEnum
CREATE TYPE "CourtStatusType" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DocketStatusType" AS ENUM ('active', 'stayed', 'appealed', 'closed');

-- CreateEnum
CREATE TYPE "DocketEntryEntryTypeType" AS ENUM ('filing', 'order', 'hearing', 'notice', 'service', 'correspondence', 'other');

-- CreateEnum
CREATE TYPE "DocketEntryStatusType" AS ENUM ('draft', 'filed', 'entered', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "DeadlineStatusType" AS ENUM ('draft', 'pending', 'completed', 'missed', 'waived', 'cancelled');

-- CreateEnum
CREATE TYPE "DeadlineDeadlineTypeType" AS ENUM ('court', 'statutory', 'contractual', 'internal', 'limitation', 'other');

-- CreateEnum
CREATE TYPE "DeadlineSourceType" AS ENUM ('manual', 'court_rule', 'docket_integration', 'agent_proposed', 'imported');

-- CreateEnum
CREATE TYPE "LegalTaskStatusType" AS ENUM ('open', 'in_progress', 'blocked', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "LegalTaskPriorityType" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CommunicationThreadStatusType" AS ENUM ('open', 'archived', 'closed');

-- CreateEnum
CREATE TYPE "CommunicationThreadPrimaryChannelType" AS ENUM ('email', 'sms', 'phone', 'portal', 'internal', 'other');

-- CreateEnum
CREATE TYPE "CommunicationParticipantParticipantRoleType" AS ENUM ('staff', 'client', 'external_counsel', 'third_party', 'system');

-- CreateEnum
CREATE TYPE "CommunicationParticipantStatusType" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "CommunicationMessageDirectionType" AS ENUM ('inbound', 'outbound', 'internal');

-- CreateEnum
CREATE TYPE "CommunicationMessageChannelType" AS ENUM ('email', 'sms', 'phone', 'portal', 'internal', 'other');

-- CreateEnum
CREATE TYPE "CommunicationMessageStatusType" AS ENUM ('draft', 'queued', 'sent', 'delivered', 'failed', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "CommunicationDeliveryChannelType" AS ENUM ('email', 'sms', 'portal');

-- CreateEnum
CREATE TYPE "CommunicationDeliveryStatusType" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- CreateEnum
CREATE TYPE "DocumentStatusType" AS ENUM ('draft', 'active', 'archived', 'disposed');

-- CreateEnum
CREATE TYPE "DocumentCategoryType" AS ENUM ('pleading', 'correspondence', 'evidence', 'contract', 'research', 'billing', 'internal', 'other');

-- CreateEnum
CREATE TYPE "DocumentConfidentialityType" AS ENUM ('matter', 'restricted', 'client_shareable');

-- CreateEnum
CREATE TYPE "DocumentVersionSourceType" AS ENUM ('upload', 'generated', 'email', 'court', 'signature_provider', 'import');

-- CreateEnum
CREATE TYPE "SignatureRequestStatusType" AS ENUM ('draft', 'sent', 'partially_signed', 'completed', 'declined', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentSignerStatusType" AS ENUM ('pending', 'viewed', 'signed', 'declined');

-- CreateEnum
CREATE TYPE "RateCardStatusType" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "RateRuleRateTypeType" AS ENUM ('hourly', 'flat_fee', 'per_appearance', 'per_item');

-- CreateEnum
CREATE TYPE "TimeEntryStatusType" AS ENUM ('draft', 'submitted', 'approved', 'billed', 'written_off');

-- CreateEnum
CREATE TYPE "ExpenseStatusType" AS ENUM ('draft', 'submitted', 'approved', 'billed', 'reimbursed', 'written_off');

-- CreateEnum
CREATE TYPE "ExpenseExpenseTypeType" AS ENUM ('filing_fee', 'travel', 'expert', 'copying', 'service', 'other');

-- CreateEnum
CREATE TYPE "RetainerAgreementStatusType" AS ENUM ('draft', 'sent', 'accepted', 'active', 'completed', 'terminated');

-- CreateEnum
CREATE TYPE "RetainerAgreementFeeStructureType" AS ENUM ('hourly', 'flat_fee', 'contingency', 'hybrid', 'pro_bono');

-- CreateEnum
CREATE TYPE "InvoiceStatusType" AS ENUM ('draft', 'approved', 'issued', 'partially_paid', 'paid', 'overdue', 'void');

-- CreateEnum
CREATE TYPE "InvoiceLineLineTypeType" AS ENUM ('time', 'expense', 'flat_fee', 'discount', 'tax', 'other');

-- CreateEnum
CREATE TYPE "TrustAccountAccountTypeType" AS ENUM ('trust', 'pooled_trust', 'dedicated_client', 'other');

-- CreateEnum
CREATE TYPE "TrustAccountStatusType" AS ENUM ('pending', 'active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "TrustLedgerAccountStatusType" AS ENUM ('active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "TrustTransactionTransactionTypeType" AS ENUM ('deposit', 'disbursement', 'transfer', 'reversal', 'bank_fee', 'adjustment');

-- CreateEnum
CREATE TYPE "TrustTransactionStatusType" AS ENUM ('posted', 'reversed');

-- CreateEnum
CREATE TYPE "TrustLedgerEntryAccountingBucketType" AS ENUM ('bank_control', 'client_liability', 'bank_fee', 'suspense');

-- CreateEnum
CREATE TYPE "TrustLedgerEntryDirectionType" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TrustBalanceSnapshotSnapshotTypeType" AS ENUM ('client_balance', 'book_balance', 'statement_balance', 'reconciliation');

-- CreateEnum
CREATE TYPE "TrustReconciliationStatusType" AS ENUM ('draft', 'in_review', 'completed', 'reopened');

-- CreateEnum
CREATE TYPE "PaymentPaymentTypeType" AS ENUM ('operating', 'trust_deposit', 'other');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('pending', 'authorized', 'captured', 'settled', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentAllocationAllocationTypeType" AS ENUM ('invoice', 'trust_deposit', 'trust_application', 'reversal');

-- CreateEnum
CREATE TYPE "RefundStatusType" AS ENUM ('requested', 'approved', 'processing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundReasonType" AS ENUM ('overpayment', 'duplicate', 'matter_closed', 'client_request', 'other');

-- CreateEnum
CREATE TYPE "PortalAccountStatusType" AS ENUM ('invited', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "PortalMatterAccessStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PortalShareStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PortalShareResourceTypeType" AS ENUM ('document', 'document_version', 'invoice', 'communication_thread');

-- CreateEnum
CREATE TYPE "IntegrationConnectionCategoryType" AS ENUM ('email', 'calendar', 'document_storage', 'signature', 'payment', 'court', 'accounting', 'other');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatusType" AS ENUM ('pending', 'active', 'needs_reauth', 'disabled', 'revoked');

-- CreateEnum
CREATE TYPE "ExternalRecordLinkResourceTypeType" AS ENUM ('contact', 'intake', 'matter', 'document', 'invoice', 'payment', 'docket', 'other');

-- CreateEnum
CREATE TYPE "ExternalRecordLinkStatusType" AS ENUM ('linked', 'conflict', 'unlinked');

-- CreateEnum
CREATE TYPE "WebhookSubscriptionStatusType" AS ENUM ('active', 'paused', 'revoked');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatusType" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'dead_letter');

-- CreateEnum
CREATE TYPE "WebhookDeliveryAttemptSucceededType" AS ENUM ('yes', 'no');

-- CreateEnum
CREATE TYPE "RetentionPolicyStatusType" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "RetentionPolicyRecordClassType" AS ENUM ('matter', 'document', 'communication', 'billing', 'contact', 'audit', 'other');

-- CreateEnum
CREATE TYPE "RetentionPolicyTriggerType" AS ENUM ('matter_closed', 'document_archived', 'record_created', 'manual');

-- CreateEnum
CREATE TYPE "RetentionHoldStatusType" AS ENUM ('active', 'released');

-- CreateEnum
CREATE TYPE "RetentionActionActionTypeType" AS ENUM ('archived', 'disposed', 'restored', 'hold_applied', 'hold_released');

-- CreateEnum
CREATE TYPE "RetentionActionResourceTypeType" AS ENUM ('matter', 'document', 'contact', 'communication_thread', 'invoice');

-- CreateEnum
CREATE TYPE "AuditEventCategoryType" AS ENUM ('authentication', 'authorization', 'legal_workflow', 'financial', 'integration', 'retention', 'agent');

-- CreateEnum
CREATE TYPE "AuditEventOutcomeType" AS ENUM ('succeeded', 'denied', 'failed');

-- CreateEnum
CREATE TYPE "AgentPrincipalAgentTypeType" AS ENUM ('assistant', 'workflow', 'integration', 'service_account');

-- CreateEnum
CREATE TYPE "AgentPrincipalStatusType" AS ENUM ('draft', 'active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "AgentCredentialStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "AgentGrantStatusType" AS ENUM ('proposed', 'active', 'suspended', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "AgentActionStatusType" AS ENUM ('requested', 'awaiting_approval', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentActionRiskLevelType" AS ENUM ('low', 'high', 'financial', 'access_control');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "bootstrapKey" TEXT,
    "status" "UserStatusType" NOT NULL DEFAULT 'invited',
    "onboardingStatus" "UserOnboardingStatusType" NOT NULL DEFAULT 'not_started',
    "role" TEXT,
    "activeFirm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordResetToken" TEXT,
    "passwordResetIssuedAt" TIMESTAMP(3),
    "passwordResetRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "RoleStatusType" NOT NULL DEFAULT 'active',
    "firm" TEXT,
    "canAccessDashboard" BOOLEAN NOT NULL DEFAULT false,
    "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "canReadPeople" BOOLEAN NOT NULL DEFAULT false,
    "canManagePeople" BOOLEAN NOT NULL DEFAULT false,
    "canManageRoles" BOOLEAN NOT NULL DEFAULT false,
    "canManageFirm" BOOLEAN NOT NULL DEFAULT false,
    "canReadIntake" BOOLEAN NOT NULL DEFAULT false,
    "canManageIntake" BOOLEAN NOT NULL DEFAULT false,
    "canRunConflictChecks" BOOLEAN NOT NULL DEFAULT false,
    "canResolveConflicts" BOOLEAN NOT NULL DEFAULT false,
    "canReadMatters" BOOLEAN NOT NULL DEFAULT false,
    "canManageMatters" BOOLEAN NOT NULL DEFAULT false,
    "canManageEthicalWalls" BOOLEAN NOT NULL DEFAULT false,
    "canReadCalendar" BOOLEAN NOT NULL DEFAULT false,
    "canManageCalendar" BOOLEAN NOT NULL DEFAULT false,
    "canReadTasks" BOOLEAN NOT NULL DEFAULT false,
    "canManageTasks" BOOLEAN NOT NULL DEFAULT false,
    "canReadCommunications" BOOLEAN NOT NULL DEFAULT false,
    "canManageCommunications" BOOLEAN NOT NULL DEFAULT false,
    "canReadDocuments" BOOLEAN NOT NULL DEFAULT false,
    "canManageDocuments" BOOLEAN NOT NULL DEFAULT false,
    "canReadBilling" BOOLEAN NOT NULL DEFAULT false,
    "canManageBilling" BOOLEAN NOT NULL DEFAULT false,
    "canReadTrust" BOOLEAN NOT NULL DEFAULT false,
    "canManageTrust" BOOLEAN NOT NULL DEFAULT false,
    "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
    "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
    "canReadPortal" BOOLEAN NOT NULL DEFAULT false,
    "canManagePortal" BOOLEAN NOT NULL DEFAULT false,
    "canReadIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "canReadRetention" BOOLEAN NOT NULL DEFAULT false,
    "canManageRetention" BOOLEAN NOT NULL DEFAULT false,
    "canViewAudit" BOOLEAN NOT NULL DEFAULT false,
    "canReadAgents" BOOLEAN NOT NULL DEFAULT false,
    "canManageAgents" BOOLEAN NOT NULL DEFAULT false,
    "canApproveAgentActions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "status" "FirmStatusType" NOT NULL DEFAULT 'onboarding',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "status" "OfficeStatusType" NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "primaryOffice" TEXT,
    "status" "FirmMembershipStatusType" NOT NULL DEFAULT 'invited',
    "title" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "contactType" "ContactContactTypeType" NOT NULL DEFAULT 'person',
    "status" "ContactStatusType" NOT NULL DEFAULT 'prospective_client',
    "firstName" TEXT NOT NULL DEFAULT '',
    "middleName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "organizationName" TEXT NOT NULL DEFAULT '',
    "preferredName" TEXT NOT NULL DEFAULT '',
    "primaryEmail" TEXT NOT NULL DEFAULT '',
    "primaryPhone" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "governmentIdLastFour" TEXT NOT NULL DEFAULT '',
    "conflictSearchAliases" JSONB DEFAULT '[]',
    "privilegedNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "contact" TEXT,
    "label" TEXT NOT NULL DEFAULT 'Primary',
    "addressType" "AddressAddressTypeType" DEFAULT 'mailing',
    "line1" TEXT NOT NULL DEFAULT '',
    "line2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMethod" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "contact" TEXT,
    "methodType" "ContactMethodMethodTypeType" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canContact" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "intakeNumber" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "status" "IntakeStatusType" NOT NULL DEFAULT 'new',
    "source" "IntakeSourceType" DEFAULT 'other',
    "primaryContact" TEXT NOT NULL,
    "office" TEXT,
    "openedBy" TEXT,
    "assignedTo" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL DEFAULT '',
    "desiredOutcome" TEXT NOT NULL DEFAULT '',
    "adversePartySummary" TEXT NOT NULL DEFAULT '',
    "declineReason" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "convertedMatter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeParticipant" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "participantRole" "IntakeParticipantParticipantRoleType" NOT NULL,
    "status" "IntakeParticipantStatusType" DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "submittedByContact" TEXT,
    "reviewedBy" TEXT,
    "status" "IntakeSubmissionStatusType" NOT NULL DEFAULT 'submitted',
    "schemaVersion" TEXT NOT NULL DEFAULT '',
    "formSchema" JSONB,
    "responses" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "supersedes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "status" "ConsultationStatusType" NOT NULL DEFAULT 'requested',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "office" TEXT,
    "host" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "outcome" "ConsultationOutcomeType" DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictCheck" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "checkNumber" TEXT NOT NULL DEFAULT '',
    "status" "ConflictCheckStatusType" NOT NULL DEFAULT 'requested',
    "intake" TEXT,
    "matter" TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "searchScope" "ConflictCheckSearchScopeType" DEFAULT 'contacts_and_matters',
    "searchVersion" TEXT NOT NULL DEFAULT 'v1',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL DEFAULT '',
    "failureReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictSearchTerm" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "check" TEXT NOT NULL,
    "term" TEXT NOT NULL DEFAULT '',
    "normalizedTerm" TEXT NOT NULL DEFAULT '',
    "termType" "ConflictSearchTermTermTypeType" NOT NULL,
    "sourceContact" TEXT,
    "includeAliases" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictSearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictMatch" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "check" TEXT NOT NULL,
    "status" "ConflictMatchStatusType" NOT NULL DEFAULT 'potential',
    "matchType" "ConflictMatchMatchTypeType" NOT NULL,
    "matchedContact" TEXT,
    "matchedMatter" TEXT,
    "matchedMatterParty" TEXT,
    "score" INTEGER,
    "matchedValue" TEXT NOT NULL DEFAULT '',
    "evidenceExcerpt" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictDisposition" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "check" TEXT NOT NULL,
    "match" TEXT,
    "outcome" "ConflictDispositionOutcomeType" NOT NULL,
    "reviewer" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "conditions" TEXT NOT NULL DEFAULT '',
    "policyReference" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeArea" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "status" "PracticeAreaStatusType" DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matterNumber" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "status" "MatterStatusType" NOT NULL DEFAULT 'proposed',
    "confidentiality" "MatterConfidentialityType" NOT NULL DEFAULT 'standard',
    "client" TEXT NOT NULL,
    "office" TEXT,
    "practiceArea" TEXT,
    "responsibleAttorney" TEXT,
    "originatingAttorney" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "billingType" "MatterBillingTypeType" DEFAULT 'hourly',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT NOT NULL DEFAULT '',
    "customData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterParty" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "partyRole" "MatterPartyPartyRoleType" NOT NULL,
    "side" "MatterPartySideType" DEFAULT 'unknown',
    "representedBy" TEXT,
    "counselContact" TEXT,
    "status" "MatterPartyStatusType" DEFAULT 'active',
    "isPrimaryClient" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterTeamMember" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "office" TEXT,
    "teamRole" "MatterTeamMemberTeamRoleType" NOT NULL,
    "status" "MatterTeamMemberStatusType" NOT NULL DEFAULT 'active',
    "canAccessRestricted" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canBill" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicalWall" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "EthicalWallStatusType" NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL DEFAULT '',
    "policyReference" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EthicalWall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicalWallMember" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "wall" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "decision" "EthicalWallMemberDecisionType" NOT NULL,
    "status" "EthicalWallMemberStatusType" DEFAULT 'active',
    "approvedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "effectiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EthicalWallMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterStatusEvent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "actorUser" TEXT,
    "actorAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "courtType" "CourtCourtTypeType" NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "division" TEXT NOT NULL DEFAULT '',
    "status" "CourtStatusType" DEFAULT 'active',
    "address" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "filingUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Docket" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "docketNumber" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "status" "DocketStatusType" NOT NULL DEFAULT 'active',
    "judgeContact" TEXT,
    "clerkContact" TEXT,
    "filedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Docket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocketEntry" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "docket" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "entryType" "DocketEntryEntryTypeType" NOT NULL,
    "status" "DocketEntryStatusType" NOT NULL DEFAULT 'draft',
    "externalEntryId" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "filedAt" TIMESTAMP(3),
    "enteredAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "documentVersion" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocketEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "docket" TEXT,
    "sourceEntry" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "DeadlineStatusType" NOT NULL DEFAULT 'draft',
    "deadlineType" "DeadlineDeadlineTypeType" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "source" "DeadlineSourceType" DEFAULT 'manual',
    "calculationMethod" TEXT NOT NULL DEFAULT '',
    "ruleReference" TEXT NOT NULL DEFAULT '',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "completedAt" TIMESTAMP(3),
    "parentDeadline" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalTask" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "deadline" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "LegalTaskStatusType" NOT NULL DEFAULT 'open',
    "priority" "LegalTaskPriorityType" DEFAULT 'normal',
    "assignedTo" TEXT,
    "assignedBy" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "parentTask" TEXT,
    "blockedReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationThread" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "intake" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "status" "CommunicationThreadStatusType" NOT NULL DEFAULT 'open',
    "primaryChannel" "CommunicationThreadPrimaryChannelType" DEFAULT 'email',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationParticipant" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "thread" TEXT NOT NULL,
    "user" TEXT,
    "contact" TEXT,
    "portalAccount" TEXT,
    "participantRole" "CommunicationParticipantParticipantRoleType" NOT NULL,
    "status" "CommunicationParticipantStatusType" DEFAULT 'active',
    "displayAddress" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "thread" TEXT NOT NULL,
    "direction" "CommunicationMessageDirectionType" NOT NULL,
    "channel" "CommunicationMessageChannelType" NOT NULL,
    "status" "CommunicationMessageStatusType" NOT NULL DEFAULT 'draft',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "senderUser" TEXT,
    "senderContact" TEXT,
    "senderAgent" TEXT,
    "externalMessageId" TEXT NOT NULL DEFAULT '',
    "replyToMessage" TEXT,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDelivery" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "message" TEXT NOT NULL,
    "integrationConnection" TEXT,
    "channel" "CommunicationDeliveryChannelType" NOT NULL,
    "status" "CommunicationDeliveryStatusType" NOT NULL DEFAULT 'pending',
    "recipientContact" TEXT,
    "recipientAddress" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "providerMessageId" TEXT NOT NULL DEFAULT '',
    "attemptCount" INTEGER DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "intake" TEXT,
    "contact" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "DocumentStatusType" NOT NULL DEFAULT 'draft',
    "category" "DocumentCategoryType" DEFAULT 'other',
    "confidentiality" "DocumentConfidentialityType" DEFAULT 'matter',
    "description" TEXT NOT NULL DEFAULT '',
    "currentVersion" TEXT,
    "archivedAt" TIMESTAMP(3),
    "disposedAt" TIMESTAMP(3),
    "retentionPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "document" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL DEFAULT '',
    "versionNumber" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "objectKey" TEXT NOT NULL DEFAULT '',
    "mediaType" TEXT NOT NULL DEFAULT '',
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL DEFAULT '',
    "source" "DocumentVersionSourceType" DEFAULT 'upload',
    "createdBy" TEXT,
    "sourceMessage" TEXT,
    "sourceDocketEntry" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "documentVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "SignatureRequestStatusType" NOT NULL DEFAULT 'draft',
    "provider" TEXT NOT NULL DEFAULT '',
    "integrationConnection" TEXT,
    "providerRequestId" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSigner" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "request" TEXT NOT NULL,
    "contact" TEXT,
    "portalAccount" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "signingOrder" INTEGER DEFAULT 1,
    "status" "DocumentSignerStatusType" NOT NULL DEFAULT 'pending',
    "providerSignerId" TEXT NOT NULL DEFAULT '',
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEvent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "request" TEXT NOT NULL,
    "signer" TEXT,
    "eventType" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "actorReference" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "RateCardStatusType" NOT NULL DEFAULT 'draft',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateRule" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "rateCard" TEXT NOT NULL,
    "user" TEXT,
    "practiceArea" TEXT,
    "rateType" "RateRuleRateTypeType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "unitLabel" TEXT NOT NULL DEFAULT 'hour',
    "priority" INTEGER DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "task" TEXT,
    "status" "TimeEntryStatusType" NOT NULL DEFAULT 'draft',
    "workDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "rateMinor" INTEGER,
    "amountMinor" INTEGER,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "incurredBy" TEXT,
    "vendor" TEXT,
    "receiptVersion" TEXT,
    "status" "ExpenseStatusType" NOT NULL DEFAULT 'draft',
    "expenseType" "ExpenseExpenseTypeType" DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "invoiceLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerAgreement" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "rateCard" TEXT,
    "agreementNumber" TEXT NOT NULL DEFAULT '',
    "status" "RetainerAgreementStatusType" NOT NULL DEFAULT 'draft',
    "feeStructure" "RetainerAgreementFeeStructureType" NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "initialRetainerMinor" INTEGER,
    "evergreenThresholdMinor" INTEGER,
    "replenishmentAmountMinor" INTEGER,
    "contingencyBasisPoints" INTEGER,
    "termsSummary" TEXT NOT NULL DEFAULT '',
    "signedDocumentVersion" TEXT,
    "trustLedgerAccount" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "retainer" TEXT,
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "status" "InvoiceStatusType" NOT NULL DEFAULT 'draft',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "balanceDueMinor" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "timeEntry" TEXT,
    "lineType" "InvoiceLineLineTypeType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER DEFAULT 1,
    "unitAmountMinor" INTEGER NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER DEFAULT 0,
    "taxMinor" INTEGER DEFAULT 0,
    "lineTotalMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "sourceRecordId" TEXT NOT NULL DEFAULT '',
    "serviceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustAccount" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "office" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "accountType" "TrustAccountAccountTypeType" NOT NULL DEFAULT 'trust',
    "status" "TrustAccountStatusType" NOT NULL DEFAULT 'pending',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "financialInstitutionName" TEXT NOT NULL DEFAULT '',
    "bankAccountLastFour" TEXT NOT NULL DEFAULT '',
    "externalAccountReference" TEXT NOT NULL DEFAULT '',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustLedgerAccount" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "trustAccount" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "ledgerNumber" TEXT NOT NULL DEFAULT '',
    "status" "TrustLedgerAccountStatusType" NOT NULL DEFAULT 'active',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "openedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "freezeReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustLedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustTransaction" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "postingDigest" TEXT NOT NULL DEFAULT '',
    "trustAccount" TEXT NOT NULL,
    "transactionType" "TrustTransactionTransactionTypeType" NOT NULL,
    "status" "TrustTransactionStatusType" NOT NULL DEFAULT 'posted',
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedBy" TEXT,
    "postedByAgent" TEXT,
    "sourcePayment" TEXT,
    "sourceRefund" TEXT,
    "reversesTransaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustLedgerEntry" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "transaction" TEXT NOT NULL,
    "trustAccount" TEXT NOT NULL,
    "ledgerAccount" TEXT,
    "accountingBucket" "TrustLedgerEntryAccountingBucketType" NOT NULL,
    "direction" "TrustLedgerEntryDirectionType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "trustAccount" TEXT NOT NULL,
    "ledgerAccount" TEXT,
    "reconciliation" TEXT,
    "snapshotType" "TrustBalanceSnapshotSnapshotTypeType" NOT NULL,
    "balanceMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustReconciliation" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "trustAccount" TEXT NOT NULL,
    "status" "TrustReconciliationStatusType" NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "statementBalanceMinor" INTEGER NOT NULL,
    "bookBalanceMinor" INTEGER NOT NULL,
    "differenceMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "invoice" TEXT,
    "trustAccount" TEXT,
    "payer" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "paymentType" "PaymentPaymentTypeType" NOT NULL,
    "status" "PaymentStatusType" NOT NULL DEFAULT 'pending',
    "amountMinor" INTEGER NOT NULL,
    "refundedMinor" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "integrationConnection" TEXT,
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT NOT NULL DEFAULT '',
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "payment" TEXT NOT NULL,
    "invoice" TEXT,
    "trustTransaction" TEXT,
    "allocationType" "PaymentAllocationAllocationTypeType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "allocatedBy" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesAllocation" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "payment" TEXT NOT NULL,
    "invoice" TEXT,
    "refundNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" "RefundStatusType" NOT NULL DEFAULT 'requested',
    "reason" "RefundReasonType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "explanation" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "failureReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccount" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "user" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "status" "PortalAccountStatusType" NOT NULL DEFAULT 'invited',
    "inviteTokenDigest" TEXT NOT NULL DEFAULT '',
    "resetTokenDigest" TEXT NOT NULL DEFAULT '',
    "inviteExpiresAt" TIMESTAMP(3),
    "resetExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMatterAccess" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "portalAccount" TEXT NOT NULL,
    "status" "PortalMatterAccessStatusType" NOT NULL DEFAULT 'active',
    "canReadDocuments" BOOLEAN NOT NULL DEFAULT false,
    "canUploadDocuments" BOOLEAN NOT NULL DEFAULT false,
    "canReadInvoices" BOOLEAN NOT NULL DEFAULT false,
    "canReadMessages" BOOLEAN NOT NULL DEFAULT false,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMatterAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalShare" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "portalAccount" TEXT NOT NULL,
    "matterAccess" TEXT NOT NULL,
    "status" "PortalShareStatusType" NOT NULL DEFAULT 'active',
    "resourceType" "PortalShareResourceTypeType" NOT NULL,
    "document" TEXT,
    "documentVersion" TEXT,
    "invoice" TEXT,
    "communicationThread" TEXT,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "office" TEXT,
    "owner" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "category" "IntegrationConnectionCategoryType" NOT NULL,
    "status" "IntegrationConnectionStatusType" NOT NULL DEFAULT 'pending',
    "credentialsEncrypted" TEXT NOT NULL DEFAULT '',
    "oauthAccessToken" TEXT NOT NULL DEFAULT '',
    "oauthRefreshToken" TEXT NOT NULL DEFAULT '',
    "webhookSecretDigest" TEXT NOT NULL DEFAULT '',
    "configuration" JSONB,
    "externalAccountId" TEXT NOT NULL DEFAULT '',
    "lastSyncedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRecordLink" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "connection" TEXT NOT NULL,
    "resourceType" "ExternalRecordLinkResourceTypeType" NOT NULL,
    "externalId" TEXT NOT NULL DEFAULT '',
    "externalUrl" TEXT NOT NULL DEFAULT '',
    "status" "ExternalRecordLinkStatusType" DEFAULT 'linked',
    "contact" TEXT,
    "intake" TEXT,
    "matter" TEXT,
    "document" TEXT,
    "invoice" TEXT,
    "payment" TEXT,
    "docket" TEXT,
    "fingerprint" TEXT NOT NULL DEFAULT '',
    "providerMetadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRecordLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "office" TEXT,
    "connection" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "WebhookSubscriptionStatusType" NOT NULL DEFAULT 'active',
    "endpointUrl" TEXT NOT NULL DEFAULT '',
    "eventTypes" JSONB NOT NULL DEFAULT '[]',
    "signingSecretDigest" TEXT NOT NULL DEFAULT '',
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "connection" TEXT NOT NULL,
    "subscription" TEXT NOT NULL,
    "eventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "status" "WebhookDeliveryStatusType" NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "attemptCount" INTEGER DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "delivery" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestDigest" TEXT NOT NULL DEFAULT '',
    "responseStatus" INTEGER,
    "responseDigest" TEXT NOT NULL DEFAULT '',
    "succeeded" "WebhookDeliveryAttemptSucceededType" NOT NULL,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "status" "RetentionPolicyStatusType" NOT NULL DEFAULT 'draft',
    "recordClass" "RetentionPolicyRecordClassType" NOT NULL,
    "trigger" "RetentionPolicyTriggerType" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "practiceArea" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "jurisdictionReference" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionHold" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "policy" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "RetentionHoldStatusType" NOT NULL DEFAULT 'active',
    "matter" TEXT,
    "document" TEXT,
    "contact" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionAction" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "policy" TEXT,
    "hold" TEXT,
    "actionType" "RetentionActionActionTypeType" NOT NULL,
    "resourceType" "RetentionActionResourceTypeType" NOT NULL,
    "matter" TEXT,
    "document" TEXT,
    "contact" TEXT,
    "communicationThread" TEXT,
    "invoice" TEXT,
    "performedBy" TEXT,
    "performedByAgent" TEXT,
    "approvedBy" TEXT,
    "evidenceDigest" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "eventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "category" "AuditEventCategoryType" NOT NULL,
    "outcome" "AuditEventOutcomeType" NOT NULL,
    "actorUser" TEXT,
    "actorAgent" TEXT,
    "actorType" TEXT NOT NULL DEFAULT '',
    "matter" TEXT,
    "contact" TEXT,
    "intake" TEXT,
    "document" TEXT,
    "invoice" TEXT,
    "payment" TEXT,
    "trustTransaction" TEXT,
    "agentAction" TEXT,
    "sourceIp" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPrincipal" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "agentType" "AgentPrincipalAgentTypeType" NOT NULL,
    "status" "AgentPrincipalStatusType" NOT NULL DEFAULT 'draft',
    "provider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPrincipal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCredential" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "agentPrincipal" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "prefix" TEXT NOT NULL DEFAULT '',
    "secretHash" TEXT NOT NULL DEFAULT '',
    "status" "AgentCredentialStatusType" NOT NULL DEFAULT 'active',
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGrant" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "agentPrincipal" TEXT NOT NULL,
    "status" "AgentGrantStatusType" NOT NULL DEFAULT 'proposed',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "agentPrincipal" TEXT NOT NULL,
    "grant" TEXT NOT NULL,
    "actionNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "actionType" TEXT NOT NULL,
    "status" "AgentActionStatusType" NOT NULL DEFAULT 'requested',
    "riskLevel" "AgentActionRiskLevelType" NOT NULL DEFAULT 'high',
    "requestDigest" TEXT NOT NULL DEFAULT '',
    "requestEnvelope" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requestedByUser" TEXT,
    "approvedBy" TEXT,
    "approvalDigest" TEXT NOT NULL DEFAULT '',
    "approvalExpiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "contact" TEXT,
    "intake" TEXT,
    "document" TEXT,
    "invoice" TEXT,
    "payment" TEXT,
    "trustTransaction" TEXT,
    "deadline" TEXT,
    "task" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultDigest" TEXT NOT NULL DEFAULT '',
    "resultEnvelope" JSONB,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActionEvent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT,
    "action" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT '',
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "actorUser" TEXT,
    "actorAgent" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FirmMembership_allowedOffices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FirmMembership_allowedOffices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Consultation_participants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Consultation_participants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LegalTask_dependents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LegalTask_dependents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CommunicationMessage_attachments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CommunicationMessage_attachments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_bootstrapKey_key" ON "User"("bootstrapKey");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_activeFirm_idx" ON "User"("activeFirm");

-- CreateIndex
CREATE INDEX "Role_firm_idx" ON "Role"("firm");

-- CreateIndex
CREATE UNIQUE INDEX "Firm_slug_key" ON "Firm"("slug");

-- CreateIndex
CREATE INDEX "Office_firm_idx" ON "Office"("firm");

-- CreateIndex
CREATE INDEX "Office_code_idx" ON "Office"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Office_firm_code_key" ON "Office"("firm", "code");

-- CreateIndex
CREATE INDEX "FirmMembership_firm_idx" ON "FirmMembership"("firm");

-- CreateIndex
CREATE INDEX "FirmMembership_user_idx" ON "FirmMembership"("user");

-- CreateIndex
CREATE INDEX "FirmMembership_role_idx" ON "FirmMembership"("role");

-- CreateIndex
CREATE INDEX "FirmMembership_primaryOffice_idx" ON "FirmMembership"("primaryOffice");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMembership_firm_user_key" ON "FirmMembership"("firm", "user");

-- CreateIndex
CREATE INDEX "Contact_firm_idx" ON "Contact"("firm");

-- CreateIndex
CREATE INDEX "Address_firm_idx" ON "Address"("firm");

-- CreateIndex
CREATE INDEX "Address_contact_idx" ON "Address"("contact");

-- CreateIndex
CREATE INDEX "ContactMethod_firm_idx" ON "ContactMethod"("firm");

-- CreateIndex
CREATE INDEX "ContactMethod_contact_idx" ON "ContactMethod"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "Intake_convertedMatter_key" ON "Intake"("convertedMatter");

-- CreateIndex
CREATE INDEX "Intake_firm_idx" ON "Intake"("firm");

-- CreateIndex
CREATE INDEX "Intake_intakeNumber_idx" ON "Intake"("intakeNumber");

-- CreateIndex
CREATE INDEX "Intake_primaryContact_idx" ON "Intake"("primaryContact");

-- CreateIndex
CREATE INDEX "Intake_office_idx" ON "Intake"("office");

-- CreateIndex
CREATE INDEX "Intake_openedBy_idx" ON "Intake"("openedBy");

-- CreateIndex
CREATE INDEX "Intake_assignedTo_idx" ON "Intake"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "Intake_firm_intakeNumber_key" ON "Intake"("firm", "intakeNumber");

-- CreateIndex
CREATE INDEX "IntakeParticipant_firm_idx" ON "IntakeParticipant"("firm");

-- CreateIndex
CREATE INDEX "IntakeParticipant_intake_idx" ON "IntakeParticipant"("intake");

-- CreateIndex
CREATE INDEX "IntakeParticipant_contact_idx" ON "IntakeParticipant"("contact");

-- CreateIndex
CREATE INDEX "IntakeSubmission_firm_idx" ON "IntakeSubmission"("firm");

-- CreateIndex
CREATE INDEX "IntakeSubmission_intake_idx" ON "IntakeSubmission"("intake");

-- CreateIndex
CREATE INDEX "IntakeSubmission_submittedByContact_idx" ON "IntakeSubmission"("submittedByContact");

-- CreateIndex
CREATE INDEX "IntakeSubmission_reviewedBy_idx" ON "IntakeSubmission"("reviewedBy");

-- CreateIndex
CREATE INDEX "IntakeSubmission_supersedes_idx" ON "IntakeSubmission"("supersedes");

-- CreateIndex
CREATE INDEX "Consultation_firm_idx" ON "Consultation"("firm");

-- CreateIndex
CREATE INDEX "Consultation_intake_idx" ON "Consultation"("intake");

-- CreateIndex
CREATE INDEX "Consultation_office_idx" ON "Consultation"("office");

-- CreateIndex
CREATE INDEX "Consultation_host_idx" ON "Consultation"("host");

-- CreateIndex
CREATE INDEX "ConflictCheck_firm_idx" ON "ConflictCheck"("firm");

-- CreateIndex
CREATE INDEX "ConflictCheck_checkNumber_idx" ON "ConflictCheck"("checkNumber");

-- CreateIndex
CREATE INDEX "ConflictCheck_intake_idx" ON "ConflictCheck"("intake");

-- CreateIndex
CREATE INDEX "ConflictCheck_matter_idx" ON "ConflictCheck"("matter");

-- CreateIndex
CREATE INDEX "ConflictCheck_requestedBy_idx" ON "ConflictCheck"("requestedBy");

-- CreateIndex
CREATE INDEX "ConflictCheck_reviewedBy_idx" ON "ConflictCheck"("reviewedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictCheck_firm_checkNumber_key" ON "ConflictCheck"("firm", "checkNumber");

-- CreateIndex
CREATE INDEX "ConflictSearchTerm_firm_idx" ON "ConflictSearchTerm"("firm");

-- CreateIndex
CREATE INDEX "ConflictSearchTerm_matter_idx" ON "ConflictSearchTerm"("matter");

-- CreateIndex
CREATE INDEX "ConflictSearchTerm_check_idx" ON "ConflictSearchTerm"("check");

-- CreateIndex
CREATE INDEX "ConflictSearchTerm_normalizedTerm_idx" ON "ConflictSearchTerm"("normalizedTerm");

-- CreateIndex
CREATE INDEX "ConflictSearchTerm_sourceContact_idx" ON "ConflictSearchTerm"("sourceContact");

-- CreateIndex
CREATE INDEX "ConflictMatch_firm_idx" ON "ConflictMatch"("firm");

-- CreateIndex
CREATE INDEX "ConflictMatch_matter_idx" ON "ConflictMatch"("matter");

-- CreateIndex
CREATE INDEX "ConflictMatch_check_idx" ON "ConflictMatch"("check");

-- CreateIndex
CREATE INDEX "ConflictMatch_matchedContact_idx" ON "ConflictMatch"("matchedContact");

-- CreateIndex
CREATE INDEX "ConflictMatch_matchedMatter_idx" ON "ConflictMatch"("matchedMatter");

-- CreateIndex
CREATE INDEX "ConflictMatch_matchedMatterParty_idx" ON "ConflictMatch"("matchedMatterParty");

-- CreateIndex
CREATE INDEX "ConflictMatch_reviewedBy_idx" ON "ConflictMatch"("reviewedBy");

-- CreateIndex
CREATE INDEX "ConflictDisposition_firm_idx" ON "ConflictDisposition"("firm");

-- CreateIndex
CREATE INDEX "ConflictDisposition_matter_idx" ON "ConflictDisposition"("matter");

-- CreateIndex
CREATE INDEX "ConflictDisposition_check_idx" ON "ConflictDisposition"("check");

-- CreateIndex
CREATE INDEX "ConflictDisposition_match_idx" ON "ConflictDisposition"("match");

-- CreateIndex
CREATE INDEX "ConflictDisposition_reviewer_idx" ON "ConflictDisposition"("reviewer");

-- CreateIndex
CREATE INDEX "PracticeArea_firm_idx" ON "PracticeArea"("firm");

-- CreateIndex
CREATE INDEX "PracticeArea_code_idx" ON "PracticeArea"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeArea_firm_code_key" ON "PracticeArea"("firm", "code");

-- CreateIndex
CREATE INDEX "Matter_firm_idx" ON "Matter"("firm");

-- CreateIndex
CREATE INDEX "Matter_matterNumber_idx" ON "Matter"("matterNumber");

-- CreateIndex
CREATE INDEX "Matter_client_idx" ON "Matter"("client");

-- CreateIndex
CREATE INDEX "Matter_office_idx" ON "Matter"("office");

-- CreateIndex
CREATE INDEX "Matter_practiceArea_idx" ON "Matter"("practiceArea");

-- CreateIndex
CREATE INDEX "Matter_responsibleAttorney_idx" ON "Matter"("responsibleAttorney");

-- CreateIndex
CREATE INDEX "Matter_originatingAttorney_idx" ON "Matter"("originatingAttorney");

-- CreateIndex
CREATE UNIQUE INDEX "Matter_firm_matterNumber_key" ON "Matter"("firm", "matterNumber");

-- CreateIndex
CREATE INDEX "MatterParty_firm_idx" ON "MatterParty"("firm");

-- CreateIndex
CREATE INDEX "MatterParty_matter_idx" ON "MatterParty"("matter");

-- CreateIndex
CREATE INDEX "MatterParty_contact_idx" ON "MatterParty"("contact");

-- CreateIndex
CREATE INDEX "MatterParty_representedBy_idx" ON "MatterParty"("representedBy");

-- CreateIndex
CREATE INDEX "MatterParty_counselContact_idx" ON "MatterParty"("counselContact");

-- CreateIndex
CREATE INDEX "MatterTeamMember_firm_idx" ON "MatterTeamMember"("firm");

-- CreateIndex
CREATE INDEX "MatterTeamMember_matter_idx" ON "MatterTeamMember"("matter");

-- CreateIndex
CREATE INDEX "MatterTeamMember_user_idx" ON "MatterTeamMember"("user");

-- CreateIndex
CREATE INDEX "MatterTeamMember_office_idx" ON "MatterTeamMember"("office");

-- CreateIndex
CREATE UNIQUE INDEX "MatterTeamMember_matter_user_key" ON "MatterTeamMember"("matter", "user");

-- CreateIndex
CREATE INDEX "EthicalWall_firm_idx" ON "EthicalWall"("firm");

-- CreateIndex
CREATE INDEX "EthicalWall_matter_idx" ON "EthicalWall"("matter");

-- CreateIndex
CREATE INDEX "EthicalWall_createdBy_idx" ON "EthicalWall"("createdBy");

-- CreateIndex
CREATE INDEX "EthicalWall_approvedBy_idx" ON "EthicalWall"("approvedBy");

-- CreateIndex
CREATE INDEX "EthicalWallMember_firm_idx" ON "EthicalWallMember"("firm");

-- CreateIndex
CREATE INDEX "EthicalWallMember_matter_idx" ON "EthicalWallMember"("matter");

-- CreateIndex
CREATE INDEX "EthicalWallMember_wall_idx" ON "EthicalWallMember"("wall");

-- CreateIndex
CREATE INDEX "EthicalWallMember_user_idx" ON "EthicalWallMember"("user");

-- CreateIndex
CREATE INDEX "EthicalWallMember_approvedBy_idx" ON "EthicalWallMember"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "EthicalWallMember_wall_user_key" ON "EthicalWallMember"("wall", "user");

-- CreateIndex
CREATE INDEX "MatterStatusEvent_firm_idx" ON "MatterStatusEvent"("firm");

-- CreateIndex
CREATE INDEX "MatterStatusEvent_matter_idx" ON "MatterStatusEvent"("matter");

-- CreateIndex
CREATE INDEX "MatterStatusEvent_actorUser_idx" ON "MatterStatusEvent"("actorUser");

-- CreateIndex
CREATE INDEX "MatterStatusEvent_actorAgent_idx" ON "MatterStatusEvent"("actorAgent");

-- CreateIndex
CREATE INDEX "Court_firm_idx" ON "Court"("firm");

-- CreateIndex
CREATE INDEX "Court_jurisdictionCode_idx" ON "Court"("jurisdictionCode");

-- CreateIndex
CREATE INDEX "Court_address_idx" ON "Court"("address");

-- CreateIndex
CREATE INDEX "Docket_firm_idx" ON "Docket"("firm");

-- CreateIndex
CREATE INDEX "Docket_matter_idx" ON "Docket"("matter");

-- CreateIndex
CREATE INDEX "Docket_court_idx" ON "Docket"("court");

-- CreateIndex
CREATE INDEX "Docket_docketNumber_idx" ON "Docket"("docketNumber");

-- CreateIndex
CREATE INDEX "Docket_judgeContact_idx" ON "Docket"("judgeContact");

-- CreateIndex
CREATE INDEX "Docket_clerkContact_idx" ON "Docket"("clerkContact");

-- CreateIndex
CREATE UNIQUE INDEX "Docket_matter_docketNumber_key" ON "Docket"("matter", "docketNumber");

-- CreateIndex
CREATE INDEX "DocketEntry_firm_idx" ON "DocketEntry"("firm");

-- CreateIndex
CREATE INDEX "DocketEntry_matter_idx" ON "DocketEntry"("matter");

-- CreateIndex
CREATE INDEX "DocketEntry_docket_idx" ON "DocketEntry"("docket");

-- CreateIndex
CREATE INDEX "DocketEntry_documentVersion_idx" ON "DocketEntry"("documentVersion");

-- CreateIndex
CREATE INDEX "DocketEntry_verifiedBy_idx" ON "DocketEntry"("verifiedBy");

-- CreateIndex
CREATE INDEX "Deadline_firm_idx" ON "Deadline"("firm");

-- CreateIndex
CREATE INDEX "Deadline_matter_idx" ON "Deadline"("matter");

-- CreateIndex
CREATE INDEX "Deadline_docket_idx" ON "Deadline"("docket");

-- CreateIndex
CREATE INDEX "Deadline_sourceEntry_idx" ON "Deadline"("sourceEntry");

-- CreateIndex
CREATE INDEX "Deadline_verifiedBy_idx" ON "Deadline"("verifiedBy");

-- CreateIndex
CREATE INDEX "Deadline_assignedTo_idx" ON "Deadline"("assignedTo");

-- CreateIndex
CREATE INDEX "Deadline_parentDeadline_idx" ON "Deadline"("parentDeadline");

-- CreateIndex
CREATE INDEX "LegalTask_firm_idx" ON "LegalTask"("firm");

-- CreateIndex
CREATE INDEX "LegalTask_matter_idx" ON "LegalTask"("matter");

-- CreateIndex
CREATE INDEX "LegalTask_deadline_idx" ON "LegalTask"("deadline");

-- CreateIndex
CREATE INDEX "LegalTask_assignedTo_idx" ON "LegalTask"("assignedTo");

-- CreateIndex
CREATE INDEX "LegalTask_assignedBy_idx" ON "LegalTask"("assignedBy");

-- CreateIndex
CREATE INDEX "LegalTask_parentTask_idx" ON "LegalTask"("parentTask");

-- CreateIndex
CREATE INDEX "CommunicationThread_firm_idx" ON "CommunicationThread"("firm");

-- CreateIndex
CREATE INDEX "CommunicationThread_matter_idx" ON "CommunicationThread"("matter");

-- CreateIndex
CREATE INDEX "CommunicationThread_intake_idx" ON "CommunicationThread"("intake");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_firm_idx" ON "CommunicationParticipant"("firm");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_matter_idx" ON "CommunicationParticipant"("matter");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_thread_idx" ON "CommunicationParticipant"("thread");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_user_idx" ON "CommunicationParticipant"("user");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_contact_idx" ON "CommunicationParticipant"("contact");

-- CreateIndex
CREATE INDEX "CommunicationParticipant_portalAccount_idx" ON "CommunicationParticipant"("portalAccount");

-- CreateIndex
CREATE INDEX "CommunicationMessage_firm_idx" ON "CommunicationMessage"("firm");

-- CreateIndex
CREATE INDEX "CommunicationMessage_matter_idx" ON "CommunicationMessage"("matter");

-- CreateIndex
CREATE INDEX "CommunicationMessage_thread_idx" ON "CommunicationMessage"("thread");

-- CreateIndex
CREATE INDEX "CommunicationMessage_senderUser_idx" ON "CommunicationMessage"("senderUser");

-- CreateIndex
CREATE INDEX "CommunicationMessage_senderContact_idx" ON "CommunicationMessage"("senderContact");

-- CreateIndex
CREATE INDEX "CommunicationMessage_senderAgent_idx" ON "CommunicationMessage"("senderAgent");

-- CreateIndex
CREATE INDEX "CommunicationMessage_externalMessageId_idx" ON "CommunicationMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_replyToMessage_idx" ON "CommunicationMessage"("replyToMessage");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_firm_idx" ON "CommunicationDelivery"("firm");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_matter_idx" ON "CommunicationDelivery"("matter");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_message_idx" ON "CommunicationDelivery"("message");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_integrationConnection_idx" ON "CommunicationDelivery"("integrationConnection");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_recipientContact_idx" ON "CommunicationDelivery"("recipientContact");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_providerMessageId_idx" ON "CommunicationDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "Document_firm_idx" ON "Document"("firm");

-- CreateIndex
CREATE INDEX "Document_matter_idx" ON "Document"("matter");

-- CreateIndex
CREATE INDEX "Document_intake_idx" ON "Document"("intake");

-- CreateIndex
CREATE INDEX "Document_contact_idx" ON "Document"("contact");

-- CreateIndex
CREATE INDEX "Document_currentVersion_idx" ON "Document"("currentVersion");

-- CreateIndex
CREATE INDEX "Document_retentionPolicy_idx" ON "Document"("retentionPolicy");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_versionKey_key" ON "DocumentVersion"("versionKey");

-- CreateIndex
CREATE INDEX "DocumentVersion_firm_idx" ON "DocumentVersion"("firm");

-- CreateIndex
CREATE INDEX "DocumentVersion_matter_idx" ON "DocumentVersion"("matter");

-- CreateIndex
CREATE INDEX "DocumentVersion_document_idx" ON "DocumentVersion"("document");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdBy_idx" ON "DocumentVersion"("createdBy");

-- CreateIndex
CREATE INDEX "DocumentVersion_sourceMessage_idx" ON "DocumentVersion"("sourceMessage");

-- CreateIndex
CREATE INDEX "DocumentVersion_sourceDocketEntry_idx" ON "DocumentVersion"("sourceDocketEntry");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_document_versionNumber_key" ON "DocumentVersion"("document", "versionNumber");

-- CreateIndex
CREATE INDEX "SignatureRequest_firm_idx" ON "SignatureRequest"("firm");

-- CreateIndex
CREATE INDEX "SignatureRequest_matter_idx" ON "SignatureRequest"("matter");

-- CreateIndex
CREATE INDEX "SignatureRequest_documentVersion_idx" ON "SignatureRequest"("documentVersion");

-- CreateIndex
CREATE INDEX "SignatureRequest_integrationConnection_idx" ON "SignatureRequest"("integrationConnection");

-- CreateIndex
CREATE INDEX "SignatureRequest_providerRequestId_idx" ON "SignatureRequest"("providerRequestId");

-- CreateIndex
CREATE INDEX "DocumentSigner_firm_idx" ON "DocumentSigner"("firm");

-- CreateIndex
CREATE INDEX "DocumentSigner_matter_idx" ON "DocumentSigner"("matter");

-- CreateIndex
CREATE INDEX "DocumentSigner_request_idx" ON "DocumentSigner"("request");

-- CreateIndex
CREATE INDEX "DocumentSigner_contact_idx" ON "DocumentSigner"("contact");

-- CreateIndex
CREATE INDEX "DocumentSigner_portalAccount_idx" ON "DocumentSigner"("portalAccount");

-- CreateIndex
CREATE INDEX "DocumentSigner_providerSignerId_idx" ON "DocumentSigner"("providerSignerId");

-- CreateIndex
CREATE INDEX "SignatureEvent_firm_idx" ON "SignatureEvent"("firm");

-- CreateIndex
CREATE INDEX "SignatureEvent_matter_idx" ON "SignatureEvent"("matter");

-- CreateIndex
CREATE INDEX "SignatureEvent_request_idx" ON "SignatureEvent"("request");

-- CreateIndex
CREATE INDEX "SignatureEvent_signer_idx" ON "SignatureEvent"("signer");

-- CreateIndex
CREATE INDEX "SignatureEvent_providerEventId_idx" ON "SignatureEvent"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureEvent_firm_providerEventId_key" ON "SignatureEvent"("firm", "providerEventId");

-- CreateIndex
CREATE INDEX "RateCard_firm_idx" ON "RateCard"("firm");

-- CreateIndex
CREATE INDEX "RateCard_matter_idx" ON "RateCard"("matter");

-- CreateIndex
CREATE INDEX "RateRule_firm_idx" ON "RateRule"("firm");

-- CreateIndex
CREATE INDEX "RateRule_matter_idx" ON "RateRule"("matter");

-- CreateIndex
CREATE INDEX "RateRule_rateCard_idx" ON "RateRule"("rateCard");

-- CreateIndex
CREATE INDEX "RateRule_user_idx" ON "RateRule"("user");

-- CreateIndex
CREATE INDEX "RateRule_practiceArea_idx" ON "RateRule"("practiceArea");

-- CreateIndex
CREATE INDEX "TimeEntry_firm_idx" ON "TimeEntry"("firm");

-- CreateIndex
CREATE INDEX "TimeEntry_matter_idx" ON "TimeEntry"("matter");

-- CreateIndex
CREATE INDEX "TimeEntry_user_idx" ON "TimeEntry"("user");

-- CreateIndex
CREATE INDEX "TimeEntry_task_idx" ON "TimeEntry"("task");

-- CreateIndex
CREATE INDEX "TimeEntry_approvedBy_idx" ON "TimeEntry"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_invoiceLine_key" ON "Expense"("invoiceLine");

-- CreateIndex
CREATE INDEX "Expense_firm_idx" ON "Expense"("firm");

-- CreateIndex
CREATE INDEX "Expense_matter_idx" ON "Expense"("matter");

-- CreateIndex
CREATE INDEX "Expense_incurredBy_idx" ON "Expense"("incurredBy");

-- CreateIndex
CREATE INDEX "Expense_vendor_idx" ON "Expense"("vendor");

-- CreateIndex
CREATE INDEX "Expense_receiptVersion_idx" ON "Expense"("receiptVersion");

-- CreateIndex
CREATE INDEX "Expense_approvedBy_idx" ON "Expense"("approvedBy");

-- CreateIndex
CREATE INDEX "RetainerAgreement_firm_idx" ON "RetainerAgreement"("firm");

-- CreateIndex
CREATE INDEX "RetainerAgreement_matter_idx" ON "RetainerAgreement"("matter");

-- CreateIndex
CREATE INDEX "RetainerAgreement_client_idx" ON "RetainerAgreement"("client");

-- CreateIndex
CREATE INDEX "RetainerAgreement_rateCard_idx" ON "RetainerAgreement"("rateCard");

-- CreateIndex
CREATE INDEX "RetainerAgreement_agreementNumber_idx" ON "RetainerAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "RetainerAgreement_signedDocumentVersion_idx" ON "RetainerAgreement"("signedDocumentVersion");

-- CreateIndex
CREATE INDEX "RetainerAgreement_trustLedgerAccount_idx" ON "RetainerAgreement"("trustLedgerAccount");

-- CreateIndex
CREATE UNIQUE INDEX "RetainerAgreement_firm_agreementNumber_key" ON "RetainerAgreement"("firm", "agreementNumber");

-- CreateIndex
CREATE INDEX "Invoice_firm_idx" ON "Invoice"("firm");

-- CreateIndex
CREATE INDEX "Invoice_matter_idx" ON "Invoice"("matter");

-- CreateIndex
CREATE INDEX "Invoice_client_idx" ON "Invoice"("client");

-- CreateIndex
CREATE INDEX "Invoice_retainer_idx" ON "Invoice"("retainer");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_firm_invoiceNumber_key" ON "Invoice"("firm", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_timeEntry_key" ON "InvoiceLine"("timeEntry");

-- CreateIndex
CREATE INDEX "InvoiceLine_firm_idx" ON "InvoiceLine"("firm");

-- CreateIndex
CREATE INDEX "InvoiceLine_matter_idx" ON "InvoiceLine"("matter");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_idx" ON "InvoiceLine"("invoice");

-- CreateIndex
CREATE INDEX "TrustAccount_firm_idx" ON "TrustAccount"("firm");

-- CreateIndex
CREATE INDEX "TrustAccount_office_idx" ON "TrustAccount"("office");

-- CreateIndex
CREATE INDEX "TrustLedgerAccount_firm_idx" ON "TrustLedgerAccount"("firm");

-- CreateIndex
CREATE INDEX "TrustLedgerAccount_matter_idx" ON "TrustLedgerAccount"("matter");

-- CreateIndex
CREATE INDEX "TrustLedgerAccount_trustAccount_idx" ON "TrustLedgerAccount"("trustAccount");

-- CreateIndex
CREATE INDEX "TrustLedgerAccount_client_idx" ON "TrustLedgerAccount"("client");

-- CreateIndex
CREATE INDEX "TrustLedgerAccount_ledgerNumber_idx" ON "TrustLedgerAccount"("ledgerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrustLedgerAccount_firm_ledgerNumber_key" ON "TrustLedgerAccount"("firm", "ledgerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrustTransaction_idempotencyKey_key" ON "TrustTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TrustTransaction_firm_idx" ON "TrustTransaction"("firm");

-- CreateIndex
CREATE INDEX "TrustTransaction_transactionNumber_idx" ON "TrustTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "TrustTransaction_postingDigest_idx" ON "TrustTransaction"("postingDigest");

-- CreateIndex
CREATE INDEX "TrustTransaction_trustAccount_idx" ON "TrustTransaction"("trustAccount");

-- CreateIndex
CREATE INDEX "TrustTransaction_postedBy_idx" ON "TrustTransaction"("postedBy");

-- CreateIndex
CREATE INDEX "TrustTransaction_postedByAgent_idx" ON "TrustTransaction"("postedByAgent");

-- CreateIndex
CREATE INDEX "TrustTransaction_sourcePayment_idx" ON "TrustTransaction"("sourcePayment");

-- CreateIndex
CREATE INDEX "TrustTransaction_sourceRefund_idx" ON "TrustTransaction"("sourceRefund");

-- CreateIndex
CREATE INDEX "TrustTransaction_reversesTransaction_idx" ON "TrustTransaction"("reversesTransaction");

-- CreateIndex
CREATE UNIQUE INDEX "TrustTransaction_firm_transactionNumber_key" ON "TrustTransaction"("firm", "transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrustTransaction_reversesTransaction_key" ON "TrustTransaction"("reversesTransaction");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_firm_idx" ON "TrustLedgerEntry"("firm");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_matter_idx" ON "TrustLedgerEntry"("matter");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_transaction_idx" ON "TrustLedgerEntry"("transaction");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_trustAccount_idx" ON "TrustLedgerEntry"("trustAccount");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_ledgerAccount_idx" ON "TrustLedgerEntry"("ledgerAccount");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_firm_idx" ON "TrustBalanceSnapshot"("firm");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_matter_idx" ON "TrustBalanceSnapshot"("matter");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_trustAccount_idx" ON "TrustBalanceSnapshot"("trustAccount");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_ledgerAccount_idx" ON "TrustBalanceSnapshot"("ledgerAccount");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_reconciliation_idx" ON "TrustBalanceSnapshot"("reconciliation");

-- CreateIndex
CREATE INDEX "TrustBalanceSnapshot_createdBy_idx" ON "TrustBalanceSnapshot"("createdBy");

-- CreateIndex
CREATE INDEX "TrustReconciliation_firm_idx" ON "TrustReconciliation"("firm");

-- CreateIndex
CREATE INDEX "TrustReconciliation_trustAccount_idx" ON "TrustReconciliation"("trustAccount");

-- CreateIndex
CREATE INDEX "TrustReconciliation_reviewedBy_idx" ON "TrustReconciliation"("reviewedBy");

-- CreateIndex
CREATE UNIQUE INDEX "TrustReconciliation_trustAccount_periodStart_periodEnd_key" ON "TrustReconciliation"("trustAccount", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Payment_firm_idx" ON "Payment"("firm");

-- CreateIndex
CREATE INDEX "Payment_matter_idx" ON "Payment"("matter");

-- CreateIndex
CREATE INDEX "Payment_invoice_idx" ON "Payment"("invoice");

-- CreateIndex
CREATE INDEX "Payment_trustAccount_idx" ON "Payment"("trustAccount");

-- CreateIndex
CREATE INDEX "Payment_payer_idx" ON "Payment"("payer");

-- CreateIndex
CREATE INDEX "Payment_paymentNumber_idx" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_integrationConnection_idx" ON "Payment"("integrationConnection");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_receivedBy_idx" ON "Payment"("receivedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_firm_paymentNumber_key" ON "Payment"("firm", "paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_firm_idempotencyKey_key" ON "Payment"("firm", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_firm_idx" ON "PaymentAllocation"("firm");

-- CreateIndex
CREATE INDEX "PaymentAllocation_matter_idx" ON "PaymentAllocation"("matter");

-- CreateIndex
CREATE INDEX "PaymentAllocation_payment_idx" ON "PaymentAllocation"("payment");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoice_idx" ON "PaymentAllocation"("invoice");

-- CreateIndex
CREATE INDEX "PaymentAllocation_trustTransaction_idx" ON "PaymentAllocation"("trustTransaction");

-- CreateIndex
CREATE INDEX "PaymentAllocation_allocatedBy_idx" ON "PaymentAllocation"("allocatedBy");

-- CreateIndex
CREATE INDEX "PaymentAllocation_reversesAllocation_idx" ON "PaymentAllocation"("reversesAllocation");

-- CreateIndex
CREATE INDEX "Refund_firm_idx" ON "Refund"("firm");

-- CreateIndex
CREATE INDEX "Refund_matter_idx" ON "Refund"("matter");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_invoice_idx" ON "Refund"("invoice");

-- CreateIndex
CREATE INDEX "Refund_refundNumber_idx" ON "Refund"("refundNumber");

-- CreateIndex
CREATE INDEX "Refund_idempotencyKey_idx" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_requestedBy_idx" ON "Refund"("requestedBy");

-- CreateIndex
CREATE INDEX "Refund_approvedBy_idx" ON "Refund"("approvedBy");

-- CreateIndex
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_firm_refundNumber_key" ON "Refund"("firm", "refundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_firm_idempotencyKey_key" ON "Refund"("firm", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PortalAccount_firm_idx" ON "PortalAccount"("firm");

-- CreateIndex
CREATE INDEX "PortalAccount_contact_idx" ON "PortalAccount"("contact");

-- CreateIndex
CREATE INDEX "PortalAccount_user_idx" ON "PortalAccount"("user");

-- CreateIndex
CREATE INDEX "PortalAccount_email_idx" ON "PortalAccount"("email");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_firm_idx" ON "PortalMatterAccess"("firm");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_matter_idx" ON "PortalMatterAccess"("matter");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_portalAccount_idx" ON "PortalMatterAccess"("portalAccount");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_grantedBy_idx" ON "PortalMatterAccess"("grantedBy");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_revokedBy_idx" ON "PortalMatterAccess"("revokedBy");

-- CreateIndex
CREATE INDEX "PortalShare_firm_idx" ON "PortalShare"("firm");

-- CreateIndex
CREATE INDEX "PortalShare_matter_idx" ON "PortalShare"("matter");

-- CreateIndex
CREATE INDEX "PortalShare_portalAccount_idx" ON "PortalShare"("portalAccount");

-- CreateIndex
CREATE INDEX "PortalShare_matterAccess_idx" ON "PortalShare"("matterAccess");

-- CreateIndex
CREATE INDEX "PortalShare_document_idx" ON "PortalShare"("document");

-- CreateIndex
CREATE INDEX "PortalShare_documentVersion_idx" ON "PortalShare"("documentVersion");

-- CreateIndex
CREATE INDEX "PortalShare_invoice_idx" ON "PortalShare"("invoice");

-- CreateIndex
CREATE INDEX "PortalShare_communicationThread_idx" ON "PortalShare"("communicationThread");

-- CreateIndex
CREATE INDEX "PortalShare_grantedBy_idx" ON "PortalShare"("grantedBy");

-- CreateIndex
CREATE INDEX "PortalShare_revokedBy_idx" ON "PortalShare"("revokedBy");

-- CreateIndex
CREATE INDEX "IntegrationConnection_firm_idx" ON "IntegrationConnection"("firm");

-- CreateIndex
CREATE INDEX "IntegrationConnection_office_idx" ON "IntegrationConnection"("office");

-- CreateIndex
CREATE INDEX "IntegrationConnection_owner_idx" ON "IntegrationConnection"("owner");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_firm_idx" ON "ExternalRecordLink"("firm");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_connection_idx" ON "ExternalRecordLink"("connection");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_externalId_idx" ON "ExternalRecordLink"("externalId");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_contact_idx" ON "ExternalRecordLink"("contact");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_intake_idx" ON "ExternalRecordLink"("intake");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_matter_idx" ON "ExternalRecordLink"("matter");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_document_idx" ON "ExternalRecordLink"("document");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_invoice_idx" ON "ExternalRecordLink"("invoice");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_payment_idx" ON "ExternalRecordLink"("payment");

-- CreateIndex
CREATE INDEX "ExternalRecordLink_docket_idx" ON "ExternalRecordLink"("docket");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecordLink_connection_resourceType_externalId_key" ON "ExternalRecordLink"("connection", "resourceType", "externalId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_firm_idx" ON "WebhookSubscription"("firm");

-- CreateIndex
CREATE INDEX "WebhookSubscription_office_idx" ON "WebhookSubscription"("office");

-- CreateIndex
CREATE INDEX "WebhookSubscription_connection_idx" ON "WebhookSubscription"("connection");

-- CreateIndex
CREATE INDEX "WebhookDelivery_firm_idx" ON "WebhookDelivery"("firm");

-- CreateIndex
CREATE INDEX "WebhookDelivery_matter_idx" ON "WebhookDelivery"("matter");

-- CreateIndex
CREATE INDEX "WebhookDelivery_connection_idx" ON "WebhookDelivery"("connection");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscription_idx" ON "WebhookDelivery"("subscription");

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_firm_eventId_key" ON "WebhookDelivery"("firm", "eventId");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_firm_idx" ON "WebhookDeliveryAttempt"("firm");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_matter_idx" ON "WebhookDeliveryAttempt"("matter");

-- CreateIndex
CREATE INDEX "WebhookDeliveryAttempt_delivery_idx" ON "WebhookDeliveryAttempt"("delivery");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDeliveryAttempt_delivery_attemptNumber_key" ON "WebhookDeliveryAttempt"("delivery", "attemptNumber");

-- CreateIndex
CREATE INDEX "RetentionPolicy_firm_idx" ON "RetentionPolicy"("firm");

-- CreateIndex
CREATE INDEX "RetentionPolicy_code_idx" ON "RetentionPolicy"("code");

-- CreateIndex
CREATE INDEX "RetentionPolicy_practiceArea_idx" ON "RetentionPolicy"("practiceArea");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_firm_code_key" ON "RetentionPolicy"("firm", "code");

-- CreateIndex
CREATE INDEX "RetentionHold_firm_idx" ON "RetentionHold"("firm");

-- CreateIndex
CREATE INDEX "RetentionHold_policy_idx" ON "RetentionHold"("policy");

-- CreateIndex
CREATE INDEX "RetentionHold_matter_idx" ON "RetentionHold"("matter");

-- CreateIndex
CREATE INDEX "RetentionHold_document_idx" ON "RetentionHold"("document");

-- CreateIndex
CREATE INDEX "RetentionHold_contact_idx" ON "RetentionHold"("contact");

-- CreateIndex
CREATE INDEX "RetentionHold_createdBy_idx" ON "RetentionHold"("createdBy");

-- CreateIndex
CREATE INDEX "RetentionHold_releasedBy_idx" ON "RetentionHold"("releasedBy");

-- CreateIndex
CREATE INDEX "RetentionAction_firm_idx" ON "RetentionAction"("firm");

-- CreateIndex
CREATE INDEX "RetentionAction_policy_idx" ON "RetentionAction"("policy");

-- CreateIndex
CREATE INDEX "RetentionAction_hold_idx" ON "RetentionAction"("hold");

-- CreateIndex
CREATE INDEX "RetentionAction_matter_idx" ON "RetentionAction"("matter");

-- CreateIndex
CREATE INDEX "RetentionAction_document_idx" ON "RetentionAction"("document");

-- CreateIndex
CREATE INDEX "RetentionAction_contact_idx" ON "RetentionAction"("contact");

-- CreateIndex
CREATE INDEX "RetentionAction_communicationThread_idx" ON "RetentionAction"("communicationThread");

-- CreateIndex
CREATE INDEX "RetentionAction_invoice_idx" ON "RetentionAction"("invoice");

-- CreateIndex
CREATE INDEX "RetentionAction_performedBy_idx" ON "RetentionAction"("performedBy");

-- CreateIndex
CREATE INDEX "RetentionAction_performedByAgent_idx" ON "RetentionAction"("performedByAgent");

-- CreateIndex
CREATE INDEX "RetentionAction_approvedBy_idx" ON "RetentionAction"("approvedBy");

-- CreateIndex
CREATE INDEX "AuditEvent_firm_idx" ON "AuditEvent"("firm");

-- CreateIndex
CREATE INDEX "AuditEvent_eventId_idx" ON "AuditEvent"("eventId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUser_idx" ON "AuditEvent"("actorUser");

-- CreateIndex
CREATE INDEX "AuditEvent_actorAgent_idx" ON "AuditEvent"("actorAgent");

-- CreateIndex
CREATE INDEX "AuditEvent_matter_idx" ON "AuditEvent"("matter");

-- CreateIndex
CREATE INDEX "AuditEvent_contact_idx" ON "AuditEvent"("contact");

-- CreateIndex
CREATE INDEX "AuditEvent_intake_idx" ON "AuditEvent"("intake");

-- CreateIndex
CREATE INDEX "AuditEvent_document_idx" ON "AuditEvent"("document");

-- CreateIndex
CREATE INDEX "AuditEvent_invoice_idx" ON "AuditEvent"("invoice");

-- CreateIndex
CREATE INDEX "AuditEvent_payment_idx" ON "AuditEvent"("payment");

-- CreateIndex
CREATE INDEX "AuditEvent_trustTransaction_idx" ON "AuditEvent"("trustTransaction");

-- CreateIndex
CREATE INDEX "AuditEvent_agentAction_idx" ON "AuditEvent"("agentAction");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_firm_eventId_key" ON "AuditEvent"("firm", "eventId");

-- CreateIndex
CREATE INDEX "AgentPrincipal_firm_idx" ON "AgentPrincipal"("firm");

-- CreateIndex
CREATE INDEX "AgentPrincipal_owner_idx" ON "AgentPrincipal"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_prefix_key" ON "AgentCredential"("prefix");

-- CreateIndex
CREATE INDEX "AgentCredential_firm_idx" ON "AgentCredential"("firm");

-- CreateIndex
CREATE INDEX "AgentCredential_agentPrincipal_idx" ON "AgentCredential"("agentPrincipal");

-- CreateIndex
CREATE INDEX "AgentCredential_createdBy_idx" ON "AgentCredential"("createdBy");

-- CreateIndex
CREATE INDEX "AgentCredential_revokedBy_idx" ON "AgentCredential"("revokedBy");

-- CreateIndex
CREATE INDEX "AgentGrant_firm_idx" ON "AgentGrant"("firm");

-- CreateIndex
CREATE INDEX "AgentGrant_matter_idx" ON "AgentGrant"("matter");

-- CreateIndex
CREATE INDEX "AgentGrant_agentPrincipal_idx" ON "AgentGrant"("agentPrincipal");

-- CreateIndex
CREATE INDEX "AgentGrant_requestedBy_idx" ON "AgentGrant"("requestedBy");

-- CreateIndex
CREATE INDEX "AgentGrant_approvedBy_idx" ON "AgentGrant"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAction_idempotencyKey_key" ON "AgentAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentAction_firm_idx" ON "AgentAction"("firm");

-- CreateIndex
CREATE INDEX "AgentAction_matter_idx" ON "AgentAction"("matter");

-- CreateIndex
CREATE INDEX "AgentAction_agentPrincipal_idx" ON "AgentAction"("agentPrincipal");

-- CreateIndex
CREATE INDEX "AgentAction_grant_idx" ON "AgentAction"("grant");

-- CreateIndex
CREATE INDEX "AgentAction_actionNumber_idx" ON "AgentAction"("actionNumber");

-- CreateIndex
CREATE INDEX "AgentAction_requestedByUser_idx" ON "AgentAction"("requestedByUser");

-- CreateIndex
CREATE INDEX "AgentAction_approvedBy_idx" ON "AgentAction"("approvedBy");

-- CreateIndex
CREATE INDEX "AgentAction_contact_idx" ON "AgentAction"("contact");

-- CreateIndex
CREATE INDEX "AgentAction_intake_idx" ON "AgentAction"("intake");

-- CreateIndex
CREATE INDEX "AgentAction_document_idx" ON "AgentAction"("document");

-- CreateIndex
CREATE INDEX "AgentAction_invoice_idx" ON "AgentAction"("invoice");

-- CreateIndex
CREATE INDEX "AgentAction_payment_idx" ON "AgentAction"("payment");

-- CreateIndex
CREATE INDEX "AgentAction_trustTransaction_idx" ON "AgentAction"("trustTransaction");

-- CreateIndex
CREATE INDEX "AgentAction_deadline_idx" ON "AgentAction"("deadline");

-- CreateIndex
CREATE INDEX "AgentAction_task_idx" ON "AgentAction"("task");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAction_firm_actionNumber_key" ON "AgentAction"("firm", "actionNumber");

-- CreateIndex
CREATE INDEX "AgentActionEvent_firm_idx" ON "AgentActionEvent"("firm");

-- CreateIndex
CREATE INDEX "AgentActionEvent_matter_idx" ON "AgentActionEvent"("matter");

-- CreateIndex
CREATE INDEX "AgentActionEvent_action_idx" ON "AgentActionEvent"("action");

-- CreateIndex
CREATE INDEX "AgentActionEvent_actorUser_idx" ON "AgentActionEvent"("actorUser");

-- CreateIndex
CREATE INDEX "AgentActionEvent_actorAgent_idx" ON "AgentActionEvent"("actorAgent");

-- CreateIndex
CREATE INDEX "_FirmMembership_allowedOffices_B_index" ON "_FirmMembership_allowedOffices"("B");

-- CreateIndex
CREATE INDEX "_Consultation_participants_B_index" ON "_Consultation_participants"("B");

-- CreateIndex
CREATE INDEX "_LegalTask_dependents_B_index" ON "_LegalTask_dependents"("B");

-- CreateIndex
CREATE INDEX "_CommunicationMessage_attachments_B_index" ON "_CommunicationMessage_attachments"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeFirm_fkey" FOREIGN KEY ("activeFirm") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_primaryOffice_fkey" FOREIGN KEY ("primaryOffice") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMethod" ADD CONSTRAINT "ContactMethod_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMethod" ADD CONSTRAINT "ContactMethod_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_primaryContact_fkey" FOREIGN KEY ("primaryContact") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_convertedMatter_fkey" FOREIGN KEY ("convertedMatter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeParticipant" ADD CONSTRAINT "IntakeParticipant_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeParticipant" ADD CONSTRAINT "IntakeParticipant_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeParticipant" ADD CONSTRAINT "IntakeParticipant_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_submittedByContact_fkey" FOREIGN KEY ("submittedByContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "IntakeSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_host_fkey" FOREIGN KEY ("host") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictSearchTerm" ADD CONSTRAINT "ConflictSearchTerm_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictSearchTerm" ADD CONSTRAINT "ConflictSearchTerm_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictSearchTerm" ADD CONSTRAINT "ConflictSearchTerm_check_fkey" FOREIGN KEY ("check") REFERENCES "ConflictCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictSearchTerm" ADD CONSTRAINT "ConflictSearchTerm_sourceContact_fkey" FOREIGN KEY ("sourceContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_check_fkey" FOREIGN KEY ("check") REFERENCES "ConflictCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_matchedContact_fkey" FOREIGN KEY ("matchedContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_matchedMatter_fkey" FOREIGN KEY ("matchedMatter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_matchedMatterParty_fkey" FOREIGN KEY ("matchedMatterParty") REFERENCES "MatterParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictMatch" ADD CONSTRAINT "ConflictMatch_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDisposition" ADD CONSTRAINT "ConflictDisposition_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDisposition" ADD CONSTRAINT "ConflictDisposition_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDisposition" ADD CONSTRAINT "ConflictDisposition_check_fkey" FOREIGN KEY ("check") REFERENCES "ConflictCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDisposition" ADD CONSTRAINT "ConflictDisposition_match_fkey" FOREIGN KEY ("match") REFERENCES "ConflictMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDisposition" ADD CONSTRAINT "ConflictDisposition_reviewer_fkey" FOREIGN KEY ("reviewer") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeArea" ADD CONSTRAINT "PracticeArea_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_client_fkey" FOREIGN KEY ("client") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_practiceArea_fkey" FOREIGN KEY ("practiceArea") REFERENCES "PracticeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_responsibleAttorney_fkey" FOREIGN KEY ("responsibleAttorney") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_originatingAttorney_fkey" FOREIGN KEY ("originatingAttorney") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_representedBy_fkey" FOREIGN KEY ("representedBy") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_counselContact_fkey" FOREIGN KEY ("counselContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterTeamMember" ADD CONSTRAINT "MatterTeamMember_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterTeamMember" ADD CONSTRAINT "MatterTeamMember_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterTeamMember" ADD CONSTRAINT "MatterTeamMember_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterTeamMember" ADD CONSTRAINT "MatterTeamMember_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWall" ADD CONSTRAINT "EthicalWall_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWall" ADD CONSTRAINT "EthicalWall_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWall" ADD CONSTRAINT "EthicalWall_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWall" ADD CONSTRAINT "EthicalWall_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWallMember" ADD CONSTRAINT "EthicalWallMember_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWallMember" ADD CONSTRAINT "EthicalWallMember_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWallMember" ADD CONSTRAINT "EthicalWallMember_wall_fkey" FOREIGN KEY ("wall") REFERENCES "EthicalWall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWallMember" ADD CONSTRAINT "EthicalWallMember_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalWallMember" ADD CONSTRAINT "EthicalWallMember_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStatusEvent" ADD CONSTRAINT "MatterStatusEvent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStatusEvent" ADD CONSTRAINT "MatterStatusEvent_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStatusEvent" ADD CONSTRAINT "MatterStatusEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStatusEvent" ADD CONSTRAINT "MatterStatusEvent_actorAgent_fkey" FOREIGN KEY ("actorAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_address_fkey" FOREIGN KEY ("address") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docket" ADD CONSTRAINT "Docket_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docket" ADD CONSTRAINT "Docket_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docket" ADD CONSTRAINT "Docket_court_fkey" FOREIGN KEY ("court") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docket" ADD CONSTRAINT "Docket_judgeContact_fkey" FOREIGN KEY ("judgeContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docket" ADD CONSTRAINT "Docket_clerkContact_fkey" FOREIGN KEY ("clerkContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_docket_fkey" FOREIGN KEY ("docket") REFERENCES "Docket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_documentVersion_fkey" FOREIGN KEY ("documentVersion") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_docket_fkey" FOREIGN KEY ("docket") REFERENCES "Docket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_sourceEntry_fkey" FOREIGN KEY ("sourceEntry") REFERENCES "DocketEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_parentDeadline_fkey" FOREIGN KEY ("parentDeadline") REFERENCES "Deadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_deadline_fkey" FOREIGN KEY ("deadline") REFERENCES "Deadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTask" ADD CONSTRAINT "LegalTask_parentTask_fkey" FOREIGN KEY ("parentTask") REFERENCES "LegalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_thread_fkey" FOREIGN KEY ("thread") REFERENCES "CommunicationThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_thread_fkey" FOREIGN KEY ("thread") REFERENCES "CommunicationThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_senderUser_fkey" FOREIGN KEY ("senderUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_senderContact_fkey" FOREIGN KEY ("senderContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_senderAgent_fkey" FOREIGN KEY ("senderAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_replyToMessage_fkey" FOREIGN KEY ("replyToMessage") REFERENCES "CommunicationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_message_fkey" FOREIGN KEY ("message") REFERENCES "CommunicationMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_integrationConnection_fkey" FOREIGN KEY ("integrationConnection") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_recipientContact_fkey" FOREIGN KEY ("recipientContact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersion_fkey" FOREIGN KEY ("currentVersion") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_retentionPolicy_fkey" FOREIGN KEY ("retentionPolicy") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_sourceMessage_fkey" FOREIGN KEY ("sourceMessage") REFERENCES "CommunicationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_sourceDocketEntry_fkey" FOREIGN KEY ("sourceDocketEntry") REFERENCES "DocketEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentVersion_fkey" FOREIGN KEY ("documentVersion") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_integrationConnection_fkey" FOREIGN KEY ("integrationConnection") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_request_fkey" FOREIGN KEY ("request") REFERENCES "SignatureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_request_fkey" FOREIGN KEY ("request") REFERENCES "SignatureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_signer_fkey" FOREIGN KEY ("signer") REFERENCES "DocumentSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_rateCard_fkey" FOREIGN KEY ("rateCard") REFERENCES "RateCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_practiceArea_fkey" FOREIGN KEY ("practiceArea") REFERENCES "PracticeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_task_fkey" FOREIGN KEY ("task") REFERENCES "LegalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_incurredBy_fkey" FOREIGN KEY ("incurredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptVersion_fkey" FOREIGN KEY ("receiptVersion") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_invoiceLine_fkey" FOREIGN KEY ("invoiceLine") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_client_fkey" FOREIGN KEY ("client") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_rateCard_fkey" FOREIGN KEY ("rateCard") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_signedDocumentVersion_fkey" FOREIGN KEY ("signedDocumentVersion") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_trustLedgerAccount_fkey" FOREIGN KEY ("trustLedgerAccount") REFERENCES "TrustLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_client_fkey" FOREIGN KEY ("client") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_retainer_fkey" FOREIGN KEY ("retainer") REFERENCES "RetainerAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_timeEntry_fkey" FOREIGN KEY ("timeEntry") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAccount" ADD CONSTRAINT "TrustAccount_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAccount" ADD CONSTRAINT "TrustAccount_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerAccount" ADD CONSTRAINT "TrustLedgerAccount_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerAccount" ADD CONSTRAINT "TrustLedgerAccount_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerAccount" ADD CONSTRAINT "TrustLedgerAccount_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerAccount" ADD CONSTRAINT "TrustLedgerAccount_client_fkey" FOREIGN KEY ("client") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_postedByAgent_fkey" FOREIGN KEY ("postedByAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_sourcePayment_fkey" FOREIGN KEY ("sourcePayment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_sourceRefund_fkey" FOREIGN KEY ("sourceRefund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustTransaction" ADD CONSTRAINT "TrustTransaction_reversesTransaction_fkey" FOREIGN KEY ("reversesTransaction") REFERENCES "TrustTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "TrustTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_ledgerAccount_fkey" FOREIGN KEY ("ledgerAccount") REFERENCES "TrustLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_ledgerAccount_fkey" FOREIGN KEY ("ledgerAccount") REFERENCES "TrustLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_reconciliation_fkey" FOREIGN KEY ("reconciliation") REFERENCES "TrustReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBalanceSnapshot" ADD CONSTRAINT "TrustBalanceSnapshot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReconciliation" ADD CONSTRAINT "TrustReconciliation_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReconciliation" ADD CONSTRAINT "TrustReconciliation_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReconciliation" ADD CONSTRAINT "TrustReconciliation_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_trustAccount_fkey" FOREIGN KEY ("trustAccount") REFERENCES "TrustAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payer_fkey" FOREIGN KEY ("payer") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_integrationConnection_fkey" FOREIGN KEY ("integrationConnection") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_trustTransaction_fkey" FOREIGN KEY ("trustTransaction") REFERENCES "TrustTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_allocatedBy_fkey" FOREIGN KEY ("allocatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_reversesAllocation_fkey" FOREIGN KEY ("reversesAllocation") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_matterAccess_fkey" FOREIGN KEY ("matterAccess") REFERENCES "PortalMatterAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_documentVersion_fkey" FOREIGN KEY ("documentVersion") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_communicationThread_fkey" FOREIGN KEY ("communicationThread") REFERENCES "CommunicationThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_connection_fkey" FOREIGN KEY ("connection") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordLink" ADD CONSTRAINT "ExternalRecordLink_docket_fkey" FOREIGN KEY ("docket") REFERENCES "Docket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_office_fkey" FOREIGN KEY ("office") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_connection_fkey" FOREIGN KEY ("connection") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_connection_fkey" FOREIGN KEY ("connection") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscription_fkey" FOREIGN KEY ("subscription") REFERENCES "WebhookSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_delivery_fkey" FOREIGN KEY ("delivery") REFERENCES "WebhookDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_practiceArea_fkey" FOREIGN KEY ("practiceArea") REFERENCES "PracticeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_policy_fkey" FOREIGN KEY ("policy") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_policy_fkey" FOREIGN KEY ("policy") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_hold_fkey" FOREIGN KEY ("hold") REFERENCES "RetentionHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_communicationThread_fkey" FOREIGN KEY ("communicationThread") REFERENCES "CommunicationThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_performedByAgent_fkey" FOREIGN KEY ("performedByAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAction" ADD CONSTRAINT "RetentionAction_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorAgent_fkey" FOREIGN KEY ("actorAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_trustTransaction_fkey" FOREIGN KEY ("trustTransaction") REFERENCES "TrustTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agentAction_fkey" FOREIGN KEY ("agentAction") REFERENCES "AgentAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrincipal" ADD CONSTRAINT "AgentPrincipal_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrincipal" ADD CONSTRAINT "AgentPrincipal_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_agentPrincipal_fkey" FOREIGN KEY ("agentPrincipal") REFERENCES "AgentPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_agentPrincipal_fkey" FOREIGN KEY ("agentPrincipal") REFERENCES "AgentPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_agentPrincipal_fkey" FOREIGN KEY ("agentPrincipal") REFERENCES "AgentPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_grant_fkey" FOREIGN KEY ("grant") REFERENCES "AgentGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_requestedByUser_fkey" FOREIGN KEY ("requestedByUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_intake_fkey" FOREIGN KEY ("intake") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_document_fkey" FOREIGN KEY ("document") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_trustTransaction_fkey" FOREIGN KEY ("trustTransaction") REFERENCES "TrustTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_deadline_fkey" FOREIGN KEY ("deadline") REFERENCES "Deadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_task_fkey" FOREIGN KEY ("task") REFERENCES "LegalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionEvent" ADD CONSTRAINT "AgentActionEvent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionEvent" ADD CONSTRAINT "AgentActionEvent_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionEvent" ADD CONSTRAINT "AgentActionEvent_action_fkey" FOREIGN KEY ("action") REFERENCES "AgentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionEvent" ADD CONSTRAINT "AgentActionEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionEvent" ADD CONSTRAINT "AgentActionEvent_actorAgent_fkey" FOREIGN KEY ("actorAgent") REFERENCES "AgentPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FirmMembership_allowedOffices" ADD CONSTRAINT "_FirmMembership_allowedOffices_A_fkey" FOREIGN KEY ("A") REFERENCES "FirmMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FirmMembership_allowedOffices" ADD CONSTRAINT "_FirmMembership_allowedOffices_B_fkey" FOREIGN KEY ("B") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Consultation_participants" ADD CONSTRAINT "_Consultation_participants_A_fkey" FOREIGN KEY ("A") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Consultation_participants" ADD CONSTRAINT "_Consultation_participants_B_fkey" FOREIGN KEY ("B") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LegalTask_dependents" ADD CONSTRAINT "_LegalTask_dependents_A_fkey" FOREIGN KEY ("A") REFERENCES "LegalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LegalTask_dependents" ADD CONSTRAINT "_LegalTask_dependents_B_fkey" FOREIGN KEY ("B") REFERENCES "LegalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommunicationMessage_attachments" ADD CONSTRAINT "_CommunicationMessage_attachments_A_fkey" FOREIGN KEY ("A") REFERENCES "CommunicationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommunicationMessage_attachments" ADD CONSTRAINT "_CommunicationMessage_attachments_B_fkey" FOREIGN KEY ("B") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
