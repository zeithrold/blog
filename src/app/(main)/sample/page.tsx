import type { User } from '@clerk/nextjs/server'
import { ArticleCard } from '@/components/blog/article-card'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const sampleContent = 'Reinforcement learning (RL) is an interdisciplinary area of machine learning and optimal control concerned with how an intelligent agent should take actions in a dynamic environment in order to maximize a reward signal. Reinforcement learning is one of the three basic machine learning paradigms, alongside supervised learning and unsupervised learning.'

function SamplePost({ user }: { user: User }) {
  return (
    <ArticleCard
      title="Sample Article"
      content={sampleContent}
      authors={[{
        name: user.fullName ?? user.username!,
        username: user.username!,
        avatar: user.imageUrl,
      }, {
        name: user.fullName ?? user.username!,
        username: user.username!,
        avatar: user.imageUrl,
      }, {
        name: user.fullName ?? user.username!,
        username: user.username!,
        avatar: user.imageUrl,
      }]}
      slug="sample-article"
    />
  )
}

export default async function SamplePage() {
  const user = await currentUser()
  if (!user) {
    return redirect('/')
  }
  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-5xl font-bold">Sample</h1>
      <div className={`
        container grid grid-cols-1 gap-4 p-4

        lg:grid-cols-3 lg:gap-8

        md:grid-cols-2 md:gap-6
      `}
      >
        <SamplePost user={user} />
        <SamplePost user={user} />
      </div>
    </div>
  )
}
