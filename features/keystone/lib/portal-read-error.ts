/** Read-side outcomes only; no credential exchange or token protocol change. */
export class PortalReadError extends Error {
  constructor(public readonly code: "invalid_session" | "invalid_cursor" | "unavailable_resource") {
    super(code === "invalid_session" ? "Portal session is invalid or expired." : code === "invalid_cursor" ? "Portal page is unavailable." : "Shared item is unavailable.");
    this.name = "PortalReadError";
  }
}
