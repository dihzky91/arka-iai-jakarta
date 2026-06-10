import type { NextConfig } from "next";

function parseOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const envServerActionOrigins = parseOrigins(
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS,
);
const envAllowedDevOrigins = parseOrigins(process.env.NEXT_ALLOWED_DEV_ORIGINS);
const defaultDevTunnelOrigins =
  process.env.NODE_ENV === "development"
    ? ["*.devtunnels.ms", "localhost:6700"]
    : [];
const serverActionsAllowedOrigins = Array.from(
  new Set([...defaultDevTunnelOrigins, ...envServerActionOrigins]),
);
const allowedDevOrigins = Array.from(
  new Set([...defaultDevTunnelOrigins, ...envAllowedDevOrigins]),
);

const nextConfig: NextConfig = {
  // @react-pdf/renderer perlu dijalankan di server saja (tidak di-bundle client)
  serverExternalPackages: ["@react-pdf/renderer", "qrcode"],


  // Aktifkan strict mode React
  reactStrictMode: true,

  // Untuk akses via reverse proxy/port-forward (mis. devtunnels).
  experimental: {
    serverActions: {
      allowedOrigins: serverActionsAllowedOrigins,
      bodySizeLimit: "10mb",
    },
  },

  // Allow cross-origin requests ke dev server dari origin tepercaya.
  allowedDevOrigins,
};

export default nextConfig;
