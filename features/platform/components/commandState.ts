// Result of a platform form command. `revision` increments on every submit so a client
// can react once per result (refresh, close the form) even when the message repeats.
export type CommandState = { ok: boolean; message: string; revision: number }

export const initialCommandState: CommandState = { ok: false, message: '', revision: 0 }

export function commandResult(previous: CommandState, ok: boolean, message: string): CommandState {
  return { ok, message, revision: previous.revision + 1 }
}

/** Reads a trimmed text field and enforces its length; throws a readable message. */
export function formText(formData: FormData, key: string, { label = key, min = 0, max = 500 }: { label?: string; min?: number; max?: number } = {}) {
  const value = String(formData.get(key) ?? '').trim()
  if (min > 0 && !value) throw new Error(`${label} is required.`)
  if (value.length < min) throw new Error(`${label} must be at least ${min} characters.`)
  if (value.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return value
}

export function formChoice<T extends string>(formData: FormData, key: string, allowed: readonly T[], label: string): T {
  const value = String(formData.get(key) ?? '').trim() as T
  if (!allowed.includes(value)) throw new Error(`Choose a ${label}.`)
  return value
}
