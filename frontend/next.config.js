/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The bare domain opens straight into the public Tragon Bots lab,
      // rather than the auth-gated platform dashboard.
      { source: "/", destination: "/lab", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
