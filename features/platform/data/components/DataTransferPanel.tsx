'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { Download, FileCheck2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Notice,
  SectionHeader,
  Track,
  fieldClass,
  labelClass,
  pillClass,
  pillPrimaryClass,
  textareaClass,
} from '@/features/platform/components/ui'

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
    <div className="min-w-0 space-y-2" role="status">
      <p className={cn('rounded-lg border px-3 py-2 text-sm', state.ok ? 'border-border bg-muted/40 text-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive')}>{state.message}</p>
      {allowDownload && state.ok && serialized ? (
        <Track>
          <button type="button" onClick={download} className={pillClass}>
            <Download className="size-4" aria-hidden="true" /> Download JSON
          </button>
        </Track>
      ) : null}
      {serialized ? <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-5">{serialized.slice(0, 20_000)}</pre> : null}
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

  const step = 'flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold tabular-nums text-muted-foreground'
  const card = 'min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs'
  const cardHead = 'flex min-w-0 items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground'

  return (
    <section aria-labelledby="data-transfer-title" className="min-w-0 space-y-4">
      <SectionHeader id="data-transfer-title" title="Data transfer" />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <div className={card}>
          <h3 className={cardHead}><FileCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />Contact import</h3>
          <form action={previewAction} className="space-y-3 p-4">
            <input type="hidden" name="operation" value="preview" />
            <div className="flex items-center gap-2 text-xs font-medium text-foreground"><span className={step}>1</span>Preview</div>
            <label htmlFor="import-rows" className={labelClass}>
              Rows (JSON)
              <textarea id="import-rows" name="rows" required value={draft} onChange={(event) => setDraft(event.target.value)} rows={12} className={cn(textareaClass, 'font-mono text-xs leading-5')} />
            </label>
            <Track>
              <button disabled={previewPending} className={pillClass}>
                {previewPending ? 'Validating…' : 'Preview without writing'}
              </button>
            </Track>
            {previewed && previewed.rows !== draft ? <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-400">Rows changed since preview. Preview again to apply.</p> : null}
            <Result state={preview} />
          </form>

          <form action={applyAction} className="space-y-3 border-t border-border p-4">
            <input type="hidden" name="operation" value="apply" />
            <input type="hidden" name="rows" value={previewed?.rows ?? ''} />
            <input type="hidden" name="idempotencyKey" value={importKey} />
            <div className="flex items-center gap-2 text-xs font-medium text-foreground"><span className={step}>2</span>Apply</div>
            <SearchableOptionSelect id="apply-connection" name="connectionId" label="Import connection" emptyLabel="Select a connection" required kind="connection" total={connectionTotal} options={connections.map((connection) => ({ value: connection.id, label: `${connection.title} — ${connection.subtitle}` }))} value={connectionId} onValueChange={setConnectionId} />
            {!connections.length ? <Notice>No active import connection.</Notice> : null}
            {!previewed ? <Notice>Not previewed. Apply uses only rows that passed preview.</Notice> : null}
            {importKey ? <p className="min-w-0 text-xs text-muted-foreground">Operation ref <span className="break-all font-mono text-foreground">{importKey}</span> · applying again repeats this import</p> : null}
            <Track>
              <button disabled={applyPending || !readyToApply} className={pillPrimaryClass}>
                <Upload className="size-4" aria-hidden="true" /> {applyPending ? 'Applying…' : 'Apply previewed rows'}
              </button>
            </Track>
            <Result state={apply} />
          </form>
        </div>

        <form action={exportAction} className={card}>
          <input type="hidden" name="operation" value="export" />
          <h3 className={cardHead}><Download className="size-4 text-muted-foreground" aria-hidden="true" />Export</h3>
          <div className="space-y-3 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className={labelClass}>
                <label htmlFor="export-scope">Scope</label>
                <FormSelect id="export-scope" name="scope" className={fieldClass}>
                  <option value="contacts">Contacts</option>
                  <option value="matters">Matters</option>
                  <option value="time_entries">Time entries</option>
                  <option value="invoices">Invoices</option>
                  <option value="audit">Audit evidence</option>
                </FormSelect>
              </div>
              <label htmlFor="export-limit" className={labelClass}>
                Maximum rows
                <input id="export-limit" name="limit" type="number" min={1} max={500} defaultValue={100} className={cn(fieldClass, 'tabular-nums')} />
              </label>
            </div>
            {exportIntent ? <p className="min-w-0 text-xs text-muted-foreground">Operation ref <span className="break-all font-mono text-foreground">{exportIntent.key}</span> · changing scope or limit starts a new export</p> : null}
            <Track>
              <button disabled={exportPending} className={pillPrimaryClass}>
                <Download className="size-4" aria-hidden="true" /> {exportPending ? 'Preparing…' : 'Prepare export'}
              </button>
            </Track>
            <Result state={exportState} allowDownload />
          </div>
        </form>
      </div>
    </section>
  )
}
