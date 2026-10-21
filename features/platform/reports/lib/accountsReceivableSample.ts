export const ACCOUNTS_RECEIVABLE_SOURCE_CAP = 100
export const ACCOUNTS_RECEIVABLE_DISPLAY_CAP = 50

export type AccountsReceivableSampleSummary = {
  rawSourceRows: number | null
  displayedRows: number | null
  sourceCap: number
  displayCap: number
  sourceCapReached: boolean
}

export function summarizeAccountsReceivableSample(rows: readonly unknown[] | null): AccountsReceivableSampleSummary {
  return {
    rawSourceRows: rows === null ? null : rows.length,
    displayedRows: rows === null ? null : Math.min(rows.length, ACCOUNTS_RECEIVABLE_DISPLAY_CAP),
    sourceCap: ACCOUNTS_RECEIVABLE_SOURCE_CAP,
    displayCap: ACCOUNTS_RECEIVABLE_DISPLAY_CAP,
    sourceCapReached: rows !== null && rows.length >= ACCOUNTS_RECEIVABLE_SOURCE_CAP,
  }
}
