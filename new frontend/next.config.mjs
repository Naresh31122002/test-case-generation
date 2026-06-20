/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_VERIFY ? ".next-verify" : ".next",

  // Production: standalone output + basePath for VPS deployment at /app
  // Dev: no basePath (runs at localhost:3000)
  ...(process.env.NODE_ENV === "production"
    ? {
        output: "standalone",
        basePath: "/app",
        images: { unoptimized: true },
      }
    : {}),

  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
