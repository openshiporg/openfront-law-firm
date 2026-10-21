import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { PublicPage } from '../PublicSiteChrome'
import { getStorefrontSettings } from '../lib/storefront-settings'
import { firmMetadata } from '../lib/metadata'
import { FIXTURE_FIRST_CONTACT_NOTICE, firstContactVersion } from '../lib/first-contact'
import { appointmentPaymentState, appointmentStatus, formatAppointmentTime, getConsultationAvailability, getConsultationCatalog, getConsultationService, getConsultationServiceById, getCustomerConsultation, getCustomerConsultations } from '../lib/consultation-data'
import { ConsultationBookingForm } from '../CustomerForms'
import { formatMinorUnits as formatMoney } from '@/features/platform/lib/money'

/** A temporary backend failure keeps a retry path instead of posing as "not found" or "sign in". */
function ServiceUnavailable({ title, retryHref }: { title: string; retryHref: string }) {
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><h1 className="sf-doc__title">{title}</h1></header><p role="alert">This page could not be loaded right now. Nothing was changed.</p><p className="mt-6 flex flex-wrap gap-6"><Link className="sf-link inline-flex min-h-11 items-center" href={retryHref}>Try again</Link><Link className="sf-link inline-flex min-h-11 items-center" href="/contact">Contact the firm</Link></p></article></PublicPage>
}

export async function homeMetadata() { return firmMetadata(null) }
export async function HomePage() {
  const settings = await getStorefrontSettings()
  const published = settings.isConfigured && (settings.isLocalFictional || settings.publication.mode === 'live')
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">{settings.isLocalFictional ? 'Fictional local workspace' : 'Public information'}</p><h1 className="sf-doc__title">{published ? settings.firmName : 'Firm information is not yet published.'}</h1></header>{settings.bookingEnabled ? <><p className="sf-doc__lede">Consultation appointments</p><Link href="/practice-areas" className="sf-btn min-h-11">Browse appointments ↗</Link></> : <p className="sf-doc__lede">Public consultation services are not configured.</p>}</article></PublicPage>
}

