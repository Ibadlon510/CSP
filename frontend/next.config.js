/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      { source: "/dashboard/entities/new", destination: "/dashboard/contacts/new", permanent: true },
      { source: "/dashboard/entities/:id", destination: "/dashboard/contacts/:id", permanent: true },
      { source: "/dashboard/entities", destination: "/dashboard/contacts", permanent: true },
    ];
  },
};

module.exports = nextConfig;
