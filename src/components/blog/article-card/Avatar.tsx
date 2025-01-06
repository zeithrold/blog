import Image from 'next/image'

export interface AvatarProps {
  src: string
}

export default function Avatar({ src }: AvatarProps) {
  return (
    <div className="avatar">
      <div className="w-4 rounded-full">
        <Image
          src={src}
          alt="Avatar"
          width={100}
          height={100}
        />
      </div>
    </div>
  )
}
