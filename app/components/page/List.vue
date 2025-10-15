<script setup lang="ts">
import z from 'zod'
import { cn } from '~/lib/utils'
import { validateQueryParam } from '~/lib/validation'

const { startCursor, tag } = defineProps<{
  startCursor?: string
  tag?: string
}>()

const startCursorValidated = validateQueryParam(startCursor, 'start_cursor', z.uuid())
const tagValidated = validateQueryParam(tag, 'tag', z.string())

const { data, status } = await useFetch<ListResponse>('/api/list', {
  query: {
    start_cursor: startCursorValidated,
    tag: tagValidated,
  },
})

/**
 * Next page
 */
function nextPage() {
  navigateTo(`/?start_cursor=${data.value?.next_cursor}`)
}
</script>

<template>
  <div
    v-if="data"
    class="container mx-auto px-4 flex flex-col gap-4 py-4 max-w-4xl w-full"
  >
    <div v-if="data.tag" class="flex justify-center">
      <span class="text-lg font-bold">Showing results for tag: <PageTag v-bind="data.tag" /></span>
    </div>
    <div
      :class="cn(
        'grid grid-cols-1 md:grid-cols-2 gap-4',
      )"
    >
      <PageListItem v-for="item in data.pages" :key="item.id" v-bind="item" />
    </div>
    <div v-if="data.has_more" class="flex justify-center p-2">
      <UiButton @click="nextPage">
        下一页
      </UiButton>
    </div>
  </div>
  <div v-if="status === 'pending'">
    <PageSkeleton />
  </div>
</template>
