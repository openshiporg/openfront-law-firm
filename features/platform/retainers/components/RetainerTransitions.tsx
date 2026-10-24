'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { Notice, Panel, Track, fieldClass, labelClass, pillClass, pillDangerClass, pillPrimaryClass, textareaClass } from '@/features/platform/components/ui'

import { transitionRetainer, type RetainerActionState } from '../actions/retainers'
import { RETAINER_TRANSITIONS, TRANSITION_LABELS } from '../lib/retainerOptions'
import { useKeptForm } from '../../components/useKeptForm'

const initial: RetainerActionState = { ok: false, message: '' }

export function RetainerTransitions({ retainerId, status, documentVersions, needsLedger }: {
  retainerId: string
  status: string
  documentVersions: Array<{ id: string; label: string }>
  needsLedger: boolean
}) {
  const router = useRouter()
  const targets = RETAINER_TRANSITIONS[status] ?? []
  const [target, setTarget] = useState<string | null>(null)
  const [versionId, setVersionId] = useState('')
  const [state, run, pending] = useActionState(async (previous: RetainerActionState, formData: FormData) => {
    const result = await transitionRetainer(previous, formData)
    if (result.ok) { setTarget(null); router.refresh() }
    return result
  }, initial)
  const runForm = useKeptForm(run, state)

  if (!targets.length) return null

  return (
    <Panel id="transitions" title="Status">
      <div className="grid min-w-0 gap-4">
        <Track label="Agreement transitions">
          {targets.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={target === value}
              className={value === 'terminated' ? pillDangerClass : target === value ? pillPrimaryClass : pillClass}
              onClick={() => setTarget(target === value ? null : value)}
            >
              {TRANSITION_LABELS[value] ?? value}
            </button>
          ))}
        </Track>

        {target ? (
          <form {...runForm} className="grid min-w-0 gap-4">
            <input type="hidden" name="retainerId" value={retainerId} />
            <input type="hidden" name="toStatus" value={target} />
            {target === 'accepted' ? (
              documentVersions.length ? (
                <div className={labelClass}>
                  <label htmlFor="retainer-signed-version">Signed agreement version</label>
                  <FormSelect id="retainer-signed-version" name="signedDocumentVersionId" required value={versionId} onValueChange={setVersionId} className={cn(fieldClass, 'text-foreground')}>
                    <option value="" disabled>Select document version</option>
                    {documentVersions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
                  </FormSelect>
                </div>
              ) : <Notice>Acceptance needs the signed agreement uploaded as a document version on this matter.</Notice>
            ) : null}
            {target === 'active' ? (
              <>
                <label className={cn(labelClass, 'sm:max-w-xs')}>Effective date<input name="effectiveDate" type="date" className={fieldClass} /></label>
                {needsLedger ? <Notice>This agreement takes a retainer deposit but has no trust ledger, so it cannot become active.</Notice> : null}
              </>
            ) : null}
            <label className={labelClass}>
              {target === 'terminated' ? 'Termination reason' : 'Note (optional)'}
              <textarea name="reason" required={target === 'terminated'} minLength={target === 'terminated' ? 5 : undefined} maxLength={2000} rows={3} className={textareaClass} />
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Track>
                <button
                  type="submit"
                  className={target === 'terminated' ? pillDangerClass : pillPrimaryClass}
                  disabled={pending || (target === 'accepted' && (!documentVersions.length || !versionId)) || (target === 'active' && needsLedger)}
                >
                  {pending ? 'Saving…' : `Confirm: ${TRANSITION_LABELS[target] ?? target}`}
                </button>
                <button type="button" className={pillClass} onClick={() => setTarget(null)}>Cancel</button>
              </Track>
            </div>
          </form>
        ) : null}
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : null}
      </div>
    </Panel>
  )
}
