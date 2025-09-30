<script setup lang="ts">
import type { SingleBlockResponse } from '~~/shared/notion'

const { block, level } = defineProps<SingleBlockResponse & {
  level?: number
  type: 'single'
}>()
</script>

<template>
  <template v-if="!level || level <= 3">
    <NotionHeading
      v-if="block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3'"
      v-bind="block"
    />
    <NotionParagraph
      v-if="block.type === 'paragraph'"
      v-bind="block"
    />
    <NotionImage
      v-if="block.type === 'image'"
      v-bind="block"
    />
    <NotionToDo
      v-if="block.type === 'to_do'"
      v-bind="block"
    />
    <LazyNotionEquation
      v-if="block.type === 'equation'"
      v-bind="block"
    />
    <LazyNotionCode
      v-if="block.type === 'code'"
      v-bind="block"
    />
    <NotionImage
      v-if="block.type === 'image'"
      v-bind="block"
    />
  </template>
</template>
