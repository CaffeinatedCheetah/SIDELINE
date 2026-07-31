import { z } from "zod";

const plainText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) => !/<\/?[a-z][\s\S]*>/i.test(value),
      "HTML is not allowed",
    );

export const gameRecapSchema = z
  .object({
    schemaVersion: z.literal("1"),
    headline: plainText(120),
    dek: plainText(220),
    summary: plainText(1200),
    keyMoments: z
      .array(
        z
          .object({
            momentId: z.string().uuid(),
            label: plainText(100),
            description: plainText(300),
            importance: z.enum(["high", "medium", "low"]),
          })
          .strict(),
      )
      .max(5),
    fanConversation: z
      .object({
        summary: plainText(500).nullable(),
        themes: z.array(plainText(100)).max(4),
      })
      .strict(),
    caveats: z.array(plainText(180)).max(4),
  })
  .strict();

export type GameRecap = z.infer<typeof gameRecapSchema>;
export const GAME_RECAP_SCHEMA_VERSION = "1";
