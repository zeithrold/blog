<script lang="ts" setup>
import type { PartialSelectResponse } from '#shared/types/list'
import { cn } from '~/lib/utils'

const { color, name } = defineProps<PartialSelectResponse>()

/**
 * 获取标签样式类
 * @param color - 标签颜色
 * @returns 样式类字符串
 */
function getTagClasses(color: string) {
  const baseClasses = 'rounded-md px-2 py-1 text-sm inline-block border'

  const colorMap: Record<string, string> = {
    default: 'text-foreground bg-foreground/5 border-foreground/10',
    gray: 'text-muted-foreground bg-gray-50 border-gray-100',
    brown: 'text-amber-700 bg-amber-50 border-amber-100',
    orange: 'text-orange-500 bg-orange-50 border-orange-100',
    yellow: 'text-yellow-500 bg-yellow-50 border-yellow-100',
    green: 'text-green-500 bg-green-50 border-green-100',
    blue: 'text-blue-500 bg-blue-50 border-blue-100',
    purple: 'text-purple-500 bg-purple-50 border-purple-100',
    pink: 'text-pink-500 bg-pink-50 border-pink-100',
    red: 'text-red-500 bg-red-50 border-red-100',
  }

  return cn(baseClasses, colorMap[color] || colorMap.default)
}
</script>

<template>
  <span :class="getTagClasses(color)">
    #{{ name }}
  </span>
</template>
