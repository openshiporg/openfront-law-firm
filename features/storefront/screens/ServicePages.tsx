import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { ChevronRight } from 'lucide-react'
import { EmailText } from '../EmailText'
import { PublicPage } from '../PublicSiteChrome'
import { AttorneyPortrait } from '../AttorneyPortrait'
import { BookingBar } from '../BookingBar'
import { getPublishedAttorneys } from '../lib/attorneys'
import { firstAdmission, officeLocality } from '../lib/locality'
import { getStorefrontSettings, NEUTRAL_FIRM_NAME } from '../lib/storefront-settings'
import { firmMetadata } from '../lib/metadata'
import { firstContactVersion } from '../lib/first-contact'
import { appointmentNotice, appointmentPaymentState, appointmentStatus, reconcileConsultationFee, formatAppointmentTime, getConsultationAvailability, getConsultationCatalog, getConsultationService, getConsultationServiceById, getConsultationOpenTimes, getCustomerConsultation, slotLabel, slotsByDay, slotTimeLabel, spreadTimes, timezoneLabel, getCustomerConsultations, type Service } from '../lib/consultation-data'
import { ConsultationBookingForm } from '../CustomerForms'
import { CancelConsultationForm } from '../CancelConsultationForm'
import { PayConsultationForm } from '../PayConsultationForm'
import { formatMinorUnits as formatMoney } from '@/features/platform/lib/money'

/** A request-time check: the appointment page is rendered per request. */
function notStarted(startsAt: string | null | undefined) {
  return !startsAt || new Date(startsAt).getTime() > Date.now()
}

function feeLabel(service: Pick<Service, 'consultationFeeMinor' | 'currencyCode'>) {
  if (service.consultationFeeMinor <= 0) return 'No fee'
  const label = formatMoney(service.consultationFeeMinor, service.currencyCode)
  return service.consultationFeeMinor % 100 === 0 ? label.replace(/\.00$/, '') : label
}

/** A temporary backend failure keeps a retry path instead of posing as "not found" or "sign in". */
export function ServiceUnavailable({ title, retryHref }: { title: string; retryHref: string }) {
  return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6"><h1 className="sf-title">{title}</h1><p role="alert" className="sf-notice sf-notice--plain">This page could not be loaded. Nothing was changed.</p><div className="sf-track"><Link className="sf-pill sf-pill--raised" href={retryHref}>Try again</Link><Link className="sf-pill" href="/contact">Contact the firm</Link></div></div></div></PublicPage>
}

