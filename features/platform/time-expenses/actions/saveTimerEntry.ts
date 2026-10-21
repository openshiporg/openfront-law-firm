'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type TimerSaveState = { ok: boolean; message: string; savedStartedAt: string | null }

function instant(value: FormDataEntryValue | null) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date
}

// Saves a captured timer as a draft time entry through the normal access-controlled
// create, so billing permission, matter scope and time-entry hooks all apply. The timer's
// start instant identifies the capture: a retried save finds the existing draft instead of
// recording the same time twice. Approval and billing stay separate later steps.
export async function saveTimerEntry(_previous: TimerSaveState, formData: FormData): Promise<TimerSaveState> {
  const matterId = String(formData.get('matterId') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const startedAt = instant(formData.get('startedAt'))
  const endedAt = instant(formData.get('endedAt'))
  const elapsedMs = Number(formData.get('elapsedMs'))
  const isBillable = formData.get('isBillable') === 'on'
  if (!matterId || matterId.length > 200) return { ok: false, message: 'Choose the matter this time belongs to.', savedStartedAt: null }
  if (description.length < 3 || description.length > 2000) return { ok: false, message: 'Describe the work in 3–2,000 characters.', savedStartedAt: null }
  if (!startedAt || !endedAt || endedAt < startedAt || !Number.isFinite(elapsedMs) || elapsedMs < 1_000 || elapsedMs > endedAt.getTime() - startedAt.getTime() + 1_000) {
    return { ok: false, message: 'The captured time is invalid. Reset the timer and capture again.', savedStartedAt: null }
  }
  const durationMinutes = Math.max(1, Math.ceil(elapsedMs / 60_000))

  const viewer = await keystoneClient<{ authenticatedItem: { id: string } | null }>('query TimerViewer { authenticatedItem { ... on User { id } } }')
  if (!viewer.success || !viewer.data.authenticatedItem?.id) return { ok: false, message: 'Sign in again to save time.', savedStartedAt: null }
  const userId = viewer.data.authenticatedItem.id

  const existing = await keystoneClient<{ timeEntries: Array<{ id: string }> }>(`
    query ExistingTimerEntry($matterId: ID!, $userId: ID!, $startedAt: DateTime!) {
      timeEntries(where: { matter: { id: { equals: $matterId } }, user: { id: { equals: $userId } }, startedAt: { equals: $startedAt } }, take: 1) { id }
    }
  `, { matterId, userId, startedAt: startedAt.toISOString() })
  if (!existing.success) return { ok: false, message: existing.error, savedStartedAt: null }
  if (existing.data.timeEntries.length) {
    return { ok: true, message: 'This captured time was already saved as a draft entry.', savedStartedAt: startedAt.toISOString() }
  }

  const response = await keystoneClient<{ createTimeEntry: { id: string; durationMinutes: number } | null }>(`
    mutation SaveTimerEntry($data: TimeEntryCreateInput!) {
      createTimeEntry(data: $data) { id durationMinutes }
    }
  `, {
    data: {
      matter: { connect: { id: matterId } },
      user: { connect: { id: userId } },
      workDate: startedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      description,
      isBillable,
    },
  })
  if (!response.success || !response.data.createTimeEntry) {
    return { ok: false, message: response.success ? 'The time entry was not saved.' : response.error, savedStartedAt: null }
  }
  revalidatePath('/dashboard/platform/time-expenses')
  return { ok: true, message: `Saved ${response.data.createTimeEntry.durationMinutes} minutes as a draft time entry for review.`, savedStartedAt: startedAt.toISOString() }
}
