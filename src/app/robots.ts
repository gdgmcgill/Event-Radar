import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/admin-login"],
    },
    sitemap: "https://uni-verse.vercel.app/sitemap.xml",
  };
}
