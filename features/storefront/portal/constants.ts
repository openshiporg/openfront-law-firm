export const PORTAL_SESSION_COOKIE = 'openfront-portal-session'

export type PortalAcceptState = { error: string | null; inviteToken: string; revision: number }

export type PortalSignInState = { sent: boolean; error: string | null }
