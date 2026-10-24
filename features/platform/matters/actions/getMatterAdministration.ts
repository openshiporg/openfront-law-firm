import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'

import type { EthicalWallEntry, MatterAdministration, MatterDocketEntry, MatterStatusEntry, MatterTeamEntry } from '../lib/administrationTypes'

// Reads for the matter administration panels. Every query runs as the signed-in viewer,
// so matter scope, ethical walls and role permissions decide what each panel shows.
export async function getMatterAdministration(matterId: string): Promise<MatterAdministration> {
  const where = { matter: { id: { equals: matterId } } }
  const [team, walls, history, dockets, workspace] = await Promise.all([
    keystoneClient<{ matterTeamMembers: MatterTeamEntry[] | null }>(`
      query MatterAdminTeam($where: MatterTeamMemberWhereInput!) {
        matterTeamMembers(where: $where, orderBy: [{ assignedAt: asc }, { id: asc }], take: 100) {
          id status teamRole canEdit canBill canAccessRestricted assignedAt user { id name }
        }
      }
    `, { where }),
    keystoneClient<{ ethicalWalls: EthicalWallEntry[] | null }>(`
      query MatterAdminWalls($where: EthicalWallWhereInput!) {
        ethicalWalls(where: $where, orderBy: [{ createdAt: desc }, { id: asc }], take: 50) {
          id name status reason policyReference effectiveAt liftedAt
          members(orderBy: [{ createdAt: asc }, { id: asc }], take: 100) { id decision status user { id name } }
        }
      }
    `, { where }),
    keystoneClient<{ matterStatusEvents: MatterStatusEntry[] | null }>(`
      query MatterAdminHistory($where: MatterStatusEventWhereInput!) {
        matterStatusEvents(where: $where, orderBy: [{ occurredAt: desc }, { id: asc }], take: 50) {
          id fromStatus toStatus action reason occurredAt actorUser { name }
        }
      }
    `, { where }),
    keystoneClient<{ dockets: MatterDocketEntry[] | null }>(`
      query MatterAdminDockets($where: DocketWhereInput!) {
        dockets(where: $where, orderBy: [{ createdAt: desc }, { id: asc }], take: 50) { id docketNumber title status court { name } }
      }
    `, { where }),
    getPracticeWorkspace('matters'),
  ])
  // The matter register computes transition authority from the viewer's role; the same
  // flag gates the header transition. The command rechecks on submit.
  const canActOnMatter = workspace.success
    ? workspace.data.sections.some((section) => section.items.some((item) => item.kind === 'Matter' && item.canAct))
    : false
  return {
    team: team.success && Array.isArray(team.data.matterTeamMembers) ? team.data.matterTeamMembers : null,
    walls: walls.success && Array.isArray(walls.data.ethicalWalls) ? walls.data.ethicalWalls : null,
    history: history.success && Array.isArray(history.data.matterStatusEvents) ? history.data.matterStatusEvents : null,
    dockets: dockets.success && Array.isArray(dockets.data.dockets) ? dockets.data.dockets : null,
    canActOnMatter,
  }
}
