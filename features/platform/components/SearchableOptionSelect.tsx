'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Search } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'

import { fieldClass, trackClass, trackItemClass } from './ui'

import { searchPracticeOptions } from '../operations/actions/searchPracticeOptions'
import type { PracticeOption, PracticeOptionKind } from '../operations/lib/practiceOptions'

// Bounded viewer-authorized search pages, including duplicate labels. Loaded
// selections remain available; stale search responses cannot replace newer input.
export function SearchableOptionSelect({
  id,
  name,
  label,
  kind,
  options,
  total,
  required = false,
  emptyLabel = 'Select',
  valuePrefix = '',
  value,
  onValueChange,
  onOptionChange,
}: {
  id: string
  name: string
  label: string
  kind: PracticeOptionKind
  options: PracticeOption[]
  total?: number
  required?: boolean
  emptyLabel?: string
  valuePrefix?: string
  value?: string
  onValueChange?: (value: string) => void
  onOptionChange?: (option: PracticeOption | undefined) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<PracticeOption[]>([])
  const [message, setMessage] = useState('')
  const [nextPage, setNextPage] = useState<number | null>(null)
  const searchRevision = useRef(0)
  const [searching, startSearch] = useTransition()
  const merged = [...new Map([...options, ...found].map((option) => [option.value, option])).values()]
  const searchable = total === undefined || total > options.length

  function search(page = 1) {
    const revision = ++searchRevision.current
    setMessage('')
    startSearch(async () => {
      const result = await searchPracticeOptions(kind, query, page)
      if (revision !== searchRevision.current) return
      if (!result.success) return setMessage(result.error)
      setFound(previous => [...new Map([...previous, ...result.data].map(option => [option.value, option])).values()])
      setNextPage(result.nextPage)
      setMessage(result.data.length ? `${result.data.length} matches${result.nextPage ? ' · more available' : ''}` : 'No match')
    })
  }

  // Pickers with no preloaded options list the first page of authorized records, so a
  // firm with a handful of matters never has to search before choosing one.
  const preloaded = useRef(false)
  useEffect(() => {
    if (preloaded.current || options.length) return
    preloaded.current = true
    const revision = ++searchRevision.current
    startSearch(async () => {
      const result = await searchPracticeOptions(kind, '', 1)
      if (revision !== searchRevision.current || !result.success) return
      setFound(previous => [...new Map([...previous, ...result.data].map(option => [option.value, option])).values()])
      setNextPage(result.nextPage)
    })
  }, [kind, options.length])

  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <FormSelect
        id={id}
        name={name}
        required={required}
        {...(value === undefined ? { defaultValue: '' } : { value })}
        onValueChange={(next) => {
          onValueChange?.(next)
          onOptionChange?.(merged.find((option) => `${valuePrefix}${option.value}` === next))
        }}
        className={fieldClass}
      >
        <option value="" disabled={required}>{emptyLabel}</option>
        {merged.map((option) => <option key={option.value} value={`${valuePrefix}${option.value}`}>{option.label}</option>)}
      </FormSelect>
      {searchable ? (
        <div className="flex min-w-0 items-center gap-2">
          <input
            aria-label={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => { searchRevision.current++; setQuery(event.target.value); setNextPage(null); setMessage('') }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search() } }}
            maxLength={100}
            placeholder={total === undefined ? 'Search' : `Search all ${total.toLocaleString()}`}
            className={cn(fieldClass, 'rounded-full')}
          />
          <div className={cn(trackClass, 'shrink-0 overflow-visible')}>
            <button type="button" className={trackItemClass(true)} onClick={() => search()} disabled={searching}>
              <Search className="size-3.5" aria-hidden="true" />Find
            </button>
            {nextPage ? <button type="button" className={trackItemClass(false)} disabled={searching} onClick={() => search(nextPage)}>More</button> : null}
          </div>
        </div>
      ) : null}
      {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
