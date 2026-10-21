export const MAX_OAUTH_FORM_BYTES = 64_000;

export class OAuthFormError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = "OAuthFormError";
  }
}

/** Accepts `application/x-www-form-urlencoded`, optionally with a UTF-8 charset. */
export function isOAuthFormContentType(value: string | null) {
  const [mediaType, ...parameters] = (value ?? "").toLowerCase().split(";").map((part) => part.trim());
  if (mediaType !== "application/x-www-form-urlencoded") return false;
  return parameters.every((parameter) => parameter === "" || parameter === "charset=utf-8");
}

/** Reads a URL-encoded body while counting the bytes actually received, so a
 * missing or understated Content-Length cannot push a larger body into the parser.
 * A declared length is only an early rejection. */
export async function readBoundedOAuthForm(request: Request, maximumBytes = MAX_OAUTH_FORM_BYTES) {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0) throw new OAuthFormError(400, "OAuth request length is invalid.");
    if (length > maximumBytes) throw new OAuthFormError(413, "OAuth request is too large.");
  }
  if (!request.body) return new URLSearchParams();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new OAuthFormError(413, "OAuth request is too large.");
    }
    chunks.push(value);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
  } catch {
    throw new OAuthFormError(400, "OAuth request body is not valid UTF-8.");
  }
  return new URLSearchParams(text);
}
