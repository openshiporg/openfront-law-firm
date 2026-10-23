'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { acceptPortalInvite } from './actions'
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <div className="sf-track sf-track--block"><button
      type="submit"
      disabled={pending}
      className="sf-pill sf-pill--accent sf-pill--lg w-full"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      {pending ? 'Opening portal…' : 'Open client portal'}
    </button></div>
  )
}

export function PortalAcceptForm({ token = '' }: { token?: string }) {
  const [state, formAction] = useActionState(acceptPortalInvite, { error: null, inviteToken: token, revision: 0 })
  return (
    <form action={formAction} className="sf-form">
      <div>
        <label htmlFor="inviteToken" className="sf-field-label">Invitation token</label>
        <input
          key={`${state.revision}:${state.inviteToken}`}
          id="inviteToken"
          name="inviteToken"
          defaultValue={state.inviteToken}
          autoComplete="off"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "portal-invitation-error" : "portal-invitation-help"}
          required
          className="sf-field sf-field--mono mt-1.5"
        />
        <p id="portal-invitation-help" className="sf-field-hint mt-1.5 block">One-time token from your firm.</p>
      </div>
      {state.error ? <p id="portal-invitation-error" role="alert" aria-live="polite" className="sf-error">{state.error}</p> : null}
      <SubmitButton />
    </form>
  )
}
