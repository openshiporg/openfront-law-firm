'use client'
import { useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface Option { value: string; label: string; data?: unknown }
export interface PickerCommon {
  id?: string; options?: Option[]; placeholder?: string; isLoading?: boolean; isDisabled?: boolean; className?: string; isClearable?: boolean; autoFocus?: boolean; controlShouldRenderValue?: boolean
  onInputChange?: (value: string) => Promise<Option[]>
  'aria-label'?: string; 'aria-describedby'?: string
}
type Props = PickerCommon & ({ multiple: false; value?: Option | null; onChange?: (value: Option | null) => void } | { multiple: true; value?: Option[]; onChange?: (value: Option[]) => void })

/** Reuse the family Radix/Command keyboard primitives. Toggle, token removal and
 * clear are separate real controls: no nested button or parent-only hit patch. */
export function RelationshipPicker(props: Props) {
  const generatedId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ query: string; options: Option[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const selected = props.multiple ? props.value ?? [] : props.value ? [props.value] : []
  const disabled = props.isDisabled || !props.onChange
  const label = props['aria-label'] || 'Related records'
  const choices = query && props.onInputChange ? result?.query === query ? result.options : [] : (props.options ?? []).filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  async function search(value: string) {
    setQuery(value); setError('')
    const request = ++sequence.current
    if (!props.onInputChange || !value) { setResult(null); setSearching(false); return }
    setSearching(true)
    try { const options = await props.onInputChange(value); if (sequence.current === request) setResult({ query: value, options }) }
    catch { if (sequence.current === request) setError('Unable to load related records.') }
    finally { if (sequence.current === request) setSearching(false) }
  }
  function choose(option: Option) {
    if (props.multiple) props.onChange?.(selected.some(item => item.value === option.value) ? selected.filter(item => item.value !== option.value) : [...selected, option])
    else { props.onChange?.(option); setOpen(false) }
  }
  function remove(value: string) {
    if (props.multiple) props.onChange?.(selected.filter(item => item.value !== value))
    else props.onChange?.(null)
  }
  function clear() { if (props.multiple) props.onChange?.([]); else props.onChange?.(null) }
  return <div className={cn('min-w-0 space-y-2', props.className)}>
    {props.multiple && props.controlShouldRenderValue !== false && selected.length > 0 && <div className="flex min-w-0 flex-wrap gap-2">{selected.map(option => <span key={option.value} className="inline-flex min-h-11 max-w-full items-center rounded-md border bg-muted pl-2"><span className="min-w-0 break-words text-sm">{option.label}</span>{!disabled && <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Remove ${option.label}`} onClick={() => remove(option.value)}><X className="size-4" aria-hidden="true" /></Button>}</span>)}</div>}
    <div className="flex min-w-0 gap-2">
      <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { sequence.current++; setQuery(''); setResult(null); setError(''); setSearching(false) } }}>
        <PopoverTrigger asChild><Button id={props.id ?? generatedId} type="button" role="combobox" aria-expanded={open} aria-label={label} aria-describedby={props['aria-describedby']} autoFocus={props.autoFocus} disabled={disabled} variant="outline" className="min-h-11 min-w-0 flex-1 justify-between gap-2 px-3 font-normal"><span className="min-w-0 truncate">{props.multiple ? `${props.placeholder || 'Choose records'}${selected.length ? ` (${selected.length})` : ''}` : selected[0]?.label || props.placeholder || 'Select record'}</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0">
          <Command shouldFilter={false}><CommandInput value={query} onValueChange={search} aria-label={`Search ${label}`} placeholder="Search records" maxLength={1000} /><CommandList><CommandEmpty>{searching || props.isLoading ? 'Loading records…' : 'No records found.'}</CommandEmpty><CommandGroup>{choices.map(option => <CommandItem key={option.value} value={option.value} onSelect={() => choose(option)} className="min-h-11 min-w-11 gap-2 break-words"><Check className={cn('size-4 shrink-0', selected.some(item => item.value === option.value) ? 'opacity-100' : 'opacity-0')} aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span></CommandItem>)}</CommandGroup></CommandList></Command>
          {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
        </PopoverContent>
      </Popover>
      {!disabled && props.isClearable !== false && selected.length > 0 && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Clear ${label}`} onClick={clear}><X className="size-4" aria-hidden="true" /></Button>}
    </div>
  </div>
}
