import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000"

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            { source: "/media/:path*", destination: `${apiBase}/media/:path*` },
        ]
    },
    images: {
        remotePatterns: [
            {
                protocol: "http",
                hostname: "localhost",
                port: "3000",
                pathname: "/media/**",
            },
        ],
    },
};
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
