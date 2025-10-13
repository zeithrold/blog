<script setup lang="ts">
import { z } from 'zod'

const id = useRoute().params.id as string
const UUIDSchema = z.uuid()

definePageMeta({
  /**
   * Validate the id
   */
  validate(route) {
    // Check if the id is a valid UUID
    return typeof route.params.id === 'string' && UUIDSchema.safeParse(route.params.id).success
  },
})
</script>

<template>
  <div class="flex-1 flex flex-col items-center">
    <PageHeader :id="id" />
    <div class="container mx-auto px-4">
      <PageContent :id="id" />
    </div>
  </div>
</template>
