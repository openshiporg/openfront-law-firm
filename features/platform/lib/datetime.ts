// Instants are stored in UTC. Display always names the zone it was formatted in, so a
// server running in another zone can never silently shift a deadline or meeting time.

export function validTimeZone(timeZone: unknown): string | null {
  const zone = typeof timeZone === 'string' ? timeZone.trim() : ''
  if (!zone) return null
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return zone
  } catch {
    return null
  }
}

function parseInstant(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatInstant(
  value: unknown,
  timeZone: unknown,
  { includeTime = true, missing = 'Not recorded' }: { includeTime?: boolean; missing?: string } = {},
) {
  const date = parseInstant(value)
  if (!date) return missing
  const zone = validTimeZone(timeZone) ?? 'UTC'
  return new Intl.DateTimeFormat('en', {
    timeZone: zone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } : {}),
  }).format(date)
}

// Queue kinds whose instant is an appointment or obligation time, not just a record date.
const timeSensitiveKinds = new Set([
  'Consultation', 'Deadline', 'Verified deadline', 'Unverified deadline', 'Docket entry', 'Task',
])

export function isTimeSensitiveKind(kind: string) {
  return timeSensitiveKinds.has(kind)
}

function zoneOffsetMs(instant: number, zone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return asUtc - Math.floor(instant / 1000) * 1000
}

// Reject calendar normalization and nonexistent local times. A repeated local
// time needs an EXPLICIT choice; the default never guesses a legal deadline.
export function zonedWallTimeToInstant(
  wallTime: string,
  timeZone: string,
  disambiguation: 'reject' | 'earlier' | 'later' = 'reject',
): Date | null {
  const zone = validTimeZone(timeZone)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wallTime.trim())
  if (!zone || !match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  if (year < 100 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const calendar = new Date(wall)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null
  // Sample offsets on both sides of transitions, including non-hour offsets
  // and date-line jumps, then require an exact round-trip of every component.
  const offsets = new Set<number>()
  for (let hours = -48; hours <= 48; hours += 6) offsets.add(zoneOffsetMs(wall + hours * 3_600_000, zone))
  const candidates = [...offsets].map(offset => wall - offset)
    .filter(instant => instant + zoneOffsetMs(instant, zone) === wall)
    .sort((a, b) => a - b)
  if (!candidates.length || candidates.length > 1 && disambiguation === 'reject') return null
  return new Date(disambiguation === 'later' ? candidates[candidates.length - 1] : candidates[0])
}
