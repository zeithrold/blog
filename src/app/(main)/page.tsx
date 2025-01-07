import { Hero, Pagination } from '@/components/list'
import { SampleCard, SampleFeaturedCarousel } from '@/components/sample'

export default async function IndexPage() {
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <Hero />
      <SampleFeaturedCarousel />
      <h1 className="text-3xl font-bold">More Posts</h1>
      <div className={`
        container grid grid-cols-1 gap-4 p-4

        lg:gap-8

        md:grid-cols-2 md:gap-6

        xl:grid-cols-3
      `}
      >
        <SampleCard featured />
        <SampleCard />
        <SampleCard />
        <SampleCard />
        <SampleCard />
        <SampleCard />
      </div>
      <Pagination pageCount={10} currentPage={1} />
    </div>
  )
}
