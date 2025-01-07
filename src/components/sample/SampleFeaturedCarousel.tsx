'use client'

import { type FeaturedCardProps, FeaturedCarousel } from '@/components/list/featured-carousel'

const sampleContent = 'Reinforcement learning (RL) is an interdisciplinary area of machine learning and optimal control concerned with how an intelligent agent should take actions in a dynamic environment in order to maximize a reward signal. Reinforcement learning is one of the three basic machine learning paradigms, alongside supervised learning and unsupervised learning.'
const sampleAvatar = 'https://www.gravatar.com/avatar/87cf64b6bc54e4d82940c9fa41f7e3fd036064bdffc1189163b681d50531785b'
const sampleAuthor = {
  name: 'Zeithrold',
  username: 'zeithrold',
  avatar: sampleAvatar,
}
const sampleDate = new Date('2022-01-01')

const features: FeaturedCardProps[] = Array.from({ length: 5 }, (_, i) => ({
  slug: `sample-${i}`,
  title: 'Sample 1',
  content: sampleContent,
  image: '/sample.jpg',
  authors: [sampleAuthor, sampleAuthor, sampleAuthor],
  date: sampleDate,
}))

export default function SampleFeaturedCarousel() {
  return (
    <FeaturedCarousel
      features={features}
    />
  )
}
