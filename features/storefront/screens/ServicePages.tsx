import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { ArrowUpRight } from 'lucide-react'
import { PublicPage } from '../PublicSiteChrome'
import { StoreLogo } from '../StoreLogo'
import { getStorefrontSettings, NEUTRAL_FIRM_NAME } from '../lib/storefront-settings'
import { firmMetadata } from '../lib/metadata'
import { FIXTURE_FIRST_CONTACT_NOTICE, firstContactVersion } from '../lib/first-contact'
import { appointmentPaymentState, appointmentStatus, formatAppointmentTime, getConsultationAvailability, getConsultationCatalog, getConsultationService, getConsultationServiceById, getCustomerConsultation, getCustomerConsultations, type Service } from '../lib/consultation-data'
import { ConsultationBookingForm } from '../CustomerForms'
import { formatMinorUnits as formatMoney } from '@/features/platform/lib/money'

function feeLabel(service: Pick<Service, 'consultationFeeMinor' | 'currencyCode'>) {
  return service.consultationFeeMinor > 0 ? formatMoney(service.consultationFeeMinor, service.currencyCode) : 'No fee'
}

/** A temporary backend failure keeps a retry path instead of posing as "not found" or "sign in". */
export function ServiceUnavailable({ title, retryHref }: { title: string; retryHref: string }) {
  return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6"><h1 className="sf-title">{title}</h1><p role="alert" className="sf-notice sf-notice--plain">This page could not be loaded. Nothing was changed.</p><div className="sf-track"><Link className="sf-pill sf-pill--raised" href={retryHref}>Try again</Link><Link className="sf-pill" href="/contact">Contact the firm</Link></div></div></div></PublicPage>
}

