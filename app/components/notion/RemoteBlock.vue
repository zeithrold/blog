<script setup lang="ts">
const { id } = defineProps<{
  id: string
  level?: number
}>()

const { data, status } = await useFetch(`/api/block/${id}`)
</script>

<template>
  <template v-if="data">
    <NotionBlock
      v-for="block in data.blocks"
      :key="block.id"
      v-bind="block"
      :level="level"
    />
  </template>
  <div v-if="status === 'pending'">
    <PageSkeleton />
  </div>
</template>
