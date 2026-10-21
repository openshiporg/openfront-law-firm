'use server'

import { redirect } from 'next/navigation'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type ResetRequestState = { sent: boolean; error: string | null }

/**
 * Enumeration-safe request: known, unknown and undeliverable addresses all get
 * the same response. Keystone issues a one-use, expiring token; the link's
 * destination (staff or storefront) is chosen from the account on the server.
 */
export async function requestCustomerPasswordReset(_previous: ResetRequestState, form: FormData): Promise<ResetRequestState> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { sent: false, error: 'Enter a valid email address.' }
  await keystoneClient(`mutation($email: String!) { sendUserPasswordResetLink(email: $email) }`, { email })
  return { sent: true, error: null }
}

export type ResetRedeemState = { error: string | null; revision: number }

export async function redeemCustomerPasswordReset(previous: ResetRedeemState, form: FormData): Promise<ResetRedeemState> {
  const revision = previous.revision + 1
  const email = String(form.get('email') || '').trim().toLowerCase()
  const token = String(form.get('token') || '')
  const password = String(form.get('password') || '')
  const confirm = String(form.get('confirmPassword') || '')
  if (!token || token.length > 512) return { error: 'This reset link is invalid or has expired. Request a new one.', revision }
  if (password.length < 12 || password.length > 1000) return { error: 'Choose a password of at least 12 characters.', revision }
  if (password !== confirm) return { error: 'The passwords do not match.', revision }
  const response = await keystoneClient<{ redeemUserPasswordResetToken: { code: string } | null }>(
    `mutation($email: String!, $token: String!, $password: String!) { redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code } }`,
    { email, token, password },
  )
  // Neither the password nor the token is ever returned to the client.
  if (!response.success) return { error: 'Choose a different password, or request a new reset link if this keeps happening.', revision }
  if (response.data.redeemUserPasswordResetToken) return { error: 'This reset link is invalid, expired or already used. Request a new one.', revision }
  redirect('/account/signin?reset=1')
}
