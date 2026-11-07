'use client'

import Link from 'next/link'
import { useActionState, useId, useState } from 'react'
import { customerAuthenticate, bookConsultation } from './actions/customer-account'
import { FIRST_CONTACT_ACKNOWLEDGMENT } from './lib/first-contact'
import { slotLabel, slotsByDay, slotTimeLabel, timezoneLabel, type AvailabilitySlot, type Service } from './lib/consultation-presentation'

export function CustomerAuthForm({ mode, service, from = '', at = '' }: { mode: 'signin' | 'signup'; service: string; from?: string; at?: string }) {
  const [state, action, pending] = useActionState(customerAuthenticate, { error: null })
  return <form action={action} className="sf-form">
    <input type="hidden" name="mode" value={mode} /><input type="hidden" name="service" value={service} /><input type="hidden" name="from" value={from} /><input type="hidden" name="at" value={at} />
    {mode === 'signup' && <label className="sf-field-label">Name<input className="sf-field" name="name" required maxLength={120} autoComplete="name" /></label>}
    <label className="sf-field-label">Email<input className="sf-field" name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    <label className="sf-field-label">
      <span className="flex items-baseline justify-between gap-3">Password{mode === 'signin' ? <Link className="sf-link text-xs font-normal" href="/account/reset">Forgot password?</Link> : <span className="sf-field-opt text-xs">12+ characters</span>}</span>
      <input className="sf-field" name="password" type="password" required minLength={12} maxLength={1000} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
    </label>
    {state.error && <p role="alert" className="sf-error">{state.error}</p>}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--solid sf-pill--lg" disabled={pending}>{pending ? 'Saving…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></div>
  </form>
}

/**
 * Open times as rows of days, each with its times, in the firm's time zone. A time
 * carried from the home booking bar starts selected when it is still open.
 */
function SlotPicker({ slots, timezone, initial }: { slots: AvailabilitySlot[]; timezone: string; initial: string }) {
  const [startsAt, setStartsAt] = useState(() => slots.some((slot) => slot.startsAt === initial) ? initial : '')
  const [showAll, setShowAll] = useState(false)
  const days = slotsByDay(slots, timezone)
  const chosenIndex = days.findIndex(({ slots: list }) => list.some((slot) => slot.startsAt === startsAt))
  const visible = showAll ? days : days.slice(0, Math.max(3, chosenIndex + 1))
  return <div className="sf-slots">
    <input type="hidden" name="startsAt" value={startsAt} />
    {visible.map(({ day, slots: list }) => {
      const [weekday, ...date] = day.split(' ')
      return <div key={day} role="radiogroup" aria-label={day} className="alt-slots__day">
        <span className="alt-slots__daylabel" aria-hidden="true">{weekday}<br />{date.join(' ')}</span>
        <div className="alt-slots__times">
          {list.map((slot) => <label key={slot.startsAt} className="sf-seg"><input type="radio" name="slotTime" value={slot.startsAt} checked={slot.startsAt === startsAt} onChange={() => setStartsAt(slot.startsAt)} /><span className="sf-pill sf-num">{slotTimeLabel(slot.startsAt, timezone)}</span></label>)}
        </div>
      </div>
    })}
    {days.length > visible.length ? <div className="sf-track"><button type="button" className="sf-pill" onClick={() => setShowAll(true)}>More days</button></div> : null}
    <p className="sf-fine">{startsAt ? `${slotLabel(startsAt, timezone)} · ` : 'Choose a time · '}Times in {timezoneLabel(timezone)}</p>
  </div>
}

/**
 * One first-contact contract: the firm's notice is shown before any input, the
 * minimum conflict/fit fields follow, and the acknowledged notice version is
 * submitted for the booking command to verify and record.
 */
export function ConsultationBookingForm({ service, slots, requestKey, timezone, notice, acknowledgmentVersion, initialStartsAt = '' }: { service: Service; slots: AvailabilitySlot[]; requestKey: string; timezone: string; notice: string; acknowledgmentVersion: string; initialStartsAt?: string }) {
  const [state, action, pending] = useActionState(bookConsultation, { error: null, values: {}, revision: 0 })
  const noticeId = useId()
  const value = (name: string) => state.values[name] ?? ''
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
      {slots.length ? <SlotPicker slots={slots} timezone={timezone} initial={value('startsAt') || initialStartsAt} /> : <p role="status" className="sf-notice sf-notice--plain">No open times in the next two weeks.</p>}
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
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--solid sf-pill--lg" disabled={pending || !slots.length || state.outcome === 'unknown'}>{pending ? 'Sending request…' : state.outcome === 'unknown' ? 'Request needs reconciliation' : service.consultationFeeMinor > 0 ? 'Continue to payment' : 'Request appointment'}</button></div>
  </form>
}
