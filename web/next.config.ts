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
    // Pages get X-Robots-Tag from the proxy, per host (P6.2): the landing hosts' public pages may open for indexing,
    // everything else stays closed. API routes never pass the proxy, so they are closed here.
    return [{
      source: '/:path*',
      headers: [
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      ],
    }, {
      source: '/api/:path*',
      headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}],
    }];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
