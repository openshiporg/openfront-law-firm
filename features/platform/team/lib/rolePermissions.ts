import type { PermissionKey } from '@/features/keystone/access'

export type PermissionGroup = { id: string; title: string; items: ReadonlyArray<{ key: PermissionKey; label: string }> }

/** Every Role permission flag, grouped for editing with readable labels. */
export const PERMISSION_GROUPS = [
  {
    id: 'people',
    title: 'People & firm',
    items: [
      { key: 'canAccessDashboard', label: 'Open the dashboard' },
      { key: 'canManageOnboarding', label: 'Run firm onboarding' },
      { key: 'canReadPeople', label: 'View people and contacts' },
      { key: 'canManagePeople', label: 'Manage people and contacts' },
      { key: 'canManageRoles', label: 'Manage roles' },
      { key: 'canManageFirm', label: 'Manage firm settings and offices' },
    ],
  },
  {
    id: 'intake',
    title: 'Intake & conflicts',
    items: [
      { key: 'canReadIntake', label: 'View intakes' },
      { key: 'canManageIntake', label: 'Manage intakes' },
      { key: 'canRunConflictChecks', label: 'Run conflict checks' },
      { key: 'canResolveConflicts', label: 'Resolve conflicts' },
    ],
  },
  {
    id: 'matters',
    title: 'Matters',
    items: [
      { key: 'canReadMatters', label: 'View matters' },
      { key: 'canManageMatters', label: 'Manage matters' },
      { key: 'canManageEthicalWalls', label: 'Manage ethical walls' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar & tasks',
    items: [
      { key: 'canReadCalendar', label: 'View calendar' },
      { key: 'canManageCalendar', label: 'Manage calendar' },
      { key: 'canReadTasks', label: 'View tasks' },
      { key: 'canManageTasks', label: 'Manage tasks' },
    ],
  },
  {
    id: 'communications',
    title: 'Communications',
    items: [
      { key: 'canReadCommunications', label: 'View communications' },
      { key: 'canManageCommunications', label: 'Send and manage communications' },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    items: [
      { key: 'canReadDocuments', label: 'View documents' },
      { key: 'canManageDocuments', label: 'Manage documents' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    items: [
      { key: 'canReadBilling', label: 'View billing' },
      { key: 'canManageBilling', label: 'Manage billing, time and expenses' },
    ],
  },
  {
    id: 'trust',
    title: 'Trust & payments',
    items: [
      { key: 'canReadTrust', label: 'View trust accounts' },
      { key: 'canManageTrust', label: 'Post trust transactions' },
      { key: 'canReadPayments', label: 'View payments' },
      { key: 'canManagePayments', label: 'Manage payments and refunds' },
    ],
  },
  {
    id: 'portal',
    title: 'Portal',
    items: [
      { key: 'canReadPortal', label: 'View client portal' },
      { key: 'canManagePortal', label: 'Manage portal access and shares' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    items: [
      { key: 'canReadIntegrations', label: 'View integrations' },
      { key: 'canManageIntegrations', label: 'Manage integrations' },
    ],
  },
  {
    id: 'machine',
    title: 'Machine access',
    items: [
      { key: 'canReadMachineCredentials', label: 'View API keys and OAuth clients' },
      { key: 'canManageMachineCredentials', label: 'Manage API keys and OAuth clients' },
    ],
  },
  {
    id: 'retention',
    title: 'Retention & audit',
    items: [
      { key: 'canReadRetention', label: 'View retention and holds' },
      { key: 'canManageRetention', label: 'Manage retention and holds' },
      { key: 'canViewAudit', label: 'View audit log' },
    ],
  },
  {
    id: 'agents',
    title: 'Agents',
    items: [
      { key: 'canReadAgents', label: 'View agents' },
      { key: 'canManageAgents', label: 'Manage agents' },
      { key: 'canApproveAgentActions', label: 'Approve agent actions' },
    ],
  },
] as const satisfies ReadonlyArray<PermissionGroup>

export type GroupedPermission = (typeof PERMISSION_GROUPS)[number]['items'][number]['key']

// Compile-time check: every PermissionKey appears in a group.
type Ungrouped = Exclude<PermissionKey, GroupedPermission>
const allPermissionsGrouped: [Ungrouped] extends [never] ? true : Ungrouped = true
void allPermissionsGrouped

export const ROLE_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.key))

export type RoleRow = {
  id: string
  name: string
  status: 'active' | 'archived'
  memberCount: number
  granted: PermissionKey[]
}

export type RoleDirectory =
  | { status: 'loaded'; roles: RoleRow[]; canManage: boolean; ownRoleId: string | null }
  | { status: 'error'; message: string }

export type RoleActionState = { ok: boolean; message: string; revision: number }
export const initialRoleActionState: RoleActionState = { ok: false, message: '', revision: 0 }
