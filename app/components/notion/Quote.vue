<script setup lang="ts">
import type { QuoteBlockObjectResponse } from '@notionhq/client'

const props = defineProps<QuoteBlockObjectResponse>()
</script>

<template>
  <div class="border-l-4 border-l-primary p-4">
    <NotionRichTextGroup :rich-text="props.quote.rich_text" />
  </div>
</template>
