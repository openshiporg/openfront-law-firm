import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import { statelessSessions } from "@keystone-6/core/session";
import "dotenv/config";

import { permissions } from "./access";
import { passwordEmailWording, passwordResetPurpose, sendPasswordResetEmail } from "./lib/mail";
import { models } from "./models";
import { permissionKeys } from "./access";
import { extendGraphqlSchema } from "./mutations";
import { s3ForcePathStyle } from "./lib/s3-storage";
import { pooledDatabaseUrl } from './database-url';

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

function runtimeEnvironment(name: "DATABASE_URL" | "SESSION_SECRET", buildFallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production" && !isProductionBuild) {
    throw new Error(`${name} is required in production.`);
  }
  return buildFallback;
}

const databaseURL = runtimeEnvironment(
  "DATABASE_URL",
  "postgresql://localhost/openfront_law_firm_build",
);

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: runtimeEnvironment(
    "SESSION_SECRET",
    "local-build-only-session-secret-do-not-deploy",
  ),
};

const initialPermissions = Object.fromEntries(
  permissionKeys.map((permission) => [permission, true]),
);

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      bootstrapKey: "openfront-law-firm-initial-user",
      status: "active",
      bootstrapRole: {
        create: {
          name: "Bootstrap administrator",
          status: "active",
          ...initialPermissions,
        },
      },
    },
  },
  passwordResetLink: {
    // Staff (any firm membership or the bootstrap principal) recover on the dashboard;
    // storefront customers recover on /account/reset.
    async sendToken({ itemId, identity, token, context }) {
      const prisma = context.sudo().prisma;
      const purpose = await passwordResetPurpose(prisma, String(itemId));
      const wording = await passwordEmailWording(prisma, String(itemId)).catch(() => ({ kind: "reset" as const, firmName: null }));
      await sendPasswordResetEmail(token, identity, undefined, purpose, wording);
    },
  },
  sessionData: `
    name
    email
    status
    activeFirm { id name displayName shortName brandTagline brandColor supportEmail status }
    role: bootstrapRole {
      id
      name
      status
      firm { id }
      ${permissionKeys.join("\n")}
    }
    firmMemberships {
      id
      status
      firm { id }
      role {
        id
        name
        status
        firm { id }
        ${permissionKeys.join("\n")}
      }
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(databaseURL),
    },
    lists: models,
    // Uploaded images (attorney portraits) share the deployment's S3_* bucket with document files.
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName: process.env.S3_BUCKET_NAME ?? "keystone-test",
        region: process.env.S3_REGION ?? "us-east-1",
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "keystone",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "keystone",
        endpoint: process.env.S3_ENDPOINT ?? "https://sfo3.digitaloceanspaces.com",
        signed: { expiry: 5000 },
        forcePathStyle: s3ForcePathStyle(process.env.S3_ENDPOINT),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session }),
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      debug: false,
      playground: false,
      apolloConfig: {
        introspection: false,
        includeStacktraceInErrorResponses: false,
      },
      extendGraphqlSchema,
    },
  }),
);
