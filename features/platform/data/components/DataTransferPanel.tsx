'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { Download, FileCheck2, Upload } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'

import {
  runDataTransfer,
  type DataTransferState,
} from '@/features/platform/operations/actions/runDataTransfer'

const initialState: DataTransferState = { ok: false, message: '' }
const example = JSON.stringify([
  {
    sourceId: 'legacy-contact-1001',
    contactType: 'person',
    firstName: 'Avery',
    lastName: 'Morgan',
    email: 'avery@example.test',
    phone: '+1 555 010 2000',
    status: 'prospective_client',
  },
], null, 2)

function Result({ state, allowDownload = false }: { state: DataTransferState; allowDownload?: boolean }) {
  if (!state.message) return null
  const serialized = state.result ? JSON.stringify(state.result, null, 2) : ''
  const download = () => {
    const blob = new Blob([serialized], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'openfront-law-firm-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-2" role="status">
      <p className={state.ok ? 'text-sm text-foreground' : 'text-sm text-destructive'}>{state.message}</p>
      {allowDownload && state.ok && serialized ? (
        <button type="button" onClick={download} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" aria-hidden="true" /> Download JSON snapshot
        </button>
      ) : null}
      {serialized ? <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5">{serialized.slice(0, 20_000)}</pre> : null}
    </div>
  )
}

// One import draft flows through preview and apply: Apply sends exactly the rows that
// passed preview, and editing the draft invalidates that preview. The import operation
// reference is derived from the previewed rows' digest and the connection, so a retried
// apply of the same validated draft replays instead of importing twice.
export function DataTransferPanel({ connections, connectionTotal }: { connections: { id: string; title: string; subtitle: string }[]; connectionTotal?: number }) {
  const [draft, setDraft] = useState(example)
  const [previewed, setPreviewed] = useState<{ rows: string; digest: string } | null>(null)
  const [connectionId, setConnectionId] = useState('')
  const [exportIntent, setExportIntent] = useState<{ key: string; scope: string; limit: string } | null>(null)
  const [preview, previewAction, previewPending] = useActionState(async (previous: DataTransferState, formData: FormData) => {
    const rows = String(formData.get('rows') ?? '')
    const result = await runDataTransfer(previous, formData)
    const digest = result.ok && result.result && 'digest' in result.result && 'valid' in result.result && result.result.valid ? result.result.digest : null
    setPreviewed(digest ? { rows, digest } : null)
    return result
  }, initialState)
  const [apply, applyAction, applyPending] = useActionState(runDataTransfer, initialState)
  const [exportState, exportAction, exportPending] = useActionState(async (previous: DataTransferState, formData: FormData) => {
    const scope = String(formData.get('scope') ?? '')
    const limit = String(formData.get('limit') ?? '')
    const intent = exportIntent && exportIntent.scope === scope && exportIntent.limit === limit
      ? exportIntent
      : { key: `data-export-${crypto.randomUUID()}`, scope, limit }
    setExportIntent(intent)
    formData.set('idempotencyKey', intent.key)
    return runDataTransfer(previous, formData)
  }, initialState)
  const readyToApply = Boolean(previewed && previewed.rows === draft && connectionId)
  const importKey = previewed && connectionId ? `contact-import-${previewed.digest.slice(0, 48)}-${connectionId.slice(0, 40)}` : ''

  return (
    <section aria-labelledby="data-transfer-title" className="border-y border-border py-5">
      <div className="mb-5 max-w-3xl">
        <h2 id="data-transfer-title" className="text-lg font-bold tracking-tight">Controlled data transfer</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Preview contact rows before writing, apply them through an active provider connection, or prepare an export of records you can access.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-5 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-semibold">Contact import</h3>
          </div>
          <form action={previewAction} className="space-y-3">
            <input type="hidden" name="operation" value="preview" />
            <label htmlFor="import-rows" className="block text-sm font-medium">Rows as JSON</label>
            <textarea id="import-rows" name="rows" required value={draft} onChange={(event) => setDraft(event.target.value)} rows={12} className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button disabled={previewPending} className="min-h-9 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60">
              {previewPending ? 'Validating…' : 'Preview without writing'}
            </button>
            {previewed && previewed.rows !== draft ? <p role="status" className="text-xs text-muted-foreground">The rows changed after preview. Preview again before applying.</p> : null}
            <Result state={preview} />
          </form>

          <form action={applyAction} className="space-y-3 border-t border-border pt-4">
            <input type="hidden" name="operation" value="apply" />
            <input type="hidden" name="rows" value={previewed?.rows ?? ''} />
            <input type="hidden" name="idempotencyKey" value={importKey} />
            <SearchableOptionSelect id="apply-connection" name="connectionId" label="Active import connection" emptyLabel="Select a connection" required kind="connection" total={connectionTotal} options={connections.map((connection) => ({ value: connection.id, label: `${connection.title} — ${connection.subtitle}` }))} value={connectionId} onValueChange={setConnectionId} />
            {!connections.length ? <p className="text-xs text-muted-foreground">Create and activate an import/provider connection before applying rows.</p> : null}
            {importKey ? <p className="text-xs text-muted-foreground">Operation reference <span className="break-all font-mono">{importKey}</span> — applying again repeats this same import.</p> : null}
            <button disabled={applyPending || !readyToApply} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60">
              <Upload className="h-4 w-4" aria-hidden="true" /> {applyPending ? 'Applying…' : 'Apply previewed rows'}
            </button>
            {!previewed ? <p className="text-xs text-muted-foreground">Preview the rows first; Apply uses exactly the rows that passed preview.</p> : null}
            <Result state={apply} />
          </form>
        </div>

        <form action={exportAction} className="space-y-4 border-t border-border pt-4">
          <input type="hidden" name="operation" value="export" />
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-semibold">Bounded export</h3>
          </div>
          <label htmlFor="export-scope" className="block text-sm font-medium">Scope</label>
          <FormSelect id="export-scope" name="scope" className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="contacts">Contacts</option>
            <option value="matters">Matters</option>
            <option value="time_entries">Time entries</option>
            <option value="invoices">Invoices</option>
            <option value="audit">Audit evidence</option>
          </FormSelect>
          <label htmlFor="export-limit" className="block text-sm font-medium">Maximum rows</label>
          <input id="export-limit" name="limit" type="number" min={1} max={500} defaultValue={100} className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          {exportIntent ? <p className="text-xs text-muted-foreground">Operation reference <span className="break-all font-mono">{exportIntent.key}</span>. Changing the scope or row limit starts a new export.</p> : null}
          <button disabled={exportPending} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60">
            <Download className="h-4 w-4" aria-hidden="true" /> {exportPending ? 'Preparing…' : 'Prepare export'}
          </button>
          <Result state={exportState} allowDownload />
        </form>
      </div>
    </section>
  )
}
