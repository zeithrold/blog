<script setup lang="ts">
import { z } from 'zod'
import { validateMainParam, validateQueryParam } from '~/lib/validation'

const route = useRoute()

const id = route.params.id as string
const startCursor = route.query.start_cursor as string

definePageMeta({
  /**
   * Validate the id
   */
  validate(route) {
    try {
      const id = route.params.id as string
      const startCursor = route.query.start_cursor as string
      validateMainParam(id, 'id', z.uuid())
      validateQueryParam(startCursor, 'start_cursor', z.uuid())
      return true
    }
    catch {
      return false
    }
  },
})
</script>

<template>
  <div class="flex-1 flex flex-col gap-4">
    <!-- Cover Image -->
    <PageCover :id="id" />

    <!-- Article Content -->
    <PageArticle :id="id" :start-cursor="startCursor" />
  </div>
</template>
