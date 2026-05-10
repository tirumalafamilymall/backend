import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Keeping this as per your current setup to prevent build blocks
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // This applies the headers to all your API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Setting to "*" allows both your store and admin panel to connect
          { key: "Access-Control-Allow-Origin", value: "*" }, 
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ]
  }
};

export default nextConfig;