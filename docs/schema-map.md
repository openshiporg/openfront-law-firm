# Openfront Law Firm: schema map

Source of truth: `features/keystone/models/**` (78 lists) and `features/keystone/mutations/**` (custom commands registered in `mutations/index.ts`).

Every firm-owned list goes through `firmOwnedHooks` (`features/keystone/tenancy.ts`):
- the active firm is assigned on create;
- connected records must belong to the same firm;
- `lifecycle` lists check their transitions against `features/keystone/lib/lifecycles.ts`.

Matter-scoped lists add matter access, team capability (`canEdit` / `canBill` / `canAccessRestricted`) and ethical-wall filters (`features/keystone/lib/matter-access.ts`).

Lifecycle changes on legal, financial and access records go through controlled mutations: serializable transaction, advisory lock, idempotency key where money or access moves, and an `AuditEvent`. Generic CRUD of `status` is denied for those lists.

Who creates: **M** = firm staff (merchant), **C** = customer (prospect or client), **S** = system or command side effect.

## 1. Lists

### Firm, people and access
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Firm | The law firm (tenant) | name, displayName, slug, brand*, logo*, defaultTimezone, defaultCurrency, isDemo | offices, memberships, roles | M via `completeFirmOnboarding` | onboarding → active → suspended / closed |
| Office | Physical office | name, code, timezone, email, phone | firm, memberships | M (onboarding, then Office CRUD) | active / inactive / closed |
| User | Login identity (staff and storefront customers) | name, email, password | memberships, consultations | M (`inviteFirmMember`), C (`registerConsultationAccount`) | invited → active → suspended / deactivated |
| FirmMembership | Staff seat in a firm | title, role, primaryOffice, allowedOffices | user, role | M `inviteFirmMember`, `changeFirmMemberAccess` | invited → active → suspended → ended |
| Role | Permission bundle (40 `can*` flags) | name, can* | firm, memberships | M (onboarding seeds standard roles; `updateFirmRoleAuthority`) | active / archived |
| ApiKey, OAuthClient, OAuthConsent, OAuthToken | Machine and API access | prefix, digests, scopes, expiry | owner, client | M `issueApiKey` / `issueOAuthClient`; S tokens | active → revoked / expired |
| AgentPrincipal, AgentCredential, AgentGrant, AgentAction, AgentActionEvent | Supervised AI agents and their approved actions | capabilities, risk, envelopes | matter, grant | M; S events | draft → active → suspended / revoked; action requested → awaiting_approval → approved / rejected → executing → succeeded / failed |

### Clients and intake
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Contact | Person or organization (client, prospect, opposing party) | contactType, names, primaryEmail, primaryPhone, conflictSearchAliases, privilegedNotes | addresses, contactMethods | M; S from intake and booking | prospective_client → client → former_client; opposing; other; archived |
| Address | Postal address | addressType, lines, city, region, postal, country, isPrimary | contact | M | — |
| ContactMethod | Email, phone or portal channel | methodType, value, canContact, verifiedAt | contact | M | — |
| Intake | Prospective-client matter request | intakeNumber, title, source, summary, adversePartySummary, practiceArea, office | primaryContact, participants, conflictChecks, consultations, convertedMatter | M `startClientIntake`; C booking (`bookClientConsultation`) | new → screening → conflict_review → consultation → decision → converted / declined / withdrawn |
| IntakeParticipant | Party named on an intake | participantRole (prospective_client, adverse_party, …) | intake, contact | S `startClientIntake`; M `addIntakeParticipant` | active / removed |
| IntakeSubmission | Structured form responses | formSchema, responses | intake | S (public intake is disabled) | submitted → under_review → accepted / superseded |
| Consultation | Booked consultation | serviceSnapshot, fee, startsAt/endsAt, timezone, host, outcome | intake, account (customer user), host | C `bookClientConsultation`; M `scheduleConsultation` | requested → scheduled → completed / cancelled / no_show; outcome pending → recommend_engagement / decline / follow_up |
| ConflictCheck | Conflict search for an intake or matter | checkNumber, scope, summary | terms, matches, dispositions | S on intake start and party add; M `requestConflictCheck` | requested → running → review_required → cleared / conflict_found; failed; cancelled |
| ConflictSearchTerm / ConflictMatch / ConflictDisposition | Terms searched, hits found, reviewer decisions | term, matchType, score, outcome, rationale | check, contact, matter | M `addConflictSearchTerm`, `addConflictMatch`, `recordConflictDisposition` | match potential → reviewing → cleared / escalated |

