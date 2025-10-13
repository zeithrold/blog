<script setup lang="ts">
import type { ColumnListBlockObjectResponse } from '@notionhq/client'
import { cn } from '~/lib/utils'

const props = defineProps<ColumnListBlockObjectResponse>()
const { data, status } = await useFetch(`/api/block/${props.id}`)

const filteredData = computed(() => data.value?.blocks.filter(block => block.type === 'single'))
</script>

<template>
  <div v-if="filteredData" :class="cn('flex gap-2')">
    <div v-for="block in filteredData" :key="block.id" class="flex-1">
      <NotionRemoteBlock v-bind="block.block" />
    </div>
  </div>
  <div v-if="status === 'pending'">
    <PageSkeleton />
  </div>
</template>
