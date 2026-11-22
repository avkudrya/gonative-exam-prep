import type {MetadataRoute} from 'next';

// Closed to crawlers until the owner explicitly opens launch indexing.
export default function robots(): MetadataRoute.Robots {
  return {rules: {userAgent: '*', disallow: '/'}};
}
