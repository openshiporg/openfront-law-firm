'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Upload } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { uploadDocumentVersion, type DocumentVersionRow, type VersionUploadState } from '../actions/documentVersions'
import { useKeptForm } from '../../components/useKeptForm'

const initial: VersionUploadState = { ok: false, message: '', revision: 0 }

function size(bytes: number | null) {
  if (!bytes) return '—'
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}

export function DocumentVersionPanel({ documentId, storage, currentVersionId, versions }: { documentId: string; storage: boolean; currentVersionId: string | null; versions: DocumentVersionRow[] }) {
  const [state, action, pending] = useActionState(uploadDocumentVersion, initial)
  const actionForm = useKeptForm(action, state)
  const router = useRouter()
  useEffect(() => { if (state.ok && state.revision) router.refresh() }, [state, router])
  return (
    <Panel title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Files<span className="font-mono text-xs font-normal text-muted-foreground">{versions.length}</span></h2>} bodyClassName="p-0">
      {storage ? (
        <form key={state.ok ? state.revision : 'form'} {...actionForm} className="grid gap-3 border-b border-border p-4">
          <input type="hidden" name="documentId" value={documentId} />
          <label className={labelClass}>Upload a new version<input type="file" name="file" required className={cn(fieldClass, 'py-1.5 file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm')} /></label>
          <label className={labelClass}>Notes<input name="notes" maxLength={2000} className={fieldClass} /></label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makeCurrent" defaultChecked className="size-4 accent-foreground" />Make current</label>
            <Track><button type="submit" disabled={pending} className={pillPrimaryClass}><Upload className="size-3.5" aria-hidden="true" />{pending ? 'Uploading…' : 'Upload'}</button></Track>
          </div>
          {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : null}
          <p className="text-xs text-muted-foreground">Up to 9 MB</p>
        </form>
      ) : <div className="border-b border-border p-4"><Notice>File storage is not configured for this workspace.</Notice></div>}
      {versions.length ? (
        <ul className="divide-y divide-border">
          {versions.map((version) => (
            <li key={version.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={version.id === currentVersionId ? 'emerald' : 'zinc'} /><span className="truncate">v{version.versionNumber ?? '?'} · {version.fileName ?? 'File'}</span>{version.id === currentVersionId ? <span className="shrink-0 text-xs font-normal text-muted-foreground">Current</span> : null}</p>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{version.mediaType ?? 'Unknown type'} · {size(version.byteSize)}</p>
              </div>
              {version.downloadUrl ? <a href={version.downloadUrl} className={pillClass} aria-label={`Download version ${version.versionNumber}`}><Download className="size-3.5" aria-hidden="true" />Download</a> : null}
            </li>
          ))}
        </ul>
      ) : <div className="p-4"><EmptyState title="No files yet" /></div>}
    </Panel>
  )
}
