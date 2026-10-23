'use client'

import { useActionState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { practiceAreas } from './content'
import { requestConsultation, type ConsultationRequestState } from './actions/requestConsultation'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="sf-pill sf-pill--primary sf-pill--lg w-full">{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}{pending ? 'Submitting…' : 'Request consultation'}</button>
}

const inputClass = 'sf-field'

export function ConsultationRequestForm({ requestKey, initialPractice = '' }: { requestKey: string; initialPractice?: string }) {
  const [state, formAction] = useActionState<ConsultationRequestState, FormData>(requestConsultation, { error: null, values: { practiceArea: initialPractice }, revision: 0 })
  const value = (name: string) => state.values[name] ?? ''
  return (
    <form key={state.revision} action={formAction} aria-describedby="intake-notice consultation-error" className="sf-form">
      <input type="hidden" name="idempotencyKey" value={requestKey} />
      <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sf-field-label">First name<input name="firstName" autoComplete="given-name" defaultValue={value('firstName')} maxLength={120} required className={inputClass} /></label>
        <label className="sf-field-label">Last name<input name="lastName" autoComplete="family-name" defaultValue={value('lastName')} maxLength={120} required className={inputClass} /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sf-field-label">Email<input name="email" type="email" autoComplete="email" defaultValue={value('email')} maxLength={320} required className={inputClass} /></label>
        <label className="sf-field-label">Phone <span className="sf-field-opt">(optional)</span><input name="phone" type="tel" autoComplete="tel" defaultValue={value('phone')} maxLength={80} className={inputClass} /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sf-field-label">Practice area<FormSelect name="practiceArea" defaultValue={value('practiceArea')} required className={inputClass}><option value="" disabled>Select an area</option>{practiceAreas.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</FormSelect></label>
        <label className="sf-field-label">State or jurisdiction<input name="jurisdiction" defaultValue={value('jurisdiction')} maxLength={120} required className={inputClass} /></label>
      </div>
      <label className="sf-field-label">Names of opposing or related parties<textarea name="opposingParties" defaultValue={value('opposingParties')} maxLength={500} required rows={3} className={`${inputClass} py-3`} /><span className="sf-field-hint">Enter “None known” when appropriate. Names support an initial conflict review.</span></label>
      <label className="sf-field-label">Known deadline <span className="sf-field-opt">(optional)</span><input name="keyDeadline" defaultValue={value('keyDeadline')} maxLength={120} className={inputClass} /><span className="sf-field-hint">Submitting this form does not extend or protect a deadline.</span></label>
      <label className="sf-field-label">Brief description<textarea name="summary" defaultValue={value('summary')} maxLength={800} required rows={5} className={`${inputClass} py-3`} /><span className="sf-field-hint">Share only what is reasonably necessary to assess fit. Do not send documents, account numbers, medical records, or unnecessary confidential details.</span></label>
      <label className="sf-field-label">How did you hear about us? <span className="sf-field-opt">(optional)</span><input name="referralSource" defaultValue={value('referralSource')} maxLength={120} className={inputClass} /></label>
      <label className="sf-check"><input type="checkbox" name="acknowledgment" value="yes" required /><span>I understand that submitting this request does not create an attorney-client relationship, the firm has not agreed to represent me, and I should not rely on this form for emergencies or deadlines.</span></label>
      {state.error ? <p id="consultation-error" role="alert" aria-live="polite" className="sf-error">{state.error}</p> : <span id="consultation-error" />}
      <SubmitButton />
      <p className="sf-fine">By submitting, you consent to the firm using this information to evaluate and respond to your request. Review the <a href="/privacy" className="underline">privacy notice</a>.</p>
    </form>
  )
}