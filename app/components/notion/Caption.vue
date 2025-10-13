<script setup lang="ts">
import type { RichTextItemResponse } from '@notionhq/client'

const { caption } = defineProps<{
  caption: RichTextItemResponse[]
}>()
</script>

<template>
  <div v-if="caption.length > 0" class="flex items-center justify-center">
    <NotionRichTextGroup :rich-text="caption" class="text-sm !text-black/50 font-sans italic" />
  </div>
</template>
