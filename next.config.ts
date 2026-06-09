import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    DIRECTUS_STATIC_TOKEN: process.env.DIRECTUS_STATIC_TOKEN || "",
  },
  allowedDevOrigins: ['msi-andrie', 'msi-jake', '100.81.225.79', '100.124.104.46', 'msi-eulysis', "100.119.3.44", "100.114.249.96", "192.168.10.176"],
};

export default nextConfig;