import type { TagType } from '../meta'
import { PostCard } from '@/components/list/post-card'

const sampleContent = 'Reinforcement learning (RL) is an interdisciplinary area of machine learning and optimal control concerned with how an intelligent agent should take actions in a dynamic environment in order to maximize a reward signal. Reinforcement learning is one of the three basic machine learning paradigms, alongside supervised learning and unsupervised learning.'
const sampleAvatar = 'https://www.gravatar.com/avatar/87cf64b6bc54e4d82940c9fa41f7e3fd036064bdffc1189163b681d50531785b'
const sampleAuthor = {
  name: 'Zeithrold',
  username: 'zeithrold',
  avatar: sampleAvatar,
}
const sampleTags: TagType[] = [{
  name: 'Machine Learning',
  slug: 'machine-learning',
  color: '#FFD700',
}, {
  name: 'Reinforcement Learning',
  slug: 'reinforcement-learning',
  color: '#FF4500',
}, {
  name: 'Deep Learning',
  slug: 'deep-learning',
  color: '#0000FF',
}]
const sampleDate = new Date('2022-01-01')

export interface SampleCardProps {
  featured?: boolean
}

export default function SampleCard({ featured }: SampleCardProps) {
  return (
    <PostCard
      title="Sample Article"
      featured={featured}
      content={sampleContent}
      authors={[sampleAuthor, sampleAuthor, sampleAuthor]}
      slug="sample-article"
      date={sampleDate}
      tags={sampleTags}
    />
  )
}
