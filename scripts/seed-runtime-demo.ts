/* eslint-disable @typescript-eslint/no-explicit-any */
import { keystoneContext } from "../features/keystone/context";
import { permissionKeys, type Session } from "../features/keystone/access";
import { loadActiveHumanSession } from "../features/keystone/lib/machine-auth";
import { prismaWithoutGraphQLErrorConversion } from "../features/keystone/lib/transactions";
import { completeFirmOnboarding } from "../features/keystone/mutations/onboarding";
import { seedSyntheticDemoScenario } from "../features/keystone/mutations/syntheticScenario";
import { assertMaintainedMigrationTarget } from "./deploy-maintained-migrations";
import { requireOwnedOfflineDatabase } from "../features/keystone/lib/local-fixture";

const ADMIN_EMAIL = "law-firm@openship.org";
const DEMO_BRAND = {
  name: "Harbor & Pine",
  displayName: "Harbor & Pine",
  shortName: "Harbor & Pine",
  brandTagline: "Fictional local workspace · no legal services",
  brandColor: "#1f4d46",
  supportEmail: "office@example.invalid",
};
const prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma) as any;

function bootstrapSession(user: any, role: any): Session {
  return {
    itemId: user.id,
    listKey: "User",
    authenticationType: "human",
    machineScopes: [],
    data: {
      name: user.name,
      status: "active",
      activeFirm: null,
      role: { ...role, firm: null },
      firmMemberships: [],
    },
  };
}

async function ensureAdministrator() {
  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (user) return user;
  if (await prisma.user.count()) {
    throw new Error("Local demo administrator is absent but other users exist; refusing implicit account creation.");
  }
  const role = await prisma.role.create({
    data: {
      name: "Bootstrap administrator",
      status: "active",
      ...Object.fromEntries(permissionKeys.map((permission) => [permission, true])),
    },
  });
  user = await keystoneContext.sudo().db.User.createOne({
    data: {
      name: "Local Law Firm Administrator",
      email: ADMIN_EMAIL,
      password: "Helloworld123",
      bootstrapKey: "openfront-law-firm-initial-user",
      status: "active",
      bootstrapRole: { connect: { id: role.id } },
    },
  });
  return user;
}

async function ensureOnboarding(user: any) {
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    include: { bootstrapRole: true, activeFirm: true },
  });
  if (current.activeFirmId) {
    if (current.activeFirm?.slug === "openfront-law-firm-demo" || current.activeFirm?.slug === "harbor-pine-legal") {
      current.activeFirm = await prisma.firm.update({
        where: { id: current.activeFirmId },
        data: { ...DEMO_BRAND, slug: "harbor-pine-legal" },
      });
    }
    const session = await loadActiveHumanSession(prisma, current.id, current.activeFirmId);
    if (!session) throw new Error("Local runtime administrator lacks an active firm membership.");
    return { session, firm: current.activeFirm };
  }
  const session = bootstrapSession(current, current.bootstrapRole);
  const onboardingContext = keystoneContext.withSession(session as any);
  const result = await completeFirmOnboarding(null, {
    firmName: DEMO_BRAND.name,
    firmSlug: "harbor-pine-legal",
    firmDisplayName: DEMO_BRAND.displayName,
    firmShortName: DEMO_BRAND.shortName,
    brandTagline: DEMO_BRAND.brandTagline,
    brandColor: DEMO_BRAND.brandColor,
    supportEmail: DEMO_BRAND.supportEmail,
    officeName: "Demo office",
    officeCode: "DEMO",
    timezone: "UTC",
    currencyCode: "USD",
    practiceAreaName: "General Practice",
    seedSyntheticDemo: process.env.RUN_OWNED_DATABASE_TESTS === "1",
  }, onboardingContext);
  const activeSession = await loadActiveHumanSession(prisma, current.id, result.firm.id);
  if (!activeSession) throw new Error("Onboarding did not establish an active administrator session.");
  return { session: activeSession, firm: result.firm };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const parsed = databaseUrl ? new URL(databaseUrl) : null;
  const databaseName = parsed?.pathname.slice(1) ?? "";
  const isMaintained = process.env.ALLOW_LOCAL_DEMO_SEED === "runtime_law_firm";
  const isDisposable = process.env.ALLOW_EPHEMERAL_COMPLETE_RUNTIME === "1"
    && parsed
    && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    && databaseName.startsWith("law_firm_complete_verify_");
  const isOwned = process.env.RUN_OWNED_DATABASE_TESTS === "1";
  if (isOwned) await requireOwnedOfflineDatabase(prisma);
  if (!isMaintained && !isDisposable && !isOwned) {
    throw new Error("Synthetic seed requires exact maintained authorization or a loopback law_firm_complete_verify database.");
  }
  if (isMaintained) {
    assertMaintainedMigrationTarget({
      databaseUrl,
      confirmation: process.env.MIGRATION_CONFIRM_DATABASE,
    });
  }
  const user = await ensureAdministrator();
  const { session, firm } = await ensureOnboarding(user);
  // The demo matter scenario is created through the authenticated,
  // server-authoritative onboarding API (never raw fixture writes).
  const scenario = await seedSyntheticDemoScenario(
    null,
    { synthetic: true },
    keystoneContext.withSession(session as any),
  );
  console.log(JSON.stringify({
    administratorEmail: ADMIN_EMAIL,
    firmId: firm.id,
    activeFirmId: session.data.activeFirm?.id,
    contactId: scenario.contactId,
    matterId: scenario.matterId,
    conflictCheckId: scenario.conflictCheckId,
    invoiceId: scenario.invoiceId,
    paymentId: scenario.paymentId,
    synthetic: true,
  }));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
