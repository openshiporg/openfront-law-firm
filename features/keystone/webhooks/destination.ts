import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import { isIP } from "node:net";

/**
 * Outbound webhook destinations are deny-by-default. An operator lists exact
 * hosts (optionally host:port, or *.example.com for subdomains) in
 * WEBHOOK_ALLOWED_HOSTS; nothing else is ever contacted.
 */
export function parseAllowedWebhookHosts(raw: string | undefined = process.env.WEBHOOK_ALLOWED_HOSTS) {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^(\*\.)?[a-z0-9.-]+(:\d{1,5})?$/.test(entry)),
  );
}

function hostAllowed(url: URL, allowed: Set<string>) {
  const hostname = url.hostname.toLowerCase();
  const withPort = url.port ? `${hostname}:${url.port}` : hostname;
  if (allowed.has(withPort)) return true;
  if (url.port) return false;
  for (const entry of allowed) {
    if (entry.startsWith("*.") && !entry.includes(":") && hostname.endsWith(entry.slice(1)) && hostname !== entry.slice(2)) {
      return true;
    }
  }
  return false;
}

export function assertWebhookDestination(value: string, allowed = parseAllowedWebhookHosts()) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("destination_invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("destination_invalid");
  if (!allowed.size || !hostAllowed(url, allowed)) throw new Error("destination_not_allowlisted");
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error("destination_private_address");
  }
  return url;
}

function ipv4Octets(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

/** Parse a validated IPv6 address to eight binary words before classifying it.
 * Textual compression, leading zeros and dotted/hex mapped forms are equivalent. */
function ipv6Words(address: string) {
  if (isIP(address) !== 6 || address.includes('%')) return null;
  let hex = address.toLowerCase();
  if (hex.includes('.')) {
    const colon = hex.lastIndexOf(':');
    const octets = ipv4Octets(hex.slice(colon + 1));
    if (!octets) return null;
    hex = hex.slice(0, colon + 1) + ((octets[0] << 8) | octets[1]).toString(16) + ':' + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const halves = hex.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return words.length === 8 ? words.map(word => Number.parseInt(word, 16)) : null;
}
export function isPrivateAddress(address: string): boolean {
  const v4 = isIP(address) === 4 ? ipv4Octets(address) : null;
  if (v4) {
    const [a, b, c] = v4;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113);
  }
  const words = ipv6Words(address);
  if (!words) return true;
  if (words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff) {
    return isPrivateAddress(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  // Only native global-unicast IPv6 is admitted. Reject local, unspecified,
  // multicast, translation/compatibility and special-purpose/tunnel ranges.
  if ((words[0] & 0xe000) !== 0x2000) return true;
  return words[0] === 0x2002 || words[0] === 0x3fff ||
    words[0] === 0x2001 && (words[1] <= 0x01ff || words[1] === 0x0db8);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * DNS lookup used for the actual socket connection, so the address that is
 * validated is the address that is dialled (no rebinding between check and use).
 */
export function publicOnlyLookup(hostname: string, options: any, callback: LookupCallback) {
  const lookupOptions: LookupAllOptions = { all: true, family: options?.family, hints: options?.hints };
  dnsLookup(hostname, lookupOptions, (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => {
    if (error) return callback(error, "");
    const list = addresses ?? [];
    if (!list.length || list.some((entry) => isPrivateAddress(entry.address))) {
      const denied = Object.assign(new Error("destination_private_address"), { code: "EDESTINATIONDENIED" });
      return callback(denied, "");
    }
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}
