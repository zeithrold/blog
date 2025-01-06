import type { LayoutProps } from '@/types'

export default function SingleComponent({ children }: LayoutProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      {children}
    </div>
  )
}
