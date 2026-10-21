export interface GenericItem { id: string; [key: string]: unknown }
export interface ListItemsResponse { items: GenericItem[]; count: number }
export interface AuthenticatedUser {
  id: string; name: string | null; email: string | null; onboardingStatus: string | null
  role: { canAccessDashboard: boolean | null; canManageOnboarding: boolean | null } | null
  activeFirm: { id: string; name: string | null; displayName: string | null; shortName: string | null; brandTagline: string | null; brandColor: string | null } | null
}
export interface AuthenticatedUserResponse { authenticatedItem: AuthenticatedUser | null }
