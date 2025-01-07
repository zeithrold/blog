import Image from 'next/image'

export interface ContentCoverProps {
  src?: string
}

export default function ContentCover({ src }: ContentCoverProps) {
  return (
    <Image
      src={src ?? '/sample.jpg'}
      width={400}
      height={400}
      className={`
        h-48 w-full object-cover

        lg:h-[30rem]

        md:h-96

        sm:h-64
      `}
      alt="Cover Image for the article"
    />
  )
}
