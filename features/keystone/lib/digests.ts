import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const record = value as Record<string, unknown>;
  const properties = Object.keys(record).sort().flatMap((key) =>
    record[key] === undefined
      ? []
      : [`${JSON.stringify(key)}:${canonicalJson(record[key])}`],
  );
  return `{${properties.join(",")}}`;
}

export function sha256Digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
