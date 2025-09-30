<script setup lang="ts">
import type { ImageBlockObjectResponse } from '@notionhq/client'

const props = defineProps<ImageBlockObjectResponse>()
</script>

<template>
  <NuxtImg v-if="props.image.type === 'external'" :src="props.image.external.url" />
  <NuxtImg v-else :src="props.image.file.url" />
  <div v-if="image.caption.length > 0" class="flex items-center justify-center">
    <NotionRichTextGroup :rich-text="image.caption" class="text-sm !text-black/50 font-sans" />
  </div>
</template>
