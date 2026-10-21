import type { LucideIcon } from 'lucide-react'

import { practiceHomeItem, practiceNavItems } from '@/features/platform/lib/navigation'

export type WorkspaceCategory =
  | 'intake'
  | 'matters'
  | 'contacts'
  | 'work'
  | 'documents'
  | 'communications'
  | 'time-expenses'
  | 'billing'
  | 'accounting'
  | 'portal'
  | 'governance'
  | 'reports'
  | 'data'
  | 'integrations'

export type WorkspaceLink = {
  title: string
  description: string
  href: string
  action: string
  icon: LucideIcon
}

export type WorkspaceDefinition = {
  title: string
  description: string
  queue: 'intakeQueue' | 'matterQueue' | 'workQueue' | 'billingQueue' | 'governanceQueue' | null
  metricKeys: string[]
  links: WorkspaceLink[]
}

type WorkspaceCopy = Omit<WorkspaceDefinition, 'links'>

const workspaceCopy: Record<WorkspaceCategory, WorkspaceCopy> = {
  intake: {
    title: 'Intake & conflicts',
    description: 'Move prospective clients from first contact through screening, conflict review, consultation, and an explicit engagement decision.',
    queue: 'intakeQueue',
    metricKeys: ['active-intakes'],
  },
  matters: {
    title: 'Matters',
    description: 'Keep matter teams, parties, ethical walls, court work, documents, communications, and finances anchored to one authorized workspace.',
    queue: 'matterQueue',
    metricKeys: ['open-matters'],
  },
  contacts: {
    title: 'Contacts',
    description: 'Maintain people and organizations once, then connect them to intake, matters, billing, portal access, and conflict searches.',
    queue: null,
    metricKeys: [],
  },
  work: {
    title: 'Calendar & tasks',
    description: 'Review verified deadlines, docket activity, consultations, and assigned tasks. Recurrence, reminders, court-rule calculation, and calendar sync are not configured.',
    queue: 'workQueue',
    metricKeys: ['open-deadlines', 'open-tasks'],
  },
  documents: {
    title: 'Documents',
    description: 'Track logical documents, immutable version/checksum metadata, signature targets, and retention links. Storage, download, OCR, generation, and signature execution require external adapters.',
    queue: null,
    metricKeys: [],
  },
  communications: {
    title: 'Communications',
    description: 'Track matter/intake conversations, drafts, attachments, and delivery evidence. No outbound/inbound mail or messaging worker is represented as configured.',
    queue: null,
    metricKeys: [],
  },
  'time-expenses': {
    title: 'Time & expenses',
    description: 'Capture billable work and disbursements, review them, and preserve the source records used to assemble bills.',
    queue: null,
    metricKeys: ['unbilled-time'],
  },
  billing: {
    title: 'Billing & payments',
    description: 'Assemble and issue bills through controlled source snapshots; record allocation, reversal, and refund evidence only when an independently certified payment path supplies real outcomes.',
    queue: 'billingQueue',
    metricKeys: ['outstanding-invoices'],
  },
  accounting: {
    title: 'Trust & accounting',
    description: 'Operate client trust books separately from firm billing, with balanced postings, exact reversals, and reconciliation evidence.',
    queue: null,
    metricKeys: [],
  },
  portal: {
    title: 'Client portal',
    description: 'Control client identities, exact matter capabilities, resource shares, sessions, expiry, and revocation.',
    queue: null,
    metricKeys: [],
  },
  governance: {
    title: 'Retention & holds',
    description: 'Preserve records under active holds, review retention eligibility, and create immutable disposition evidence.',
    queue: 'governanceQueue',
    metricKeys: ['active-holds'],
  },
  reports: {
    title: 'Reports',
    description: 'Use scoped operational records for intake, matters, work, billing, collections, trust, retention, and audit review.',
    queue: null,
    metricKeys: ['active-intakes', 'open-matters', 'open-deadlines', 'open-tasks', 'unbilled-time', 'outstanding-invoices', 'active-holds'],
  },
  data: {
    title: 'Import & export',
    description: 'Prepare firm-owned data for migration and portability without bypassing validation, access controls, or evidence retention.',
    queue: null,
    metricKeys: [],
  },
  integrations: {
    title: 'Integrations',
    description: 'Configure encrypted provider records, OAuth clients, API keys, subscriptions, and delivery evidence. Provider adapters, signed ingress, and outbound workers remain deployment integrations.',
    queue: null,
    metricKeys: [],
  },
}

export const workspaceDefinitions = Object.fromEntries(
  Object.entries(workspaceCopy).map(([category, definition]) => {
    const href = `/dashboard/platform/${category}`
    const navItem = practiceNavItems.find((item) => item.href === href)
    // The page heading always uses the sidebar's destination title (one name per place).
    return [category, {
      ...definition,
      title: navItem?.title ?? definition.title,
      links: [{
        title: navItem?.title ?? definition.title,
        description: definition.description,
        href,
        action: 'Open workspace',
        icon: navItem?.icon ?? practiceHomeItem.icon,
      }],
    }]
  }),
) as Record<WorkspaceCategory, WorkspaceDefinition>
