import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PublicPage } from '../PublicSiteChrome'
import { CustomerAuthForm } from '../CustomerForms'
import { CustomerResetRedeemForm, CustomerResetRequestForm } from '../CustomerResetForms'
import { appointmentPaymentState, appointmentStatus, formatAppointmentTime, getCustomerConsultations } from '../lib/consultation-data'
import { firmMetadata } from '../lib/metadata'
import { getStorefrontSettings } from '../lib/storefront-settings'
import { customerSignOut } from '../actions/customer-account'
import { formatMinorUnits } from '@/features/platform/lib/money'

export async function AccountAuthPage({ mode, searchParams }: { mode: 'signin' | 'signup'; searchParams: Promise<{ service?: string; reset?: string }> }) {
  const { service = '', reset } = await searchParams
  const settings = await getStorefrontSettings()
  if (mode === 'signup' && !settings.accountsEnabled) return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your appointments</p><h1 className="sf-doc__title">Accounts are not open</h1></header><p>This firm is not accepting new online accounts. Existing appointment customers can <Link className="sf-link" href="/account/signin">sign in to their appointments</Link>. Separately invited clients can use the <Link className="sf-link" href="/portal">client portal</Link> or <Link className="sf-link" href="/contact">contact the firm</Link>.</p></article></PublicPage>
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your appointments</p><h1 className="sf-doc__title">{mode === 'signup' ? 'Create account' : 'Sign in'}</h1></header>{mode === 'signin' && reset === '1' ? <p role="status" className="mb-5">Your password was changed. Sign in with the new password.</p> : null}{mode === 'signup' && settings.publication.mode === 'live' ? <p className="mb-5 text-sm">Read the <Link className="sf-link" href="/privacy">privacy notice</Link> before you create an account.</p> : null}<CustomerAuthForm mode={mode} service={service} />{settings.accountsEnabled ? <Link className="sf-link mt-5 inline-flex min-h-11 items-center" href={`/account/${mode === 'signup' ? 'signin' : 'signup'}${service ? `?service=${encodeURIComponent(service)}` : ''}`}>{mode === 'signup' ? 'Already have an account? Sign in' : 'Create account'} ↗</Link> : null}</article></PublicPage>
}
export async function accountMetadata() { return firmMetadata('Your appointments') }
export async function AccountPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const { after } = await searchParams
  const cursor = typeof after === 'string' ? after : null
  const result = await getCustomerConsultations(cursor)
  if (result.status === 'signed_out') redirect('/account/signin')
  if (result.status === 'unavailable') return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your account</p><h1 className="sf-doc__title">Appointments</h1></header><p role="alert">Your appointments could not be loaded right now. Nothing was changed.</p><p className="mt-6 flex flex-wrap gap-6"><Link className="sf-link inline-flex min-h-11 items-center" href="/account">Try again</Link><Link className="sf-link inline-flex min-h-11 items-center" href="/contact">Contact the firm</Link></p></article></PublicPage>
  const { appointments: rows, nextCursor } = result.data
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your account</p><h1 className="sf-doc__title">Appointments</h1></header><form action={customerSignOut}><button className="sf-link mb-5 min-h-11">Sign out</button></form>{rows.length ? <div className="grid gap-4">{rows.map(row => {
    const status = appointmentStatus(row.status)
    return <article className="rounded-md border p-5" key={row.id}><h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">{row.serviceTitle}<span className="inline-flex items-center gap-2 text-xs font-normal"><span className={`size-2 rounded-full ${status.tone}`} aria-hidden="true" />{status.label}</span></h2><p className="my-3 text-sm">{formatAppointmentTime(row.startsAt, row.timezone)} · {formatMinorUnits(row.feeMinor, row.currencyCode)} · {appointmentPaymentState(row)}</p><Link className="sf-link inline-flex min-h-11 items-center" href={`/account/appointments/${row.id}`}>Appointment details ↗</Link></article>
  })}</div> : <p role="status">{cursor ? 'No older appointments.' : 'No appointments yet.'}</p>}<nav aria-label="Appointment pages" className="mt-5 flex flex-wrap gap-6">{cursor ? <Link className="sf-link inline-flex min-h-11 items-center" href="/account">Most recent</Link> : null}{nextCursor ? <Link className="sf-link inline-flex min-h-11 items-center" href={`/account?after=${encodeURIComponent(nextCursor)}`}>Older appointments</Link> : null}</nav><Link className="sf-link mt-5 inline-flex min-h-11 items-center" href="/practice-areas">Browse appointments ↗</Link></article></PublicPage>
}
export function AccountSignInPage(props: { searchParams: Promise<{ service?: string; reset?: string }> }) { return <AccountAuthPage mode="signin" {...props} /> }
export function AccountSignUpPage(props: { searchParams: Promise<{ service?: string }> }) { return <AccountAuthPage mode="signup" {...props} /> }
export async function signInMetadata() { return firmMetadata('Sign in') }
export async function signUpMetadata() { return firmMetadata('Create account') }

/** Storefront password recovery: request (no token) or set a new password (one-use token). */
export async function AccountResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  const resetToken = typeof token === 'string' ? token.slice(0, 512) : ''
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your appointments</p><h1 className="sf-doc__title">{resetToken ? 'Set a new password' : 'Reset your password'}</h1></header>{resetToken ? <CustomerResetRedeemForm token={resetToken} /> : <CustomerResetRequestForm />}<Link className="sf-link mt-5 inline-flex min-h-11 items-center" href="/account/signin">Back to sign in</Link></article></PublicPage>
}
export async function resetMetadata() { return firmMetadata('Reset password') }
