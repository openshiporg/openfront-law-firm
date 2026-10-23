'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { redeemPortalSignIn, requestPortalSignIn } from './actions'

const buttonClass = 'sf-pill sf-pill--accent sf-pill--lg w-full'

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return <div className="sf-track sf-track--block"><button type="submit" disabled={pending} className={buttonClass}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}{pending ? busy : idle}</button></div>
}

export function PortalSignInRequestForm() {
  const [state, formAction] = useActionState(requestPortalSignIn, { sent: false, error: null })
  if (state.sent) return <p role="status" className="sf-notice">If a client portal account uses that address, a one-time sign-in link is on its way. It expires in 15 minutes.</p>
  return (
    <form action={formAction} className="sf-form">
      <div>
        <label htmlFor="portal-email" className="sf-field-label">Email address</label>
        <input id="portal-email" name="email" type="email" autoComplete="email" required maxLength={320} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'portal-signin-error' : undefined} className="sf-field mt-1.5" />
      </div>
      {state.error ? <p id="portal-signin-error" role="alert" aria-live="polite" className="sf-error">{state.error}</p> : null}
      <SubmitButton idle="Email me a sign-in link" busy="Sending…" />
    </form>
  )
}

export function PortalSignInConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(redeemPortalSignIn, { sent: false, error: null })
  return (
    <form action={formAction} className="sf-form">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p role="alert" aria-live="polite" className="sf-error">{state.error}</p> : null}
      <SubmitButton idle="Continue to client portal" busy="Opening portal…" />
    </form>
  )
}
