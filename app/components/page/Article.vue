<script setup lang="ts">
import { z } from 'zod'
import { cn } from '~/lib/utils'
import { validateMainParam, validateQueryParam } from '~/lib/validation'

const { id, startCursor } = defineProps<{
  id: string
  startCursor?: string
}>()

const idValidated = validateMainParam(id, 'id', z.uuid())

const startCursorValidated = validateQueryParam(startCursor, 'start_cursor', z.uuid())

const { data: pageData, status: pageStatus } = await useFetch(`/api/page/${idValidated}`)
const { data: tagsData, status: tagsStatus } = await useFetch(`/api/page/${idValidated}/tags`)
const { data: blockData, status: blockStatus } = await useFetch(`/api/block/${id}`, {
  query: {
    start_cursor: startCursorValidated,
  },
})

const title = computed(() => {
  if (!pageData.value) {
    return undefined
  }
  const { properties } = pageData.value
  const titleProperty = Object.values(properties).find(property => property.type === 'title')
  return titleProperty?.title.map(title => title.plain_text).join('') || undefined
})

/**
 * Next page
 */
function nextPage() {
  navigateTo(`/-/${idValidated}?start_cursor=${blockData.value?.next_cursor}`)
}
</script>

<template>
  <Head>
    <Title>{{ title }}</Title>
  </Head>

  <PageSkeleton v-if="pageStatus === 'pending' || blockStatus === 'pending'" />

  <div
    v-else-if="pageData && blockData && pageStatus === 'success' && blockStatus === 'success'"
    class="container mx-auto px-4 flex flex-col gap-4 py-4 max-w-4xl w-full"
  >
    <!-- Title -->
    <h1 :class="cn('text-4xl font-bold', { 'mt-4': !pageData.cover })">
      {{ title }}
    </h1>

    <!-- Author -->
    <PageAuthor :id="pageData.created_by.id" :created-at="pageData.created_time" />

    <!-- Tags -->
    <div v-if="tagsData && tagsData.tags.length > 0 && tagsStatus === 'success'" class="flex flex-wrap gap-2">
      <PageTag v-for="tag in tagsData.tags" :key="tag.id" v-bind="tag" />
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-4 font-serif text-lg">
      <NotionBlock v-for="block in blockData.blocks" :key="block.id" v-bind="block" />
      <div v-if="blockData.has_more" class="flex justify-center p-2">
        <UiButton @click="nextPage">
          下一页
        </UiButton>
      </div>
    </div>
  </div>
</template>
