import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const s3MediaBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL;

const s3RemotePattern = (() => {
  if (!s3MediaBase) return null;
  try {
    const url = new URL(s3MediaBase);
    return {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port,
      pathname: '/**',
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [...(s3RemotePattern ? [s3RemotePattern] : [])],
    dangerouslyAllowLocalIP: true,
  },
};
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
