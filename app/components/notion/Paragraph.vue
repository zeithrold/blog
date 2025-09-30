<script setup lang="ts">
import type { ParagraphBlockObjectResponse } from '@notionhq/client'

const props = defineProps<ParagraphBlockObjectResponse>()
</script>

<template>
  <p>
    <NotionRichTextGroup
      :rich-text="props.paragraph.rich_text"
    />
  </p>
</template>
