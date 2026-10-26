'use client'

import { useActionState, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Pause, Play, RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fieldClass, labelClass, pillClass, pillPrimaryClass, trackClass, trackItemClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { saveTimerEntry, type TimerSaveState } from '@/features/platform/time-expenses/actions/saveTimerEntry'
import { useKeptForm } from '../components/useKeptForm'

// Only elapsed-capture metadata survives navigation. Legal descriptions and
// matter identities NEVER enter origin-wide storage; they stay mounted, under
// the server-verified current actor/firm key, and must be selected again on reload.
type TimerDraft = { version: 2; scope: string; captureId: string; revision: number; expiresAt: number; firstStartedAt: string | null; runningSince: number | null; accumulatedMs: number }
const PREFIX = 'openfront-law-firm:timer-v2:'
const CHANGE_EVENT = 'openfront-law-firm:timer-draft-change'
const memories = new Map<string, string>()
const initialSave: TimerSaveState = { ok: false, message: '', savedStartedAt: null }
function emptyDraft(scope: string): TimerDraft {
  return { version: 2, scope, captureId: '', revision: 0, expiresAt: 0, firstStartedAt: null, runningSince: null, accumulatedMs: 0 }
}
function parseDraft(snapshot: string, scope: string): TimerDraft {
  try {
    const value: unknown = JSON.parse(snapshot)
    if (!value || typeof value !== 'object') return emptyDraft(scope)
    const row = value as Partial<TimerDraft>
    if (row.version !== 2 || row.scope !== scope || typeof row.captureId !== 'string' || !/^[a-f0-9-]{36}$/i.test(row.captureId) || (typeof row.revision !== 'number' || !Number.isInteger(row.revision)) || typeof row.expiresAt !== 'number' || row.expiresAt <= Date.now() || typeof row.accumulatedMs !== 'number' || !Number.isFinite(row.accumulatedMs) || row.accumulatedMs < 0 || row.accumulatedMs > 86_400_000 || typeof row.firstStartedAt !== 'string' || !Number.isFinite(Date.parse(row.firstStartedAt)) || row.runningSince !== null && (typeof row.runningSince !== 'number' || !Number.isFinite(row.runningSince) || row.runningSince > Date.now())) return emptyDraft(scope)
    return { version: 2, scope, captureId: row.captureId, revision: row.revision, expiresAt: row.expiresAt, firstStartedAt: row.firstStartedAt, runningSince: row.runningSince, accumulatedMs: row.accumulatedMs }
  } catch { return emptyDraft(scope) }
}
function readSnapshot(key: string) {
  try { return window.localStorage.getItem(key) ?? '' } catch { return memories.get(key) ?? '' }
}
function writeDraft(key: string, draft: TimerDraft | null) {
  const value = draft ? JSON.stringify(draft) : ''
  memories.set(key, value)
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch { /* Metadata only in memory when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener('storage', onChange) }
}

export function LocalTimerClient({ scopeKey }: { scopeKey: string }) {
  const storageKey = `${PREFIX}${scopeKey}`
  const snapshot = useCallback(() => readSnapshot(storageKey), [storageKey])
  const draft = parseDraft(useSyncExternalStore(subscribe, snapshot, () => ''), scopeKey)
  const [matterId, setMatterId] = useState('')
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [announcement, setAnnouncement] = useState('')
  const [legacyPresent, setLegacyPresent] = useState(false)
  const [saveState, saveAction, saving] = useActionState(async (previous: TimerSaveState, formData: FormData) => {
    const submittedSnapshot = readSnapshot(storageKey)
    const result = await saveTimerEntry(previous, formData)
    // Compare CURRENT persisted capture/revision, not just the response's old
    // start time. Another tab/new capture cannot be erased by Save A completing.
    if (result.ok && result.savedStartedAt === formData.get('startedAt') && readSnapshot(storageKey) === submittedSnapshot) {
      writeDraft(storageKey, null)
      setMatterId(''); setDescription(''); setAnnouncement('Time saved as a draft entry.')
    }
    return result
  }, initialSave)
  const saveActionForm = useKeptForm(saveAction, saveState)

  useEffect(() => {
    try {
      // Presence only: never parse or restore unbound confidential content into
      // the current identity. Discard is explicit, with an honest loss notice.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is readable only after mount
      setLegacyPresent(window.localStorage.getItem('openfront-law-firm:timer-draft') !== null)
      const previous = window.localStorage.getItem(`${PREFIX}last-scope`)
      if (previous?.startsWith(PREFIX) && previous !== `${PREFIX}last-scope` && previous !== storageKey) { window.localStorage.removeItem(previous); memories.delete(previous) }
      window.localStorage.setItem(`${PREFIX}last-scope`, storageKey)
    } catch { /* No sensitive values are retained in the fallback either. */ }
  }, [storageKey])
  useEffect(() => {
    if (!draft.runningSince) return
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [draft.runningSince])
  function update(next: TimerDraft) {
    writeDraft(storageKey, { ...next, revision: draft.revision + 1, expiresAt: Date.now() + 86_400_000 })
  }
  const elapsed = draft.accumulatedMs + (draft.runningSince ? Math.max(0, now - draft.runningSince) : 0)
  const seconds = Math.floor(elapsed / 1_000)
  const duration = `${String(Math.floor(seconds / 3_600)).padStart(2, '0')}:${String(Math.floor((seconds % 3_600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const running = Boolean(draft.runningSince)
  function toggle() {
    const at = Date.now()
    if (running && draft.runningSince) {
      update({ ...draft, runningSince: null, accumulatedMs: draft.accumulatedMs + at - draft.runningSince })
      setAnnouncement(`Timer paused at ${duration}.`)
    } else {
      update({ ...draft, captureId: draft.captureId || crypto.randomUUID(), firstStartedAt: draft.firstStartedAt ?? new Date(at).toISOString(), runningSince: at })
      setAnnouncement('Timer running.')
    }
    setNow(at)
  }
  function reset() { writeDraft(storageKey, null); setAnnouncement('Timer reset.') }
  return <div className="space-y-4">
    {legacyPresent ? <div role="alert" className="space-y-3 rounded-[4px] border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><p>An older unsaved timer draft on this device has an unverified owner. It was not restored or saved.</p><div className={trackClass}><button type="button" className={pillClass} onClick={() => { try { window.localStorage.removeItem("openfront-law-firm:timer-draft"); setLegacyPresent(false); setAnnouncement("The older unverified draft was discarded. No time entry was saved."); } catch { setAnnouncement("The older draft could not be removed from this device."); } }}>Discard older draft</button></div></div> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] bg-muted/60 px-4 py-3 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)]">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn('size-2 rounded-[1px] ring-2 ring-background', running ? 'animate-pulse bg-emerald-500' : elapsed ? 'bg-amber-500' : 'bg-zinc-400')} />
        <output aria-label="Elapsed time" aria-live="off" className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{duration}</output>
      </div>
      <div className={trackClass}>
        <button type="button" onClick={toggle} disabled={saving} className={running ? trackItemClass(true) : pillPrimaryClass}>{running ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}{running ? 'Pause' : draft.accumulatedMs ? 'Resume' : 'Start'}</button>
        <button type="button" onClick={reset} disabled={saving || elapsed === 0} className={trackItemClass(false)}><RotateCcw className="size-4" aria-hidden="true" />Reset</button>
      </div>
    </div>
    <p role="status" className="sr-only">{announcement}</p>
    <p className="text-xs text-muted-foreground">Elapsed time is kept on this device for one day. Matter and description are not.</p>
    <form {...saveActionForm}>
      <fieldset disabled={saving} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <input type="hidden" name="captureId" value={draft.captureId} />
        <input type="hidden" name="startedAt" value={draft.firstStartedAt ?? ''} />
        <input type="hidden" name="endedAt" value={new Date(now).toISOString()} />
        <input type="hidden" name="elapsedMs" value={String(elapsed)} />
        <SearchableOptionSelect id="timer-matter" name="matterId" label="Matter" emptyLabel="Search for the matter" required kind="matter" options={[]} value={matterId} onValueChange={setMatterId} />
        <label htmlFor="timer-description" className={labelClass}>Work description<input id="timer-description" name="description" required minLength={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} className={fieldClass} /></label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="isBillable" checked={isBillable} onChange={event => setIsBillable(event.target.checked)} className="size-4 accent-foreground" />Billable</label>
          <div className="flex items-center gap-3">
            {running ? <span className="text-xs text-muted-foreground">Pause to save</span> : null}
            <div className={trackClass}><button type="submit" className={pillPrimaryClass} disabled={saving || running || elapsed < 1_000 || !draft.firstStartedAt}><Save className="size-4" aria-hidden="true" />{saving ? 'Saving…' : 'Save time'}</button></div>
          </div>
        </div>
        {saveState.message ? <p role={saveState.ok ? 'status' : 'alert'} className={cn('text-sm sm:col-span-2', saveState.ok ? 'text-foreground' : 'text-destructive')}>{saveState.message}</p> : null}
      </fieldset>
    </form>
  </div>
}
