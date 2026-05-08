import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@psms/shared"],
  async headers() {
    const credentialTokenHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate",
      },
      {
        key: "Pragma",
        value: "no-cache",
      },
      {
        key: "Expires",
        value: "0",
      },
      {
        key: "Referrer-Policy",
        value: "no-referrer",
      },
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow",
      },
    ];

    return [
      {
        source: "/staff-activation",
        headers: credentialTokenHeaders,
      },
      {
        source: "/password-reset",
        headers: credentialTokenHeaders,
      },
    ];
  },
};

export default nextConfig;
