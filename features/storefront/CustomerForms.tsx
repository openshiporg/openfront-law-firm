'use client'

import Link from 'next/link'
import { useActionState, useId } from 'react'
import { customerAuthenticate, bookConsultation } from './actions/customer-account'
import { FIRST_CONTACT_ACKNOWLEDGMENT } from './lib/first-contact'
import { type AvailabilitySlot, type Service } from './lib/consultation-presentation'

export function CustomerAuthForm({ mode, service, from = '' }: { mode: 'signin' | 'signup'; service: string; from?: string }) {
  const [state, action, pending] = useActionState(customerAuthenticate, { error: null })
  return <form action={action} className="sf-form">
    <input type="hidden" name="mode" value={mode} /><input type="hidden" name="service" value={service} /><input type="hidden" name="from" value={from} />
    {mode === 'signup' && <label className="sf-field-label">Name<input className="sf-field" name="name" required maxLength={120} autoComplete="name" /></label>}
    <label className="sf-field-label">Email<input className="sf-field" name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    <label className="sf-field-label">
      <span className="flex items-baseline justify-between gap-3">Password{mode === 'signin' ? <Link className="sf-link text-xs font-normal" href="/account/reset">Forgot password?</Link> : <span className="sf-field-opt text-xs">12+ characters</span>}</span>
      <input className="sf-field" name="password" type="password" required minLength={12} maxLength={1000} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
    </label>
    {state.error && <p role="alert" className="sf-error">{state.error}</p>}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--primary sf-pill--lg" disabled={pending}>{pending ? 'Saving…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></div>
  </form>
}

function zoned(timezone: string, options: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }) } catch { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }) }
}

/** Open times grouped by calendar day in the firm's time zone. */
function groupSlots(slots: AvailabilitySlot[], timezone: string) {
  const day = zoned(timezone, { weekday: 'long', month: 'short', day: 'numeric' })
  const time = zoned(timezone, { hour: 'numeric', minute: '2-digit' })
  const groups = new Map<string, Array<{ value: string; label: string }>>()
  for (const slot of slots) {
    const instant = new Date(slot.startsAt)
    if (!Number.isFinite(instant.getTime())) continue
    const key = day.format(instant)
    groups.set(key, [...(groups.get(key) ?? []), { value: slot.startsAt, label: time.format(instant) }])
  }
  return [...groups.entries()]
}

/**
 * One first-contact contract: the firm's notice is shown before any input, the
 * minimum conflict/fit fields follow, and the acknowledged notice version is
 * submitted for the booking command to verify and record.
 */
export function ConsultationBookingForm({ service, slots, requestKey, timezone, notice, acknowledgmentVersion }: { service: Service; slots: AvailabilitySlot[]; requestKey: string; timezone: string; notice: string; acknowledgmentVersion: string }) {
  const [state, action, pending] = useActionState(bookConsultation, { error: null, values: {}, revision: 0 })
  const noticeId = useId()
  const value = (name: string) => state.values[name] ?? ''
  const days = groupSlots(slots, timezone)
  return <form key={state.revision} action={action} aria-describedby={noticeId} className="sf-form gap-8">
    <section id={noticeId} aria-label="Before you share any details" className="sf-card">
      <div className="sf-card__body grid gap-3 text-sm leading-6">
        <p className="sf-label">Before you share any details</p>
        {notice.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <p><Link href="/privacy" className="sf-link">Privacy notice</Link></p>
      </div>
    </section>
    <input type="hidden" name="serviceId" value={service.id} /><input type="hidden" name="requestKey" value={requestKey} /><input type="hidden" name="acknowledgmentVersion" value={acknowledgmentVersion} />

    <fieldset className="grid gap-4">
      <legend className="sf-h3 mb-4">1. Time</legend>
      {days.length ? <div className="sf-slots">
        {days.map(([day, times]) => <div key={day} className="sf-slots__day">
          <p className="text-sm font-medium">{day}</p>
          <div className="sf-track sf-slots__track">
            {times.map(slot => <label key={slot.value} className="sf-seg"><input type="radio" name="startsAt" value={slot.value} required defaultChecked={value('startsAt') === slot.value} /><span className="sf-pill sf-num">{slot.label}</span></label>)}
          </div>
        </div>)}
        <p className="sf-fine">Times in {timezone}</p>
      </div> : <p role="status" className="sf-notice sf-notice--plain">No open times in the next two weeks.</p>}
    </fieldset>

    <fieldset className="grid gap-5">
      <legend className="sf-h3 mb-4">2. Conflict check</legend>
      <label className="sf-field-label">State or jurisdiction<input name="jurisdiction" className="sf-field" defaultValue={value('jurisdiction')} maxLength={120} required /></label>
      <label className="sf-field-label">Names of opposing or related parties<textarea name="opposingParties" className="sf-field" defaultValue={value('opposingParties')} maxLength={500} required /><span className="sf-field-hint">Enter “None known” if none.</span></label>
      <label className="sf-field-label">Known deadline <span className="sf-field-opt">(optional)</span><input name="keyDeadline" className="sf-field" defaultValue={value('keyDeadline')} maxLength={120} /><span className="sf-field-hint">A request does not extend or protect a deadline.</span></label>
    </fieldset>

    <fieldset className="grid gap-5">
      <legend className="sf-h3 mb-4">3. Your matter</legend>
      <label className="sf-field-label">Brief description <span className="sf-field-opt">(optional)</span><textarea name="summary" className="sf-field min-h-32" defaultValue={value('summary')} maxLength={800} /></label>
      <label className="sf-check"><input type="checkbox" name="acknowledgment" value="yes" required /><span>{FIRST_CONTACT_ACKNOWLEDGMENT}</span></label>
    </fieldset>

    {state.error && <p role="alert" className="sf-error">{state.error}</p>}
    {state.outcome === 'unknown' ? <div role="status" className="sf-card"><div className="sf-card__body grid gap-3 text-sm"><p className="flex items-center gap-2 font-semibold"><span className="sf-dot sf-dot--amber" aria-hidden="true" />Request outcome unknown</p><p className="break-all font-mono text-xs">Reference: {state.requestKey}</p><p className="sf-muted">Keep this reference when contacting the firm. A missing appointment does not prove the request had no effect.</p><div className="sf-track"><Link href="/account" className="sf-pill sf-pill--raised">Check your appointments</Link></div></div></div> : null}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--primary sf-pill--lg" disabled={pending || !slots.length || state.outcome === 'unknown'}>{pending ? 'Sending request…' : state.outcome === 'unknown' ? 'Request needs reconciliation' : 'Request appointment'}</button></div>
  </form>
}
