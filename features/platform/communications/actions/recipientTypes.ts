export type RecipientActionState = { ok: boolean; message: string; revision: number }

export type ParticipantRow = {
  id: string
  participantRole: string | null
  status: string | null
  displayAddress: string | null
  addedAt: string | null
  user: { name: string | null } | null
  contact: { displayName: string | null } | null
  portalAccount: { email: string | null } | null
}

export type ThreadRecipientSetup = { threadStatus: string | null; participants: ParticipantRow[] }

export type ContactEmailMethod = { id: string; label: string | null; value: string; isPrimary: boolean }

export type DeliveryRow = {
  id: string
  status: string | null
  recipientAddress: string | null
  provider: string | null
  attemptCount: number | null
  recipientContact: { displayName: string | null } | null
}

export type MessageDeliverySetup = {
  status: string | null
  direction: string | null
  channel: string | null
  threadId: string | null
  deliveries: DeliveryRow[]
  participants: ParticipantRow[]
  connections: Array<{ id: string; name: string; provider: string }>
}
