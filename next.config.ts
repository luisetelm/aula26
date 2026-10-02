import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ninguna página se puede incrustar en otra web (protege la pantalla de permiso del conector).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
