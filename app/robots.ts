import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "https://yomitori.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/documents",
        "/master-data",
        "/reminders",
        "/setup",
        "/tasks",
        "/team",
        "/unprocessed",
        "/usage",
        "/audit-logs",
      ],
    },
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
