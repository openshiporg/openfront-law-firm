'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { redeemPortalSignIn, requestPortalSignIn } from './actions'

const buttonClass = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--portal-accent,var(--foreground))] px-5 text-sm font-semibold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className={buttonClass}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}{pending ? busy : idle}</button>
}

export function PortalSignInRequestForm() {
  const [state, formAction] = useActionState(requestPortalSignIn, { sent: false, error: null })
  if (state.sent) return <p role="status" className="mt-8 text-sm leading-6">If a client portal account uses that address, a one-time sign-in link is on its way. It expires in 15 minutes.</p>
  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="portal-email" className="text-sm font-semibold text-foreground">Email address</label>
        <input id="portal-email" name="email" type="email" autoComplete="email" required maxLength={320} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'portal-signin-error' : undefined} className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {state.error ? <p id="portal-signin-error" role="alert" aria-live="polite" className="text-sm leading-6 text-destructive">{state.error}</p> : null}
      <SubmitButton idle="Email me a sign-in link" busy="Sending…" />
    </form>
  )
}

export function PortalSignInConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(redeemPortalSignIn, { sent: false, error: null })
  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p role="alert" aria-live="polite" className="text-sm leading-6 text-destructive">{state.error}</p> : null}
      <SubmitButton idle="Continue to client portal" busy="Opening portal…" />
    </form>
  )
}
