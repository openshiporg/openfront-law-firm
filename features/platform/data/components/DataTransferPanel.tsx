'use client'

import { useActionState, useMemo, useState } from 'react'
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
import { createSpreadsheetImportConnection, type ImportConnectionState } from '../actions/importConnection'
import { CSV_TEMPLATE, csvToContactRows } from '../lib/contactCsv'

const initialState: DataTransferState = { ok: false, message: '' }

type PreviewResult = { valid: boolean; rowCount: number; errorCount: number; digest: string; rows: Array<{ rowNumber: number; valid: boolean; errors: string[]; normalized: { firstName: string; lastName: string; organizationName: string; email: string; phone: string } }> }
type ImportResult = { importedCount: number; replayed: boolean }

function Message({ state }: { state: DataTransferState }) {
  if (!state.message) return null
  return <p role="status" className={cn('rounded-lg border px-3 py-2 text-sm', state.ok ? 'border-border bg-muted/40 text-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive')}>{state.message}</p>
}

function ExportResult({ state }: { state: DataTransferState }) {
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
    <div className="min-w-0 space-y-2">
      <Message state={state} />
      {state.ok && serialized ? (
        <Track>
          <button type="button" onClick={download} className={pillClass}>
            <Download className="size-4" aria-hidden="true" /> Download JSON
          </button>
        </Track>
      ) : null}
    </div>
  )
}

function problem(error: string) {
  if (error.startsWith('sourceId is duplicated')) return 'Duplicate of another row (same email or name)'
  if (error.startsWith('sourceId is required')) return 'Missing ID'
  if (error === 'status is unsupported') return 'Unknown status'
  if (error.startsWith('contactType')) return 'Type must be person or organization'
  if (error.startsWith('person requires')) return 'Needs a first or last name'
  if (error.startsWith('organization requires')) return 'Needs an organization name'
  if (error === 'email is invalid') return 'Invalid email'
  return error.replace('organizationName', 'organization').replace('firstName', 'first name').replace('lastName', 'last name').replace('sourceId', 'ID')
}

