<script setup lang="ts">
import type { RichTextItemResponse } from '@notionhq/client'
import type { HTMLAttributes } from 'vue'
import { Calendar, CircleUser, StickyNote } from 'lucide-vue-next'
import { colorClassMap } from '@/lib/notion'
import { cn } from '~/lib/utils'

// eslint-disable-next-line vue/define-props-destructuring
const props = defineProps<RichTextItemResponse & {
  class?: HTMLAttributes['class']
}>()

const className = computed(() => {
  return {
    [props.class ?? '']: true,
    'rounded-md font-mono px-1 py-0.5 text-sm text-black/50 bg-black/5': props.annotations.code,
    'font-bold': props.annotations.bold,
    'font-italic': props.annotations.italic,
    'line-through': props.annotations.strikethrough,
    'underline': props.annotations.underline,
    [colorClassMap[props.annotations.color]]: true,
  }
})

const href = computed(() => {
  if (props.type !== 'mention' || props.mention.type === 'user') {
    return undefined
  }
  const { mention } = props
  if (mention.type === 'page') {
    return `/-/${mention.page.id}`
  }
  return undefined
})
</script>

<template>
  <span
    v-if="props.type === 'text'"
    :class="cn(className)"
    v-bind="$attrs"
  >
    {{ plain_text }}
  </span>
  <span v-else-if="props.type === 'mention'" class="underline inline-flex items-center gap-1 hover:text-muted-foreground">
    <NuxtLink :to="href" class="inline-flex items-center gap-1">
      <StickyNote v-if="props.mention.type === 'page'" class="w-4 h-4" />
      <Calendar v-if="props.mention.type === 'date'" class="w-4 h-4" />
      <CircleUser v-if="props.mention.type === 'user'" class="w-4 h-4" />
      <span v-if="props.mention.type !== 'user'" :class="cn(className)">{{ plain_text }}</span>
      <span v-else :class="cn(className)">{{ plain_text.slice(2) }}</span>
      <!-- To remove the @ from the plain_text -->
    </NuxtLink>
  </span>
  <NotionRichTextEquation v-else v-bind="props" />
</template>
