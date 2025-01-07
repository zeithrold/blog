import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: 'img.clerk.com',
      pathname: '/**',
    }, {
      protocol: 'https',
      hostname: 'images.unsplash.com',
      pathname: '/photo-**',
    }, {
      protocol: 'https',
      hostname: 'www.gravatar.com',
      pathname: '/avatar/**',
    }],
  },
  // Optionally, add any other Next.js config below
}

const withMDX = createMDX({
  // Add markdown plugins here, as desired
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
