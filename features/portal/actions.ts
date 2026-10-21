'use server'
import { acceptPortalInvite as accept, signOutPortal as end } from '@/features/storefront/portal/actions'
import type { PortalAcceptState } from './constants'
export async function acceptPortalInvite(previous: PortalAcceptState, form: FormData): Promise<PortalAcceptState> { return accept(previous, form) }
export async function signOutPortal() { return end() }