function PracticeIndex({ services, bookingEnabled }: { services: Service[]; bookingEnabled: boolean }) {
  return <ol className="sf-index">
    {services.map(service => <li key={service.id} className="sf-index__row">
      <Link href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`} className="sf-index__link"><h3 className="sf-h3">{service.name}</h3></Link>
      {service.description ? <p className="sf-muted line-clamp-2 max-w-[60ch] text-sm leading-6">{service.description}</p> : null}
      <p className="sf-index__meta sf-num"><span>{service.consultationMinutes} min consultation</span><span>{feeLabel(service)}</span></p>
      {bookingEnabled ? <div className="sf-index__aside mt-3 md:mt-0"><div className="sf-track"><Link href={`/consultation?service=${encodeURIComponent(service.id)}`} className="sf-pill sf-pill--raised sf-pill--sm">Book</Link></div></div> : null}
    </li>)}
  </ol>
}

export async function homeMetadata() { return firmMetadata(null) }
export async function HomePage() {
  const settings = await getStorefrontSettings()
  const published = settings.isConfigured && (settings.isLocalFictional || settings.publication.mode === 'live')
  const catalog = published ? await getConsultationCatalog(null) : null
  const services = catalog?.status === 'ok' ? catalog.data.services.slice(0, 6) : []
  const about = settings.publication.aboutStatement?.split(/\n{2,}/)[0] ?? null
  return <PublicPage dock={settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link href="/practice-areas" className="sf-pill sf-pill--primary sf-pill--lg">Request a consultation</Link></div> : undefined}>
    <section className="sf-shell sf-hero" aria-labelledby="home-title">
      <div className="sf-hero__grid">
        <div className="sf-hero__body">
          <p className="sf-label">{settings.isLocalFictional ? 'Fictional local workspace' : published ? 'Law firm' : 'Public information'}</p>
          <h1 id="home-title" className="sf-display">{published ? settings.firmName : 'Firm information is not yet published.'}</h1>
          {published && settings.tagline ? <p className="sf-lede">{settings.tagline}</p> : null}
          <div className="flex flex-wrap gap-3">
            {settings.bookingEnabled ? <div className="sf-track"><Link href="/practice-areas" className="sf-pill sf-pill--primary sf-pill--lg">Request a consultation</Link><Link href="/account" className="sf-pill sf-pill--lg">Your appointments</Link></div> : <div className="sf-track"><Link href="/contact" className="sf-pill sf-pill--raised sf-pill--lg">Contact</Link></div>}
          </div>
        </div>
        <aside className="sf-hero__seal" aria-label="Existing clients">
          <div className="flex items-center gap-3"><StoreLogo icon={settings.logoIcon} hue={settings.logoColor} /><p className="sf-label">Existing clients</p></div>
          <p className="sf-h3">Client portal</p>
          <p className="sf-muted text-sm">Documents, invoices and messages shared by the firm.</p>
          <div className="sf-track sf-track--block"><Link href="/portal" className="sf-pill sf-pill--raised">Open portal</Link><Link href="/portal/accept" className="sf-pill">Use invitation</Link></div>
        </aside>
      </div>
    </section>

    {published ? <div className="sf-shell">
      <section className="sf-section" aria-labelledby="home-practice">
        <div className="sf-section__head"><h2 id="home-practice" className="sf-h2">Practice areas</h2><Link href="/practice-areas" className="sf-link inline-flex min-h-11 items-center gap-1 text-sm">All practice areas <ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
        {catalog?.status !== 'ok' ? <p role="alert" className="sf-notice sf-notice--plain">Practice areas could not be loaded. <Link href="/" className="sf-link">Try again</Link></p>
          : services.length ? <PracticeIndex services={services} bookingEnabled={settings.bookingEnabled} />
          : <p role="status" className="sf-muted">No practice areas are published.</p>}
      </section>

      {about ? <section className="sf-section" aria-labelledby="home-about">
        <div className="sf-section__head"><h2 id="home-about" className="sf-h2">About the firm</h2><Link href="/about" className="sf-link inline-flex min-h-11 items-center gap-1 text-sm">About <ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
        <div className="sf-prose sf-prose--lead"><p>{about}</p></div>
      </section> : null}

      <section className="sf-section" aria-labelledby="home-contact">
        <div className="sf-card sf-card--ink">
          <div className="sf-card__body grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="grid gap-2">
              <p className="sf-label">Contact</p>
              <h2 id="home-contact" className="sf-h2">{settings.firmName || NEUTRAL_FIRM_NAME}</h2>
              {settings.supportEmail ? <a className="text-base underline underline-offset-4" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : null}
              <p className="sf-muted text-sm">Not for emergencies or deadline protection.</p>
            </div>
            <div className="sf-track" style={{ background: 'color-mix(in oklab, var(--color-paper) 12%, transparent)', boxShadow: 'none' }}><Link href="/contact" className="sf-pill sf-pill--raised">Contact details</Link></div>
          </div>
        </div>
      </section>
    </div> : <div className="sf-shell"><p role="status" className="sf-notice sf-notice--plain max-w-xl">Public consultation services are not configured.</p></div>}
  </PublicPage>
}

export async function servicesMetadata() { return firmMetadata('Practice areas') }
export async function ServicesPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const { after } = await searchParams
  const cursor = typeof after === 'string' ? after : null
  const [catalog, settings] = await Promise.all([getConsultationCatalog(cursor), getStorefrontSettings()])
  if (catalog.status !== 'ok') return <ServiceUnavailable title="Practice areas" retryHref="/practice-areas" />
  const { services, nextCursor } = catalog.data
  return <PublicPage><div className="sf-shell sf-page">
    <header className="sf-page__head">
      <p className="sf-label">Consultation appointments</p><h1 className="sf-title">Practice areas</h1>
    </header>
    {services.length ? <PracticeIndex services={services} bookingEnabled={settings.bookingEnabled} /> : <div className="sf-empty"><p role="status">{cursor ? 'No more practice areas.' : 'Practice areas are not published.'}</p>{cursor ? null : <Link className="sf-link" href="/contact">Contact the firm</Link>}</div>}
    {cursor || nextCursor ? <nav aria-label="Practice area pages" className="sf-track mt-8">{cursor ? <Link className="sf-pill" href="/practice-areas">First page</Link> : null}{nextCursor ? <Link className="sf-pill sf-pill--raised" href={`/practice-areas?after=${encodeURIComponent(nextCursor)}`}>More practice areas</Link> : null}</nav> : null}
  </div></PublicPage>
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
  const book = `/consultation?service=${encodeURIComponent(service.id)}`
  return <PublicPage dock={settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link className="sf-pill sf-pill--primary sf-pill--lg" href={book}>Choose a time</Link></div> : undefined}><div className="sf-shell sf-page">
    <nav aria-label="Breadcrumb" className="mb-8"><Link className="sf-link text-sm" href="/practice-areas">Practice areas</Link></nav>
    <div className="sf-split">
      <article className="grid gap-6">
        <p className="sf-label">{settings.isLocalFictional ? 'Fictional local appointment' : 'Consultation appointment'}</p>
        <h1 className="sf-title">{service.name}</h1>
        {service.description ? <div className="sf-prose sf-prose--lead">{service.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : null}
      </article>
      <aside className="sf-split__aside">
        <div className="sf-card">
          <div className="sf-card__body grid gap-5">
            <dl className="sf-facts">
              <div><dt>Length</dt><dd className="sf-num">{service.consultationMinutes} minutes</dd></div>
              <div><dt>Consultation fee</dt><dd className="sf-num">{feeLabel(service)}</dd></div>
              <div><dt>Payment</dt><dd>Not collected online</dd></div>
            </dl>
            {settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link className="sf-pill sf-pill--primary sf-pill--lg" href={book}>Choose a time</Link></div> : <p className="sf-notice sf-notice--plain">Online booking is closed.</p>}
            <p className="sf-fine">A request does not create an attorney-client relationship. The firm runs a conflict check before confirming.</p>
          </div>
        </div>
      </aside>
    </div>
  </div></PublicPage>
}

export async function bookingMetadata() { return firmMetadata('Request an appointment') }
export async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const settings = await getStorefrontSettings()
  const selected = (await searchParams).service
  const lookup = selected ? await getConsultationServiceById(selected) : null
  if (lookup?.status === 'unavailable') return <ServiceUnavailable title="Choose an appointment" retryHref={`/consultation?service=${encodeURIComponent(selected ?? '')}`} />
  const service = lookup?.status === 'ok' ? lookup.data : null
  const notice = settings.isLocalFictional ? FIXTURE_FIRST_CONTACT_NOTICE : settings.publication.firstContactNotice
  if (!service || !settings.bookingEnabled || !notice) return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6"><h1 className="sf-title">Choose an appointment</h1><div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/practice-areas">Practice areas</Link></div></div></div></PublicPage>
  const history = await getCustomerConsultations()
  if (history.status === 'signed_out') redirect(`/account/signin?service=${encodeURIComponent(service.id)}`)
  if (history.status === 'unavailable') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const availability = await getConsultationAvailability(service.id)
  if (availability.status !== 'ok') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const slots = availability.data.slots
  const acknowledgmentVersion = firstContactVersion(settings.isLocalFictional ? 'fixture' : 'live', settings.publication.firstContactNoticeVersion)
  return <PublicPage><div className="sf-shell sf-page">
    <nav aria-label="Breadcrumb" className="mb-8"><Link className="sf-link text-sm" href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`}>{service.name}</Link></nav>
    <div className="sf-split sf-split--wide-aside">
      <div className="grid gap-8">
        <header className="grid gap-3">
          <p className="sf-label">{settings.isLocalFictional ? 'Fictional local appointment' : 'Appointment request'}</p>
          <h1 className="sf-title">Request a consultation</h1>
        </header>
        <ConsultationBookingForm service={service} slots={slots} requestKey={randomUUID()} timezone={availability.data.timezone} notice={notice} acknowledgmentVersion={acknowledgmentVersion} />
      </div>
      <aside className="sf-split__aside order-first lg:order-none">
        <div className="sf-card"><div className="sf-card__body grid gap-4">
          <p className="sf-label">Appointment</p>
          <p className="sf-h3">{service.name}</p>
          <dl className="sf-facts">
            <div><dt>Length</dt><dd className="sf-num">{service.consultationMinutes} minutes</dd></div>
            <div><dt>Fee</dt><dd className="sf-num">{feeLabel(service)}</dd></div>
            <div><dt>Time zone</dt><dd>{availability.data.timezone}</dd></div>
          </dl>
        </div></div>
      </aside>
    </div>
  </div></PublicPage>
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
  return <PublicPage><div className="sf-shell sf-page">
    <nav aria-label="Breadcrumb" className="mb-8"><Link className="sf-link text-sm" href="/account">Your appointments</Link></nav>
    <div className="sf-narrow grid gap-8">
      <header className="grid gap-4">
        <p className="sf-status"><span className={`sf-dot ${status.tone}`} aria-hidden="true" />{status.label}</p>
        <h1 className="sf-title">{row.serviceTitle}</h1>
        <p className="sf-lede sf-num">{formatAppointmentTime(row.startsAt, row.timezone)}</p>
      </header>
      <dl className="sf-facts">
        <div><dt>Status</dt><dd className="flex items-center gap-2"><span className={`sf-dot ${status.tone}`} aria-hidden="true" />{status.label}</dd></div>
        <div><dt>Time</dt><dd className="sf-num">{formatAppointmentTime(row.startsAt, row.timezone)}</dd></div>
        <div><dt>Consultation fee</dt><dd className="sf-num">{formatMoney(row.feeMinor, row.currencyCode)}</dd></div>
        <div><dt>Payment</dt><dd>{appointmentPaymentState(row)}</dd></div>
      </dl>
      <p role="status" className="sf-notice">{row.status === 'requested' ? 'The firm runs a conflict check before confirming. No payment is collected online.' : 'No payment is collected online.'}</p>
      <div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/account">Your appointments</Link><Link className="sf-pill" href="/contact">Contact the firm</Link></div>
    </div>
  </div></PublicPage>
}

/** Old payment URLs: there is no online payment step, so they open the appointment itself. */
export async function legacyPaymentRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/account/appointments/${encodeURIComponent((await params).id)}`)
}
