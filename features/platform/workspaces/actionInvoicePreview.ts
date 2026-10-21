export const ACTION_INVOICE_PREVIEW_LIMIT = 12

export function describeActionInvoicePreview(shownCount: number, authorizedMatchCount: number) {
  return {
    summary: `${shownCount.toLocaleString()} shown · ${authorizedMatchCount.toLocaleString()} authorized matches counted`,
    description: `Action-bearing preview only: up to ${ACTION_INVOICE_PREVIEW_LIMIT} authorized invoices are shown here. The read-only Invoice metadata register below is a separate paged source; it does not extend this action queue. View all opens the searchable, paged action register.`,
  }
}
