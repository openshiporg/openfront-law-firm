type HeaderSource = { get(name: string): string | null | undefined };

/**
 * Get the application origin from the incoming request, the same way
 * getBaseUrl() does: x-forwarded-host first, then host.
 */
export function getRequestBaseUrl(headers: HeaderSource, requestUrl?: string): string {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  const fallbackProtocol = requestUrl ? new URL(requestUrl).protocol.replace(":", "") : "https";
  const protocol = headers.get("x-forwarded-proto") || fallbackProtocol;

  if (host) {
    return `${protocol}://${host}`;
  }

  return requestUrl ? new URL(requestUrl).origin : "";
}

export function getRequestOrigin(request: Request): string {
  return getRequestBaseUrl(request.headers, request.url);
}
