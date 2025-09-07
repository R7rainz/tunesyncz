/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your configuration here
  eslint: {
    ignoreDuringBuilds: true, // Optional: if you want to ignore ESLint during builds
  },
  typescript: {
    ignoreBuildErrors: true, // Optional: if you have TypeScript errors
  },
};

export default nextConfig;
