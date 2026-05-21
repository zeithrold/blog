import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.notion.so' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.notion.so' },
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 's3.us-west-2.amazonaws.com' },
    ],
  },
  /**
   *
   */
  async redirects() {
    return [
      {
        source: '/p/:pageId',
        destination: '/-/:pageId',
        permanent: true,
      },
    ]
  },
}

export default nextConfig

void import('@opennextjs/cloudflare').then(async (m) => {
  await m.initOpenNextCloudflareForDev()
})
