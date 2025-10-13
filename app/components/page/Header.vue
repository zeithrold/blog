<script setup lang="ts">
import { z } from 'zod'

const { id } = defineProps<{
  id: string
}>()

const UUIDSchema = z.uuid()

if (!UUIDSchema.safeParse(id).success && typeof id !== 'string') {
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid ID',
  })
}

const { data, status } = await useFetch(`/api/page/${id}`)

const title = computed(() => {
  if (!data.value) {
    return undefined
  }
  const { properties } = data.value
  const titleProperty = Object.values(properties).find(property => property.type === 'title')
  return titleProperty?.title.map(title => title.plain_text).join('') || undefined
})

const cover = computed(() => {
  if (!data.value) {
    return undefined
  }
  const { cover } = data.value
  return cover?.type === 'external' ? cover.external.url : cover?.file.url
})

const appConfig = useAppConfig()
</script>

<template>
  <Head>
    <Title>{{ appConfig.site.title }} - {{ title }}</Title>
  </Head>
  <PageSkeleton v-if="status === 'pending'" />
  <div
    v-else-if="data && status === 'success'"
    class="flex flex-col gap-4 w-full"
  >
    <NuxtImg
      v-if="data.cover !== null"
      :src="cover"
      class="w-full h-72"
    />
    <div class="container mx-auto px-4 flex flex-col gap-4 py-4">
      <h1 class="text-4xl font-bold">
        {{ title }}
      </h1>
      <PageAuthor :id="data.created_by.id" :created-at="data.created_time" />
    </div>
  </div>
</template>
