'use client'
import { useActionState } from 'react'
import { completeOnboarding, type OnboardingState } from '../actions/onboarding'

// Family ordered-setup hook; Law's dependency phases commit atomically in its
// existing server-owned onboarding command, not client-side privileged CRUD.
export function useOnboardingApi(initial: OnboardingState) {
  return useActionState(completeOnboarding, initial)
}
