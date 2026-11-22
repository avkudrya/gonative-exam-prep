import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@gonative/exam-domain'],
  // The shared package uses NodeNext-style './x.js' imports for its TypeScript sources.
  webpack(config) {
    config.resolve.extensionAlias = {'.js': ['.ts', '.tsx', '.js']};
    return config;
  },
  async headers() {
    // Closed to crawlers until the owner opens launch indexing (Phase 6).
    return [{
      source: '/:path*',
      headers: [
        {key: 'X-Robots-Tag', value: 'noindex, nofollow'},
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      ],
    }];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
