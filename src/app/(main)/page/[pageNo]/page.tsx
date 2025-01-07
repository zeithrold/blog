import { Pagination } from '@/components/list'
import { SampleCard } from '@/components/sample'
import { notFound, redirect } from 'next/navigation'

export default async function PageBrowser({ params }: {
  params: Promise<{ pageNo: string }>
}) {
  const { pageNo } = await params
  const no = Number.parseInt(pageNo, 10)
  if (no === 1) {
    return redirect('/')
  }
  if (Number.isNaN(no) || no < 1) {
    return notFound()
  }
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div className="container flex w-full flex-col p-4">
        <div className="flex flex-col gap-2 text-3xl font-bold">
          <h1>
            Page
            {' '}
            {no}
          </h1>
        </div>
      </div>
      <div className={`
        container grid grid-cols-1 gap-4 p-4

        lg:gap-8

        md:grid-cols-2 md:gap-6

        xl:grid-cols-3
      `}
      >
        <SampleCard />
        <SampleCard />
        <SampleCard />
        <SampleCard />
        <SampleCard />
        <SampleCard />
      </div>
      <Pagination pageCount={10} currentPage={no} />
    </div>
  )
}
