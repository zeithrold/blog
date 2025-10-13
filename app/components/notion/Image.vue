<script setup lang="ts">
import type { ImageBlockObjectResponse } from '@notionhq/client'

const props = defineProps<ImageBlockObjectResponse>()
</script>

<template>
  <NuxtImg v-if="props.image.type === 'external'" :src="props.image.external.url" />
  <NuxtImg v-else :src="props.image.file.url" />
  <NotionCaption :caption="props.image.caption" />
</template>
