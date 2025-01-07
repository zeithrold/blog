import { humanTime } from '@/lib/helper'
import { BiTime } from 'react-icons/bi'

export interface DateInfoProps {
  date: Date
  mode?: 'full' | 'compact'
}

export default function DateInfo({ date, mode = 'compact' }: DateInfoProps) {
  return (
    <div className={`
      flex w-full

      ${mode === 'compact' ? 'text-sm' : ''}

      items-center gap-2 text-gray-600
    `}
    >
      <BiTime className={`
        ${mode === 'full' ? 'text-lg' : ''}
      `}
      />
      <time
        dateTime={date.toISOString()}
        className="flex-1"
      >
        {humanTime(date, mode)}
      </time>
    </div>
  )
}
