import { randomUUID } from "crypto";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { query } from "@/lib/db";

async function ensureUserAndDefaultOrganization(args: {
  providerSubject: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const userResult = await query<{ id: string }>(
    `INSERT INTO users (email, name, avatar_url, auth_provider, auth_provider_subject, last_login_at)
     VALUES ($1, $2, $3, 'google', $4, now())
     ON CONFLICT (auth_provider, auth_provider_subject)
     DO UPDATE SET
       email = EXCLUDED.email,
       name = COALESCE(EXCLUDED.name, users.name),
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       last_login_at = now(),
       updated_at = now()
     RETURNING id`,
    [args.email, args.name ?? null, args.avatarUrl ?? null, args.providerSubject]
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
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.sub && profile?.email) {
        const googleProfile = profile as typeof profile & { picture?: string | null };
        const userId = await ensureUserAndDefaultOrganization({
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
