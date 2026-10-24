'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { EmptyState, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, statusLabel, statusTone, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { prepareDeliveriesAction } from '../actions/recipients'
import type { MessageDeliverySetup } from '../actions/recipientTypes'
import { participantName, participantRole } from './ThreadRecipientsClient'
import { ActionMessage, useRecipientAction } from './useRecipientAction'

const EMAIL = /^[^\s@<>,;()"]+@[^\s@<>,;()"]+\.[^\s@<>,;()"]+$/

function PrepareForm({ messageId, setup, onDone }: { messageId: string; setup: MessageDeliverySetup; onDone: () => void }) {
  const [state, action, pending] = useRecipientAction(prepareDeliveriesAction, onDone)
  const eligible = setup.participants.filter((participant) => participant.displayAddress && EMAIL.test(participant.displayAddress))
  const prepared = new Set(setup.deliveries.map((delivery) => delivery.recipientAddress))
  if (!eligible.length) return <Notice>Add recipients with an email address to the thread first.</Notice>
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="messageId" value={messageId} />
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Recipients</legend>
        {eligible.map((participant) => (
          <label key={participant.id} className="flex min-h-10 min-w-0 items-center gap-3 text-sm">
            <input type="checkbox" name="participantIds" value={participant.id} defaultChecked={!setup.deliveries.length || prepared.has(participant.displayAddress)} className="size-4 shrink-0 accent-foreground" />
            <span className="min-w-0 truncate">{participantName(participant)}<span className="text-muted-foreground"> · {participant.displayAddress} · {participantRole(participant)}</span></span>
          </label>
        ))}
      </fieldset>
      {setup.connections.length ? (
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`delivery-connection-${messageId}`} className="text-xs font-medium text-muted-foreground">Email connection</label>
          <FormSelect id={`delivery-connection-${messageId}`} name="integrationConnectionId" defaultValue="" className={fieldClass}>
            <option value="">Workspace email (SMTP)</option>
            {setup.connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.provider}</option>)}
          </FormSelect>
        </div>
      ) : null}
      <label className={labelClass}>Reason<textarea name="reason" required minLength={5} maxLength={2000} rows={2} placeholder="Reviewed recipients for this message" className={textareaClass} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActionMessage state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Preparing…' : setup.deliveries.length ? 'Replace deliveries' : 'Prepare deliveries'}</button></Track>
      </div>
    </form>
  )
}

export function MessageDeliveriesClient({ messageId, setup }: { messageId: string; setup: MessageDeliverySetup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  // Mirrors prepareCommunicationDeliveries: draft outbound email with no delivery outcomes yet.
  const canPrepare = setup.status === 'draft' && setup.direction === 'outbound' && setup.channel === 'email' && setup.deliveries.every((delivery) => delivery.status === 'pending')
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Deliveries<span className="font-mono text-xs font-normal text-muted-foreground">{setup.deliveries.length}</span></h2>}
      actions={canPrepare ? <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Send className="size-3.5" aria-hidden="true" />Prepare deliveries</button></Track> : null}
      bodyClassName="p-0"
    >
      {open ? <div className="border-b border-border p-4"><PrepareForm messageId={messageId} setup={setup} onDone={close} /></div> : null}
      {setup.deliveries.length ? (
        <ul className="divide-y divide-border">
          {setup.deliveries.map((delivery) => (
            <li key={delivery.id} className="min-w-0 px-4 py-3">
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={statusTone(delivery.status)} /><Link href={`/dashboard/platform/communications/delivery/${encodeURIComponent(delivery.id)}`} className="truncate underline-offset-4 hover:underline">{delivery.recipientAddress ?? 'No address'}</Link><span className="shrink-0 text-xs font-normal text-muted-foreground">{statusLabel(delivery.status)}</span></p>
              <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{delivery.recipientContact?.displayName ?? 'Contact not linked'} · {delivery.provider || 'smtp'} · {delivery.attemptCount ?? 0} attempts</p>
            </li>
          ))}
        </ul>
      ) : <div className="p-4"><EmptyState title={canPrepare ? 'No deliveries prepared' : 'No deliveries'} /></div>}
      {canPrepare && setup.deliveries.length ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Queue the message to send these deliveries.</p> : null}
      {setup.status === 'draft' && setup.channel && setup.channel !== 'email' ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Only email deliveries can be prepared.</p> : null}
    </Panel>
  )
}
