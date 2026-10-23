export type PortalManagementState = {
  ok: boolean
  message: string
  inviteToken: string | null
  /** Set only after an invitation: whether the link was emailed to the client. */
  invitationEmailed?: boolean | null
}
