import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "https://yomitori.org";

const publicPaths = [
  "/",
  "/enterprise/contact",
  "/legal/privacy",
  "/legal/specified-commercial-transactions",
  "/legal/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const lastModified = new Date();

  return publicPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
