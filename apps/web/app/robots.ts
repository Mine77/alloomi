import type { MetadataRoute } from "next";
import { siteMetadata } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const appUrl = siteMetadata.siteUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    host: new URL(appUrl).host,
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
