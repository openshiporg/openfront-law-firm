'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { commandResult, formChoice, formText, type CommandState } from '@/features/platform/components/commandState'
import { TEAM_ROLES } from '../lib/administrationTypes'

const teamRoleValues = TEAM_ROLES.map(([value]) => value)
const id = (formData: FormData, key: string, label: string) => formText(formData, key, { label, min: 1, max: 200 })
const matterPath = (matterId: string) => `/dashboard/platform/matters/${encodeURIComponent(matterId)}`

type MatterFacts = { id: string; status: string; confidentiality: string; teamMembers: Array<{ id: string; status: string; canAccessRestricted: boolean; user: { id: string } | null }> }

async function loadMatter(matterId: string): Promise<MatterFacts> {
  const response = await keystoneClient<{ matter: MatterFacts | null }>(`
    query MatterAdminFacts($id: ID!) {
      matter(where: { id: $id }) {
        id status confidentiality
        teamMembers(where: { status: { equals: active } }, take: 200) { id status canAccessRestricted user { id } }
      }
    }
  `, { id: matterId })
  if (!response.success || !response.data.matter) throw new Error('This matter is unavailable in your current access.')
  return response.data.matter
}

/** Adds a team member, changes their role and capabilities, or removes them. */
export async function saveMatterTeamMember(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = id(formData, 'matterId', 'Matter')
    const userId = id(formData, 'userId', 'Team member')
    const remove = formData.get('intent') === 'remove'
    const teamRole = remove ? formText(formData, 'teamRole', { label: 'Team role', min: 1, max: 60 }) : formChoice(formData, 'teamRole', teamRoleValues, 'team role')
    if (!teamRoleValues.includes(teamRole as (typeof teamRoleValues)[number])) throw new Error('Choose a team role.')
    const reason = formText(formData, 'reason', { label: 'Reason', min: 5, max: 2000 })
    const canAccessRestricted = !remove && formData.get('canAccessRestricted') === 'on'
    const matter = await loadMatter(matterId)
    const current = matter.teamMembers.find((member) => member.user?.id === userId)
    if (remove && !current) throw new Error('This person is not on the matter team.')
    if (matter.confidentiality === 'restricted' && current?.canAccessRestricted && !canAccessRestricted) {
      const others = matter.teamMembers.filter((member) => member.user?.id !== userId && member.canAccessRestricted)
      if (!others.length) throw new Error('A restricted matter must keep at least one team member with restricted access.')
    }
    const response = await keystoneClient<{ setMatterTeamAccess: { id: string; status: string } }>(`
      mutation SetMatterTeamAccess($matterId: ID!, $userId: ID!, $teamRole: String!, $status: String!, $canAccessRestricted: Boolean, $canEdit: Boolean, $canBill: Boolean, $reason: String!) {
        setMatterTeamAccess(matterId: $matterId, userId: $userId, teamRole: $teamRole, status: $status, canAccessRestricted: $canAccessRestricted, canEdit: $canEdit, canBill: $canBill, reason: $reason) { id status }
      }
    `, {
      matterId,
      userId,
      teamRole,
      status: remove ? 'removed' : 'active',
      canAccessRestricted,
      canEdit: !remove && formData.get('canEdit') === 'on',
      canBill: !remove && formData.get('canBill') === 'on',
      reason,
    })
    if (!response.success) throw new Error('The team change was not saved. Matter management permission is required, the person must be an active firm member, and a restricted matter must keep a current restricted-access steward.')
    revalidatePath(matterPath(matterId))
    return commandResult(previous, true, remove ? 'Removed from the team.' : current ? 'Team access saved.' : 'Added to the team.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The team change was not saved.')
  }
}

/** Creates an ethical wall in draft; it screens no one until activated. */
export async function createEthicalWall(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = id(formData, 'matterId', 'Matter')
    const name = formText(formData, 'name', { label: 'Name', min: 2, max: 200 })
    const reason = formText(formData, 'reason', { label: 'Reason', min: 5, max: 4000 })
    const policyReference = formText(formData, 'policyReference', { label: 'Policy reference', max: 200 })
    await loadMatter(matterId)
    const viewer = await keystoneClient<{ authenticatedItem: { id: string } | null }>('query WallViewer { authenticatedItem { ... on User { id } } }')
    if (!viewer.success || !viewer.data.authenticatedItem?.id) throw new Error('Sign in again to create a wall.')
    const response = await keystoneClient<{ createEthicalWall: { id: string } | null }>(`
      mutation CreateEthicalWall($data: EthicalWallCreateInput!) { createEthicalWall(data: $data) { id } }
    `, {
      data: {
        matter: { connect: { id: matterId } },
        name,
        reason,
        ...(policyReference ? { policyReference } : {}),
        createdBy: { connect: { id: viewer.data.authenticatedItem.id } },
      },
    })
    if (!response.success || !response.data.createEthicalWall) throw new Error('The wall was not created. Ethical-wall management permission is required.')
    revalidatePath(matterPath(matterId))
    return commandResult(previous, true, 'Draft wall created. Add members, then activate it.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The wall was not created.')
  }
}

