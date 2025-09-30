<script setup lang="ts">
import type { BlockResponse } from '~~/shared/notion'

const props = defineProps<BlockResponse>()
</script>

<template>
  <template v-if="props.type === 'group'">
    <NotionGroupBlock v-bind="props" />
  </template>
  <template v-else>
    <NotionSingleBlock v-bind="props" />
  </template>
</template>
