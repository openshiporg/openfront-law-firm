'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { PortalManagementState } from './types'

const inviteMutation = `mutation($contactId: ID!, $email: String!) { invitePortalAccount(contactId: $contactId, email: $email) { account { id email status } inviteToken } }`
// grantPortalMatterAccess now requires explicit versioned intent; use policyPortal.
const shareMutation = `mutation($accessId: ID!, $resourceType: String!, $resourceId: ID!) { sharePortalResource(portalMatterAccessId: $accessId, resourceType: $resourceType, resourceId: $resourceId) { id status resourceType } }`
const revokeMutation = `mutation($id: ID!, $grantType: String!, $reason: String!) { revokePortalGrant(id: $id, grantType: $grantType, reason: $reason) { id status replayed } }`

function value(formData: FormData, key: string, maximum = 500) {
  const result = String(formData.get(key) ?? '').trim()
  if (!result || result.length > maximum) throw new Error(`${key} is required.`)
  return result
}

function splitSelection(formData: FormData, key: string, allowed: Set<string>) {
  const raw = value(formData, key)
  const separator = raw.indexOf(':')
  if (separator < 1) throw new Error(`${key} is invalid.`)
  const type = raw.slice(0, separator)
  const id = raw.slice(separator + 1)
  if (!allowed.has(type) || !id || id.length > 200) throw new Error(`${key} is invalid.`)
  return { type, id }
}

export async function managePortal(
  _previousState: PortalManagementState,
  formData: FormData,
): Promise<PortalManagementState> {
  try {
    const operation = value(formData, 'operation', 40)
    let inviteToken: string | null = null

    if (operation === 'invite') {
      const email = value(formData, 'email', 320).toLowerCase()
      const response = await keystoneClient<{ invitePortalAccount: { inviteToken: string } }>(inviteMutation, {
        contactId: value(formData, 'contactId', 200),
        email,
      })
      if (!response.success) return { ok: false, message: response.error, inviteToken: null }
      inviteToken = response.data.invitePortalAccount.inviteToken
    } else if (operation === 'grant') {
      throw new Error('Use the versioned Matter directory to review and submit the exact grant intent.')
    } else if (operation === 'share') {
      const resource = splitSelection(formData, 'resource', new Set(['document', 'invoice', 'communication_thread']))
      const response = await keystoneClient(shareMutation, {
        accessId: value(formData, 'accessId', 200),
        resourceType: resource.type,
        resourceId: resource.id,
      })
      if (!response.success) return { ok: false, message: response.error, inviteToken: null }
    } else if (operation === 'revoke') {
      const target = splitSelection(formData, 'target', new Set(['account', 'share']))
      const reason = value(formData, 'reason', 2000)
      if (reason.length < 5) throw new Error('Revocation reason must be at least 5 characters.')
      const response = await keystoneClient(revokeMutation, { id: target.id, grantType: target.type, reason })
      if (!response.success) return { ok: false, message: response.error, inviteToken: null }
    } else {
      throw new Error('Unsupported portal operation.')
    }

    revalidatePath('/dashboard/platform/portal')
    return {
      ok: true,
      message: inviteToken ? 'Invitation created. Copy the one-time link now.' : 'Portal access updated through the controlled workflow.',
      inviteToken,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Portal access could not be updated.', inviteToken: null }
  }
}
