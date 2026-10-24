'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type TrustSetupState = { ok: boolean; message: string }

const ACCOUNT_TYPES = ['trust', 'pooled_trust', 'dedicated_client', 'other']
const ACTIVATION_REASON = 'Opened from Trust & accounting'

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function revalidateAccounting() {
  revalidatePath('/dashboard/platform/accounting')
}

async function activateAccount(trustAccountId: string) {
  return keystoneClient<{ transitionTrustAccount: { id: string; status: string } }>(`
    mutation ActivateTrustAccount($id: ID!, $reason: String!) {
      transitionTrustAccount(trustAccountId: $id, toStatus: "active", reason: $reason) { id status }
    }
  `, { id: trustAccountId, reason: ACTIVATION_REASON })
}

// Creates the account in its initial pending state with its bank identity, then
// activates it through the controlled transition (which requires that identity).
export async function openTrustAccount(_previous: TrustSetupState, formData: FormData): Promise<TrustSetupState> {
  const name = field(formData, 'name')
  const accountType = field(formData, 'accountType')
  const currencyCode = field(formData, 'currencyCode').toUpperCase()
  const financialInstitutionName = field(formData, 'financialInstitutionName')
  const bankAccountLastFour = field(formData, 'bankAccountLastFour')
  const officeId = field(formData, 'officeId')
  if (name.length < 2 || name.length > 200) return { ok: false, message: 'Account name must be 2–200 characters.' }
  if (!ACCOUNT_TYPES.includes(accountType)) return { ok: false, message: 'Choose an account type.' }
  if (!/^[A-Z]{3}$/.test(currencyCode)) return { ok: false, message: 'Currency must be a three-letter code.' }
  if (!financialInstitutionName || financialInstitutionName.length > 300) return { ok: false, message: 'Bank name is required (300 characters or fewer).' }
  if (!/^\d{4}$/.test(bankAccountLastFour)) return { ok: false, message: 'Enter exactly the last four digits of the account number.' }
  if (officeId.length > 200) return { ok: false, message: 'Choose a valid office.' }

  const duplicate = await keystoneClient<{ trustAccountsCount: number }>(`
    query TrustAccountDuplicate($name: String!) { trustAccountsCount(where: { name: { equals: $name, mode: insensitive }, status: { not: { equals: closed } } }) }
  `, { name })
  if (duplicate.success && duplicate.data.trustAccountsCount > 0) return { ok: false, message: `A trust account named ${name} already exists.` }

  const created = await keystoneClient<{ createTrustAccount: { id: string } | null }>(`
    mutation OpenTrustAccount($data: TrustAccountCreateInput!) { createTrustAccount(data: $data) { id } }
  `, {
    data: {
      name,
      accountType,
      currencyCode,
      financialInstitutionName,
      bankAccountLastFour,
      ...(officeId ? { office: { connect: { id: officeId } } } : {}),
    },
  })
  if (!created.success || !created.data.createTrustAccount) {
    return { ok: false, message: 'The trust account was not created. Check trust management permission.' }
  }
  revalidateAccounting()
  const activated = await activateAccount(created.data.createTrustAccount.id)
  if (!activated.success) return { ok: false, message: `${name} was created as pending but not activated.` }
  return { ok: true, message: `Trust account ${name} is active.` }
}

export async function activateTrustAccount(trustAccountId: string): Promise<TrustSetupState> {
  const id = String(trustAccountId ?? '').trim()
  if (!id || id.length > 200) return { ok: false, message: 'Choose a trust account.' }
  const account = await keystoneClient<{ trustAccount: { id: string; status: string; financialInstitutionName: string | null; bankAccountLastFour: string | null } | null }>(`
    query TrustAccountForActivation($id: ID!) { trustAccount(where: { id: $id }) { id status financialInstitutionName bankAccountLastFour } }
  `, { id })
  if (!account.success) return { ok: false, message: account.error }
  if (!account.data.trustAccount) return { ok: false, message: 'Choose a trust account you can access.' }
  if (!['pending', 'frozen'].includes(account.data.trustAccount.status)) return { ok: false, message: 'Only a pending or frozen account can be activated.' }
  if (!account.data.trustAccount.financialInstitutionName || !account.data.trustAccount.bankAccountLastFour) {
    return { ok: false, message: 'Activation requires the bank name and last four digits.' }
  }
  const response = await activateAccount(id)
  if (!response.success) return { ok: false, message: 'The trust account was not activated. Check trust management permission.' }
  revalidateAccounting()
  return { ok: true, message: 'Trust account active.' }
}

