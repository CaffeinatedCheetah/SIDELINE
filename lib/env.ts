import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().default("FanTakes <no-reply@example.test>"),
  ENABLE_DEV_AUTH: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  if (
    process.env.NODE_ENV === "production" &&
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
