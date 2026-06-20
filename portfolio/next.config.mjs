/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Lint runs separately (CI / `npm run lint`); don't fail production builds on
  // ESLint errors. TypeScript type-checking still runs and will fail the build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
