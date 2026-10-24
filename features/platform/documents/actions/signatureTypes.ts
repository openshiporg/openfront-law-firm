export type SignatureActionState = { ok: boolean; message: string; revision: number }

export type SignatureSignerRow = { id: string; name: string | null; email: string | null; signingOrder: number | null; status: string | null; signedAt: string | null }

export type SignatureRequestRow = {
  id: string
  title: string | null
  status: string | null
  provider: string | null
  expiresAt: string | null
  sentAt: string | null
  createdAt: string | null
  versionNumber: number | null
  connectionName: string | null
  signers: SignatureSignerRow[]
}

export type SignatureConnectionOption = { id: string; name: string; provider: string }

export type DocumentSignatureSetup = {
  documentStatus: string | null
  currentVersion: { id: string; versionNumber: number | null; fileName: string | null } | null
  requests: SignatureRequestRow[]
  connections: SignatureConnectionOption[]
}
