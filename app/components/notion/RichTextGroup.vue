<script setup lang="ts">
import type { RichTextItemResponse } from '@notionhq/client'
import type { HTMLAttributes } from 'vue'

const { richText, class: className } = defineProps<{
  richText: RichTextItemResponse[]
} & {
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span>
    <NotionRichText
      v-for="text in richText"
      :key="text.plain_text"
      v-bind="text"
      :class="className"
    />
  </span>
</template>
