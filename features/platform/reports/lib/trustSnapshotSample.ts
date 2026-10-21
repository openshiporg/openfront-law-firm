export const TRUST_SNAPSHOT_SOURCE_CAP = 100

export type TrustSnapshotSampleSummary = {
  rawSourceRows: number | null
  representedLedgers: number
  sourceCap: number
  sourceCapReached: boolean
}

export function latestLedgerSnapshots<T extends { ledgerAccount?: { id: string } | null }>(rows: readonly T[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const id = row.ledgerAccount?.id
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function summarizeTrustSnapshotSample(
  rawRows: readonly unknown[] | null,
  ledgerRows: readonly unknown[],
): TrustSnapshotSampleSummary {
  return {
    rawSourceRows: rawRows === null ? null : rawRows.length,
    representedLedgers: ledgerRows.length,
    sourceCap: TRUST_SNAPSHOT_SOURCE_CAP,
    sourceCapReached: rawRows !== null && rawRows.length >= TRUST_SNAPSHOT_SOURCE_CAP,
  }
}

export function sumCurrencies(rows: Array<{
  amountMinor?: number | null
  balanceDueMinor?: number | null
  balanceMinor?: number | null
  currencyCode: string
}>) {
  const result = new Map<string, number>()
  for (const row of rows) result.set(row.currencyCode, (result.get(row.currencyCode) ?? 0) + Number(row.amountMinor ?? row.balanceDueMinor ?? row.balanceMinor ?? 0))
  return result
}
