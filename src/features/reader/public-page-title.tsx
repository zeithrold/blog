import type { ComponentProps, ReactNode } from 'react'

const titleClass = [
  'm-0 font-serif font-medium tracking-[-.035em] leading-[1.2] text-balance wrap-anywhere',
  '[html:lang(zh-CN)_&]:tracking-[-.02em] [html:lang(zh-CN)_&]:leading-[1.35]',
].join(' ')

const sizes = {
  section: 'text-[length:40px] max-[701px]:text-[length:32px]',
  utility: 'text-[length:32px] max-[701px]:text-[length:26px]',
}

export function PublicPageTitle({
  variant = 'section',
  className = '',
  ...props
}: ComponentProps<'h1'> & { variant?: keyof typeof sizes }): ReactNode {
  return (
    <h1
      className={[
        titleClass,
        sizes[variant],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
