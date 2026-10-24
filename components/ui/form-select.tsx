'use client'
import { Children, isValidElement, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '@/lib/utils'

const NONE = '__none__'
type Option = ComponentProps<'option'> & Partial<Record<`data-${string}`, string>>
type Props = {
  children: ReactNode; id?: string; name?: string; value?: string | number; defaultValue?: string | number; required?: boolean; disabled?: boolean; className?: string
  onValueChange?: (value: string, option?: Option) => void
  'aria-label'?: string; 'aria-describedby'?: string
}
/** Family Radix select, including real painted/keyboard-operable 44px options.
 * A visually hidden native select owns FormData and required validation, so a blank
 * choice submits blank (Radix's own bubble select drops value="" options). */
export function FormSelect({ children, id, name, value, defaultValue, required, disabled, className, onValueChange, ...aria }: Props) {
  const generated = useId(), root = useRef<HTMLDivElement>(null)
  const options = Children.toArray(children).filter(isValidElement<Option>).filter(option => option.type === 'option').map(option => ({ value: String(option.props.value ?? option.props.children ?? ''), props: option.props }))
  const initial = String(defaultValue ?? options[0]?.value ?? '')
  const [internal, setInternal] = useState(initial)
  const selected = value === undefined ? internal : String(value)
  const empty = options.find(option => !option.value)
  const pickableEmpty = Boolean(empty && !required && !empty.props.disabled)
  function update(picked: string) { const next = picked === NONE ? '' : picked; if (value === undefined) setInternal(next); onValueChange?.(next, options.find(option => option.value === next)?.props) }
  useEffect(() => {
    const form = root.current?.closest('form')
    const reset = () => { if (value === undefined) setInternal(initial) }
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [initial, value])
  const triggerId = id ?? generated
  return <div ref={root} className="relative flex min-w-0 items-end gap-2">
    <select name={name} value={selected} onChange={event => update(event.target.value)} required={required} disabled={disabled} aria-hidden="true" tabIndex={-1} className="sr-only" onFocus={() => document.getElementById(triggerId)?.focus()}>
      {options.map(option => <option key={option.value || NONE} value={option.value} disabled={option.props.disabled}>{String(option.props.children ?? '')}</option>)}
    </select>
    <Select value={selected || (pickableEmpty ? NONE : '')} onValueChange={update} disabled={disabled}>
      <SelectTrigger id={triggerId} className={cn('min-h-11 min-w-0 flex-1', className)} {...aria}><SelectValue placeholder={empty?.props.children ?? 'Select option'} /></SelectTrigger>
      <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">{options.filter(option => option.value || pickableEmpty).map(option => option.value ? option : { ...option, value: NONE }).map(option => <SelectItem key={option.value} value={option.value} disabled={option.props.disabled} className="min-h-11 min-w-11"><span className="[overflow-wrap:anywhere]">{option.props.children}</span></SelectItem>)}</SelectContent>
    </Select>
    {pickableEmpty && selected && !disabled ? <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Clear ${aria['aria-label'] || name || 'selection'}`} onClick={() => update('')}><X className="size-4" aria-hidden="true" /></Button> : null}
  </div>
}
