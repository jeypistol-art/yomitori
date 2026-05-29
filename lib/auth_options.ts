import { randomUUID } from "crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { query } from "@/lib/db";
import {
  consumeEmailLoginToken,
  normalizeLoginEmail,
} from "@/lib/email_login_tokens";

async function ensureUserAndDefaultOrganization(args: {
  provider: "google" | "email";
  providerSubject: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const userResult = await query<{ id: string }>(
    `INSERT INTO users (email, name, avatar_url, auth_provider, auth_provider_subject, last_login_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (email)
     DO UPDATE SET
       auth_provider = EXCLUDED.auth_provider,
       auth_provider_subject = EXCLUDED.auth_provider_subject,
       email = EXCLUDED.email,
       name = COALESCE(EXCLUDED.name, users.name),
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       deleted_at = NULL,
       last_login_at = now(),
       updated_at = now()
     RETURNING id`,
    [
      args.email,
      args.name ?? null,
      args.avatarUrl ?? null,
      args.provider,
      args.providerSubject,
    ]
  );

  const userId = userResult.rows[0].id;
  const membership = await query<{ id: string }>(
    `SELECT id
     FROM organization_members
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId]
  );

  if (membership.rows.length === 0) {
    const organizationName = args.email.includes("@")
      ? `${args.email.split("@")[0]}'s Organization`
      : "YOMITORI Organization";
    const org = await query<{ id: string }>(
      `INSERT INTO organizations (name, plan_code, billing_email)
       VALUES ($1, 'personal', $2)
       RETURNING id`,
      [organizationName, args.email]
    );
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES ($1, $2, 'owner', now())`,
      [org.rows[0].id, userId]
    );
  }

  return userId;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "email-link",
      name: "Email Link",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const email = normalizeLoginEmail(credentials?.email);
        const token = String(credentials?.token ?? "");
        const isValid = await consumeEmailLoginToken(email, token);
        if (!isValid) {
          return null;
        }

        const userId = await ensureUserAndDefaultOrganization({
          provider: "email",
          providerSubject: `email:${email}`,
          email,
          name: email.split("@")[0] || email,
          avatarUrl: null,
        });

        return {
          id: userId,
          email,
          name: email.split("@")[0] || email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, profile, user }) {
      if (user?.id) {
        token.accountId = user.id;
      }
      if (profile?.sub && profile?.email) {
        const googleProfile = profile as typeof profile & { picture?: string | null };
        const userId = await ensureUserAndDefaultOrganization({
          provider: "google",
          providerSubject: profile.sub,
          email: profile.email,
          name: profile.name,
          avatarUrl: googleProfile.picture,
        });
        token.accountId = userId;
      }
      if (!token.sessionId) {
        token.sessionId = randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      const accountId = token.accountId as string | undefined;
      if (session.user && accountId) {
        session.user.id = accountId;
      }
      return session;
    },
  },
};