function PracticeIndex({ services, bookingEnabled }: { services: Service[]; bookingEnabled: boolean }) {
  const terms = commonTerms(services)
  return <ol className="sf-index">
    {services.map(service => <li key={service.id} className="sf-index__row">
      <Link href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`} className="sf-index__link"><h3 className="sf-h3">{service.name}</h3></Link>
      {service.description ? <p className="sf-muted line-clamp-2 max-w-[60ch] text-[1.0625rem] leading-7">{service.description}</p> : null}
      <p className="sf-index__meta sf-num">{[service.consultationMinutes !== terms.minutes ? `${service.consultationMinutes} min` : null, service.consultationFeeMinor !== terms.fee ? (service.consultationFeeMinor <= 0 ? 'No fee' : feeLabel(service)) : null].filter(Boolean).join(' · ')}</p>
      {bookingEnabled ? <div className="sf-index__aside mt-3 md:mt-0"><div className="sf-track"><Link href={`/consultation?service=${encodeURIComponent(service.id)}`} className="sf-pill sf-pill--primary sf-pill--sm" aria-label={`Book a ${service.name} consultation`}>Book</Link></div></div> : null}
    </li>)}
  </ol>
}

export async function homeMetadata() { return firmMetadata(null) }

/** The most common length and fee, stated once; a row only shows what differs from it. */
function commonTerms(services: Service[]) {
  const mode = <T,>(values: T[]) => { const counts = new Map<T, number>(); values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)); return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] }
  return { minutes: mode(services.map((s) => s.consultationMinutes)), fee: mode(services.map((s) => s.consultationFeeMinor)) }
}

function termsSentence(terms: { minutes?: number; fee?: number }, services: Service[]) {
  if (!services.length || terms.minutes === undefined || terms.fee === undefined) return null
  const reference = services.find((s) => s.consultationFeeMinor === terms.fee)!
  const differs = services.filter((s) => s.consultationFeeMinor !== terms.fee)
  const first = `First consultations run ${terms.minutes} minutes${terms.fee <= 0 ? ' and cost nothing' : ` and cost ${feeLabel(reference)}`}`
  if (!differs.length) return `${first}.`
  const parts = differs.map((s) => `${s.name}, ${s.consultationFeeMinor <= 0 ? 'no fee' : feeLabel(s)}`)
  return `${first}, except ${parts.join('; ')}.`
}

function RowDifference({ service, terms }: { service: Service; terms: { minutes?: number; fee?: number } }) {
  const notes = [
    service.consultationMinutes !== terms.minutes ? `${service.consultationMinutes} min` : null,
    service.consultationFeeMinor !== terms.fee ? (service.consultationFeeMinor <= 0 ? 'No fee' : feeLabel(service)) : null,
  ].filter(Boolean)
  return notes.length ? <span className="alt-practice__meta">{notes.join(' · ')}</span> : <span aria-hidden="true" />
}

function countWord(n: number) {
  return ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][n] ?? String(n)
}

/** Home: the firm's people in black and white, the booking bar, practice areas and attorneys. */
export async function HomePage() {
  const settings = await getStorefrontSettings()
  const published = settings.isConfigured && settings.publication.mode === 'live'
  const [catalog, openTimes, attorneys] = await Promise.all([
    published ? getConsultationCatalog(null) : Promise.resolve(null),
    published && settings.bookingEnabled ? getConsultationOpenTimes(null) : Promise.resolve(null),
    getPublishedAttorneys(published),
  ])
  // Practice areas arrive in the firm's chosen order (Public site → Practice areas → Order).
  const services = catalog?.status === 'ok' ? catalog.data.services : []
  const name = settings.firmName ?? NEUTRAL_FIRM_NAME
  const place = officeLocality(settings.officeAddress)
  const times = openTimes?.status === 'ok' ? openTimes.data : null
  const choices = services.map((service) => ({ id: service.id, name: service.name, consultationMinutes: service.consultationMinutes, fee: feeLabel(service), slots: times?.services.find((row) => row.serviceId === service.id)?.slots ?? [] }))
  const team = attorneys ?? []
  const terms = commonTerms(services)
  const street = settings.officeAddress[0]?.split(',')[0]?.trim()
  const lede = [team.length ? `${countWord(team.length)} attorneys` : null, street ? `at ${street}` : null, place ? `in ${place.city}` : null].filter(Boolean).join(' ')
  return <PublicPage dock={settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link href="/practice-areas" className="sf-pill sf-pill--lg">Request a consultation</Link></div> : undefined}>
    <section className="alt-hero" aria-labelledby="home-title">
      {/* eslint-disable-next-line @next/next/no-img-element -- first-paint hero, never lazy */}
      <img className="alt-hero__img" src="/storefront-hero.jpg" alt={`The attorneys of ${name}`} width={1920} height={1280} fetchPriority="high" decoding="sync" />
      <div className="alt-hero__body">
        <h1 id="home-title" className="alt-hero__title">Wills, closings, custody, contracts. Handled plainly.</h1>
        {published && lede ? <p className="alt-hero__tagline">{lede}. We tell you the cost before we start.</p> : published && settings.tagline ? <p className="alt-hero__tagline">{settings.tagline}</p> : null}
      </div>
    </section>

    {settings.bookingEnabled && choices.length && times ? <BookingBar choices={choices} timezone={times.timezone} /> : null}

    <div className="alt-lower">
      <section aria-labelledby="home-practice">
        <div className="alt-head alt-head--practice">
          <h2 id="home-practice" className="sf-h2">What we take on</h2>
          {termsSentence(terms, services) ? <p className="alt-head__note">{termsSentence(terms, services)}</p> : null}
        </div>
        {!published ? <p className="sf-muted">Firm information is not yet published.</p>
          : catalog?.status !== 'ok' ? <p role="alert" className="sf-notice sf-notice--plain">Practice areas could not be loaded. <Link href="/" className="sf-link">Try again</Link></p>
          : services.length ? <ul className="alt-practice">
            {services.map((service) => <li key={service.id} className="alt-practice__row">
              <Link className="alt-practice__link" href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`}>
                <span className="alt-practice__name">{service.name}</span>
                <RowDifference service={service} terms={terms} />
                <ChevronRight className="alt-practice__chev size-6" strokeWidth={1.25} aria-hidden="true" />
              </Link>
            </li>)}
          </ul>
          : <p role="status" className="sf-muted">No practice areas are published.</p>}
        <ul className="alt-contact">
          {settings.officeAddress.length ? <li>{settings.officeAddress.join(', ')}</li> : null}
          {settings.officePhone ? <li><a href={`tel:${settings.officePhone.replace(/[^\d+]/g, '')}`} className="sf-num">{settings.officePhone}</a></li> : null}
          {settings.supportEmail ? <li><a href={`mailto:${settings.supportEmail}`}><EmailText value={settings.supportEmail} /></a></li> : null}
        </ul>
      </section>
      <span className="alt-lower__divider" aria-hidden="true" />
      {team.length ? <section aria-labelledby="home-attorneys">
        <div className="alt-head">
          <h2 id="home-attorneys" className="sf-h2">Who you will work with</h2>
          <p className="alt-head__note">You meet the attorney who will handle your matter, not an intake desk.</p>
        </div>
        <ul className="alt-attorneys">
          {team.slice(0, 4).map((person) => <li key={person.slug}><Link className="alt-attorney" href={`/attorneys/${encodeURIComponent(person.slug)}`}>
            <AttorneyPortrait name={person.name} photoUrl={person.photoUrl} size="fill" className="alt-attorney__photo" />
            <span className="alt-attorney__name">{person.name}</span>
            {person.title ? <span className="alt-attorney__role">{person.title}</span> : null}
            {person.focus ? <span className="alt-attorney__focus">{person.focus}</span> : null}
            {firstAdmission(person.admissions) ? <span className="alt-attorney__admitted">Admitted {firstAdmission(person.admissions)}</span> : null}
          </Link></li>)}
        </ul>
      </section> : <section aria-labelledby="home-about"><div className="alt-head"><h2 id="home-about" className="sf-h2">{name}</h2></div>{settings.publication.aboutStatement ? <div className="sf-prose"><p>{settings.publication.aboutStatement.split(/\n{2,}/)[0]}</p></div> : null}</section>}
    </div>
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
      <h1 className="sf-title">Practice areas</h1>{services.length && termsSentence(commonTerms(services), services) ? <p className="sf-lede">{termsSentence(commonTerms(services), services)}</p> : null}
    </header>
    {services.length ? <PracticeIndex services={services} bookingEnabled={settings.bookingEnabled} /> : <div className="sf-empty"><p role="status" className="sf-h3">{cursor ? 'No more practice areas.' : 'No practice areas to show right now.'}</p>{cursor ? null : <><p className="sf-muted text-sm">To ask about a legal matter, contact the firm directly.</p><Link className="sf-link" href="/contact">Contact the firm</Link></>}</div>}
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
  const published = settings.publication.mode !== 'closed'
  const [openTimes, attorneys] = await Promise.all([
    settings.bookingEnabled ? getConsultationOpenTimes(service.id) : Promise.resolve(null),
    getPublishedAttorneys(published),
  ])
  const times = openTimes?.status === 'ok' ? openTimes.data : null
  const slots = times?.services.find((row) => row.serviceId === service.id)?.slots ?? []
  const days = times ? slotsByDay(slots, times.timezone).slice(0, 2).map(({ day, slots: list }) => ({ day, slots: spreadTimes(list, times.timezone, 3) })) : []
  const people = (attorneys ?? []).filter((person) => person.practiceAreas.some((area) => area.slug === service.publicSlug))
  const book = `/consultation?service=${encodeURIComponent(service.id)}`
  const [lede, ...rest] = service.description ? service.description.split(/\n{2,}/) : []
  const masthead = <div className="alt-masthead">
    <ul>
      {settings.officeAddress.length ? <li>{settings.officeAddress.join(', ')}</li> : null}
      {settings.officePhone ? <li><a href={`tel:${settings.officePhone.replace(/[^\d+]/g, '')}`}>{settings.officePhone}</a></li> : null}
      {settings.supportEmail ? <li><a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></li> : null}
    </ul>
  </div>
  return <PublicPage masthead={masthead} dock={settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link className="sf-pill sf-pill--lg" href={book}>Request a consultation</Link></div> : undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element -- first-paint band, never lazy */}
    <img className="alt-band" src="/storefront-coast.jpg" alt="" width={2400} height={800} fetchPriority="high" decoding="sync" />
    <div className="alt-detail">
      <article className="alt-detail__main">
        <nav aria-label="Breadcrumb"><ol className="alt-crumbs"><li><Link href="/practice-areas">Practice areas</Link></li><li aria-current="page">{service.name}</li></ol></nav>
        <h1 className="alt-detail__title">{service.name}</h1>
        {lede ? <p className="alt-detail__lede">{lede}</p> : null}
        {rest.length ? <div className="sf-prose">{rest.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : null}
        {people.length ? <section className="alt-who" aria-labelledby="who-handles">
          <h2 id="who-handles" className="alt-who__head">{people.length === 1 ? 'Your attorney' : 'Your attorneys'}</h2>
          <ul className="alt-who__list">
            {people.map((person) => <li key={person.slug}><Link className="alt-who__person" href={`/attorneys/${encodeURIComponent(person.slug)}`}>
              <AttorneyPortrait name={person.name} photoUrl={person.photoUrl} size="fill" className="alt-who__photo" />
              <span className="grid content-start">
                <span className="alt-who__name">{person.name}</span>
                {person.title ? <span className="alt-who__role">{person.title}</span> : null}
                {person.focus ? <span className="alt-who__focus">{person.focus}</span> : null}
                {firstAdmission(person.admissions) ? <span className="alt-who__admitted">Admitted {firstAdmission(person.admissions)}</span> : null}
              </span>
            </Link></li>)}
          </ul>
        </section> : null}
      </article>
      <span className="alt-detail__divider" aria-hidden="true" />
      <aside className="alt-bookcard" data-dock-anchor aria-labelledby="book-card">
        <h2 id="book-card" className="alt-bookcard__name">Book a first meeting</h2>
        <ul className="alt-bookcard__facts sf-num"><li><strong>{service.consultationMinutes} minutes</strong></li><li><strong>{service.consultationFeeMinor <= 0 ? 'No fee' : feeLabel(service)}</strong>{service.consultationFeeMinor > 0 ? ', paid by card when you book' : ''}</li></ul>
        {!settings.bookingEnabled ? <p className="sf-notice sf-notice--plain">Online booking is closed. <Link className="sf-link" href="/contact">Contact the firm</Link></p>
          : <form action="/consultation" method="get" className="grid gap-4">
            <input type="hidden" name="service" value={service.id} />
            {days.length && times ? <fieldset className="alt-slots">
              <legend>Open this week</legend>
              {days.map(({ day, slots: list }, dayIndex) => {
                const [weekday, ...date] = day.split(' ')
                return <div key={day} className="alt-slots__day">
                  <span className="alt-slots__daylabel"><b>{weekday}</b>{date.join(' ')}</span>
                  <div className="alt-slots__times">
                    {list.map((slot, index) => <label key={slot.startsAt} className="sf-seg"><input type="radio" name="at" value={slot.startsAt} defaultChecked={dayIndex === 0 && index === 0} aria-label={slotLabel(slot.startsAt, times.timezone)} /><span className="sf-pill sf-num">{slotTimeLabel(slot.startsAt, times.timezone)}</span></label>)}
                  </div>
                </div>
              })}
              <p className="alt-bookcard__zone">Times in {timezoneLabel(times.timezone)}. <Link className="sf-link" href={book}>More times</Link></p>
            </fieldset> : <p role="status" className="sf-notice sf-notice--plain">{times ? 'No open times this week.' : 'Open times could not be loaded.'} <Link className="sf-link" href={book}>See all times</Link></p>}
            <p className="alt-bookcard__check">Before we confirm, we check that we don’t already represent anyone on the other side. That usually takes a business day.</p>
            <button className="sf-pill sf-pill--solid">{days.length ? 'Request this time' : 'Request a consultation'}</button>
          </form>}
        <p className="alt-bookcard__fine">Booking doesn’t make us your lawyers yet, and this form is not watched around the clock. If a court deadline is days away, call {settings.officePhone ?? 'the office'}.</p>
      </aside>
    </div>
  </PublicPage>
}

