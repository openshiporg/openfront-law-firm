'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { initialCommandState, type CommandState } from './commandState'
import { fieldClass, labelClass, pillDangerClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from './ui'

type CommandAction = (previous: CommandState, formData: FormData) => Promise<CommandState>

/** Runs a form command; on success refreshes the route once and calls onDone. */
export function useCommand(action: CommandAction, onDone?: () => void) {
  const [state, formAction, pending] = useActionState(action, initialCommandState)
  const router = useRouter()
  const handled = useRef(0)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (state.revision && state.revision !== handled.current) {
      handled.current = state.revision
      if (state.ok) {
        router.refresh()
        done.current?.()
      }
    }
  }, [state, router])
  return [state, formAction, pending] as const
}

export function FormMessage({ state, className }: { state: CommandState; className?: string }) {
  if (!state.message) return <span />
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm [overflow-wrap:anywhere]', state.ok ? 'text-foreground' : 'text-destructive', className)}>{state.message}</p>
}

export function FormFooter({ state, pending, label, pendingLabel = 'Saving…', danger = false, className }: { state: CommandState; pending: boolean; label: string; pendingLabel?: string; danger?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <FormMessage state={state} />
      <div className={trackClass}><button type="submit" disabled={pending} className={danger ? pillDangerClass : pillPrimaryClass}>{pending ? pendingLabel : label}</button></div>
    </div>
  )
}

export function TextField({ id, name, label, type = 'text', required = false, defaultValue, minLength, maxLength, placeholder, className }: { id: string; name: string; label: string; type?: string; required?: boolean; defaultValue?: string; minLength?: number; maxLength?: number; placeholder?: string; className?: string }) {
  return <label htmlFor={id} className={cn(labelClass, className)}>{label}<input id={id} name={name} type={type} required={required} defaultValue={defaultValue} minLength={minLength} maxLength={maxLength} placeholder={placeholder} className={fieldClass} /></label>
}

export function ReasonField({ id, label = 'Reason', minLength = 5, required = true, className }: { id: string; label?: string; minLength?: number; required?: boolean; className?: string }) {
  return <label htmlFor={id} className={cn(labelClass, className)}>{label}<textarea id={id} name="reason" required={required} minLength={required ? minLength : undefined} maxLength={2000} rows={2} className={cn(textareaClass, 'min-h-16')} /></label>
}

/** Segmented choice: radio inputs rendered as raised pills in a recessed track. */
export function ChoiceTrack({ name, label, defaultValue, options, className }: { name: string; label: string; defaultValue?: string; options: ReadonlyArray<readonly [string, string]>; className?: string }) {
  return (
    <fieldset className={cn('grid min-w-0 gap-1.5', className)}>
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className={trackClass}>
        {options.map(([value, text]) => (
          <label key={value} className="relative">
            <input type="radio" name={name} value={value} defaultChecked={value === defaultValue} required className="peer sr-only" />
            <span className={cn(trackItemClass(false), 'cursor-pointer peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-black/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 dark:peer-checked:bg-zinc-800')}>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function CheckField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-10 items-center gap-2 text-sm text-foreground"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-foreground" />{label}</label>
}
