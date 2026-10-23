// Internal Keystone mail helper, not a public Next Server Action.
import { createTransport } from "nodemailer";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  
  throw new Error('Email link origin is not configured.');
}

function passwordResetEmail({ url }: { url: string }): string {
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
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
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

const resetPaths: Record<PasswordResetPurpose, string> = { staff: "/dashboard/reset", customer: "/account/reset" };

export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string, purpose: PasswordResetPurpose = "staff"): Promise<void> {
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
  await transport.sendMail({
    to,
    from,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: resetUrl.href,
    }),
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
    html: passwordResetEmail({ url: signInUrl.href }).replace('Please click below to reset your password', 'Use this one-time link within 15 minutes to open your client portal').replace('>Reset Password<', '>Open client portal<'),
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
    html: passwordResetEmail({ url: acceptUrl.href }).replace('Please click below to reset your password', 'Your law firm invited you to its client portal. Use this one-time link to accept').replace('>Reset Password<', '>Open client portal<').replace('If you did not request this email you can safely ignore it.', 'If you were not expecting this invitation you can safely ignore it.'),
  });
}
