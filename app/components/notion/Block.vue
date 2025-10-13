<script setup lang="ts">
import type { BlockResponse } from '~~/shared/notion'

// eslint-disable-next-line vue/define-props-destructuring
const props = defineProps<BlockResponse & {
  level?: number
}>()
</script>

<template>
  <template v-if="props.type === 'group'">
    <NotionGroupBlock v-bind="props" :level="level" />
  </template>
  <template v-else>
    <NotionSingleBlock v-bind="props" :level="level" />
  </template>
</template>
