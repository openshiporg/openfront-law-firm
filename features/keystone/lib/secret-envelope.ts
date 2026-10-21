import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

function envelopeKey(override?: string) {
  const encoded = override ?? process.env.INTEGRATION_CREDENTIAL_KEY;
  if (!encoded) throw new Error("INTEGRATION_CREDENTIAL_KEY is required.");
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) throw new Error("INTEGRATION_CREDENTIAL_KEY must encode exactly 32 bytes.");
  return key;
}

export function encryptSecret(value: string, keyOverride?: string) {
  if (!value || Buffer.byteLength(value, "utf8") > 32_768) {
    throw new Error("Integration credential must be between 1 and 32768 bytes.");
  }
  const key = envelopeKey(keyOverride);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("openfront-law-firm:integration:v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(envelope: string, keyOverride?: string) {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = envelope.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
    throw new Error("Integration credential envelope is invalid.");
  }
  const key = envelopeKey(keyOverride);
  const iv = Buffer.from(encodedIv, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Integration credential envelope is invalid.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from("openfront-law-firm:integration:v1"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Integration credential envelope authentication failed.");
  }
}

export function secretDigest(value: string, keyOverride?: string) {
  return createHmac("sha256", envelopeKey(keyOverride)).update(value).digest("hex");
}
