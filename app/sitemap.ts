import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    "",
    "/leagues",
    "/teams",
    "/games",
    "/debates",
    "/communities",
    "/hall-of-flame",
    "/help",
    "/guidelines",
    "/terms",
    "/privacy",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "daily" : ("weekly" as const),
  }));
}
