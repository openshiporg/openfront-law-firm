'use client'

import Link from 'next/link'
import { useActionState, useId } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { customerAuthenticate, bookConsultation } from './actions/customer-account'
import { FIRST_CONTACT_ACKNOWLEDGMENT } from './lib/first-contact'
import { formatAppointmentTime, type AvailabilitySlot, type Service } from './lib/consultation-presentation'

const control = 'min-h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
export function CustomerAuthForm({ mode, service }: { mode: 'signin' | 'signup'; service: string }) {
  const [state, action, pending] = useActionState(customerAuthenticate, { error: null })
  return <form action={action} className="grid max-w-md gap-5">
    <input type="hidden" name="mode" value={mode} /><input type="hidden" name="service" value={service} />
    {mode === 'signup' && <label className="grid gap-2 text-sm">Name<input className={control} name="name" required maxLength={120} autoComplete="name" /></label>}
    <label className="grid gap-2 text-sm">Email<input className={control} name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    <label className="grid gap-2 text-sm">Password<input className={control} name="password" type="password" required minLength={12} maxLength={1000} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <button className="sf-btn min-h-11" disabled={pending}>{pending ? 'Saving…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
    {mode === 'signin' ? <Link className="sf-link inline-flex min-h-11 items-center" href="/account/reset">Forgot password?</Link> : null}
  </form>
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
  return <form key={state.revision} action={action} aria-describedby={noticeId} className="grid max-w-lg gap-5">
    <section id={noticeId} aria-label="Before you share any details" className="rounded-md border p-4 text-sm leading-6">
      {notice.split(/\n{2,}/).map((paragraph, index) => <p key={index} className={index ? 'mt-3' : undefined}>{paragraph}</p>)}
      <p className="mt-3">Read the <Link href="/privacy" className="sf-link">privacy notice</Link> before you continue.</p>
    </section>
    <input type="hidden" name="serviceId" value={service.id} /><input type="hidden" name="requestKey" value={requestKey} /><input type="hidden" name="acknowledgmentVersion" value={acknowledgmentVersion} />
    {slots.length ? <label className="grid gap-2 text-sm">Appointment time<FormSelect name="startsAt" className={control} required defaultValue={value('startsAt')}><option value="" disabled>Select time</option>{slots.map(slot => <option key={slot.startsAt} value={slot.startsAt}>{formatAppointmentTime(slot.startsAt, timezone)}</option>)}</FormSelect></label> : <p role="status" className="text-sm">No times are open in the next two weeks. Check back later or contact the firm.</p>}
    <label className="grid gap-2 text-sm">State or jurisdiction<input name="jurisdiction" className={control} defaultValue={value('jurisdiction')} maxLength={120} required /></label>
    <label className="grid gap-2 text-sm">Names of opposing or related parties<textarea name="opposingParties" className={`${control} min-h-20 py-3`} defaultValue={value('opposingParties')} maxLength={500} required /><span className="text-xs text-muted-foreground">Enter “None known” when appropriate. Names support an initial conflict review.</span></label>
    <label className="grid gap-2 text-sm">Known deadline <span className="text-muted-foreground">(optional)</span><input name="keyDeadline" className={control} defaultValue={value('keyDeadline')} maxLength={120} /><span className="text-xs text-muted-foreground">Requesting an appointment does not extend or protect a deadline.</span></label>
    <label className="grid gap-2 text-sm">Brief description <span className="text-muted-foreground">(optional)</span><textarea name="summary" className={`${control} min-h-28 py-3`} defaultValue={value('summary')} maxLength={800} /></label>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" name="acknowledgment" value="yes" required className="size-11 shrink-0 accent-foreground" />{FIRST_CONTACT_ACKNOWLEDGMENT}</label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.outcome === 'unknown' ? <div className="space-y-2 rounded-md border p-3 text-sm"><p className="break-all">Original request reference: {state.requestKey}</p><Link href="/account" className="sf-link inline-flex min-h-11 items-center">Check your appointments</Link><p>Keep this reference when contacting the firm. A missing appointment is not proof that the request had no effect.</p></div> : null}
    <button className="sf-btn min-h-11" disabled={pending || !slots.length || state.outcome === 'unknown'}>{pending ? 'Sending request…' : state.outcome === 'unknown' ? 'Request needs reconciliation' : 'Request appointment'}</button>
  </form>
}
