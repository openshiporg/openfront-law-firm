'use client'

import { useId, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { LOGO_ICONS } from './lib/untitled-logo-registry'
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo'
import { normalizeStoreLogoColor, safeStoreLogo } from '@/features/shared/store-logo'

/**
 * Logo library / custom SVG picker shared by Store Settings and onboarding. The
 * committed icon is always a sanitized SVG; custom edits stay in a draft until a
 * valid explicit Apply, so choosing "Custom SVG" never erases the current logo.
 */
export function LogoPicker({ initialIcon, initialColor }: { initialIcon: string; initialColor: string }) {
  const editorId = useId()
  const [icon, setIcon] = useState(() => safeStoreLogo(initialIcon))
  const [hue, setHue] = useState(normalizeStoreLogoColor(initialColor))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(icon)
  const selected = LOGO_ICONS.find(item => item.lightSvg === icon)
  const safeDraft = sanitizeStoreLogoSvg(draft)
  const startEditing = () => { setDraft(icon); setEditing(true) }
  return <fieldset className="space-y-4 rounded-lg border p-4">
    <legend className="px-1 text-sm font-medium">Store logo</legend>
    <label className="grid gap-2 text-sm">Logo library
      <FormSelect className="min-h-11 rounded-md border bg-background px-3" value={editing || !selected ? 'custom' : selected.id} onValueChange={id => {
        if (id === 'custom') return startEditing()
        const found = LOGO_ICONS.find(item => item.id === id)
        if (!found) return
        setIcon(found.lightSvg)
        setEditing(false)
      }}>
        {LOGO_ICONS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        <option value="custom">Custom SVG</option>
      </FormSelect>
    </label>
    {!editing ? <button type="button" className="min-h-11 text-sm font-medium underline-offset-4 hover:underline" aria-controls={editorId} aria-expanded={false} onClick={startEditing}>{selected ? 'Edit as custom SVG' : 'Edit custom SVG'}</button> : <div id={editorId} className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <label className="grid gap-2 text-sm">Custom SVG
        <textarea className="min-h-32 rounded-md border bg-background p-3 font-mono text-xs" value={draft} onChange={e => setDraft(e.target.value)} aria-invalid={!safeDraft} aria-describedby={`${editorId}-help`} maxLength={100000} spellCheck={false} />
      </label>
      <p id={`${editorId}-help`} className={`text-xs ${safeDraft ? 'text-muted-foreground' : 'text-destructive'}`} role={safeDraft ? undefined : 'alert'}>{safeDraft ? 'Scripts, links, styles, event handlers and external assets are rejected. The current logo stays until you apply.' : 'Enter a safe SVG document. The current logo is unchanged.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-md border px-3 text-sm font-medium disabled:opacity-50" disabled={!safeDraft || safeDraft === icon} onClick={() => { setIcon(safeDraft); setEditing(false) }}>Apply SVG</button>
        <button type="button" className="min-h-11 rounded-md px-3 text-sm" onClick={() => { setDraft(icon); setEditing(false) }}>Cancel</button>
      </div>
    </div>}
    <label className="grid gap-2 text-sm">Logo hue
      <input className="min-h-11 rounded-md border bg-background px-3" type="number" min="0" max="359" name="logoColor" value={hue} onChange={e => setHue(e.target.value)} />
    </label>
    <span data-store-logo="preview" className="block size-12 [&>svg]:size-full" role="img" aria-label="Current logo preview" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(hue)}deg)` }} dangerouslySetInnerHTML={{ __html: icon }} />
    <input type="hidden" name="logoIcon" value={icon} />
  </fieldset>
}
