export const OFFICE_STATUSES = ['active', 'inactive', 'closed'] as const
export type OfficeStatus = (typeof OFFICE_STATUSES)[number]
export const OFFICE_STATUS_LABELS: Record<OfficeStatus, string> = { active: 'Active', inactive: 'Inactive', closed: 'Closed' }

export type FirmDefaults = {
  id: string
  name: string
  slug: string
  status: string
  defaultTimezone: string
  defaultCurrency: string
}

export type OfficeRow = {
  id: string
  name: string
  code: string
  status: OfficeStatus
  timezone: string
  email: string | null
  phone: string | null
}

export type FirmSetup =
  | { status: 'loaded'; firm: FirmDefaults; offices: OfficeRow[]; officesTotal: number }
  | { status: 'error'; message: string }

export type FirmActionState = { ok: boolean; message: string; revision: number }
export const initialFirmActionState: FirmActionState = { ok: false, message: '', revision: 0 }

/** Common currencies offered first; any ISO 4217 three-letter code is accepted. */
export const COMMON_CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'NZD', 'CHF', 'JPY', 'SGD', 'HKD', 'INR', 'ZAR', 'MXN'] as const
