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

const { data, status } = await useFetch(`/api/block/${id}`)
</script>

<template>
  <div v-if="data" class="flex flex-col gap-4 font-serif text-lg">
    <NotionBlock v-for="block in data.blocks" :key="block.id" v-bind="block" />
  </div>
  <div v-if="status === 'pending'">
    <PageSkeleton />
  </div>
</template>
