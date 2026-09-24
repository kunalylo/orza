/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Request-body limits for API routes are enforced in code (src/lib/http.ts → readBodyText / parseBody):
  // Next's `serverActions.bodySizeLimit` only applies to Server Actions, which ÖRZA doesn't use.
  // Also cap bodies at the reverse proxy (e.g. nginx `client_max_body_size 12m`).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
