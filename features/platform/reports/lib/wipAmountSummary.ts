export const REPORT_WIP_SOURCE_CAP = 100

export type ReportWipTimeEntry = {
  amountMinor?: number | null
  currencyCode: string
}

export type ReportWipExpense = {
  amountMinor: number
  currencyCode: string
}

export type ReportWipAmountSummary = {
  knownAmountsByCurrency: Map<string, number>
  unknownTimeAmountsByCurrency: Map<string, number>
  timeEntryRows: number | null
  expenseRows: number | null
  timeEntriesUnavailable: boolean
  expensesUnavailable: boolean
  timeEntriesAtCap: boolean
  expensesAtCap: boolean
}

export function summarizeReportWipAmounts(
  timeEntries: readonly ReportWipTimeEntry[] | null,
  expenses: readonly ReportWipExpense[] | null,
): ReportWipAmountSummary {
  const knownAmountsByCurrency = new Map<string, number>()
  const unknownTimeAmountsByCurrency = new Map<string, number>()
  for (const row of timeEntries ?? []) {
    if (typeof row.amountMinor !== 'number') {
      unknownTimeAmountsByCurrency.set(row.currencyCode, (unknownTimeAmountsByCurrency.get(row.currencyCode) ?? 0) + 1)
      continue
    }
    knownAmountsByCurrency.set(row.currencyCode, (knownAmountsByCurrency.get(row.currencyCode) ?? 0) + row.amountMinor)
  }
  for (const row of expenses ?? []) {
    knownAmountsByCurrency.set(row.currencyCode, (knownAmountsByCurrency.get(row.currencyCode) ?? 0) + row.amountMinor)
  }

  return {
    knownAmountsByCurrency,
    unknownTimeAmountsByCurrency,
    timeEntryRows: timeEntries?.length ?? null,
    expenseRows: expenses?.length ?? null,
    timeEntriesUnavailable: timeEntries === null,
    expensesUnavailable: expenses === null,
    timeEntriesAtCap: timeEntries !== null && timeEntries.length >= REPORT_WIP_SOURCE_CAP,
    expensesAtCap: expenses !== null && expenses.length >= REPORT_WIP_SOURCE_CAP,
  }
}
