import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  serverExternalPackages: ["@sidan-lab/whisky-js-nodejs"],
};

export default nextConfig;
