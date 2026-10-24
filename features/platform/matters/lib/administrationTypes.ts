export const TEAM_ROLES = [
  ['responsible_attorney', 'Responsible attorney'],
  ['attorney', 'Attorney'],
  ['paralegal', 'Paralegal'],
  ['assistant', 'Assistant'],
  ['billing', 'Billing'],
  ['observer', 'Observer'],
] as const

export type TeamRole = (typeof TEAM_ROLES)[number][0]

export type MatterTeamEntry = {
  id: string
  status: string
  teamRole: string
  canEdit: boolean
  canBill: boolean
  canAccessRestricted: boolean
  assignedAt: string | null
  user: { id: string; name: string | null } | null
}

export type EthicalWallEntry = {
  id: string
  name: string
  status: string
  reason: string | null
  policyReference: string | null
  effectiveAt: string | null
  liftedAt: string | null
  members: Array<{ id: string; decision: string; status: string; user: { id: string; name: string | null } | null }>
}

export type MatterStatusEntry = {
  id: string
  fromStatus: string | null
  toStatus: string
  action: string | null
  reason: string | null
  occurredAt: string | null
  actorUser: { name: string | null } | null
}

export type MatterDocketEntry = { id: string; docketNumber: string; title: string | null; status: string; court: { name: string | null } | null }

/** Each section loads independently; null means the viewer's role cannot read it. */
export type MatterAdministration = {
  team: MatterTeamEntry[] | null
  walls: EthicalWallEntry[] | null
  history: MatterStatusEntry[] | null
  dockets: MatterDocketEntry[] | null
  canActOnMatter: boolean
}
