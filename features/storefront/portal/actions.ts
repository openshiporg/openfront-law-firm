'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { keystoneContext } from '@/features/keystone/context'
import { revokePortalSession } from '@/features/keystone/lib/portal-auth'
import { acceptPortalInvitation, redeemPortalSignInLink, requestPortalSignInLink } from '@/features/keystone/mutations/portalWorkflows'
import { isEmailDeliveryConfigured, sendPortalSignInEmail } from '@/features/keystone/lib/mail'
import { PORTAL_SESSION_COOKIE, type PortalAcceptState, type PortalSignInState } from './constants'

export async function acceptPortalInvite(
  previousState: PortalAcceptState,
  formData: FormData,
): Promise<PortalAcceptState> {
  const inviteToken = String(formData.get('inviteToken') ?? '').trim()
  if (!inviteToken || inviteToken.length > 512) return { error: 'Enter a valid invitation token.', inviteToken: inviteToken.slice(0, 512), revision: previousState.revision + 1 }

  try {
    const result = await acceptPortalInvitation(null, { inviteToken }, keystoneContext)
    const cookieStore = await cookies()
    cookieStore.set(PORTAL_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/portal',
      expires: result.expiresAt,
    })
  } catch {
    return {
      error: 'This invitation is invalid, expired, or has already been accepted. Contact your firm to request a new invitation.',
      inviteToken,
      revision: previousState.revision + 1,
    }
  }

  redirect('/portal')
}

export async function signOutPortal() {
  const cookieStore = await cookies()
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value
  if (token) await revokePortalSession(token, keystoneContext.prisma)
  cookieStore.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/portal',
    maxAge: 0,
  })
  redirect('/portal/signin')
}

/** Same response whether or not an active portal account uses the address. */
export async function requestPortalSignIn(_previous: PortalSignInState, formData: FormData): Promise<PortalSignInState> {
  const email = String(formData.get('email') ?? '').trim().slice(0, 320)
  if (!email) return { sent: false, error: 'Enter the email address your firm invited.' }
  // Without email delivery no link can arrive; say so instead of implying one was sent.
  if (!isEmailDeliveryConfigured()) return { sent: false, error: 'Email sign-in links are not available for this firm. Ask your firm for a new invitation link.' }
  await requestPortalSignInLink(email, keystoneContext.prisma, (token, to) => sendPortalSignInEmail(token, to))
  return { sent: true, error: null }
}

/** POST-only redemption, so link scanners that prefetch the email link cannot burn it. */
export async function redeemPortalSignIn(_previous: PortalSignInState, formData: FormData): Promise<PortalSignInState> {
  const token = String(formData.get('token') ?? '').trim()
  if (!token || token.length > 512) return { sent: false, error: 'This sign-in link is invalid or has expired. Request a new one.' }
  try {
    const result = await redeemPortalSignInLink(token, keystoneContext.prisma)
    const cookieStore = await cookies()
    cookieStore.set(PORTAL_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/portal',
      expires: result.expiresAt,
    })
  } catch {
    return { sent: false, error: 'This sign-in link is invalid or has expired. Request a new one.' }
  }
  redirect('/portal')
}
