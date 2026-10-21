import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { Service, CustomerConsultation, ServiceAvailability } from './consultation-presentation'
export * from './consultation-presentation'

/**
 * Customer data results keep "signed out", "temporary service failure" and
 * successful (possibly empty) data distinct, so a backend outage is never shown
 * as a sign-in prompt, a missing record or an unpublished catalog.
 */
export type CustomerResult<T> = { status: 'ok'; data: T } | { status: 'signed_out' } | { status: 'unavailable' }

const selection = 'id serviceTitle feeMinor currencyCode status startsAt endsAt timezone'
const serviceSelection = 'id code publicSlug name description consultationFeeMinor consultationMinutes currencyCode'

export type CatalogPage = { services: Service[]; nextCursor: string | null }

export async function getConsultationCatalog(cursor: string | null = null): Promise<CustomerResult<CatalogPage>> {
  const result = await keystoneClient<{ consultationCatalogPage: CatalogPage }>(`query($cursor: String) { consultationCatalogPage(cursor: $cursor) { services { ${serviceSelection} } nextCursor } }`, { cursor })
  return result.success ? { status: 'ok', data: result.data.consultationCatalogPage } : { status: 'unavailable' }
}

/** Exact published service by its public slug (not a lowercased internal code). */
export async function getConsultationService(slug: string): Promise<CustomerResult<Service | null>> {
  const result = await keystoneClient<{ consultationService: Service | null }>(`query($slug: String!) { consultationService(slug: $slug) { ${serviceSelection} } }`, { slug })
  return result.success ? { status: 'ok', data: result.data.consultationService } : { status: 'unavailable' }
}

export async function getConsultationServiceById(id: string): Promise<CustomerResult<Service | null>> {
  const result = await keystoneClient<{ consultationService: Service | null }>(`query($id: ID!) { consultationService(id: $id) { ${serviceSelection} } }`, { id })
  return result.success ? { status: 'ok', data: result.data.consultationService } : { status: 'unavailable' }
}

async function signedIn(): Promise<CustomerResult<true>> {
  const viewer = await keystoneClient<{ authenticatedItem: { id: string } | null }>('{ authenticatedItem { ... on User { id } } }')
  if (!viewer.success) return { status: 'unavailable' }
  return viewer.data.authenticatedItem ? { status: 'ok', data: true } : { status: 'signed_out' }
}

export type AppointmentHistoryPage = { appointments: CustomerConsultation[]; nextCursor: string | null }

export async function getCustomerConsultations(cursor: string | null = null): Promise<CustomerResult<AppointmentHistoryPage>> {
  const identity = await signedIn()
  if (identity.status !== 'ok') return identity
  const result = await keystoneClient<{ customerConsultationPage: AppointmentHistoryPage }>(`query($cursor: String) { customerConsultationPage(cursor: $cursor) { appointments { ${selection} } nextCursor } }`, { cursor })
  return result.success ? { status: 'ok', data: result.data.customerConsultationPage } : { status: 'unavailable' }
}

/** `data: null` is a generic not-found: another account's appointment is never distinguished from a missing one. */
export async function getCustomerConsultation(id: string): Promise<CustomerResult<CustomerConsultation | null>> {
  const identity = await signedIn()
  if (identity.status !== 'ok') return identity
  const result = await keystoneClient<{ customerConsultation: CustomerConsultation | null }>(`query($id: ID!) { customerConsultation(id: $id) { ${selection} } }`, { id })
  return result.success ? { status: 'ok', data: result.data.customerConsultation } : { status: 'unavailable' }
}

/** Bookable times computed by the same host/overlap rules the booking command enforces. */
export async function getConsultationAvailability(serviceId: string): Promise<CustomerResult<ServiceAvailability>> {
  const result = await keystoneClient<{ consultationAvailability: ServiceAvailability }>(`query($serviceId: ID!) { consultationAvailability(serviceId: $serviceId) { timezone slots { startsAt endsAt } } }`, { serviceId })
  return result.success ? { status: 'ok', data: result.data.consultationAvailability } : { status: 'unavailable' }
}

