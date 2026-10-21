import "dotenv/config";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  closeSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

export function assertMaintainedMigrationTarget({
  databaseUrl,
  confirmation,
  allowedDatabase = "runtime_law_firm",
}: {
  databaseUrl: string | undefined;
  confirmation: string | undefined;
  allowedDatabase?: string;
}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("Maintained migration target must use PostgreSQL.");
  }
  if (!loopback.has(url.hostname)) {
    throw new Error("Maintained migration deployment is restricted to loopback PostgreSQL.");
  }
  if (database !== allowedDatabase || confirmation !== allowedDatabase) {
    throw new Error(`Set MIGRATION_CONFIRM_DATABASE=${allowedDatabase} and target that exact database.`);
  }
  if (!database.startsWith("runtime_") || /prod|production/i.test(database)) {
    throw new Error("Maintained migration target must be an explicitly named local runtime database.");
  }
  return { database, redactedUrl: `${url.protocol}//${url.hostname}:${url.port || "5432"}/${database}` };
}

function run(command: string, args: string[]) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: process.env,
    timeout: 15 * 60 * 1000,
  });
}

function localMigrations() {
  return new Map(
    readdirSync("migrations", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const bytes = readFileSync(`migrations/${entry.name}/migration.sql`);
        return [entry.name, createHash("sha256").update(bytes).digest("hex")];
      }),
  );
}

export async function verifyMigrationBackup({
  path,
  reference,
  now = Date.now(),
}: {
  path: string | undefined;
  reference: string | undefined;
  now?: number;
}) {
  path ??= "";
  reference ??= "";
  const match = reference.match(/^sha256:([a-f0-9]{64})$/);
  if (!match || !isAbsolute(path)) {
    throw new Error("Set an absolute MIGRATION_BACKUP_PATH and exact sha256 MIGRATION_BACKUP_REFERENCE.");
  }
  const stat = statSync(path);
  if (!stat.isFile() || stat.size < 1024 || now - stat.mtimeMs > 24 * 60 * 60_000 || stat.mtimeMs > now + 60_000) {
    throw new Error("Migration backup must be a recent non-empty regular file.");
  }
  const descriptor = openSync(path, "r");
  const header = Buffer.alloc(5);
  try {
    readSync(descriptor, header, 0, header.length, 0);
  } finally {
    closeSync(descriptor);
  }
  if (header.toString("ascii") !== "PGDMP") {
    throw new Error("Migration backup is not a PostgreSQL custom-format dump.");
  }
  const checksum = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => checksum.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  if (checksum.digest("hex") !== match[1]) {
    throw new Error("Migration backup checksum does not match MIGRATION_BACKUP_REFERENCE.");
  }
}

async function preflight(prisma: PrismaClient, expectedDatabase: string) {
  const current = await prisma.$queryRawUnsafe<Array<{ database: string; recovery: boolean }>>(
    "SELECT current_database() AS database, pg_is_in_recovery() AS recovery",
  );
  if (current[0]?.database !== expectedDatabase || current[0]?.recovery) {
    throw new Error("Database identity changed or target is a read-only replica.");
  }
  const relations = await prisma.$queryRawUnsafe<Array<{ migrations: string | null; domain: string | null; portal: string | null }>>(
    `SELECT
      to_regclass('public._prisma_migrations')::text AS migrations,
      to_regclass('public."Firm"')::text AS domain,
      to_regclass('public."PortalAccount"')::text AS portal`,
  );
  const hasDomainData = Boolean(relations[0]?.domain);
  if (hasDomainData && !relations[0]?.migrations) {
    throw new Error("Non-empty law-firm schema has no Prisma migration history; deployment refused.");
  }
  if (relations[0]?.migrations) {
    const applied = await prisma.$queryRawUnsafe<Array<{
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>>(
      `SELECT migration_name, checksum, finished_at, rolled_back_at
       FROM "_prisma_migrations"
       ORDER BY started_at`,
    );
    const local = localMigrations();
    for (const migration of applied) {
      if (!migration.finished_at && !migration.rolled_back_at) {
        throw new Error(`Failed or interrupted migration requires operator review: ${migration.migration_name}`);
      }
      if (migration.rolled_back_at) continue;
      const checksum = local.get(migration.migration_name);
      if (!checksum || checksum !== migration.checksum) {
        throw new Error(`Applied migration history is unknown or modified: ${migration.migration_name}`);
      }
    }
  }
  if (relations[0]?.portal) {
    const duplicateEmails = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM (
        SELECT firm, email FROM "PortalAccount" GROUP BY firm, email HAVING count(*) > 1
      ) duplicates`,
    );
    const duplicateDigests = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM (
        SELECT "inviteTokenDigest" FROM "PortalAccount"
        WHERE "inviteTokenDigest" IS NOT NULL AND "inviteTokenDigest" <> ''
        GROUP BY "inviteTokenDigest" HAVING count(*) > 1
      ) duplicates`,
    );
    if (duplicateEmails[0]?.count || duplicateDigests[0]?.count) {
      throw new Error("Portal data violates a pending uniqueness invariant; migration deployment refused.");
    }
  }
  if (hasDomainData) {
    await verifyMigrationBackup({
      path: process.env.MIGRATION_BACKUP_PATH,
      reference: process.env.MIGRATION_BACKUP_REFERENCE,
    });
  }
  return { hasDomainData };
}

export async function deployMaintainedMigrations() {
  const target = assertMaintainedMigrationTarget({
    databaseUrl: process.env.DATABASE_URL,
    confirmation: process.env.MIGRATION_CONFIRM_DATABASE,
  });
  const prisma = new PrismaClient();
  try {
    await preflight(prisma, target.database);
    console.log(`Applying checked migrations to guarded local target ${target.redactedUrl}`);
    await prisma.$transaction(async (tx) => {
      const lock = await tx.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        "SELECT pg_try_advisory_xact_lock(hashtext('openfront-law-firm:maintained-migrations')) AS acquired",
      );
      if (!lock[0]?.acquired) throw new Error("Another maintained migration deployment holds the target lock.");
      run("npx", ["prisma", "migrate", "deploy", "--schema", "schema.prisma"]);
    }, { timeout: 15 * 60 * 1000, maxWait: 10_000 });
    run("npx", ["prisma", "migrate", "status", "--schema", "schema.prisma"]);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  deployMaintainedMigrations().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
