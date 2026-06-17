/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verification builds write to a separate dir so they never corrupt the
  // running dev server's `.next` cache. Set NEXT_VERIFY=1 for build/typecheck.
  distDir: process.env.NEXT_VERIFY ? ".next-verify" : ".next",
};

export default nextConfig;
