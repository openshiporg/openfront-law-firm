'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { slotLabel, slotsByDay, slotTimeLabel, timezoneLabel, type AvailabilitySlot, type Service } from './lib/consultation-presentation'

type Choice = Pick<Service, 'id' | 'name' | 'consultationMinutes'> & { fee: string; slots: AvailabilitySlot[] }

/**
 * Home booking bar: matter, then one of this week's open times, then the request.
 * Both lists are shadcn popovers over published data; the booking page re-checks the
 * time and runs the intake and conflict questions before anything is requested.
 */
export function BookingBar({ choices, timezone, initialServiceId }: { choices: Choice[]; timezone: string; initialServiceId?: string }) {
  const router = useRouter()
  const [serviceId, setServiceId] = useState(initialServiceId && choices.some((c) => c.id === initialServiceId) ? initialServiceId : choices[0]?.id ?? '')
  const service = choices.find((choice) => choice.id === serviceId) ?? choices[0]
  const [startsAt, setStartsAt] = useState(service?.slots[0]?.startsAt ?? '')
  const [matterOpen, setMatterOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const days = useMemo(() => slotsByDay(service?.slots ?? [], timezone), [service, timezone])
  const chosen = service?.slots.find((slot) => slot.startsAt === startsAt)
  if (!service) return null

  const pickService = (id: string) => {
    setServiceId(id)
    const next = choices.find((choice) => choice.id === id)
    setStartsAt((current) => next?.slots.some((slot) => slot.startsAt === current) ? current : next?.slots[0]?.startsAt ?? '')
    setMatterOpen(false)
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = new URLSearchParams({ service: service.id })
    if (chosen) query.set('at', chosen.startsAt)
    router.push(`/consultation?${query.toString()}`)
  }

  return <form className="alt-book" data-dock-anchor onSubmit={submit} aria-label="Request a consultation">
    <div className="alt-book__row">
      <div className="alt-book__field alt-book__field--matter">
        <span className="alt-book__label" id="book-matter">I need help with</span>
        <Popover open={matterOpen} onOpenChange={setMatterOpen}>
          <PopoverTrigger className="alt-select" aria-labelledby="book-matter book-matter-value" aria-haspopup="listbox">
            <span id="book-matter-value">{service.name}</span><ChevronDown className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start" className="alt-pop" role="listbox" aria-label="Practice areas">
            {choices.map((choice) => <button key={choice.id} type="button" role="option" aria-selected={choice.id === service.id} className="alt-pop__option" onClick={() => pickService(choice.id)}>
              <span>{choice.name}</span><span className="alt-pop__meta">{choice.fee}</span>
            </button>)}
          </PopoverContent>
        </Popover>
      </div>
      <div className="alt-book__field alt-book__field--time">
        <span className="alt-book__label" id="book-time">This week</span>
        <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger className="alt-select" aria-labelledby="book-time book-time-value" aria-haspopup="listbox" disabled={!days.length}>
            <span id="book-time-value" className="sf-num">{chosen ? slotLabel(chosen.startsAt, timezone) : 'No open times'}</span><ChevronDown className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start" className="alt-pop alt-pop--times" role="listbox" aria-label={`Open times, ${timezoneLabel(timezone)}`}>
            {days.map(({ day, slots }) => <div key={day}>
              <p className="alt-pop__day">{day}</p>
              <div className="alt-pop__times">
                {slots.map((slot) => <button key={slot.startsAt} type="button" role="option" aria-selected={slot.startsAt === startsAt} className="alt-pop__option alt-pop__time" onClick={() => { setStartsAt(slot.startsAt); setTimeOpen(false) }}>{slotTimeLabel(slot.startsAt, timezone)}</button>)}
              </div>
            </div>)}
            <p className="alt-pop__zone">Times in {timezoneLabel(timezone)}</p>
          </PopoverContent>
        </Popover>
      </div>
      <div className="alt-book__submit"><button className="alt-book__button" type="submit">Request a consultation</button></div>
    </div>
    <p className="alt-book__note">Asking for a time doesn’t make us your lawyers yet. For a deadline this week, call the office.</p>
  </form>
}
