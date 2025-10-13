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
  <NuxtLink v-else-if="props.type === 'mention'" :to="href">
    <UiButton variant="link" size="lg">
      <StickyNote v-if="props.mention.type === 'page'" />
      <Calendar v-if="props.mention.type === 'date'" />
      <CircleUser v-if="props.mention.type === 'user'" />
      <span v-if="props.mention.type !== 'user'" :class="cn(className)">{{ plain_text }}</span>
      <span v-else :class="cn(className)">{{ plain_text.slice(2) }}</span>
      <!-- To remove the @ from the plain_text -->
    </UiButton>
  </NuxtLink>
  <NotionRichTextEquation v-else v-bind="props" />
</template>