export async function servicesMetadata() { return firmMetadata('Practice areas') }
export async function ServicesPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const { after } = await searchParams
  const cursor = typeof after === 'string' ? after : null
  const catalog = await getConsultationCatalog(cursor)
  if (catalog.status !== 'ok') return <ServiceUnavailable title="Practice areas" retryHref="/practice-areas" />
  const { services, nextCursor } = catalog.data
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Consultation appointments</p><h1 className="sf-doc__title">Practice areas</h1></header>{services.length ? <div className="grid gap-5 sm:grid-cols-2">{services.map(service => <article key={service.id} className="rounded-lg border border-border p-5"><h2 className="text-xl font-semibold">{service.name}</h2><p className="my-4 text-sm">{service.description}</p><p className="mb-4 text-sm">{service.consultationMinutes} minutes · {formatMoney(service.consultationFeeMinor, service.currencyCode)}</p><Link className="sf-link inline-flex min-h-11 items-center" href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`}>View appointment ↗</Link></article>)}</div> : <p role="status">{cursor ? 'No more practice areas.' : 'Practice areas are not published.'}</p>}<nav aria-label="Practice area pages" className="mt-6 flex flex-wrap gap-6">{cursor ? <Link className="sf-link inline-flex min-h-11 items-center" href="/practice-areas">First page</Link> : null}{nextCursor ? <Link className="sf-link inline-flex min-h-11 items-center" href={`/practice-areas?after=${encodeURIComponent(nextCursor)}`}>More practice areas</Link> : null}</nav></article></PublicPage>
}

export async function serviceDetailMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const result = await getConsultationService((await params).slug)
  return firmMetadata(result.status === 'ok' && result.data ? result.data.name : 'Practice areas')
}
export async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const settings = await getStorefrontSettings()
  const result = await getConsultationService(slug)
  if (result.status !== 'ok') return <ServiceUnavailable title="Practice areas" retryHref={`/practice-areas/${encodeURIComponent(slug)}`} />
  const service = result.data
  if (!service) notFound()
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">{settings.isLocalFictional ? 'Fictional local appointment' : 'Consultation appointment'}</p><h1 className="sf-doc__title">{service.name}</h1><p className="sf-doc__lede">{service.description}</p></header><p>{service.consultationMinutes} minutes · {formatMoney(service.consultationFeeMinor, service.currencyCode)}</p><p className="mt-6"><Link className="sf-btn min-h-11" href={`/consultation?service=${service.id}`}>Choose appointment ↗</Link></p><p className="mt-6"><Link className="sf-link inline-flex min-h-11 items-center" href="/practice-areas">All appointments</Link></p></article></PublicPage>
}

export async function bookingMetadata() { return firmMetadata('Request an appointment') }
export async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const settings = await getStorefrontSettings()
  const selected = (await searchParams).service
  const lookup = selected ? await getConsultationServiceById(selected) : null
  if (lookup?.status === 'unavailable') return <ServiceUnavailable title="Choose an appointment" retryHref={`/consultation?service=${encodeURIComponent(selected ?? '')}`} />
  const service = lookup?.status === 'ok' ? lookup.data : null
  const notice = settings.isLocalFictional ? FIXTURE_FIRST_CONTACT_NOTICE : settings.publication.firstContactNotice
  if (!service || !settings.bookingEnabled || !notice) return <PublicPage><article className="sf-doc"><h1 className="sf-doc__title">Choose an appointment</h1><Link className="sf-link inline-flex min-h-11 items-center" href="/practice-areas">Browse practice areas ↗</Link></article></PublicPage>
  const history = await getCustomerConsultations()
  if (history.status === 'signed_out') redirect(`/account/signin?service=${encodeURIComponent(service.id)}`)
  if (history.status === 'unavailable') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const availability = await getConsultationAvailability(service.id)
  if (availability.status !== 'ok') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const slots = availability.data.slots
  const acknowledgmentVersion = firstContactVersion(settings.isLocalFictional ? 'fixture' : 'live', settings.publication.firstContactNoticeVersion)
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">{settings.isLocalFictional ? 'Fictional local appointment' : 'Appointment request'}</p><h1 className="sf-doc__title">{service.name}</h1><p>{service.consultationMinutes} minutes · {formatMoney(service.consultationFeeMinor, service.currencyCode)}</p></header><ConsultationBookingForm service={service} slots={slots} requestKey={randomUUID()} timezone={availability.data.timezone} notice={notice} acknowledgmentVersion={acknowledgmentVersion} /></article></PublicPage>
}

export async function appointmentMetadata() { return firmMetadata('Appointment') }
export async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const result = await getCustomerConsultation(id)
  if (result.status === 'signed_out') redirect('/account/signin')
  if (result.status === 'unavailable') return <ServiceUnavailable title="Appointment" retryHref={`/account/appointments/${encodeURIComponent(id)}`} />
  const row = result.data
  if (!row) notFound()
  const status = appointmentStatus(row.status)
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><p className="sf-doc__meta">Your appointment</p><h1 className="sf-doc__title">{row.serviceTitle}</h1></header><dl className="grid gap-3"><div><dt>Status</dt><dd className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${status.tone}`} aria-hidden="true" />{status.label}</dd></div><div><dt>Time</dt><dd>{formatAppointmentTime(row.startsAt, row.timezone)}</dd></div><div><dt>Consultation fee</dt><dd>{formatMoney(row.feeMinor, row.currencyCode)}</dd></div><div><dt>Payment</dt><dd>{appointmentPaymentState(row)}</dd></div></dl><p role="status" className="my-6 rounded-md border p-4">{row.status === 'requested' ? 'The firm reviews each request, including a conflict check, before confirming. No payment is collected online.' : 'No payment is collected online. Contact the firm with any questions about this appointment.'}</p><Link className="sf-link inline-flex min-h-11 items-center" href="/account">Your appointments ↗</Link></article></PublicPage>
}

/** Old payment URLs: there is no online payment step, so they open the appointment itself. */
export async function legacyPaymentRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/account/appointments/${encodeURIComponent((await params).id)}`)
}
