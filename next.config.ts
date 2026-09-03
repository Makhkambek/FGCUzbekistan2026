import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers that cost nothing on a LAN deployment. Deliberately no HSTS:
  // the scoring laptop serves plain HTTP to the hall (see README), and HSTS
  // would force every referee's browser to HTTPS mid-tournament.
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
