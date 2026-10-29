import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { PublicPage } from '../PublicSiteChrome'
import { CustomerAuthForm } from '../CustomerForms'
import { CustomerResetRedeemForm, CustomerResetRequestForm } from '../CustomerResetForms'
import { appointmentStatus, formatAppointmentTime, getCustomerConsultations } from '../lib/consultation-data'
import { firmMetadata } from '../lib/metadata'
import { getStorefrontSettings } from '../lib/storefront-settings'
import { customerSignOut } from '../actions/customer-account'
import { formatMinorUnits } from '@/features/platform/lib/money'

/** Centered account card shared by sign in, create account and password reset. */
function AuthShell({ title, label = 'Consultation requests and appointments', tabs, children, foot }: { title: string; label?: string; tabs?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return <PublicPage><div className="sf-shell sf-page grid justify-items-center">
    <div className="grid w-full max-w-md gap-6">
      {tabs}
      <div className="sf-card">
        <div className="sf-card__body grid gap-6">
          <header className="grid gap-2"><h1 className="sf-h2">{title}</h1><p className="sf-label">{label}</p></header>
          {children}
        </div>
        {foot ? <div className="sf-card__foot text-sm">{foot}</div> : null}
      </div>
    </div>
  </div></PublicPage>
}

export async function AccountAuthPage({ mode, searchParams }: { mode: 'signin' | 'signup'; searchParams: Promise<{ service?: string; reset?: string; from?: string }> }) {
  const { service = '', reset, from = '' } = await searchParams
  const settings = await getStorefrontSettings()
  const query = service ? `?service=${encodeURIComponent(service)}` : from ? `?from=${encodeURIComponent(from)}` : ''
  if (mode === 'signup' && !settings.accountsEnabled) return <AuthShell title="Accounts are not open" foot={<><Link className="sf-link" href="/portal">Client portal</Link><Link className="sf-link" href="/contact">Contact the firm</Link></>}>
    <p className="sf-muted text-sm leading-6">This firm is not accepting new online accounts.</p>
    <div className="sf-track sf-track--block"><Link className="sf-pill sf-pill--raised sf-pill--lg" href="/account/signin">Sign in</Link></div>
  </AuthShell>
  const tabs = settings.accountsEnabled ? <nav aria-label="Account" className="sf-track sf-track--block">
    <Link href={`/account/signin${query}`} className="sf-pill" aria-current={mode === 'signin' ? 'page' : undefined}>Sign in</Link>
    <Link href={`/account/signup${query}`} className="sf-pill" aria-current={mode === 'signup' ? 'page' : undefined}>Create account</Link>
  </nav> : null
  return <AuthShell title={mode === 'signup' ? 'Create account' : 'Sign in'} tabs={tabs} foot={<><span className="sf-muted">Invited by the firm?</span><Link className="sf-link" href="/portal">Client portal</Link></>}>
    {mode === 'signin' && reset === '1' ? <p role="status" className="sf-notice">Password changed. Sign in with the new password.</p> : null}
    {mode === 'signup' && settings.publication.mode === 'live' ? <p className="text-sm"><Link className="sf-link" href="/privacy">Privacy notice</Link></p> : null}
    <CustomerAuthForm mode={mode} service={service} from={typeof from === 'string' ? from.slice(0, 300) : ''} />
  </AuthShell>
}

export async function accountMetadata() { return firmMetadata('Your appointments') }
export async function AccountPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const { after } = await searchParams
  const cursor = typeof after === 'string' ? after : null
  const [result, settings] = await Promise.all([getCustomerConsultations(cursor), getStorefrontSettings()])
  if (result.status === 'signed_out') redirect(cursor ? `/account/signin?from=${encodeURIComponent('/account')}` : '/account/signin')
  if (result.status === 'unavailable') return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6"><h1 className="sf-title">Appointments</h1><p role="alert" className="sf-notice sf-notice--plain">Your appointments could not be loaded. Nothing was changed.</p><div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/account">Try again</Link><Link className="sf-pill" href="/contact">Contact the firm</Link></div></div></div></PublicPage>
  const { appointments: rows, nextCursor } = result.data
  return <PublicPage><div className="sf-shell sf-page">
    <header className="sf-page__head sf-page__head--split">
      <div className="grid gap-3"><h1 className="sf-title">Appointments</h1><p className="sf-label">Your account</p></div>
      <div className="sf-track">
        {settings.bookingEnabled ? <Link className="sf-pill sf-pill--primary" href="/practice-areas">New request</Link> : null}
        <form action={customerSignOut}><button className="sf-pill">Sign out</button></form>
      </div>
    </header>
    {rows.length ? <ul className="sf-rows">{rows.map(row => {
      const status = appointmentStatus(row.status)
      return <li key={row.id}><Link className="sf-row" href={`/account/appointments/${row.id}`}>
        <span className="sf-row__title"><span className={`sf-dot ${status.tone}`} aria-hidden="true" /><span>{row.serviceTitle}</span><span className="sf-status">{status.label}</span></span>
        <span className="sf-row__meta sf-num">{formatAppointmentTime(row.startsAt, row.timezone)} · {formatMinorUnits(row.feeMinor, row.currencyCode)}</span>
        <ChevronRight className="sf-row__end size-5" aria-hidden="true" />
      </Link></li>
    })}</ul> : <div className="sf-empty"><p role="status" className="sf-h3">{cursor ? 'No older appointments' : 'No appointments yet'}</p>{settings.bookingEnabled && !cursor ? <div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/practice-areas">Practice areas</Link></div> : null}</div>}
    {cursor || nextCursor ? <nav aria-label="Appointment pages" className="sf-track mt-6">{cursor ? <Link className="sf-pill" href="/account">Most recent</Link> : null}{nextCursor ? <Link className="sf-pill sf-pill--raised" href={`/account?after=${encodeURIComponent(nextCursor)}`}>Older appointments</Link> : null}</nav> : null}
  </div></PublicPage>
}
export function AccountSignInPage(props: { searchParams: Promise<{ service?: string; reset?: string; from?: string }> }) { return <AccountAuthPage mode="signin" {...props} /> }
export function AccountSignUpPage(props: { searchParams: Promise<{ service?: string; from?: string }> }) { return <AccountAuthPage mode="signup" {...props} /> }
export async function signInMetadata() { return firmMetadata('Sign in') }
export async function signUpMetadata() { return firmMetadata('Create account') }

/** Storefront password recovery: request (no token) or set a new password (one-use token). */
export async function AccountResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  const resetToken = typeof token === 'string' ? token.slice(0, 512) : ''
  return <AuthShell title={resetToken ? 'Set a new password' : 'Reset your password'} foot={<Link className="sf-link" href="/account/signin">Back to sign in</Link>}>
    {resetToken ? <CustomerResetRedeemForm token={resetToken} /> : <CustomerResetRequestForm />}
  </AuthShell>
}
export async function resetMetadata() { return firmMetadata('Reset password') }
