import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms', '/support', '/calculator'],
      disallow: [
        '/protocol',
        '/timeline',
        '/health',
        '/journal',
        '/learn',
        '/profile',
        '/admin',
        '/tracker',
        '/game',
        '/api/',
        '/auth/',
        '/share/',
      ],
    },
    sitemap: 'https://www.mypepprotocol.app/sitemap.xml',
  }
}
