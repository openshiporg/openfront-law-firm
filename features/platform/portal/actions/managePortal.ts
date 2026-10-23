'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { isEmailDeliveryConfigured, sendPortalInvitationEmail } from '@/features/keystone/lib/mail'
import type { PortalManagementState } from './types'

const inviteMutation = `mutation($contactId: ID!, $email: String!) { invitePortalAccount(contactId: $contactId, email: $email) { account { id email status } inviteToken } }`
// grantPortalMatterAccess now requires explicit versioned intent; use policyPortal.
const shareMutation = `mutation($accessId: ID!, $resourceType: String!, $resourceId: ID!) { sharePortalResource(portalMatterAccessId: $accessId, resourceType: $resourceType, resourceId: $resourceId) { id status resourceType } }`
const threadMessageCountQuery = `query($threadId: ID!) { communicationMessagesCount(where: { thread: { id: { equals: $threadId } }, status: { in: [sent, delivered, received] } }) }`
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
    let invitationEmailed: boolean | null = null

    if (operation === 'invite') {
      const email = value(formData, 'email', 320).toLowerCase()
      const response = await keystoneClient<{ invitePortalAccount: { inviteToken: string } }>(inviteMutation, {
        contactId: value(formData, 'contactId', 200),
        email,
      })
      if (!response.success) return { ok: false, message: response.error, inviteToken: null }
      inviteToken = response.data.invitePortalAccount.inviteToken
      invitationEmailed = false
      if (isEmailDeliveryConfigured()) {
        try {
          await sendPortalInvitationEmail(inviteToken, email)
          invitationEmailed = true
        } catch {
          invitationEmailed = false
        }
      }
    } else if (operation === 'grant') {
      throw new Error('Use the versioned Matter directory to review and submit the exact grant intent.')
    } else if (operation === 'share') {
      const resource = splitSelection(formData, 'resource', new Set(['document', 'invoice', 'communication_thread']))
      if (resource.type === 'communication_thread') {
        // The client only ever sees sent, delivered or received messages; drafts and
        // internal notes stay in the firm. Refuse to share a thread that would look empty.
        const messages = await keystoneClient<{ communicationMessagesCount: number }>(threadMessageCountQuery, { threadId: resource.id })
        if (messages.success && messages.data.communicationMessagesCount === 0) {
          return { ok: false, message: 'This conversation has no sent or received messages yet, so the client would see an empty thread. Send a message first, then share it.', inviteToken: null }
        }
      }
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
      message: inviteToken
        ? invitationEmailed
          ? 'Invitation created and emailed to the client. The link below is a backup you can copy.'
          : isEmailDeliveryConfigured()
            ? 'Invitation created, but the email could not be sent. Copy the one-time link below and send it to the client.'
            : 'Invitation created. Email delivery is not configured, so copy the one-time link below and send it to the client yourself.'
        : 'Client access updated.',
      inviteToken,
      invitationEmailed,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Portal access could not be updated.', inviteToken: null }
  }
}
