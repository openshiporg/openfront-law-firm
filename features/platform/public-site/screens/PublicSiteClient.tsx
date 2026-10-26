'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ErrorBanner, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from '@/features/platform/components/ui'
import { minorUnitsToDecimal } from '@/features/platform/lib/money'
import { CONSULTATION_HOURS_LABEL } from '@/features/storefront/lib/consultation-presentation'
import { savePracticeArea, savePublicSitePolicy, type PublicPracticeAreaRow, type PublicSitePolicyRow, type PublicSiteState } from '../actions/publicSite'
import { useKeptForm } from '../../components/useKeptForm'

const initial: PublicSiteState = { ok: false, message: '', revision: 0 }

function useRefreshOnSuccess(state: PublicSiteState) {
  const router = useRouter()
  useEffect(() => { if (state.ok && state.revision) router.refresh() }, [state, router])
}

function Result({ state }: { state: PublicSiteState }) {
  if (!state.message) return <span />
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

function Switch({ name, label, defaultChecked, detail }: { name: string; label: string; defaultChecked: boolean; detail?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-[4px] border border-border bg-background px-3 py-2">
      <span className="min-w-0"><span className="block text-sm font-medium">{label}</span>{detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-6 w-10 shrink-0 rounded-[4px] bg-muted shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-[4px] after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-emerald-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50" />
    </label>
  )
}

export function PublicSitePolicyForm({ policy }: { policy: PublicSitePolicyRow | null }) {
  const [state, action, pending] = useActionState(savePublicSitePolicy, initial)
  const actionForm = useKeptForm(action, state)
  useRefreshOnSuccess(state)
  const published = policy?.status === 'published'
  const [status, setStatus] = useState<'draft' | 'published'>(policy?.status ?? 'draft')
  return (
    <form {...actionForm} className="min-w-0">
      <input type="hidden" name="policyId" value={policy?.id ?? ''} />
      <input type="hidden" name="status" value={status} />
      <Panel
        title={<h2 className="flex items-center gap-2 text-sm font-semibold"><StatusDot tone={published ? 'emerald' : 'amber'} />Site publication<span className="text-xs font-normal text-muted-foreground">{published ? 'Published' : policy ? 'Draft' : 'Not set up'}</span></h2>}
        actions={<Link href="/" target="_blank" className={cn(trackItemClass(false), 'h-7 text-xs')}>View site <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}
        bodyClassName="grid gap-5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch name="publicAccountsEnabled" label="Client accounts" detail="Sign up and view appointments" defaultChecked={Boolean(policy?.publicAccountsEnabled)} />
          <Switch name="publicBookingEnabled" label="Online consultation booking" detail={CONSULTATION_HOURS_LABEL} defaultChecked={Boolean(policy?.publicBookingEnabled)} />
        </div>
        <label className={labelClass}>About the firm<textarea name="aboutStatement" defaultValue={policy?.aboutStatement ?? ''} rows={4} maxLength={20000} className={textareaClass} /></label>
        <label className={labelClass}>
          <span className="flex justify-between gap-2">Privacy notice{policy?.privacyNoticeVersion ? <span className="font-mono">v{policy.privacyNoticeVersion}</span> : null}</span>
          <textarea name="privacyNotice" defaultValue={policy?.privacyNotice ?? ''} rows={6} maxLength={20000} className={textareaClass} />
        </label>
        <label className={labelClass}>
          <span className="flex justify-between gap-2">First-contact notice<span>{policy?.firstContactNoticeVersion ? <span className="font-mono">v{policy.firstContactNoticeVersion}</span> : 'Shown before a prospect enters details'}</span></span>
          <textarea name="firstContactNotice" defaultValue={policy?.firstContactNotice ?? ''} rows={5} maxLength={20000} className={textareaClass} />
        </label>
        <Notice>Required: privacy notice for accounts; first-contact notice for booking. Editing a notice creates a new version.</Notice>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Status</legend>
          <div className={trackClass}>
            {(['draft', 'published'] as const).map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={trackItemClass(status === value)}><StatusDot tone={value === 'published' ? 'emerald' : 'amber'} />{value === 'published' ? 'Published' : 'Draft'}</button>)}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Result state={state} />
          <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : status === 'published' ? 'Save and publish' : 'Save draft'}</button></Track>
        </div>
      </Panel>
    </form>
  )
}

function PracticeAreaForm({ area, currencyCode, onDone }: { area?: PublicPracticeAreaRow; currencyCode: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(savePracticeArea, initial)
  const actionForm = useKeptForm(action, state)
  useRefreshOnSuccess(state)
  useEffect(() => { if (state.ok && state.revision && onDone) onDone() }, [state, onDone])
  const fee = minorUnitsToDecimal(area?.consultationFeeMinor ?? 0, currencyCode)
  return (
    <form {...actionForm} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={area?.id ?? ''} />
      <input type="hidden" name="currencyCode" value={currencyCode} />
      <label className={labelClass}>Name<input name="name" required maxLength={200} defaultValue={area?.name ?? ''} className={fieldClass} /></label>
      <label className={labelClass}>Web address<span className="relative block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/practice-areas/</span><input name="publicSlug" maxLength={80} defaultValue={area?.publicSlug ?? ''} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={cn(fieldClass, 'pl-[7.5rem]')} /></span></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Description<textarea name="description" rows={3} maxLength={4000} defaultValue={area?.description ?? ''} className={textareaClass} /></label>
      <label className={labelClass}>Consultation length (minutes)<input name="consultationMinutes" type="number" min={15} max={120} step={15} required defaultValue={area?.consultationMinutes ?? 30} className={fieldClass} /></label>
      <label className={labelClass}>Consultation fee ({currencyCode})<input name="consultationFee" inputMode="decimal" defaultValue={fee} className={fieldClass} /></label>
      <div className="sm:col-span-2"><Switch name="isPublic" label="Show on public site" defaultChecked={area?.isPublic ?? true} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Result state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : area ? 'Save' : 'Add practice area'}</button></Track>
      </div>
    </form>
  )
}

export function PracticeAreaManager({ areas, currencyCode }: { areas: PublicPracticeAreaRow[]; currencyCode: string }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Practice areas<span className="font-mono text-xs font-normal text-muted-foreground">{areas.filter((area) => area.isPublic && area.status === 'active').length} public · {areas.length}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><PracticeAreaForm currencyCode={currencyCode} onDone={() => setOpen(null)} /></div> : null}
      {areas.length ? (
        <ul className="divide-y divide-border">
          {areas.map((area) => {
            const live = area.isPublic && area.status === 'active'
            return (
              <li key={area.id} className="min-w-0">
                <button type="button" onClick={() => setOpen(open === area.id ? null : area.id)} aria-expanded={open === area.id} className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
                  <StatusDot tone={live ? 'emerald' : 'zinc'} />
                  <span className="min-w-0 truncate text-sm font-semibold">{area.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{live ? 'On site' : area.status === 'archived' ? 'Archived' : 'Hidden'}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{area.consultationMinutes} min</span>
                </button>
                {open === area.id ? <div className="border-t border-border bg-muted/20 p-4"><PracticeAreaForm area={area} currencyCode={currencyCode} onDone={() => setOpen(null)} /></div> : null}
              </li>
            )
          })}
        </ul>
      ) : <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No practice areas yet</p>}
    </Panel>
  )
}

export function PublicSiteError({ message }: { message: string }) {
  return <ErrorBanner>{message}</ErrorBanner>
}
