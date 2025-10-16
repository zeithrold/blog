<script setup lang="ts">
import z from 'zod'
import { validateQueryParam } from '~/lib/validation'

const startCursor = useRoute().query.start_cursor as string
const tag = useRoute().params.name as string

const startCursorValidated = validateQueryParam(startCursor, 'start_cursor', z.uuid())
const tagValidated = validateQueryParam(tag, 'tag', z.string())

definePageMeta({
  /**
   * Validate the id
   */
  validate(route) {
    try {
      const startCursor = route.query.start_cursor as string
      const tag = route.params.name as string
      validateQueryParam(startCursor, 'start_cursor', z.uuid())
      validateQueryParam(tag, 'tag', z.string())
      return $fetch('/api/tags').then(response => response.tags.some(item => item.name === tag))
    }
    catch {
      return false
    }
  },
})
</script>

<template>
  <div class="flex-1 flex flex-col">
    <PageList :start-cursor="startCursorValidated" :tag="tagValidated" />
  </div>
</template>
