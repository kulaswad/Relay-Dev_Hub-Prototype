/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
    outputFileTracingIncludes: {
      "/**": ["./relay.db"],
    },
  },
  reactStrictMode: true,
};

export default nextConfig;