export async function bookingMetadata() { return firmMetadata('Request an appointment') }
export async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string; at?: string }> }) {
  const settings = await getStorefrontSettings()
  const query = await searchParams
  const selected = query.service
  const at = typeof query.at === 'string' ? query.at.slice(0, 40) : ''
  const lookup = selected ? await getConsultationServiceById(selected) : null
  if (lookup?.status === 'unavailable') return <ServiceUnavailable title="Choose an appointment" retryHref={`/consultation?service=${encodeURIComponent(selected ?? '')}`} />
  const service = lookup?.status === 'ok' ? lookup.data : null
  const notice = settings.publication.firstContactNotice
  // While booking is open, a named service that does not exist (or is not public) is a missing record.
  if (selected && !service && settings.bookingEnabled && notice) notFound()
  if (!service || !settings.bookingEnabled || !notice) {
    const open = Boolean(settings.bookingEnabled && notice)
    // Without a chosen service, the published practice areas are offered directly.
    const catalog = open ? await getConsultationCatalog() : null
    const choices = catalog?.status === 'ok' ? catalog.data.services : []
    return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6">
      <h1 className="sf-title">{open ? 'Choose an appointment' : 'Online booking is not available'}</h1>
      <p role="status" className="sf-notice sf-notice--plain">{open ? 'Choose a practice area to see open times.' : 'This firm is not taking consultation requests online. Contact the firm directly.'}</p>
      {choices.length ? <div className="sf-track sf-slots__track">{choices.map((choice) => <Link key={choice.id} className="sf-pill sf-pill--raised" href={`/consultation?service=${encodeURIComponent(choice.id)}`}>{choice.name}</Link>)}</div> : null}
      <div className="sf-track">{open && !choices.length ? <Link className="sf-pill sf-pill--raised" href="/practice-areas">Practice areas</Link> : null}<Link className={open ? 'sf-pill' : 'sf-pill sf-pill--raised'} href="/contact">Contact the firm</Link></div>
    </div></div></PublicPage>
  }
  const history = await getCustomerConsultations()
  if (history.status === 'signed_out') redirect(`/account/signin?service=${encodeURIComponent(service.id)}${at ? `&at=${encodeURIComponent(at)}` : ''}`)
  if (history.status === 'unavailable') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const availability = await getConsultationAvailability(service.id)
  if (availability.status !== 'ok') return <ServiceUnavailable title={service.name} retryHref={`/consultation?service=${encodeURIComponent(service.id)}`} />
  const slots = availability.data.slots
  const acknowledgmentVersion = firstContactVersion(settings.publication.firstContactNoticeVersion)
  return <PublicPage><div className="sf-shell sf-page">
    <nav aria-label="Breadcrumb"><ol className="alt-crumbs"><li><Link href="/practice-areas">Practice areas</Link></li><li><Link href={`/practice-areas/${encodeURIComponent(service.publicSlug)}`}>{service.name}</Link></li></ol></nav>
    <div className="sf-split sf-split--wide-aside">
      <div className="grid gap-8">
        <header className="grid gap-3">
          <h1 className="sf-title">Request a consultation</h1>
          <p className="sf-lede">{service.name}</p>
        </header>
        <ConsultationBookingForm service={service} slots={slots} requestKey={randomUUID()} timezone={availability.data.timezone} notice={notice} acknowledgmentVersion={acknowledgmentVersion} initialStartsAt={at} />
      </div>
      <aside className="sf-split__aside order-first lg:order-none">
        <div className="sf-card"><div className="sf-card__body grid gap-4">
          <p className="sf-h3">{service.name}</p>
          <dl className="sf-facts">
            <div><dt>Length</dt><dd className="sf-num">{service.consultationMinutes} minutes</dd></div>
            <div><dt>Fee</dt><dd className="sf-num">{feeLabel(service)}</dd></div>
            {service.consultationFeeMinor > 0 ? <div><dt>Payment</dt><dd>Card, on the next step</dd></div> : null}
            <div><dt>Time zone</dt><dd>{timezoneLabel(availability.data.timezone)}</dd></div>
          </dl>
        </div></div>
      </aside>
    </div>
  </div></PublicPage>
}

