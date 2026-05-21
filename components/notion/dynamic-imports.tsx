'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

export const Code = dynamic(async () => {
  const mod = await import('react-notion-x/third-party/code')
  return mod.Code
})

export const Collection = dynamic(async () => {
  const mod = await import('react-notion-x/third-party/collection')
  return mod.Collection
})

export const Equation = dynamic(async () => {
  const mod = await import('react-notion-x/third-party/equation')
  return mod.Equation
})

export const Pdf = dynamic(async () => {
  const mod = await import('react-notion-x/third-party/pdf')
  return mod.Pdf
})

export const Modal = dynamic(async () => {
  const mod = await import('react-notion-x/third-party/modal')
  return mod.Modal as ComponentType<Record<string, unknown>>
})
