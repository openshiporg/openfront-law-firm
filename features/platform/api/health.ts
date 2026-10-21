import { NextResponse } from "next/server";

import { keystoneContext } from "@/features/keystone/context";

export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 2_000;

export async function GET() {
  try {
    await Promise.race([
      keystoneContext.prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database health check timed out")), DATABASE_TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(
      { status: "ok", service: "openfront-law-firm" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", service: "openfront-law-firm" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
