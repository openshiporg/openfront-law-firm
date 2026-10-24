'use client'

import { startTransition, useEffect, useRef, type FormEvent } from 'react'

function succeeded(state: unknown) {
  if (!state || typeof state !== 'object') return false
  const result = state as { ok?: unknown; success?: unknown }
  return result.ok === true || result.success === true
}

/**
 * Submits a useActionState form without React's automatic reset, so a refused save keeps
 * everything the user typed or toggled. The form resets only after a successful result.
 */
export function useKeptForm(dispatch: (formData: FormData) => void, state: unknown) {
  const submitted = useRef<HTMLFormElement | null>(null)
  useEffect(() => {
    const form = submitted.current
    if (!form) return
    submitted.current = null
    if (succeeded(state) && form.isConnected) form.reset()
  }, [state])
  return {
    onSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()
      const submitter = (event.nativeEvent as SubmitEvent).submitter
      const formData = new FormData(event.currentTarget, submitter)
      submitted.current = event.currentTarget
      startTransition(() => dispatch(formData))
    },
  }
}
