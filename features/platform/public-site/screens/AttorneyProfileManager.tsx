'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ErrorBanner, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { saveAttorneyProfile, type AttorneyProfileRow, type AttorneyProfileSetup } from '../actions/attorneyProfiles'
import type { PublicSiteState } from '../actions/publicSite'
import { useKeptForm } from '../../components/useKeptForm'

const initial: PublicSiteState = { ok: false, message: '', revision: 0 }

function ProfileForm({ profile, areas, onDone }: { profile?: AttorneyProfileRow; areas: Array<{ id: string; name: string }>; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveAttorneyProfile, initial)
  const actionForm = useKeptForm(action, state)
  const router = useRouter()
  useEffect(() => { if (state.ok && state.revision) { router.refresh(); onDone() } }, [state, router, onDone])
  const selected = new Set(profile?.practiceAreas.map((area) => area.id) ?? [])
  return (
    <form {...actionForm} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={profile?.id ?? ''} />
      <label className={labelClass}>Name<input name="name" required maxLength={200} defaultValue={profile?.name ?? ''} className={fieldClass} /></label>
      <label className={labelClass}>Title<input name="title" maxLength={120} defaultValue={profile?.title ?? ''} placeholder="Partner" className={fieldClass} /></label>
      <label className={labelClass}>Focus<input name="focus" maxLength={200} defaultValue={profile?.focus ?? ''} className={fieldClass} /></label>
      <label className={labelClass}>Web address<span className="relative block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/attorneys/</span><input name="slug" maxLength={80} defaultValue={profile?.slug ?? ''} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={cn(fieldClass, 'pl-[5.5rem]')} /></span></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Biography<textarea name="biography" rows={4} maxLength={8000} defaultValue={profile?.biography ?? ''} className={textareaClass} /></label>
      <label className={labelClass}>Bar admissions (one per line)<textarea name="admissions" rows={3} maxLength={2000} defaultValue={profile?.admissions ?? ''} className={textareaClass} /></label>
      <div className="grid content-start gap-4">
        <label className={labelClass}>Public email<input name="email" type="email" maxLength={320} defaultValue={profile?.email ?? ''} className={fieldClass} /></label>
        <label className={labelClass}>Order<input name="sortOrder" type="number" step={1} defaultValue={profile?.sortOrder ?? 0} className={fieldClass} /></label>
      </div>
      {areas.length ? <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Practice areas</legend>
        <div className="flex flex-wrap gap-2">
          {areas.map((area) => <label key={area.id} className="relative"><input type="checkbox" name="practiceAreaIds" value={area.id} defaultChecked={selected.has(area.id)} className="peer sr-only" /><span className="inline-flex h-8 cursor-pointer items-center rounded-full bg-muted px-3 text-sm text-muted-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-black/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50">{area.name}</span></label>)}
        </div>
      </fieldset> : null}
      <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} className="size-4 accent-foreground" />Show on public site</label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : <span />}
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : profile ? 'Save profile' : 'Add profile'}</button></Track>
      </div>
    </form>
  )
}

export function AttorneyProfileManager({ setup, areas }: { setup: AttorneyProfileSetup; areas: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  if (setup.status !== 'loaded') return <ErrorBanner>Attorney profiles could not be loaded.</ErrorBanner>
  const profiles = setup.profiles
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Attorney profiles<span className="font-mono text-xs font-normal text-muted-foreground">{profiles.filter((profile) => profile.isPublic).length} public · {profiles.length}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><ProfileForm areas={areas} onDone={close} /></div> : null}
      {profiles.length ? <ul className="divide-y divide-border">
        {profiles.map((profile) => <li key={profile.id}>
          <button type="button" onClick={() => setOpen(open === profile.id ? null : profile.id)} aria-expanded={open === profile.id} className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
            <StatusDot tone={profile.isPublic ? 'emerald' : 'zinc'} />
            <span className="min-w-0 truncate text-sm font-semibold">{profile.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{profile.isPublic ? 'On site' : 'Hidden'}</span>
            {profile.title ? <span className="ml-auto truncate text-xs text-muted-foreground">{profile.title}</span> : null}
          </button>
          {open === profile.id ? <div className="border-t border-border bg-muted/20 p-4"><ProfileForm profile={profile} areas={areas} onDone={close} /></div> : null}
        </li>)}
      </ul> : <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No profiles yet</p>}
    </Panel>
  )
}