/** Activates a draft wall or lifts an active one. */
export async function transitionMatterWall(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = id(formData, 'matterId', 'Matter')
    const wallId = id(formData, 'wallId', 'Wall')
    const toStatus = formChoice(formData, 'toStatus', ['active', 'lifted'] as const, 'wall status')
    const reason = formText(formData, 'reason', { label: 'Reason', min: 5, max: 2000 })
    const wall = await keystoneClient<{ ethicalWall: { id: string; status: string } | null }>('query WallStatus($id: ID!) { ethicalWall(where: { id: $id }) { id status } }', { id: wallId })
    if (!wall.success || !wall.data.ethicalWall) throw new Error('This wall is unavailable in your current access.')
    const from = wall.data.ethicalWall.status
    if (toStatus === 'active' && from !== 'draft') throw new Error('Only a draft wall can be activated.')
    if (toStatus === 'lifted' && from !== 'active') throw new Error('Only an active wall can be lifted.')
    const response = await keystoneClient<{ transitionEthicalWall: { wall: { id: string; status: string } } }>(`
      mutation TransitionEthicalWall($wallId: ID!, $toStatus: String!, $reason: String!) {
        transitionEthicalWall(wallId: $wallId, toStatus: $toStatus, reason: $reason) { wall { id status } }
      }
    `, { wallId, toStatus, reason })
    if (!response.success) throw new Error('The wall was not changed. Ethical-wall management permission is required.')
    revalidatePath(matterPath(matterId))
    return commandResult(previous, true, toStatus === 'active' ? 'Wall active.' : 'Wall lifted.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The wall was not changed.')
  }
}

/** Adds, changes or revokes one person's allowed / blocked decision on a wall. */
export async function setMatterWallMember(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = id(formData, 'matterId', 'Matter')
    const wallId = id(formData, 'wallId', 'Wall')
    const userId = id(formData, 'userId', 'Member')
    const revoke = formData.get('intent') === 'revoke'
    const decision = formChoice(formData, 'decision', ['allowed', 'blocked'] as const, 'decision')
    const reason = formText(formData, 'reason', { label: 'Reason', min: 5, max: 2000 })
    const wall = await keystoneClient<{ ethicalWall: { id: string; status: string } | null }>('query WallMemberStatus($id: ID!) { ethicalWall(where: { id: $id }) { id status } }', { id: wallId })
    if (!wall.success || !wall.data.ethicalWall) throw new Error('This wall is unavailable in your current access.')
    if (wall.data.ethicalWall.status === 'lifted') throw new Error('A lifted wall cannot be changed.')
    const response = await keystoneClient<{ setEthicalWallMember: { id: string; status: string } }>(`
      mutation SetEthicalWallMember($wallId: ID!, $userId: ID!, $decision: String!, $status: String!, $reason: String!) {
        setEthicalWallMember(wallId: $wallId, userId: $userId, decision: $decision, status: $status, reason: $reason) { id status }
      }
    `, { wallId, userId, decision, status: revoke ? 'revoked' : 'active', reason })
    if (!response.success) throw new Error('The wall member was not saved. Ethical-wall management permission is required, and the person must be an active firm member.')
    revalidatePath(matterPath(matterId))
    return commandResult(previous, true, revoke ? 'Decision revoked.' : decision === 'blocked' ? 'Member blocked.' : 'Member allowed.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The wall member was not saved.')
  }
}

/** Switches the matter between standard and restricted confidentiality. */
export async function changeConfidentiality(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = id(formData, 'matterId', 'Matter')
    const confidentiality = formChoice(formData, 'confidentiality', ['standard', 'restricted'] as const, 'confidentiality')
    const reason = formText(formData, 'reason', { label: 'Reason', min: 10, max: 4000 })
    const matter = await loadMatter(matterId)
    if (matter.confidentiality === confidentiality) throw new Error(`The matter is already ${confidentiality}.`)
    if (confidentiality === 'restricted' && !matter.teamMembers.some((member) => member.canAccessRestricted)) {
      throw new Error('Give at least one team member restricted access before restricting the matter.')
    }
    const response = await keystoneClient<{ changeMatterConfidentiality: { replayed: boolean } }>(`
      mutation ChangeMatterConfidentiality($matterId: ID!, $confidentiality: String!, $reason: String!) {
        changeMatterConfidentiality(matterId: $matterId, confidentiality: $confidentiality, reason: $reason) { replayed }
      }
    `, { matterId, confidentiality, reason })
    if (!response.success) throw new Error('Confidentiality was not changed. Ethical-wall management permission is required.')
    revalidatePath(matterPath(matterId))
    return commandResult(previous, true, confidentiality === 'restricted' ? 'Matter restricted.' : 'Matter set to standard.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'Confidentiality was not changed.')
  }
}
