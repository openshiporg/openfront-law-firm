'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { keystoneContext } from '@/features/keystone/context'

export type AccountState = { error: string | null }
export async function customerAuthenticate(_previous: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const password = String(form.get('password') || '')
  if (form.get('mode') === 'signup') {
    const registration = await keystoneClient(`mutation($name: String!, $email: String!, $password: String!) { registerConsultationAccount(name: $name, email: $email, password: $password) { id } }`, { name: String(form.get('name') || ''), email, password })
    if (!registration.success) return { error: 'Account could not be created. Check your details or sign in.' }
  }
  const response = await keystoneClient<{ authenticateUserWithPassword: { sessionToken?: string } }>(`mutation($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken } ... on UserAuthenticationWithPasswordFailure { message } } }`, { email, password })
  const token = response.success ? response.data.authenticateUserWithPassword.sessionToken : null
  if (!token) return { error: 'Email or password is incorrect.' }
  // The password was verified above; only an active account receives a session.
  // Invited, suspended or deactivated accounts never enter a sign-in/redirect loop.
  const account = await keystoneContext.prisma.user.findUnique({ where: { email }, select: { status: true } }).catch(() => null)
  if (account?.status !== 'active') return { error: 'This account cannot sign in right now. If you were invited, finish setup from your invitation email, or reset your password. Otherwise contact the firm.' }
  ;(await cookies()).set('keystonejs-session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 86400 * 7 })
  revalidatePath('/account')
  const service = String(form.get('service') || '')
  redirect(service ? `/consultation?service=${encodeURIComponent(service)}` : '/account')
}
export async function customerSignOut() {
  ;(await cookies()).delete('keystonejs-session')
  revalidatePath('/account')
  redirect('/account/signin')
}
export type BookingState = { error: string | null; values: Record<string, string>; revision: number; outcome?: 'rejected' | 'unknown'; requestKey?: string }

export async function bookConsultation(previous: BookingState, form: FormData): Promise<BookingState> {
  const values = {
    startsAt: String(form.get('startsAt') || ''),
    jurisdiction: String(form.get('jurisdiction') || ''),
    opposingParties: String(form.get('opposingParties') || ''),
    keyDeadline: String(form.get('keyDeadline') || ''),
    summary: String(form.get('summary') || ''),
  }
  const revision = previous.revision + 1
  if (form.get('acknowledgment') !== 'yes') return { error: 'Read the notice and confirm the acknowledgment before submitting.', values, revision }
  const response = await keystoneClient<{ bookClientConsultation: { id: string } }>(
    `mutation($serviceId: ID!, $startsAt: String!, $requestKey: String!, $summary: String, $jurisdiction: String!, $opposingParties: String!, $keyDeadline: String, $acknowledgmentVersion: String!) {
      bookClientConsultation(serviceId: $serviceId, startsAt: $startsAt, requestKey: $requestKey, summary: $summary, jurisdiction: $jurisdiction, opposingParties: $opposingParties, keyDeadline: $keyDeadline, acknowledgmentVersion: $acknowledgmentVersion) { id }
    }`,
    { serviceId: String(form.get('serviceId') || ''), requestKey: String(form.get('requestKey') || ''), acknowledgmentVersion: String(form.get('acknowledgmentVersion') || ''), ...values },
  )
  if (!response.success) {
    // A GraphQL/transport error is not proof of non-effect. Do not mint another
    // request or advise changed-body retry. Durable server-owned recovery remains
    // required; keep this original reference and entered values in the meantime.
    return { error: 'The outcome of this request is unconfirmed. Do not submit a different request. Check your appointment history and contact the firm with this request reference if it is still unresolved.', values, revision, outcome: 'unknown', requestKey: String(form.get('requestKey') || '') }
  }
  revalidatePath('/account')
  redirect(`/account/appointments/${encodeURIComponent(response.data.bookClientConsultation.id)}`)
}