// Ledger numbers are unique per firm. The suggestion is the next TL-NNNN after the
// highest one the viewer can read; staff may replace it.
export async function suggestLedgerNumber() {
  const response = await keystoneClient<{ trustLedgerAccounts: Array<{ ledgerNumber: string }> }>(`
    query LedgerNumberSequence { trustLedgerAccounts(where: { ledgerNumber: { startsWith: "TL-" } }, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) { ledgerNumber } }
  `)
  let highest = 0
  if (response.success) {
    for (const { ledgerNumber } of response.data.trustLedgerAccounts) {
      const match = /^TL-(\d+)$/.exec(ledgerNumber)
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return `TL-${String(highest + 1).padStart(4, '0')}`
}

export async function openTrustLedger(_previous: TrustSetupState, formData: FormData): Promise<TrustSetupState> {
  const trustAccountId = field(formData, 'trustAccountId')
  const matterId = field(formData, 'matterId')
  let clientId = field(formData, 'clientId')
  const ledgerNumber = field(formData, 'ledgerNumber')
  if (!trustAccountId || trustAccountId.length > 200) return { ok: false, message: 'Choose an active trust account.' }
  if (matterId.length > 200 || clientId.length > 200) return { ok: false, message: 'Choose a valid client or matter.' }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/.test(ledgerNumber)) return { ok: false, message: 'Ledger number must be up to 60 letters, numbers, dot, slash, underscore or hyphen.' }

  const lookup = await keystoneClient<{
    trustAccount: { id: string; status: string; currencyCode: string } | null
    matters: Array<{ id: string; matterNumber: string; client: { id: string } | null }>
    trustLedgerAccountsCount: number
  }>(`
    query LedgerSetup($accountId: ID!, $matterIds: [ID!]!, $ledgerNumber: String!) {
      trustAccount(where: { id: $accountId }) { id status currencyCode }
      matters(where: { id: { in: $matterIds } }, take: 1) { id matterNumber client { id } }
      trustLedgerAccountsCount(where: { ledgerNumber: { equals: $ledgerNumber } })
    }
  `, { accountId: trustAccountId, matterIds: matterId ? [matterId] : [], ledgerNumber })
  if (!lookup.success) return { ok: false, message: lookup.error }
  const account = lookup.data.trustAccount
  if (!account || account.status !== 'active') return { ok: false, message: 'Choose an active trust account.' }
  const matter = lookup.data.matters[0]
  if (matterId && !matter) return { ok: false, message: 'Choose a matter you can access.' }
  if (!clientId) clientId = matter?.client?.id ?? ''
  if (!clientId) return { ok: false, message: 'Choose the client, or a matter that has a client.' }
  if (lookup.data.trustLedgerAccountsCount > 0) return { ok: false, message: `Ledger number ${ledgerNumber} is already used.` }

  const response = await keystoneClient<{ createTrustLedgerAccount: { id: string; ledgerNumber: string } | null }>(`
    mutation OpenTrustLedger($data: TrustLedgerAccountCreateInput!) { createTrustLedgerAccount(data: $data) { id ledgerNumber } }
  `, {
    data: {
      trustAccount: { connect: { id: account.id } },
      client: { connect: { id: clientId } },
      ...(matterId ? { matter: { connect: { id: matterId } } } : {}),
      ledgerNumber,
      currencyCode: account.currencyCode,
    },
  })
  if (!response.success || !response.data.createTrustLedgerAccount) {
    return { ok: false, message: 'The ledger was not opened. Check trust management permission and matter access.' }
  }
  revalidateAccounting()
  return { ok: true, message: `Ledger ${response.data.createTrustLedgerAccount.ledgerNumber} is active.` }
}
