import type { Context } from ".keystone/types";

import { isInteractiveHumanSession, permissionKeys, type Session } from "../access";
import { runSerializableTransaction } from "../lib/transactions";
import { requireOwnedOfflineDatabase } from "../lib/local-fixture";
import { sanitizeStoreLogoSvg } from "../../shared/sanitize-store-logo";
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../../shared/store-logo";
import { assertCurrentCommandActor } from "./command-authority";
import { applySyntheticDemoScenario, SYNTHETIC_DEMO_MARKER } from "./syntheticScenario";
import { recordAuditEvent } from "./workflow-helpers";
import { standardFirmRoles, standardRolePermissionData } from "./roleWorkflows";

function bounded(value: string, label: string, max: number) {
  const text = value?.trim();
  if (!text || text.length > max) throw new Error(`${label} is required and must be ${max} characters or fewer.`);
  return text;
}

function optionalBounded(value: string | null | undefined, label: string, maximum: number) {
  const result = value?.trim() || null;
  if (result && result.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return result;
}

function optionalEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() || null;
  if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Support email must be valid.");
  }
  return email;
}

function optionalBrandColor(value: string | null | undefined) {
  const color = value?.trim().toLowerCase() || null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) throw new Error("Brand color must be a six-digit hexadecimal color.");
  return color;
}

// Firm.logoIcon/logoColor field hooks do not run for Prisma writes, so onboarding
// applies the same sanitizer and hue normalizer before persisting them.
function logoIcon(value: string | null | undefined) {
  const safe = sanitizeStoreLogoSvg(value?.trim() || DEFAULT_STORE_LOGO_ICON);
  if (!safe) throw new Error("Logo must be a safe SVG document.");
  return safe;
}

function slug(value: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Firm slug must contain lowercase letters, numbers, and single hyphens.");
  }
  return normalized;
}

