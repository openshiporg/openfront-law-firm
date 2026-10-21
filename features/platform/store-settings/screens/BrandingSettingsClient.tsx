'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LogoPicker } from '@/features/platform/store-settings/LogoPicker'
import { safeStoreLogo } from '@/features/shared/store-logo'

import {
  saveBranding,
  type BrandingSetup,
  type BrandingState,
} from '../actions/branding'
import { STOREFRONT_ACCENT_PRESETS, accentContrastOnPaper, accentIdFromHex, normalizeAccentHex } from '@/features/storefront/lib/accent'

export function BrandingSettingsClient({ setup }: { setup: BrandingSetup }) {
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

  const value = (key: keyof BrandingState['values']) => state.values[key] ?? ''
  const selectedAccent = state.values.accentId || accentIdFromHex(firm?.brandColor)
  // A valid persisted color outside the palette (e.g. from onboarding) stays selectable as-is.
  const currentHex = accentIdFromHex(firm?.brandColor) === 'current' ? normalizeAccentHex(firm?.brandColor) : null
  const accentOptions = [
    ...STOREFRONT_ACCENT_PRESETS.map((preset) => ({ id: preset.id, hex: preset.hex as string | null, label: preset.label })),
    ...(currentHex ? [{ id: 'current', hex: currentHex, label: `Current (${currentHex})` }] : []),
  ]

  if (setup.status === 'error') {
    return (
      <div role="alert" className="max-w-2xl rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">
        Store settings could not be loaded. Saved settings are unchanged. Reload the page to try again.
      </div>
    )
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <input type="hidden" name="firmId" value={firm?.id || ''} />

      {!firm ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground"
        >
          No active firm is configured.
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Label className="space-y-1.5">
          <span className="text-sm font-medium">Firm name</span>
          <Input name="name" defaultValue={value('name')} required maxLength={120} />
        </Label>
        <Label className="space-y-1.5">
          <span className="text-sm font-medium">Display name <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Input name="displayName" defaultValue={value('displayName')} maxLength={120} />
        </Label>
        <Label className="space-y-1.5">
          <span className="text-sm font-medium">Short name <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Input name="shortName" defaultValue={value('shortName')} maxLength={40} />
        </Label>
        <Label className="space-y-1.5">
          <span className="text-sm font-medium">Support email <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Input name="supportEmail" type="email" defaultValue={value('supportEmail')} maxLength={320} />
        </Label>
      </div>

      <Label className="block space-y-1.5">
        <span className="text-sm font-medium">Tagline <span className="font-normal text-muted-foreground">(optional)</span></span>
        <Textarea name="tagline" defaultValue={value('tagline')} rows={2} maxLength={180} />
      </Label>

      <LogoPicker initialIcon={value('logoIcon')} initialColor={value('logoColor')} />

      <div>
        <p className="text-sm font-medium">Accent color</p>

        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
          {accentOptions.map((preset) => {
            const active = selectedAccent === preset.id
            return (
              <label key={preset.id} className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 text-sm focus-within:ring-2 focus-within:ring-ring has-checked:border-border has-checked:bg-background has-checked:font-medium has-checked:shadow-sm',
              )}>
                <input type="radio" name="accentId" value={preset.id} defaultChecked={active} className="size-11 shrink-0 accent-foreground" />
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.hex || 'transparent' }}
                />
                {preset.label}
              </label>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {currentHex && accentContrastOnPaper(currentHex) < 3
            ? `${currentHex} is too light to read on the storefront paper, so the storefront uses the logo hue until you choose another accent.`
            : 'Match logo hue derives the storefront accent and focus ring from the logo hue above.'}
        </p>
      </div>

      {state.message ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {!state.message && state.saved ? (
        <p role="status" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          Store settings saved.
        </p>
      ) : null}

      <Button type="submit" disabled={!firm}>
        <Save className="size-4" aria-hidden="true" /> Save store settings
      </Button>
    </form>
  )
}