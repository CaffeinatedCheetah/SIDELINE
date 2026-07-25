import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DIRECT_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().default("FanTakes <no-reply@example.test>"),
  ENABLE_DEV_AUTH: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
  SPORTS_API_BASE_URL: z.union([z.literal(""), z.string().url()]).optional(),
  SPORTS_API_KEY: z.string().optional(),
  ALLOW_PREVIEW_SEED: z.enum(["true", "false"]).default("false"),
});

export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  // Block dev auth in Vercel Production (VERCEL_ENV is set by Vercel itself,
  // not user-configurable). Also block when NODE_ENV is "production" and we're
  // NOT on a Vercel Preview — covers non-Vercel production hosts.
  const isVercelProduction = process.env.VERCEL_ENV === "production";
  const isNonVercelProduction =
    process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV;
  if (
    (isVercelProduction || isNonVercelProduction) &&
    result.data.ENABLE_DEV_AUTH === "true"
  )
    throw new Error("ENABLE_DEV_AUTH must be false in production.");
  if (
    Boolean(result.data.AUTH_GOOGLE_ID) !==
    Boolean(result.data.AUTH_GOOGLE_SECRET)
  )
    throw new Error("Both Google OAuth variables must be supplied together.");
  return result.data;
}
