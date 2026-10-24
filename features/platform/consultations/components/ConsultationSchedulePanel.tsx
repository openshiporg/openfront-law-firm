'use client'

import { useState } from 'react'

import { FormSelect } from '@/components/ui/form-select'
import { FormFooter, ReasonField, TextField, useCommand } from '@/features/platform/components/CommandFormParts'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { Panel, Track, fieldClass, labelClass, trackItemClass } from '@/features/platform/components/ui'

import { scheduleConsultationCommand } from '../actions/scheduleConsultation'
import { SCHEDULABLE_STATUSES, type ConsultationSchedule } from '../lib/scheduleTypes'
import { useKeptForm } from '../../components/useKeptForm'

const DURATIONS = [15, 30, 45, 60, 90, 120]

function wallParts(value: string | null, timeZone: string) {
  if (!value) return { date: '', time: '' }
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(value)).map((part) => [part.type, part.value]))
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
  } catch {
    return { date: '', time: '' }
  }
}

export function ConsultationSchedulePanel({ consultation, timeZone }: { consultation: ConsultationSchedule; timeZone: string }) {
  const schedulable = SCHEDULABLE_STATUSES.includes(consultation.status)
  const [open, setOpen] = useState(false)
  const [hostId, setHostId] = useState(consultation.host?.id ?? '')
  const [officeId, setOfficeId] = useState(consultation.office?.id ?? '')
  const [state, action, pending] = useCommand(scheduleConsultationCommand, () => setOpen(false))
  const actionForm = useKeptForm(action, state)
  if (!schedulable) return null
  const rescheduling = consultation.status === 'scheduled'
  const { date, time } = wallParts(consultation.startsAt, timeZone)
  const currentMinutes = consultation.startsAt && consultation.endsAt ? Math.round((new Date(consultation.endsAt).getTime() - new Date(consultation.startsAt).getTime()) / 60_000) : 30
  const durations = DURATIONS.includes(currentMinutes) || currentMinutes < 5 || currentMinutes > 480 ? DURATIONS : [...DURATIONS, currentMinutes].sort((a, b) => a - b)
  const label = rescheduling ? 'Reschedule' : 'Schedule'
  return (
    <Panel
      id="consultation-schedule"
      title={label}
      actions={<Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}>{open ? 'Close' : label}</button></Track>}
      bodyClassName={open ? 'p-4' : 'p-0'}
    >
      {open ? (
        <form {...actionForm} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="consultationId" value={consultation.id} />
          <TextField id="schedule-date" name="date" label={`Date (${timeZone})`} type="date" required defaultValue={date} />
          <TextField id="schedule-time" name="time" label="Start time" type="time" required defaultValue={time} />
          <label htmlFor="schedule-duration" className={labelClass}>Duration
            <FormSelect id="schedule-duration" name="durationMinutes" defaultValue={String(currentMinutes >= 5 && currentMinutes <= 480 ? currentMinutes : 30)} className={fieldClass}>
              {durations.map((minutes) => <option key={minutes} value={String(minutes)}>{minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}</option>)}
            </FormSelect>
          </label>
          <TextField id="schedule-location" name="location" label="Location" maxLength={300} defaultValue={consultation.location ?? ''} />
          <div className="sm:col-span-2"><SearchableOptionSelect id="schedule-host" name="hostId" label="Host" emptyLabel="Choose a host" required kind="member" value={hostId} onValueChange={setHostId} options={consultation.host ? [{ value: consultation.host.id, label: consultation.host.name || 'Current host' }] : []} /></div>
          <div className="sm:col-span-2"><SearchableOptionSelect id="schedule-office" name="officeId" label="Office" emptyLabel="No office" kind="office" value={officeId} onValueChange={setOfficeId} options={consultation.office ? [{ value: consultation.office.id, label: `${consultation.office.name ?? 'Office'}${consultation.office.code ? ` · ${consultation.office.code}` : ''}` }] : []} /></div>
          <ReasonField id="schedule-reason" required={false} className="sm:col-span-2" />
          <FormFooter state={state} pending={pending} label={label} pendingLabel="Saving…" className="sm:col-span-2" />
        </form>
      ) : state.ok && state.message ? <p role="status" className="px-4 py-3 text-sm">{state.message}</p> : null}
    </Panel>
  )
}
