export const lifecycles = {
  firm: {
    onboarding: ["active", "closed"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    closed: [],
  },
  user: {
    invited: ["active", "deactivated"],
    active: ["suspended", "deactivated"],
    suspended: ["active", "deactivated"],
    deactivated: [],
  },
  membership: {
    invited: ["active", "ended"],
    active: ["suspended", "ended"],
    suspended: ["active", "ended"],
    ended: [],
  },
  intake: {
    new: ["screening", "withdrawn"],
    screening: ["conflict_review", "declined", "withdrawn"],
    conflict_review: ["consultation", "decision", "declined", "withdrawn"],
    consultation: ["decision", "declined", "withdrawn"],
    decision: ["converted", "declined", "withdrawn"],
    converted: [],
    declined: [],
    withdrawn: [],
  },
  intakeSubmission: {
    submitted: ["under_review", "superseded"],
    under_review: ["accepted", "superseded"],
    accepted: ["superseded"],
    superseded: [],
  },
  consultation: {
    requested: ["scheduled", "cancelled"],
    scheduled: ["completed", "cancelled", "no_show"],
    completed: [],
    cancelled: [],
    no_show: [],
  },
  conflictCheck: {
    requested: ["running", "cancelled"],
    running: ["review_required", "failed", "cancelled"],
    review_required: ["cleared", "conflict_found", "failed", "cancelled"],
    cleared: [],
    conflict_found: [],
    failed: [],
    cancelled: [],
  },
  conflictMatch: {
    potential: ["reviewing", "cleared", "escalated"],
    reviewing: ["cleared", "escalated"],
    cleared: [],
    escalated: [],
  },
  matter: {
    proposed: ["pending_conflict", "declined"],
    pending_conflict: ["open", "declined"],
    open: ["on_hold", "closing"],
    on_hold: ["open", "closing"],
    closing: ["closed", "open"],
    closed: [],
    declined: [],
  },
  ethicalWall: {
    draft: ["active"],
    active: ["lifted"],
    lifted: [],
  },
  docket: {
    active: ["stayed", "closed", "appealed"],
    stayed: ["active", "closed"],
    appealed: ["active", "closed"],
    closed: [],
  },
  docketEntry: {
    draft: ["filed", "entered", "rejected", "withdrawn"],
    filed: ["entered", "rejected", "withdrawn"],
    entered: [],
    rejected: [],
    withdrawn: [],
  },
  deadline: {
    draft: ["pending", "cancelled"],
    pending: ["completed", "missed", "waived", "cancelled"],
    completed: [],
    missed: ["completed", "waived"],
    waived: [],
    cancelled: [],
  },
  legalTask: {
    open: ["in_progress", "blocked", "completed", "cancelled"],
    in_progress: ["blocked", "completed", "cancelled"],
    blocked: ["open", "in_progress", "cancelled"],
    completed: [],
    cancelled: [],
  },
  communicationThread: {
    open: ["archived", "closed"],
    archived: ["open", "closed"],
    closed: [],
  },
  communicationMessage: {
    draft: ["queued", "cancelled"],
    queued: ["sent", "failed", "cancelled"],
    sent: ["delivered", "failed"],
    delivered: [],
    failed: ["queued"],
    received: [],
    cancelled: [],
  },
  communicationDelivery: {
    pending: ["sent", "failed"],
    sent: ["delivered", "failed", "bounced"],
    delivered: [],
    failed: ["pending"],
    bounced: [],
  },
  document: {
    draft: ["active", "archived"],
    active: ["archived"],
    archived: ["active", "disposed"],
    disposed: [],
  },
  signatureRequest: {
    draft: ["sent", "cancelled"],
    sent: ["partially_signed", "completed", "declined", "expired", "cancelled"],
    partially_signed: ["completed", "declined", "expired", "cancelled"],
    completed: [],
    declined: [],
    expired: [],
    cancelled: [],
  },
  signer: {
    pending: ["viewed", "signed", "declined"],
    viewed: ["signed", "declined"],
    signed: [],
    declined: [],
  },
  rateCard: {
    draft: ["active", "retired"],
    active: ["retired"],
    retired: [],
  },
  timeEntry: {
    draft: ["submitted", "written_off"],
    submitted: ["approved", "draft", "written_off"],
    approved: ["billed", "written_off"],
    billed: [],
    written_off: [],
  },
  expense: {
    draft: ["submitted", "written_off"],
    submitted: ["approved", "draft", "written_off"],
    approved: ["billed", "reimbursed", "written_off"],
    billed: ["reimbursed"],
    reimbursed: [],
    written_off: [],
  },
  retainer: {
    draft: ["sent", "terminated"],
    sent: ["accepted", "terminated"],
    accepted: ["active", "terminated"],
    active: ["completed", "terminated"],
    completed: [],
    terminated: [],
  },
  invoice: {
    draft: ["approved", "void"],
    approved: ["issued", "void"],
    issued: ["partially_paid", "paid", "overdue", "void"],
    partially_paid: ["paid", "overdue", "void"],
    overdue: ["partially_paid", "paid", "void"],
    paid: ["partially_paid", "overdue"],
    void: [],
  },
  trustAccount: {
    pending: ["active", "closed"],
    active: ["frozen", "closed"],
    frozen: ["active", "closed"],
    closed: [],
  },
  trustLedgerAccount: {
    active: ["frozen", "closed"],
    frozen: ["active", "closed"],
    closed: [],
  },
  trustReconciliation: {
    draft: ["in_review"],
    in_review: ["completed", "draft"],
    completed: ["reopened"],
    reopened: ["in_review"],
  },
  payment: {
    pending: ["authorized", "failed", "cancelled"],
    authorized: ["captured", "failed", "cancelled"],
    captured: ["settled", "failed"],
    settled: [],
    failed: [],
    cancelled: [],
  },
  refund: {
    requested: ["approved", "cancelled"],
    approved: ["processing", "cancelled"],
    processing: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
    cancelled: [],
  },
  portalAccount: {
    invited: ["active", "closed"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    closed: [],
  },
  portalMatterAccess: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: [],
  },
  portalShare: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: [],
  },
  integrationConnection: {
    pending: ["active", "disabled", "revoked"],
    active: ["needs_reauth", "disabled", "revoked"],
    needs_reauth: ["active", "disabled", "revoked"],
    disabled: ["active", "revoked"],
    revoked: [],
  },
  webhookDelivery: {
    pending: ["processing", "failed"],
    processing: ["succeeded", "failed"],
    failed: ["pending", "dead_letter"],
    succeeded: [],
    dead_letter: [],
  },
  retentionPolicy: {
    draft: ["active", "retired"],
    active: ["retired"],
    retired: [],
  },
  retentionHold: {
    active: ["released"],
    released: [],
  },
  agentPrincipal: {
    draft: ["active", "revoked"],
    active: ["suspended", "revoked"],
    suspended: ["active", "revoked"],
    revoked: [],
  },
  agentCredential: {
    active: ["revoked", "expired"],
    revoked: [],
    expired: [],
  },
  agentGrant: {
    proposed: ["active", "revoked"],
    active: ["suspended", "revoked", "expired"],
    suspended: ["active", "revoked", "expired"],
    revoked: [],
    expired: [],
  },
  agentAction: {
    requested: ["awaiting_approval", "approved", "cancelled"],
    awaiting_approval: ["approved", "rejected", "cancelled"],
    approved: ["executing", "cancelled"],
    rejected: [],
    executing: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
    cancelled: [],
  },
} as const;

