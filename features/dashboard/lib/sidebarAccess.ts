/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type SidebarUser = { role?: { canAccessDashboard?: boolean | null; permissions?: string[] | null } | null } | null | undefined

/**
 * Platform destination -> permissions, any one of which opens it. A destination not
 * listed stays visible. The sidebar hides the rest, and the proxy answers 404 for them
 * by direct URL (canOpenPlatformPath); every command still enforces its own access.
 */
export const platformDestinationPermissions: Record<string, readonly string[]> = {
  intake: ['canReadIntake', 'canManageIntake', 'canRunConflictChecks'],
  matters: ['canReadMatters', 'canManageMatters'],
  contacts: ['canReadPeople', 'canManagePeople'],
  work: ['canReadCalendar', 'canManageCalendar', 'canReadTasks', 'canManageTasks'],
  dockets: ['canReadCalendar', 'canManageCalendar'],
  documents: ['canReadDocuments', 'canManageDocuments'],
  communications: ['canReadCommunications', 'canManageCommunications'],
  'time-expenses': ['canReadBilling', 'canManageBilling'],
  billing: ['canReadBilling', 'canManageBilling', 'canReadPayments', 'canManagePayments'],
  retainers: ['canReadBilling', 'canManageBilling'],
  accounting: ['canReadTrust', 'canManageTrust'],
  portal: ['canReadPortal', 'canManagePortal'],
  ai: ['canReadAgents', 'canManageAgents'],
  governance: ['canReadRetention', 'canManageRetention'],
  reports: ['canViewAudit', 'canReadBilling', 'canReadTrust'],
  firm: ['canManageFirm'],
  team: ['canManagePeople', 'canManageRoles'],
  data: ['canManageFirm', 'canManagePeople'],
  integrations: ['canReadIntegrations', 'canManageIntegrations'],
  'payment-providers': ['canManagePayments', 'canManageTrust', 'canManageFirm'],
  'public-site': ['canManageFirm'],
  branding: ['canManageFirm'],
}

/** Known permissions hide destinations the role lacks; unknown (older session shape) shows all. */
function roleAllows(slug: string, user: SidebarUser) {
  const granted = user?.role?.permissions
  const required = platformDestinationPermissions[slug]
  if (!Array.isArray(granted) || !required) return true
  return required.some((permission) => granted.includes(permission))
}

/** The same check as the sidebar for a /dashboard/platform/<slug>/... URL: false means 404. */
export function canOpenPlatformPath(pathname: string, user: SidebarUser) {
  const match = /^\/dashboard\/platform\/([^/?#]+)/.exec(pathname)
  if (!match) return true
  return roleAllows(match[1], user)
}

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/**
 * A platform page whose first segment is a list path follows that list's visibility;
 * pages that are not tied to one list stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  return items.filter((item) => {
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0]
    return !slug || (!hiddenPaths.has(slug) && roleAllows(slug, user))
  })
}
