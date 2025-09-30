<script setup lang="ts">
import type { Heading1BlockObjectResponse, Heading2BlockObjectResponse, Heading3BlockObjectResponse } from '@notionhq/client'

const props = defineProps<Heading1BlockObjectResponse | Heading2BlockObjectResponse | Heading3BlockObjectResponse>()
</script>

<template>
  <h1 v-if="props.type === 'heading_1'" class="text-3xl font-bold font-sans">
    <NotionRichTextGroup
      :rich-text="props.heading_1.rich_text"
    />
  </h1>
  <h2 v-if="props.type === 'heading_2'" class="text-2xl font-bold font-sans">
    <NotionRichTextGroup
      :rich-text="props.heading_2.rich_text"
    />
  </h2>
  <h3 v-if="props.type === 'heading_3'" class="text-xl font-bold font-sans">
    <NotionRichTextGroup
      :rich-text="props.heading_3.rich_text"
    />
  </h3>
</template>
