import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { z } from "zod";

import { db } from "@/lib/db/client";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (process.env.EMAIL_SERVER) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  );
}

if (
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_AUTH === "true"
) {
  providers.push(
    Credentials({
      id: "development",
      name: "Development account",
      credentials: { email: { label: "Demo email", type: "email" } },
      authorize: async (credentials) => {
        const parsed = z
          .object({ email: z.string().email() })
          .safeParse(credentials);
        if (!parsed.success || !parsed.data.email.endsWith("@fantakes.local"))
          return null;
        return db.user.findUnique({ where: { email: parsed.data.email } });
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/sign-in", error: "/auth/error" },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) session.user.id = String(token.userId ?? token.sub);
      return session;
    },
  },
});
