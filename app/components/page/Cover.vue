<script setup lang="ts">
import { z } from 'zod'
import { validateMainParam } from '~/lib/validation'

const { id } = defineProps<{
  id: string
}>()

const idValidated = validateMainParam(id, 'id', z.uuid())

const { data, status } = await useFetch(`/api/page/${idValidated}`)

const cover = computed(() => {
  if (!data.value) {
    return undefined
  }
  const { cover } = data.value
  return cover?.type === 'external' ? cover.external.url : cover?.file.url
})
</script>

<template>
  <div v-if="status === 'pending'" class="w-full h-72 bg-gray-200 animate-pulse rounded" />
  <div
    v-else-if="data && cover"
    class="w-full h-72 overflow-hidden"
  >
    <NuxtImg
      :src="cover"
      class="w-full h-full object-cover object-center"
    />
  </div>
</template>
