'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { HUE_PRESETS, LOGO_ICONS } from './lib/untitled-logo-registry'
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo'
import { normalizeStoreLogoColor, safeStoreLogo } from '@/features/shared/store-logo'
import { Track, fieldClass, labelClass, pillClass, pillPrimaryClass, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { cn } from '@/lib/utils'

/**
 * Logo library / custom SVG picker shared by Store Settings and onboarding. The
 * committed icon is always a sanitized SVG; custom edits stay in a draft until a
 * valid explicit Apply, so choosing "Custom SVG" never erases the current logo.
 * `onChange` reports the committed icon and hue for live previews.
 */
export function LogoPicker({ initialIcon, initialColor, onChange }: { initialIcon: string; initialColor: string; onChange?: (value: { icon: string; hue: string }) => void }) {
  const editorId = useId()
  const [icon, setIcon] = useState(() => safeStoreLogo(initialIcon))
  const [hue, setHue] = useState(normalizeStoreLogoColor(initialColor))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(icon)
  const selected = LOGO_ICONS.find(item => item.lightSvg === icon)
  const safeDraft = sanitizeStoreLogoSvg(draft)
  const startEditing = () => { setDraft(icon); setEditing(true) }
  const choose = (id: string) => {
    if (id === 'custom') return startEditing()
    const found = LOGO_ICONS.find(item => item.id === id)
    if (!found) return
    setIcon(found.lightSvg)
    setEditing(false)
  }
  const reported = useRef(onChange)
  useEffect(() => { reported.current = onChange })
  useEffect(() => { reported.current?.({ icon, hue }) }, [icon, hue])
  const hueFilter = { filter: `hue-rotate(${normalizeStoreLogoColor(hue)}deg)` }
  const activeId = editing || !selected ? 'custom' : selected.id

  return <fieldset className="min-w-0 space-y-4">
    <legend className="mb-3 text-sm font-semibold text-foreground">Store logo</legend>

    <div className="flex min-w-0 items-center gap-3">
      <span data-store-logo="preview" className="block size-12 shrink-0 rounded-lg border border-border bg-background p-1.5 [&>svg]:size-full" role="img" aria-label="Current logo preview" style={hueFilter} dangerouslySetInnerHTML={{ __html: icon }} />
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-foreground">{editing || !selected ? 'Custom SVG' : selected.name}</p>
        <p className="text-xs text-muted-foreground">Hue {normalizeStoreLogoColor(hue)}°</p>
      </div>
    </div>

    <div role="radiogroup" aria-label="Logo library" className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 overflow-y-auto rounded-xl bg-muted p-1.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]">
      {LOGO_ICONS.map(item => {
        const active = activeId === item.id
        return <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={item.name}
          title={item.name}
          onClick={() => choose(item.id)}
          className={cn(
            'flex aspect-square min-h-11 items-center justify-center rounded-lg bg-background p-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-zinc-900',
            active ? 'ring-2 ring-foreground ring-offset-2 ring-offset-muted' : 'ring-1 ring-black/5 hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/30',
          )}
        >
          <span aria-hidden="true" className="block size-full [&>svg]:size-full" style={hueFilter} dangerouslySetInnerHTML={{ __html: item.lightSvg }} />
        </button>
      })}
    </div>

    {!editing ? <Track>
      <button type="button" className={pillClass} aria-controls={editorId} aria-expanded={false} onClick={startEditing}>{selected ? 'Edit as custom SVG' : 'Edit custom SVG'}</button>
    </Track> : <div id={editorId} className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <label className={labelClass}>Custom SVG
        <textarea className={cn(textareaClass, 'min-h-32 font-mono text-xs')} value={draft} onChange={e => setDraft(e.target.value)} aria-invalid={!safeDraft} aria-describedby={`${editorId}-help`} maxLength={100000} spellCheck={false} />
      </label>
      <p id={`${editorId}-help`} className={`text-xs ${safeDraft ? 'text-muted-foreground' : 'text-destructive'}`} role={safeDraft ? undefined : 'alert'}>{safeDraft ? 'Scripts, links, styles, event handlers and external assets are rejected. Current logo kept until applied.' : 'Not a safe SVG document. Current logo unchanged.'}</p>
      <Track>
        <button type="button" className={pillPrimaryClass} disabled={!safeDraft || safeDraft === icon} onClick={() => { setIcon(safeDraft); setEditing(false) }}>Apply SVG</button>
        <button type="button" className={pillClass} onClick={() => { setDraft(icon); setEditing(false) }}>Cancel</button>
      </Track>
    </div>}

    <div className="grid min-w-0 gap-2">
      <span className="text-xs font-medium text-muted-foreground" id={`${editorId}-hue`}>Logo hue</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Track label="Logo hue presets" className="min-w-0">
          {HUE_PRESETS.map(preset => {
            const active = normalizeStoreLogoColor(hue) === String(preset.value)
            return <button key={preset.name} type="button" aria-pressed={active} className={trackItemClass(active)} onClick={() => setHue(String(preset.value))}>
              <span aria-hidden="true" className="size-3 rounded-full bg-[oklch(0.6_0.15_260)] ring-1 ring-black/10" style={{ filter: `hue-rotate(${preset.value}deg)` }} />
              {preset.name}
            </button>
          })}
        </Track>
        <input className={cn(fieldClass, 'w-24 tabular-nums')} aria-labelledby={`${editorId}-hue`} type="number" min="0" max="359" name="logoColor" value={hue} onChange={e => setHue(e.target.value)} />
      </div>
    </div>
    <input type="hidden" name="logoIcon" value={icon} />
  </fieldset>
}