function timezone(value: string) {
  const normalized = bounded(value, "Timezone", 100);
  try {
    Intl.DateTimeFormat("en", { timeZone: normalized }).format();
    return normalized;
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
}

function currency(value: string) {
  const normalized = value?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error("Currency must be a three-letter code.");
  return normalized;
}

export async function completeFirmOnboarding(
  _root: unknown,
  args: {
    firmName: string;
    firmSlug: string;
    firmDisplayName?: string | null;
    firmShortName?: string | null;
    brandTagline?: string | null;
    brandColor?: string | null;
    supportEmail?: string | null;
    logoIcon?: string | null;
    logoColor?: string | null;
    officeName: string;
    officeCode: string;
    timezone: string;
    currencyCode: string;
    practiceAreaName?: string | null;
    /** Explicitly opt into the clearly-synthetic demo matter scenario (skip for a real/custom setup). */
    seedSyntheticDemo?: boolean | null;
  },
  context: Context,
) {
  const session = context.session as Session | undefined;
  if (
    !isInteractiveHumanSession(session) ||
    session.data.status !== "active"
  ) {
    throw new Error("An active human administrator is required for onboarding.");
  }
  const firmName = bounded(args.firmName, "Firm name", 200);
  const firmSlug = slug(args.firmSlug);
  const displayName = optionalBounded(args.firmDisplayName, "Display name", 120) ?? firmName;
  const shortName = optionalBounded(args.firmShortName, "Short name", 40) ?? displayName.slice(0, 40);
  const brandTagline = optionalBounded(args.brandTagline, "Brand tagline", 180);
  const brandColor = optionalBrandColor(args.brandColor);
  const supportEmail = optionalEmail(args.supportEmail);
  const firmLogoIcon = logoIcon(args.logoIcon);
  const firmLogoColor = normalizeStoreLogoColor(args.logoColor ?? "0");
  const officeName = bounded(args.officeName, "Office name", 200);
  const officeCode = bounded(args.officeCode, "Office code", 30).toUpperCase();
  const defaultTimezone = timezone(args.timezone);
  const defaultCurrency = currency(args.currencyCode);
  const practiceAreaName = bounded(args.practiceAreaName || "General Practice", "Practice area name", 200);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-onboarding:${session.itemId}`}))`;
    const user = await tx.user.findUnique({
      where: { id: session.itemId },
      include: {
        activeFirm: true,
        bootstrapRole: true,
        firmMemberships: { include: { firm: true, role: true } },
      },
    });
    if (!user || user.status !== "active") throw new Error("Bootstrap user is unavailable.");
    const activeMembership = user.firmMemberships.find((membership: any) =>
      membership.status === "active" && membership.firmId === user.activeFirmId,
    );
    if (user.activeFirm && activeMembership) {
      await assertCurrentCommandActor(tx, context, "canManageOnboarding");
      if (user.activeFirm.status !== "active" || activeMembership.role?.status !== "active" || activeMembership.role?.firmId !== user.activeFirm.id || !activeMembership.role?.canManageOnboarding) throw new Error("Current onboarding authority is required.");
      if (args.seedSyntheticDemo === true) {
        // Same locked, current membership authority as the standalone seed; the
        // scenario itself refuses any firm that is not an owned offline fixture.
        await assertCurrentCommandActor(tx, context, "canManageOnboarding");
        const demoScenario = await applySyntheticDemoScenario(tx, {
          firmId: user.activeFirm.id,
          actorUserId: user.id,
        });
        await recordAuditEvent(tx, {
          firmId: user.activeFirm.id,
          eventType: "firm.synthetic_demo_seeded",
          category: "legal_workflow",
          outcome: "succeeded",
          actorUserId: user.id,
          matterId: demoScenario.matterId,
          metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER },
        });
        return {
          firm: user.activeFirm,
          office: null,
          membership: activeMembership,
          role: activeMembership.role,
          replayed: true,
          demoScenario,
        };
      }
      return {
        firm: user.activeFirm,
        office: null,
        membership: activeMembership,
        role: activeMembership.role,
        replayed: true,
        demoScenario: null,
      };
    }
    if (user.bootstrapRole?.status !== "active" || !user.bootstrapRole?.canManageOnboarding || user.bootstrapRole?.firmId) throw new Error("Current bootstrap onboarding authority is required.");
    if (user.activeFirmId || user.firmMemberships.some((membership: any) => membership.status !== "invited")) {
      throw new Error("Bootstrap user has a partial firm assignment that requires administrator review.");
    }
    const duplicate = await tx.firm.findUnique({ where: { slug: firmSlug } });
    if (duplicate) throw new Error("Firm slug is already in use.");

    // Fixture admission precedes ALL base/scenario writes, not merely their
    // durable commit. Ordinary non-fixture setup does not require an offline DB.
    if (args.seedSyntheticDemo === true) await requireOwnedOfflineDatabase(tx);
    const firm = await tx.firm.create({
      data: {
        name: firmName,
        displayName,
        shortName,
        brandTagline: brandTagline ?? "",
        brandColor: brandColor ?? "",
        supportEmail: supportEmail ?? "",
        logoIcon: firmLogoIcon,
        logoColor: firmLogoColor,
        slug: firmSlug,
        status: "onboarding",
        isDemo: args.seedSyntheticDemo === true,
        defaultTimezone,
        defaultCurrency,
      },
    });
    const office = await tx.office.create({
      data: {
        firmId: firm.id,
        name: officeName,
        code: officeCode,
        status: "active",
        timezone: defaultTimezone,
      },
    });
    const role = await tx.role.create({
      data: {
        firmId: firm.id,
        name: "Firm administrator",
        status: "active",
        ...Object.fromEntries(permissionKeys.map((permission) => [permission, true])),
      },
    });
    // Least-privilege staff roles so new members need not be invited as administrators.
    await tx.role.createMany({
      data: standardFirmRoles.map((standard) => ({
        firmId: firm.id,
        name: standard.name,
        status: "active",
        ...standardRolePermissionData(standard),
      })),
    });
    const now = new Date();
    const membership = await tx.firmMembership.create({
      data: {
        firmId: firm.id,
        userId: user.id,
        roleId: role.id,
        primaryOfficeId: office.id,
        status: "active",
        title: "Administrator",
        startedAt: now,
      },
    });
    await Promise.all([
      tx.user.update({
        where: { id: user.id },
        data: { activeFirmId: firm.id, onboardingStatus: "completed" },
      }),
      tx.practiceArea.create({
        data: {
          firmId: firm.id,
          name: practiceAreaName,
          code: "GENERAL",
          status: "active",
          description: "Firm-configured default practice area; review before operational use.",
        },
      }),
      tx.firm.update({ where: { id: firm.id }, data: { status: "active" } }),
    ]);
    await recordAuditEvent(tx, {
      firmId: firm.id,
      eventType: "firm.onboarding_completed",
      category: "authorization",
      actorUserId: user.id,
      metadata: { firmId: firm.id, officeId: office.id, roleId: role.id, membershipId: membership.id },
    });
    let demoScenario: Awaited<ReturnType<typeof applySyntheticDemoScenario>> | null = null;
    if (args.seedSyntheticDemo === true) {
      demoScenario = await applySyntheticDemoScenario(tx, {
        firmId: firm.id,
        actorUserId: user.id,
      });
      await recordAuditEvent(tx, {
        firmId: firm.id,
        eventType: "firm.synthetic_demo_seeded",
        category: "legal_workflow",
        outcome: "succeeded",
        actorUserId: user.id,
        matterId: demoScenario.matterId,
        metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER },
      });
    }
    return {
      firm: { ...firm, status: "active" },
      office,
      membership,
      role,
      replayed: false,
      demoScenario: demoScenario ?? null,
    };
  });
}