### Matters and work
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| PracticeArea | Service line, and the public consultation offering | name, description, isPublic, publicSlug, consultationFeeMinor, consultationMinutes | matters | M | active / archived |
| Matter | Client engagement | matterNumber, title, confidentiality, billingType, opened/closed | client, office, practiceArea, intake, attorneys, parties, team, walls | M `convertIntakeToMatter` | proposed → pending_conflict → open ⇄ on_hold → closing → closed; declined |
| MatterParty | Party on a matter | partyRole, side, isPrimaryClient | matter, contact, counsel | S conversion; M `addMatterParty`, `changeMatterParty` | active / removed |
| MatterTeamMember | Staff on a matter, with capabilities | teamRole, canEdit, canBill, canAccessRestricted | matter, user | S conversion; M `setMatterTeamAccess` | active / removed |
| EthicalWall / EthicalWallMember | Screens users from a matter | reason, policyReference; decision allowed / blocked | matter, user | M `transitionEthicalWall`, `setEthicalWallMember` | draft → active → lifted |
| MatterStatusEvent | Matter status history | from, to, action, reason | matter | S | — |
| Court | Court or tribunal | name, jurisdiction, type, filingUrl | dockets | M | active / inactive |
| Docket | Court case on a matter | docketNumber, title, filedAt | matter, court, judge/clerk contacts | M | active / stayed / appealed / closed |
| DocketEntry | Filing, order or hearing on a docket | entryType, occurredAt, isVerified | docket, documentVersion | M `recordDocketEntry`, `verifyDocketEntry` | draft → filed / entered / rejected / withdrawn |
| Deadline | Court, statutory or internal deadline | dueAt, timezone, deadlineType, isVerified | matter, docket, tasks | M | draft → pending (verified) → completed / missed / waived / cancelled |
| LegalTask | Assigned work item | title, priority, dueAt, assignedTo | matter, deadline, subtasks, dependencies | M | open → in_progress → blocked → completed / cancelled |

### Documents and communications
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Document | Matter document record | title, category, confidentiality | matter, versions, currentVersion, retentionPolicy | M | draft → active → archived → disposed |
| DocumentVersion | Stored file version | fileName, objectKey, mediaType, byteSize, sha256 | document | M `ingestDocumentVersion` (bucket upload) | — (immutable) |
| SignatureRequest / DocumentSigner / SignatureEvent | E-signature handoff | provider, signers, events | documentVersion | M `prepareSignatureRequest`, `addDocumentSigner`; S provider events | draft → sent → partially_signed → completed / declined / expired / cancelled |
| CommunicationThread | Matter or intake conversation | subject, primaryChannel | matter, intake, participants, messages | M | open / archived / closed |
| CommunicationParticipant | Recipient on a thread | participantRole, displayAddress | user, contact, portalAccount | M `addCommunicationParticipant` | active / removed |
| CommunicationMessage | Message | direction, channel, body | thread, deliveries | M (draft), `queueCommunicationMessage` | draft → queued → sent → delivered / failed; received; cancelled |
| CommunicationDelivery | Per-recipient delivery | channel, status, attempts | message, recipientContact | S `prepareCommunicationDeliveries` | pending → sent → delivered / failed / bounced |

