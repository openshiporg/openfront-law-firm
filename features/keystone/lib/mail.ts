// Internal Keystone mail helper, not a public Next Server Action.
import { createTransport } from "nodemailer";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  
  throw new Error('Email link origin is not configured.');
}

function passwordResetEmail({ url, heading, action, footnote }: { url: string; heading: string; action: string; footnote: string }): string {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";

  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            ${heading}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">${action}</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            ${footnote}
          </td>
        </tr>
      </table>
    </body>
  `;
}

export type PasswordResetPurpose = "staff" | "customer";

type ResetPurposeClient = {
  user: { findUnique(args: unknown): Promise<{ bootstrapKey?: string | null; firmMemberships?: unknown[] } | null> };
};

/**
 * The reset link follows the account, never the caller: an identity with any
 * firm membership or the bootstrap key is staff (dashboard reset); every other
 * account is a storefront customer (/account/reset).
 */
export async function passwordResetPurpose(prisma: ResetPurposeClient, userId: string): Promise<PasswordResetPurpose> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bootstrapKey: true, firmMemberships: { select: { id: true }, take: 1 } },
  });
  return !user || user.bootstrapKey || user.firmMemberships?.length ? "staff" : "customer";
}

export type PasswordEmailKind = "invite" | "reset";

type PasswordEmailClient = {
  user: { findUnique(args: unknown): Promise<{ firmMemberships?: Array<{ status?: string | null; firm?: { name?: string | null; displayName?: string | null } | null }> } | null> };
  firm: { findMany(args: unknown): Promise<Array<{ name?: string | null; displayName?: string | null }>> };
};

/**
 * Wording for the password email. An account whose firm membership is still
 * "invited" is setting up its first sign-in; everyone else is resetting. The
 * firm name is the one set in Store Settings: the account's own firm, else the
 * single active firm, else no name at all (never a hard-coded brand).
 */
export async function passwordEmailWording(prisma: PasswordEmailClient, userId: string): Promise<{ kind: PasswordEmailKind; firmName: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firmMemberships: { select: { status: true, firm: { select: { name: true, displayName: true } } } } },
  });
  const memberships = user?.firmMemberships ?? [];
  const kind: PasswordEmailKind = memberships.length > 0 && memberships.every((m) => m.status === "invited") ? "invite" : "reset";
  const named = (f?: { name?: string | null; displayName?: string | null } | null) => f?.name?.trim() || f?.displayName?.trim() || null;
  let firmName = memberships.map((m) => named(m.firm)).find(Boolean) ?? null;
  if (!firmName) {
    const firms = await prisma.firm.findMany({ where: { status: { equals: "active" } }, take: 2, select: { name: true, displayName: true } });
    firmName = firms.length === 1 ? named(firms[0]) : null;
  }
  return { kind, firmName };
}

export function passwordEmailCopy(kind: PasswordEmailKind, firmName: string | null) {
  if (kind === "invite") {
    return {
      subject: firmName ? `Set up your ${firmName} sign-in` : "Set up your sign-in",
      heading: firmName ? `You have been invited to the ${firmName} workspace. Choose a password to finish setting up your sign-in.` : "Choose a password to finish setting up your sign-in.",
      action: "Set up sign-in",
      footnote: "If you were not expecting this invitation you can ignore this email.",
    };
  }
  return {
    subject: firmName ? `Reset your ${firmName} password` : "Reset your password",
    heading: "Use the button below to choose a new password.",
    action: "Reset password",
    footnote: "If you did not ask to reset your password you can ignore this email.",
  };
}

const resetPaths: Record<PasswordResetPurpose, string> = { staff: "/dashboard/reset", customer: "/account/reset" };

export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string, purpose: PasswordResetPurpose = "staff", wording: { kind: PasswordEmailKind; firmName: string | null } = { kind: "reset", firmName: null }): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Email delivery is not configured.');
  }
  if (to.length > 254 || !/^[^\s@<>,;()]+@[^\s@<>,;()]+\.[^\s@<>,;()]+$/.test(to)) {
    throw new Error('A single valid recipient is required.');
  }
  const origin = new URL(baseUrl || getBaseUrlForEmails());
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Email link origin is invalid.');
  const resetUrl = new URL(resetPaths[purpose], origin.origin);
  resetUrl.searchParams.set('token', resetToken);
  const transport = createTransport({ host, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const copy = passwordEmailCopy(wording.kind, wording.firmName);
  await transport.sendMail({
    to,
    from,
    subject: copy.subject,
    html: passwordResetEmail({ url: resetUrl.href, heading: copy.heading, action: copy.action, footnote: copy.footnote }),
  });
}
/** One-use portal sign-in link for a returning client (portal-scoped; never staff). */
export async function sendPortalSignInEmail(signInToken: string, to: string, baseUrl?: string): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Email delivery is not configured.');
  }
  if (to.length > 254 || !/^[^\s@<>,;()]+@[^\s@<>,;()]+\.[^\s@<>,;()]+$/.test(to)) {
    throw new Error('A single valid recipient is required.');
  }
  const origin = new URL(baseUrl || getBaseUrlForEmails());
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Email link origin is invalid.');
  const signInUrl = new URL('/portal/signin', origin.origin);
  signInUrl.searchParams.set('token', signInToken);
  const transport = createTransport({ host, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({
    to,
    from,
    subject: "Your client portal sign-in link",
    html: passwordResetEmail({ url: signInUrl.href, heading: 'Use this one-time link within 15 minutes to open your client portal', action: 'Open client portal', footnote: 'If you did not request this email you can safely ignore it.' }),
  });
}

/**
 * Whether outbound email can be sent: the same SMTP host, sender, port and link-origin
 * checks the senders above apply. Returns only a boolean; never exposes the values.
 */
export function isEmailDeliveryConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) return false;
  try {
    const origin = new URL(getBaseUrlForEmails());
    return ['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password;
  } catch {
    return false;
  }
}

/** One-time client portal invitation link (portal-scoped; never staff). */
export async function sendPortalInvitationEmail(inviteToken: string, to: string, baseUrl?: string): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Email delivery is not configured.');
  }
  if (to.length > 254 || !/^[^\s@<>,;()]+@[^\s@<>,;()]+\.[^\s@<>,;()]+$/.test(to)) {
    throw new Error('A single valid recipient is required.');
  }
  const origin = new URL(baseUrl || getBaseUrlForEmails());
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Email link origin is invalid.');
  const acceptUrl = new URL('/portal/accept', origin.origin);
  acceptUrl.searchParams.set('token', inviteToken);
  const transport = createTransport({ host, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({
    to,
    from,
    subject: "You're invited to your client portal",
    html: passwordResetEmail({ url: acceptUrl.href, heading: 'Your law firm invited you to its client portal. Use this one-time link to accept', action: 'Open client portal', footnote: 'If you were not expecting this invitation you can safely ignore it.' }),
  });
}