export type LifecycleKey = keyof typeof lifecycles;

export function initialLifecycleState(lifecycle: LifecycleKey) {
  return Object.keys(lifecycles[lifecycle])[0];
}

export function canTransition(
  lifecycle: LifecycleKey,
  from: string,
  to: string,
): boolean {
  const definition = lifecycles[lifecycle] as Record<string, readonly string[]> | undefined;
  return definition?.[from]?.includes(to) ?? false;
}

function lifecycleLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}

export function assertInitialLifecycleState(lifecycle: LifecycleKey, status: string) {
  const initial = initialLifecycleState(lifecycle);
  if (status !== initial) {
    throw new Error(`${lifecycleLabel(lifecycle)} must be created in ${initial} status.`);
  }
  return status;
}

export function assertCommandTarget(command: string, target: unknown, allowedTargets: readonly string[]) {
  if (typeof target !== "string" || !allowedTargets.includes(target)) {
    throw new Error(`The requested state is not available through the ${command} command.`);
  }
  return target;
}

export function assertLifecycleTransition(
  lifecycle: LifecycleKey,
  from: string,
  to: string,
) {
  if (!(lifecycle in lifecycles)) throw new Error(`Unknown lifecycle: ${lifecycle}`);
  if (!canTransition(lifecycle, from, to)) {
    throw new Error(`${lifecycleLabel(lifecycle)} cannot transition from ${from} to ${to}.`);
  }
  return to;
}