### Billing, payments and trust
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| RateCard / RateRule | Hourly and fixed rates by matter, timekeeper or practice area | amountMinor, rateType, priority, effective dates | matter, user, practiceArea | M | card draft → active → retired |
| TimeEntry | Recorded time | workDate, durationMinutes, rate/amount, isBillable | matter, user, task, invoiceLine | M (timer, manual) | draft → submitted → approved (priced) → billed / written_off |
| Expense | Disbursement | amount, expenseType, isBillable | matter, receiptVersion | M | draft → submitted → approved → billed / reimbursed / written_off |
| RetainerAgreement | Engagement terms and retainer | feeStructure, initialRetainerMinor, evergreen, contingency bps | matter, client, rateCard, trustLedger | M `prepareRetainerAgreement` | draft → sent → accepted → active → completed / terminated |
| Invoice / InvoiceLine | Bill and its lines | totals, balanceDue, issued/due | matter, client, lines, payments | M `assembleDraftInvoice`, `transitionInvoice` | draft → approved → issued → partially_paid → paid; overdue; void |
| Payment / PaymentAllocation | Money received and applied to invoices | amount, method (providerCode), allocations | invoice, payer, trustAccount | M `recordManualPayment`, `allocatePayment`; S provider | pending → authorized → captured → settled; failed; cancelled |
| Refund | Money returned | amount, reason | payment, invoice | M `requestRefund`, `reviewRefund` | requested → approved → processing → succeeded / failed; cancelled |
| TrustAccount | IOLTA or other trust bank account | accountType, bank, last four | ledgers, transactions | M | pending → active ⇄ frozen → closed |
| TrustLedgerAccount | Client or matter sub-ledger | ledgerNumber | trustAccount, client, matter | M | active ⇄ frozen → closed |
| TrustTransaction / TrustLedgerEntry | Double-entry trust postings | type, entries (debit/credit by bucket) | account, ledger | M `postTrustTransaction` | posted → reversed |
| TrustBalanceSnapshot / TrustReconciliation | Three-way reconciliation | statement, book and client balances | account | M `prepareTrustReconciliation` | draft → in_review → completed → reopened |

### Client portal and public site
| List | Purpose | Created by | States |
|---|---|---|---|
| PortalAccount | Client portal login (passwordless, invitation or email link) | M `invitePortalAccount`; C `acceptPortalInvitation` | invited → active → suspended / closed |
| PortalMatterAccess | Client's access to one matter (documents / invoices / messages) | M `grantPortalMatterAccess`, `executePortalGrant`, `revokePortalGrant` | active / revoked / expired |
| PortalShare | One shared document, invoice or thread | M `sharePortalResource` | active / revoked / expired |
| PortalSession | Portal session | S | active / revoked / expired |
| PortalDiscoveryPolicy / PortalGrantIntent | Which matters may be granted; idempotent grant records | M `recordPortalDiscoveryPolicy`; S | — |
| PublicSitePolicy | Publication of the public site: accounts, booking, notices, About | M | draft → published |
| AttorneyProfile | Public attorney profile | M | isPublic flag |

### Integrations, retention and audit
| List | Purpose | Created by | States |
|---|---|---|---|
| IntegrationConnection | Provider connection (email, calendar, payment, import …) | M | pending → active → needs_reauth / disabled / revoked |
| ExternalRecordLink | Imported or synced record identity | S imports | linked / conflict / unlinked |
| WebhookSubscription / WebhookDelivery / WebhookDeliveryAttempt | Outbound webhooks | M subscription; S deliveries | subscription active / paused / revoked; delivery pending → processing → succeeded / failed / dead_letter |
| RetentionPolicy | Retention rule by record class | M | draft → active → retired |
| RetentionHold | Legal hold on a matter, document or contact | M `placeRetentionHold`, `releaseRetentionHold` | active → released |
| RetentionAction | Archive, dispose or hold evidence | S | — |
| AuditEvent | Append-only audit log | S | — |

## 2. Workflows

