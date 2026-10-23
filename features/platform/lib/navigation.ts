import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ContactRound,
  FileSignature,
  Globe,
  Inbox,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  Palette,
  PlugZap,
  ReceiptText,
  Scale,
  ShieldCheck,
  Store,
  UsersRound,
} from 'lucide-react'

const dashboardBasePath = '/dashboard'

export type PracticeNavItem = {
  title: string
  href: string
  description: string
  icon: LucideIcon
}

export type PracticeNavGroup = {
  id: string
  title: string
  icon: LucideIcon
  items: PracticeNavItem[]
}

export const practiceHomeItem: PracticeNavItem = {
  title: 'Today',
  href: '/dashboard/platform/today',
  description: 'Current intake, matter, work, billing, and hold queues.',
  icon: LayoutDashboard,
}

export const practiceNavGroups: PracticeNavGroup[] = [
  {
    id: 'practice',
    title: 'Practice',
    icon: Scale,
    items: [
      { title: 'Intake & conflicts', href: '/dashboard/platform/intake', description: 'Prospects, screening, consultations, and conflict review.', icon: Inbox },
      { title: 'Matters', href: '/dashboard/platform/matters', description: 'Matter teams, parties, ethical walls, and activity.', icon: BriefcaseBusiness },
      { title: 'Contacts', href: '/dashboard/platform/contacts', description: 'People, organizations, addresses, and contact methods.', icon: ContactRound },
    ],
  },
  {
    id: 'work',
    title: 'Work',
    icon: BriefcaseBusiness,
    items: [
      { title: 'Calendar & tasks', href: '/dashboard/platform/work', description: 'Deadlines, dockets, consultations, and assigned work.', icon: CalendarDays },
      { title: 'Documents', href: '/dashboard/platform/documents', description: 'Documents, versions, templates, and signature handoffs.', icon: FileSignature },
      { title: 'Communications', href: '/dashboard/platform/communications', description: 'Matter threads, drafts, delivery, and client updates.', icon: MessagesSquare },
      { title: 'Time & expenses', href: '/dashboard/platform/time-expenses', description: 'Capture, review, and prepare billable work.', icon: Clock3 },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: Landmark,
    items: [
      { title: 'Billing & payments', href: '/dashboard/platform/billing', description: 'Bills, balances, allocations, refunds, and collections.', icon: ReceiptText },
      { title: 'Trust & accounting', href: '/dashboard/platform/accounting', description: 'Trust ledgers, reconciliations, and operating books.', icon: Landmark },
      { title: 'Client portal', href: '/dashboard/platform/portal', description: 'Invitations, matter grants, shares, and sessions.', icon: CircleDollarSign },
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: BrainCircuit,
    items: [
      {
        title: 'Legal AI',
        href: '/dashboard/platform/ai',
        description: 'Matter-scoped evidence, review preparation, workflows, and evaluation gates.',
        icon: BrainCircuit,
      },
    ],
  },
  {
    id: 'control',
    title: 'Control',
    icon: ShieldCheck,
    items: [
      { title: 'Retention & holds', href: '/dashboard/platform/governance', description: 'Legal holds, retention review, and disposal evidence.', icon: ShieldCheck },
      { title: 'Reports', href: '/dashboard/platform/reports', description: 'Operational, financial, trust, and audit reporting.', icon: BarChart3 },
      { title: 'People & access', href: '/dashboard/platform/team', description: 'Staff invitations, memberships, firm roles, and office scope.', icon: UsersRound },
      { title: 'Import & export', href: '/dashboard/platform/data', description: 'Staged migrations, validation, and data portability.', icon: ArrowLeftRight },
      { title: 'Integrations', href: '/dashboard/platform/integrations', description: 'Provider connections, webhooks, OAuth, and API keys.', icon: PlugZap },
    ],
  },
  {
    id: 'storefront',
    title: 'Storefront',
    icon: Store,
    items: [
      { title: 'Public site', href: '/dashboard/platform/public-site', description: 'Publication, notices, practice areas and attorney profiles.', icon: Globe },
      { title: 'Store Settings', href: '/dashboard/platform/branding', description: 'Public site identity, logo, accent color, and support contact.', icon: Palette },
    ],
  },
]

export const practiceNavItems = [practiceHomeItem, ...practiceNavGroups.flatMap((group) => group.items)]

// One user-facing title per platform destination: sidebar labels, page headings,
// breadcrumbs and back links all read it from here.
export function platformDestinationTitle(href: string, fallback: string) {
  return practiceNavItems.find((item) => item.href === href)?.title ?? fallback
}

export type PlatformTrailItem = { label: string; href?: string }

export function platformBreadcrumbs(trail: PlatformTrailItem[], basePath = dashboardBasePath) {
  const resolve = (href: string) => href === dashboardBasePath || href.startsWith(`${dashboardBasePath}/`)
    ? `${basePath}${href.slice(dashboardBasePath.length)}`
    : href.startsWith("/platform/") ? `${basePath}${href}` : href
  return [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    ...trail.map((item, index) => item.href && index < trail.length - 1
      ? { type: 'link' as const, label: item.label, href: resolve(item.href) }
      : { type: 'page' as const, label: item.label }),
  ]
}

// The shared Openfront Sidebar contract: hrefs relative to the dashboard basePath, with Today as the
// standalone entry and each practice group rendered as a collapsible group.
export type PlatformNavItem = PracticeNavItem & { group: string }

export type PlatformNavGroup = {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

const relativeToDashboard = (href: string) => href.slice(dashboardBasePath.length)

export const platformNavItems: PlatformNavItem[] = [
  { ...practiceHomeItem, href: relativeToDashboard(practiceHomeItem.href), group: 'standalone' },
  ...practiceNavGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, href: relativeToDashboard(item.href), group: group.id })),
  ),
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = practiceNavGroups.map((group) => ({
  id: group.id,
  title: group.title,
  icon: group.icon,
  items: platformNavItems.filter((item) => item.group === group.id),
}))

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }))
}
