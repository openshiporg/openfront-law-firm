'use client'

import Link from 'next/link'

import { useActionState, useState, type ChangeEvent } from 'react'
import { Save } from 'lucide-react'

import { cn } from '@/lib/utils'
import { LogoPicker } from '@/features/platform/store-settings/LogoPicker'
import { safeStoreLogo } from '@/features/shared/store-logo'
import { ErrorBanner, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass, trackItemClass } from '@/features/platform/components/ui'

import {
  saveBranding,
  type BrandingSetup,
  type BrandingState,
} from '../actions/branding'
import { NEUTRAL_FIRM_NAME, STOREFRONT_ACCENT_PRESETS, accentContrastOnPaper, accentIdFromHex, normalizeAccentHex, resolveStorefrontAccent, storefrontThemeVariables } from '@/features/storefront/lib/accent'
import { useKeptForm } from '../../components/useKeptForm'

const optional = <span className="font-normal text-muted-foreground/80"> · optional</span>

export function BrandingSettingsClient({ setup, publication = 'unpublished' }: { setup: BrandingSetup; publication?: 'booking' | 'published' | 'unpublished' }) {
  const firm = setup.firm
  const initialValues = {
    name: firm?.name || '',
    displayName: firm?.displayName || '',
    shortName: firm?.shortName || '',
    tagline: firm?.brandTagline || '',
    accentId: accentIdFromHex(firm?.brandColor),
    logoIcon: safeStoreLogo(firm?.logoIcon),
    logoColor: firm?.logoColor || '0',
    supportEmail: firm?.supportEmail || '',
  }

  const [state, formAction] = useActionState<BrandingState, FormData>(saveBranding, {
    message: null,
    saved: false,
    values: initialValues,
  })
  const formActionForm = useKeptForm(formAction, state)

  const value = (key: keyof BrandingState['values']) => state.values[key] ?? ''
  const selectedAccent = state.values.accentId || accentIdFromHex(firm?.brandColor)
  // A valid persisted color outside the palette (e.g. from onboarding) stays selectable as-is.
  const currentHex = accentIdFromHex(firm?.brandColor) === 'current' ? normalizeAccentHex(firm?.brandColor) : null
  const accentOptions = [
    ...STOREFRONT_ACCENT_PRESETS.map((preset) => ({ id: preset.id, hex: preset.hex as string | null, label: preset.label })),
    ...(currentHex ? [{ id: 'current', hex: currentHex, label: `Current (${currentHex})` }] : []),
  ]

  // Live preview mirrors the uncontrolled fields; it never feeds the submission.
  const [preview, setPreview] = useState(() => ({
    name: value('name'),
    displayName: value('displayName'),
    tagline: value('tagline'),
    accentId: selectedAccent,
    icon: value('logoIcon'),
    hue: value('logoColor'),
  }))
  const onFormChange = (event: ChangeEvent<HTMLFormElement>) => {
    const target = event.target as unknown as HTMLInputElement
    if (target.name === 'name' || target.name === 'displayName' || target.name === 'tagline' || target.name === 'accentId') {
      const key = target.name
      setPreview((current) => ({ ...current, [key]: target.value }))
    }
  }

  if (setup.status === 'error') {
    return (
      <div className="max-w-2xl">
        <ErrorBanner title="Store settings unavailable">Saved settings are unchanged. Reload the page to try again.</ErrorBanner>
      </div>
    )
  }

  const previewAccentHex = accentOptions.find((option) => option.id === preview.accentId)?.hex ?? null
  const theme = storefrontThemeVariables({ accentHex: previewAccentHex ? resolveStorefrontAccent(previewAccentHex) : null, logoColor: preview.hue })
  const previewName = preview.displayName.trim() || preview.name.trim() || NEUTRAL_FIRM_NAME

  return (
    <form {...formActionForm} onChange={onFormChange} className="min-w-0">
      <input type="hidden" name="firmId" value={firm?.id || ''} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <aside aria-label="Storefront preview" className="min-w-0 lg:sticky lg:top-20 lg:order-last">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">Storefront preview</p>
              <Link href="/dashboard/platform/public-site" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><StatusDot tone={!firm ? 'zinc' : publication === 'unpublished' ? 'amber' : 'emerald'} />{!firm ? 'No firm' : publication === 'unpublished' ? 'Site not published' : publication === 'booking' ? 'Published · booking open' : 'Published'}</Link>
            </div>
            <div className="bg-[oklch(0.955_0.010_78)] px-5 py-6 text-[oklch(0.22_0.01_78)]">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="block size-10 shrink-0 [&>svg]:size-full" style={{ filter: `hue-rotate(${theme['--sf-logo-hue']}deg)` }} dangerouslySetInnerHTML={{ __html: safeStoreLogo(preview.icon) }} />
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-semibold leading-tight tracking-tight">{previewName}</p>
                  {preview.tagline.trim() ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 opacity-70">{preview.tagline}</p> : null}
                </div>
              </div>
              <div className="mt-6 h-px w-full" style={{ backgroundColor: theme['--sf-accent'] }} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {publication === 'booking' ? <span className="inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium text-white" style={{ backgroundColor: theme['--sf-accent'] }}>Request a consultation</span> : null}
                {publication === 'unpublished' ? <span className="text-xs opacity-70">Firm information is not yet published.</span> : <span className="text-xs font-medium underline underline-offset-4" style={{ color: theme['--sf-accent'] }}>Practice areas</span>}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {!firm ? <Notice>No active firm is configured.</Notice> : null}

          <Panel title="Firm identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                <span>Firm name</span>
                <input className={fieldClass} name="name" defaultValue={value('name')} required maxLength={120} />
              </label>
              <label className={labelClass}>
                <span>Display name{optional}</span>
                <input className={fieldClass} name="displayName" defaultValue={value('displayName')} maxLength={120} />
              </label>
              <label className={labelClass}>
                <span>Short name{optional}</span>
                <input className={fieldClass} name="shortName" defaultValue={value('shortName')} maxLength={40} />
              </label>
              <label className={labelClass}>
                <span>Support email{optional}</span>
                <input className={fieldClass} name="supportEmail" type="email" defaultValue={value('supportEmail')} maxLength={320} />
              </label>
              <label className={cn(labelClass, 'sm:col-span-2')}>
                <span>Tagline{optional}</span>
                <textarea className={cn(textareaClass, 'min-h-16')} name="tagline" defaultValue={value('tagline')} rows={2} maxLength={180} />
              </label>
            </div>
          </Panel>

          <Panel>
            <LogoPicker
              initialIcon={value('logoIcon')}
              initialColor={value('logoColor')}
              onChange={({ icon, hue }) => setPreview((current) => (current.icon === icon && current.hue === hue ? current : { ...current, icon, hue }))}
            />
          </Panel>

          <Panel title="Accent color" bodyClassName="space-y-3">
            <div role="radiogroup" aria-label="Accent color" className="min-w-0">
              <Track className="flex w-full sm:inline-flex sm:w-auto">
                {accentOptions.map((preset) => {
                  const active = preview.accentId === preset.id
                  return (
                    <label key={preset.id} className={cn(trackItemClass(active), 'cursor-pointer focus-within:ring-2 focus-within:ring-ring/50')}>
                      <input type="radio" name="accentId" value={preset.id} defaultChecked={selectedAccent === preset.id} className="sr-only" />
                      <span
                        aria-hidden="true"
                        className={cn('size-3 rounded-full ring-1 ring-black/10', !preset.hex && 'bg-[conic-gradient(from_0deg,#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)]')}
                        style={preset.hex ? { backgroundColor: preset.hex } : undefined}
                      />
                      {preset.label}
                    </label>
                  )
                })}
              </Track>
            </div>
            {currentHex && accentContrastOnPaper(currentHex) < 3 ? (
              <Notice>{currentHex} is too light for the storefront paper; the logo hue is used until another accent is chosen.</Notice>
            ) : null}
          </Panel>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 py-3 pl-4 pr-20 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:-mx-6 md:pl-6 md:pr-24">
        <div className="min-w-0 flex-1 text-sm">
          {state.message ? (
            <p role="alert" className="text-destructive">{state.message}</p>
          ) : null}
          {!state.message && state.saved ? (
            <p role="status" className="inline-flex items-center gap-2 text-foreground"><StatusDot tone="emerald" />Store settings saved.</p>
          ) : null}
        </div>
        <Track>
          <button type="submit" disabled={!firm} className={pillPrimaryClass}>
            <Save className="size-4" aria-hidden="true" /> Save store settings
          </button>
        </Track>
      </div>
    </form>
  )
}