1. **Publish the firm:** Firm + Office (onboarding) → PublicSitePolicy → PracticeArea (isPublic, fee, length) → AttorneyProfile.
2. **Prospect books online (storefront):**
   - User (`registerConsultationAccount`) → Intake + Contact + Consultation (`bookClientConsultation`, within the published weekday hours).
   - Staff confirm with Consultation → scheduled / completed / no_show (`scheduleConsultation`, `transitionConsultation`).
   - The customer sees history at `/account` and can cancel (`cancelOwnConsultation`).
3. **Intake → conflicts → matter:**
   - Intake + Contact + IntakeParticipant (adverse parties) → ConflictCheck + terms → matches → disposition → cleared.
   - Clearing advances the intake to decision; then `convertIntakeToMatter` creates the Matter, MatterParty and MatterTeamMember.
   - A conflict found → Intake declined.
4. **Matter administration:** team (`setMatterTeamAccess`), parties, ethical walls, confidentiality, hold / resume / close (`transitionMatter`).
5. **Litigation calendar:** Court → Docket → DocketEntry (verify) → Deadline (verify → complete) → LegalTask.
6. **Documents:** Document → DocumentVersion (upload) → SignatureRequest + signers → completed → retention policy / hold.
7. **Client communication:** Thread → participants → draft message → queue → deliveries (`prepareCommunicationDeliveries`) → delivered / failed.
8. **Time to cash:**
   - RateCard / RateRule, TimeEntry + Expense → approve (priced) → Invoice (assemble → approve → issue).
   - Payment (record) → PaymentAllocation → paid; Refund if needed.
   - RetainerAgreement governs the terms.
9. **Trust (IOLTA):** TrustAccount → TrustLedgerAccount (per client or matter) → TrustTransaction (deposit, disbursement, transfer) → TrustReconciliation (three-way) → completed.
10. **Client portal:** discovery policy → PortalAccount invite → accept → PortalMatterAccess grant → PortalShare (document, invoice, thread) → client reads at `/portal`.
11. **People and access:** Role (standard roles) → FirmMembership invite → access changes → Office scope.
12. **Governance and integrations:** RetentionPolicy → RetentionHold → RetentionAction; IntegrationConnection, ApiKey / OAuthClient, WebhookSubscription; AuditEvent review.

## 3. Coverage

Routes are under `/dashboard/platform/`. **OK** = the job can be done; **THIN** = the page exists but the job can't be completed; **MISSING** = no page.

