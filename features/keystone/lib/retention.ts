export type RetentionHoldEvidence = {
  status: "active" | "released";
  releasedAt?: string | null;
};

export function evaluateRetentionDisposal(input: {
  now: Date;
  eligibleAt: string;
  holds: RetentionHoldEvidence[];
  approved: boolean;
}) {
  if (input.holds.some((hold) => hold.status === "active" && !hold.releasedAt)) {
    return { allowed: false, reason: "An active retention hold blocks disposal." } as const;
  }

  const eligibleAt = Date.parse(input.eligibleAt);
  if (!Number.isFinite(eligibleAt) || eligibleAt > input.now.getTime()) {
    return { allowed: false, reason: "The resource is not yet eligible for disposal." } as const;
  }

  if (!input.approved) {
    return { allowed: false, reason: "Human disposal approval is required." } as const;
  }

  return { allowed: true, reason: null } as const;
}
