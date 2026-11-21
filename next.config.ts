import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "bcryptjs"],
  outputFileTracingIncludes: {
    "/api/extractos/[id]/pdf": [
      "./assets/fonts/**/*",
      "./public/brand/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
    "/api/comprobantes/[kind]/[id]": [
      "./assets/fonts/**/*",
      "./public/brand/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default nextConfig;