function PreviewTable({ result }: { result: PreviewResult }) {
  const name = (row: PreviewResult['rows'][number]['normalized']) => [row.firstName, row.lastName].filter(Boolean).join(' ') || row.organizationName || '—'
  return (
    <div className="min-w-0 space-y-2">
      <p className={cn('text-sm font-medium', result.valid ? 'text-foreground' : 'text-destructive')}>
        {result.valid ? `${result.rowCount.toLocaleString()} ${result.rowCount === 1 ? 'contact' : 'contacts'} ready to import.` : `${result.errorCount.toLocaleString()} of ${result.rowCount.toLocaleString()} rows need fixing before import.`}
      </p>
      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[30rem] text-xs">
          <thead className="sticky top-0 border-b border-border bg-muted/60 text-left text-muted-foreground"><tr><th className="px-2 py-1.5 font-medium">Row</th><th className="px-2 py-1.5 font-medium">Name</th><th className="px-2 py-1.5 font-medium">Email</th><th className="px-2 py-1.5 font-medium">Phone</th><th className="px-2 py-1.5 font-medium">Problem</th></tr></thead>
          <tbody className="divide-y divide-border">
            {result.rows.slice(0, 500).map((row) => (
              <tr key={row.rowNumber} className={row.valid ? undefined : 'bg-destructive/5'}>
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                <td className="max-w-[10rem] truncate px-2 py-1.5 text-foreground">{name(row.normalized)}</td>
                <td className="max-w-[12rem] truncate px-2 py-1.5 text-muted-foreground">{row.normalized.email || '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{row.normalized.phone || '—'}</td>
                <td className="px-2 py-1.5 text-destructive">{row.errors.map(problem).join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// One import draft flows through preview and apply: Apply sends exactly the rows that
// passed preview, and changing the file or pasted text invalidates that preview. The
// import reference is derived from the previewed rows' digest and the connection, so a
// retried apply of the same validated draft replays instead of importing twice.
export function DataTransferPanel({ connections, connectionTotal }: { connections: { id: string; title: string; subtitle: string }[]; connectionTotal?: number }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [previewed, setPreviewed] = useState<{ rows: string; digest: string } | null>(null)
  const [previewSource, setPreviewSource] = useState('')
  const [fileError, setFileError] = useState('')
  const [selectedConnectionId, setConnectionId] = useState('')
  const connectionId = selectedConnectionId || (connections.length === 1 ? connections[0].id : '')
  const [exportIntent, setExportIntent] = useState<{ key: string; scope: string; limit: string } | null>(null)
  const parsed = useMemo(() => csvText.trim() ? csvToContactRows(csvText) : null, [csvText])
  const rowsJson = parsed && !parsed.error ? JSON.stringify(parsed.rows) : ''
  const [preview, previewAction, previewPending] = useActionState(async (previous: DataTransferState, formData: FormData) => {
    const rows = String(formData.get('rows') ?? '')
    const result = await runDataTransfer(previous, formData)
    const digest = result.ok && result.result && 'digest' in result.result && 'valid' in result.result && result.result.valid ? result.result.digest : null
    setPreviewed(digest ? { rows, digest } : null)
    setPreviewSource(rows)
    return result.ok ? { ...result, message: '' } : result
  }, initialState)
  const [apply, applyAction, applyPending] = useActionState(async (previous: DataTransferState, formData: FormData) => {
    const result = await runDataTransfer(previous, formData)
    if (!result.ok || !result.result || !('importedCount' in result.result)) return result
    const imported = result.result as ImportResult
    return { ...result, message: imported.replayed ? 'These contacts were already imported.' : `Imported ${imported.importedCount.toLocaleString()} ${imported.importedCount === 1 ? 'contact' : 'contacts'}.` }
  }, initialState)
  const [connectionState, connectionAction, connectionPending] = useActionState(createSpreadsheetImportConnection, { ok: false, message: '' } as ImportConnectionState)
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
  const readyToApply = Boolean(previewed && previewed.rows === rowsJson && connectionId)
  const importKey = previewed && connectionId ? `contact-import-${previewed.digest.slice(0, 48)}-${connectionId.slice(0, 40)}` : ''
  const previewResult = preview.ok && preview.result && 'rows' in preview.result ? preview.result as unknown as PreviewResult : null
  const previewCurrent = previewSource === rowsJson

  async function readFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > 2_000_000) { setFileName(''); setCsvText(''); setFileError('Choose a CSV file under 2 MB.'); return }
    setFileName(file.name)
    setCsvText(await file.text())
  }

  const step = 'flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold tabular-nums text-muted-foreground'
  const card = 'min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs'
  const cardHead = 'flex min-w-0 items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground'

  return (
    <section aria-labelledby="data-transfer-title" className="min-w-0 space-y-4">
      <SectionHeader id="data-transfer-title" title="Import and export" />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <div className={card}>
          <h3 className={cardHead}><FileCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />Import contacts</h3>
          <form action={previewAction} className="space-y-3 p-4">
            <input type="hidden" name="operation" value="preview" />
            <input type="hidden" name="rows" value={rowsJson} />
            <div className="flex items-center gap-2 text-xs font-medium text-foreground"><span className={step}>1</span>Choose a CSV file</div>
            <label htmlFor="import-file" className={labelClass}>
              CSV file
              <input id="import-file" type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} className={cn(fieldClass, 'py-2 file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium')} />
            </label>
            <details className="group" open={Boolean(csvText && !fileName)}>
              <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Or paste CSV</span><span className="hidden group-open:inline">Hide pasted CSV</span></summary>
              <label htmlFor="import-csv" className={cn(labelClass, 'mt-2')}>
                CSV text
                <textarea id="import-csv" value={csvText} onChange={(event) => { setFileName(''); setCsvText(event.target.value) }} rows={8} placeholder={CSV_TEMPLATE} className={cn(textareaClass, 'font-mono text-xs leading-5')} />
              </label>
            </details>
            <p className="text-xs text-muted-foreground">Columns: First name, Last name, Organization, Email, Phone. Optional: Status, Type, ID.</p>
            {fileName ? <p className="truncate text-xs text-foreground">{fileName}{parsed && !parsed.error ? ` · ${parsed.rows.length.toLocaleString()} rows` : ''}</p> : null}
            {fileError ? <p role="alert" className="text-xs font-medium text-destructive">{fileError}</p> : null}
            {parsed?.error ? <p role="alert" className="text-xs font-medium text-destructive">{parsed.error}</p> : null}
            {parsed?.unknownColumns.length ? <p className="text-xs text-muted-foreground">Ignored columns: {parsed.unknownColumns.join(', ')}</p> : null}
            <Track>
              <button disabled={previewPending || !rowsJson} className={pillClass}>
                {previewPending ? 'Checking…' : 'Preview import'}
              </button>
            </Track>
            {previewed && previewed.rows !== rowsJson ? <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-400">The file changed. Preview again before importing.</p> : null}
            <Message state={preview} />
            {previewResult && previewCurrent ? <PreviewTable result={previewResult} /> : null}
          </form>

          <div className="space-y-3 border-t border-border p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground"><span className={step}>2</span>Import</div>
            {!connections.length ? (
              <form action={connectionAction} className="space-y-2">
                <p className="text-xs text-muted-foreground">Set up spreadsheet import once. It remembers imported rows so they aren’t imported twice.</p>
                <Track><button disabled={connectionPending} className={pillClass}>{connectionPending ? 'Setting up…' : 'Set up spreadsheet import'}</button></Track>
                {connectionState.message ? <p role="status" className={cn('text-xs', connectionState.ok ? 'text-foreground' : 'text-destructive')}>{connectionState.message}</p> : null}
              </form>
            ) : null}
            <form action={applyAction} className="space-y-3">
              <input type="hidden" name="operation" value="apply" />
              <input type="hidden" name="rows" value={previewed?.rows ?? ''} />
              <input type="hidden" name="idempotencyKey" value={importKey} />
              {connections.length > 1 ? (
                <SearchableOptionSelect id="apply-connection" name="connectionId" label="Import source" emptyLabel="Choose a source" required kind="connection" total={connectionTotal} options={connections.map((connection) => ({ value: connection.id, label: connection.title }))} value={connectionId} onValueChange={setConnectionId} />
              ) : <input type="hidden" name="connectionId" value={connectionId} />}
              {!previewed && connections.length ? <Notice>Preview the file first. Only previewed rows are imported.</Notice> : null}
              {importKey ? (
                <details className="group text-xs text-muted-foreground">
                  <summary className="cursor-pointer list-none font-medium hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> details</summary>
                  <p className="mt-2 min-w-0">Reference <span className="break-all font-mono text-foreground">{importKey}</span>. Importing again repeats this same import.</p>
                </details>
              ) : null}
              <Track>
                <button disabled={applyPending || !readyToApply} className={pillPrimaryClass}>
                  <Upload className="size-4" aria-hidden="true" /> {applyPending ? 'Importing…' : 'Import contacts'}
                </button>
              </Track>
              <Message state={apply} />
            </form>
          </div>
        </div>

        <form action={exportAction} className={card}>
          <input type="hidden" name="operation" value="export" />
          <h3 className={cardHead}><Download className="size-4 text-muted-foreground" aria-hidden="true" />Export</h3>
          <div className="space-y-3 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className={labelClass}>
                <label htmlFor="export-scope">What to export</label>
                <FormSelect id="export-scope" name="scope" className={fieldClass}>
                  <option value="contacts">Contacts</option>
                  <option value="matters">Matters</option>
                  <option value="time_entries">Time entries</option>
                  <option value="invoices">Invoices</option>
                  <option value="audit">Activity log</option>
                </FormSelect>
              </div>
              <label htmlFor="export-limit" className={labelClass}>
                Maximum rows
                <input id="export-limit" name="limit" type="number" min={1} max={500} defaultValue={100} className={cn(fieldClass, 'tabular-nums')} />
              </label>
            </div>
            {exportIntent ? (
              <details className="group text-xs text-muted-foreground">
                <summary className="cursor-pointer list-none font-medium hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> details</summary>
                <p className="mt-2 min-w-0">Reference <span className="break-all font-mono text-foreground">{exportIntent.key}</span>. Changing the type or row limit starts a new export.</p>
              </details>
            ) : null}
            <Track>
              <button disabled={exportPending} className={pillPrimaryClass}>
                <Download className="size-4" aria-hidden="true" /> {exportPending ? 'Preparing…' : 'Prepare export'}
              </button>
            </Track>
            <ExportResult state={exportState} />
          </div>
        </form>
      </div>
    </section>
  )
}
