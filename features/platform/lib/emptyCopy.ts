// Authored empty results for workspace sections, keyed by section key. A section that is
// not listed reads "Nothing here yet" rather than a "No <section title>" construction.
const emptyCopy: Record<string, string> = {
  accounts: 'No accounts yet',
  active: 'No open matters',
  conflicts: 'No conflict checks waiting',
  connections: 'No connections yet',
  consultations: 'No consultations booked',
  credentials: 'No machine access to review',
  deadlines: 'No deadlines awaiting review',
  delivery: 'No deliveries need follow-up',
  directory: 'No contacts yet',
  docket: 'No docket activity',
  documents: 'No documents in progress',
  drafts: 'No drafts waiting for review',
  'eligible-contacts': 'No contacts can be invited yet',
  'eligible-matters': 'No matters to share',
  evidence: 'No retention evidence recorded',
  expenses: 'No expenses awaiting approval',
  exports: 'No exports yet',
  grants: 'No client has matter access yet',
  holds: 'No active legal holds',
  invoices: 'No bills need action',
  ledgers: 'No client ledgers open',
  links: 'No imported records',
  payments: 'No payments or refunds recorded',
  pipeline: 'No intakes in progress',
  reconciliation: 'Nothing to reconcile',
  relationships: 'No relationships recorded',
  'shareable-documents': 'No documents marked shareable',
  'shareable-invoices': 'No issued invoices to share',
  'shareable-threads': 'No open conversations to share',
  shares: 'Nothing shared with clients',
  signatures: 'No signatures in progress',
  tasks: 'No assigned work',
  threads: 'No open conversations',
  time: 'No time awaiting approval',
  walls: 'No access decisions recorded',
  webhooks: 'No webhook deliveries',
}

export function sectionEmptyCopy(key: string) {
  return emptyCopy[key] ?? 'Nothing here yet'
}