export async function appointmentMetadata() { return firmMetadata('Appointment') }
export async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ session_id?: string; paid?: string }> }) {
  const id = (await params).id
  const returned = await searchParams
  if (returned?.session_id || returned?.paid) await reconcileConsultationFee(id)
  const result = await getCustomerConsultation(id)
  if (result.status === 'signed_out') redirect(`/account/signin?from=${encodeURIComponent(`/account/appointments/${encodeURIComponent(id)}`)}`)
  if (result.status === 'unavailable') return <ServiceUnavailable title="Appointment" retryHref={`/account/appointments/${encodeURIComponent(id)}`} />
  const row = result.data
  if (!row) notFound()
  const status = appointmentStatus(row.status)
  return <PublicPage><div className="sf-shell sf-page">
    <nav aria-label="Breadcrumb"><ol className="alt-crumbs"><li><Link href="/account">Your appointments</Link></li></ol></nav>
    <div className="sf-narrow grid gap-8">
      <header className="grid gap-4">
        <p className="sf-status"><span className={`sf-dot ${status.tone}`} aria-hidden="true" />{status.label}</p>
        <h1 className="sf-title">{row.serviceTitle}</h1>
        <p className="sf-lede sf-num">{formatAppointmentTime(row.startsAt, row.timezone)}</p>
      </header>
      <dl className="sf-facts">
        <div><dt>Status</dt><dd className="flex items-center gap-2"><span className={`sf-dot ${status.tone}`} aria-hidden="true" />{status.label}</dd></div>
        <div><dt>Time</dt><dd className="sf-num">{formatAppointmentTime(row.startsAt, row.timezone)}</dd></div>
        <div><dt>Consultation fee</dt><dd className="sf-num">{row.feeMinor > 0 ? formatMoney(row.feeMinor, row.currencyCode) : 'No fee'}</dd></div>
        <div><dt>Payment</dt><dd>{appointmentPaymentState(row)}</dd></div>
      </dl>
      <p role="status" className="sf-notice">{appointmentNotice(row)}</p>
      {row.paymentState === 'due' ? <PayConsultationForm consultationId={row.id} amountLabel={formatMoney(row.feeMinor, row.currencyCode)} /> : null}
      {['requested', 'scheduled'].includes(row.status) && notStarted(row.startsAt) ? <CancelConsultationForm consultationId={row.id} /> : null}
      <div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/account">Your appointments</Link><Link className="sf-pill" href="/contact">Contact the firm</Link></div>
    </div>
  </div></PublicPage>
}

/** Old payment URLs: there is no online payment step, so they open the appointment itself. */
export async function legacyPaymentRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/account/appointments/${encodeURIComponent((await params).id)}`)
}
