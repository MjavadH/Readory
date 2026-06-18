import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000"
const mediaImageHost = process.env.NEXT_PUBLIC_MEDIA_IMAGE_HOST ?? "localhost"
const mediaImagePort = process.env.NEXT_PUBLIC_MEDIA_IMAGE_PORT ?? "3000"
const mediaImageProtocol = process.env.NEXT_PUBLIC_MEDIA_IMAGE_PROTOCOL ?? "http"

const nextConfig: NextConfig = {
    output: 'standalone',
    async rewrites() {
        return [
            { source: "/media/:path*", destination: `${apiBase}/media/:path*` },
        ]
    },
    images: {
        remotePatterns: [
            {
                protocol: mediaImageProtocol as "http" | "https",
                hostname: mediaImageHost,
                port: mediaImagePort,
                pathname: "/media/**",
            },
        ],
    },
};
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