| Workflow / list | Page (route · slice) | Before | After |
|---|---|---|---|
| Today overview | `today` · today | OK | OK |
| Public site, practice areas, attorney profiles | `public-site` · public-site | OK | OK |
| Branding | `branding` · store-settings | OK | OK |
| Firm defaults (time zone, currency) and Offices | — | **MISSING**: no page to add an office or change firm defaults after onboarding | OK: `firm` · firm (firm defaults, offices create/edit/status) |
| Intake, conflicts, conversion | `intake` · intake | OK | OK |
| Consultations (confirm, reschedule, complete, no-show, outcome) | `work` lane + drill-in | **THIN**: no row action for Consultation; staff can't confirm a booked request | OK: row actions (confirm, cancel, outcome, no-show) + Schedule / reschedule panel on the drill-in · consultations |
| Contacts (create, edit, addresses, methods, detail) | `contacts` · workspace | **THIN**: read-only lists; no create, no edit, no detail page | OK: `contacts` (search, status and type tracks, New contact drawer) + `contacts/[contactId]` (identity, status, addresses, methods, matters, intakes, portal) |
| Matters list and workspace | `matters`, `matters/[id]` | OK for work items (create forms added in QA r1) | OK |
| Matter team, ethical walls, confidentiality, close | `matters/[id]` | **THIN**: no team, wall or close controls | OK: team access, ethical walls, confidentiality, status action in the header, status history on `matters/[id]` |
| Courts, dockets, docket entries | `work` docket lane | **THIN**: no court or docket create; entries can't be recorded or verified | OK: `dockets` · dockets (courts, dockets with status tabs) + `dockets/[docketId]` (entries, record, verify, linked deadlines, status) |
| Deadlines, tasks | `work` · desks | OK | OK |
| Documents and files | `documents` · desks + documents | OK (versions added in QA r1) | OK |
| Signature requests | `documents` signatures lane | **THIN**: no way to prepare a request or add signers | OK for preparation: request from the current version, signers, cancel. Sent and signed states need a provider (backend blocks manual updates) |
| Communications: recipients and delivery | `communications` · desks | **THIN**: no way to add recipients, so a queued message has no deliveries | OK: Recipients panel on threads, Prepare deliveries on draft messages |
| Time and expenses | `time-expenses` · desks | OK | OK |
| Rates, invoices, payments | `billing` · billing | OK (QA r1) | OK |
| Invoice void after issue | `billing` row action | **THIN**: only draft discard; an issued invoice can't be voided | OK: void and mark-overdue actions |
| Refunds | `billing` payments lane | **MISSING**: no request or review | OK for request and two-person approval. Processing outcome needs provider ingress (backend blocks it) |
| Retainer agreements | — | **MISSING** | OK: `retainers` · retainers (status tabs, create) + `retainers/[retainerId]` (terms, transitions, invoices) |
| Trust accounts, ledgers, postings, reconciliation | `accounting` · accounting | OK (QA r1) | OK |
| Client portal admin | `portal` · portal | OK | OK |
| Team and invitations | `team` · team | OK | OK |
| Role permissions | `team` | **THIN**: standard roles can be added but not edited | OK: Roles section with grouped permission toggles, create, archive |
| Retention policies and holds | `governance` · workspace | **THIN**: holds can be released but not placed; no policy create or activate | OK: policies create/activate/retire, Place legal hold |
| Integrations, API keys, webhooks | `integrations` · workspace | **THIN**: read-only health; no API key issue or revoke | OK: connections create, API keys issue (secret shown once) and revoke |
| Import and export | `data` · data | OK | OK |
| Reports and audit | `reports` · reports | OK | OK |
| Legal AI and agents | `ai/*` · legal-ai | OK for supervised evidence review. Agent principals and grants: **Models** only (advanced machine access; see coverage notes) | Unchanged: agent principals and grants stay in Models (advanced machine access) |

Covered by a parent page, with no page of their own:
- **Matter workspace:** MatterStatusEvent, MatterParty, MatterTeamMember, EthicalWallMember.
- **Conflict panel:** ConflictSearchTerm, ConflictMatch, ConflictDisposition.
- **Document detail:** DocumentVersion, DocumentSigner, SignatureEvent.
- **Thread detail:** CommunicationParticipant, CommunicationDelivery.
- **Invoice / Billing:** InvoiceLine, PaymentAllocation.
- **Accounting:** TrustLedgerEntry, TrustBalanceSnapshot.
- **Portal:** PortalSession, PortalGrantIntent, PortalDiscoveryPolicy.
- **Integrations:** WebhookDeliveryAttempt, ExternalRecordLink.
- **Reports and governance:** AuditEvent, RetentionAction.
- **Intake:** IntakeParticipant, IntakeSubmission.
- **Integrations (machine access):** OAuthToken, OAuthConsent.

## 4. Storefront flows

| Flow | Before |
|---|---|
| Browse practice areas → detail → book (signed in) → appointment page → `/account` history | OK |
| Customer cancels a requested or scheduled consultation before it starts | **MISSING** → OK: Cancel form on `/account/appointments/[id]` (`cancelOwnConsultation`) |
| Attorney directory → profile | OK (QA r1) |
| Client portal: invitation → sign in → shared items → document / invoice / thread | OK |
| Anonymous intake form (no account) | Disabled by policy (`PUBLIC_INTAKE_ENABLED = false`); booking requires an account and the first-contact notice |
