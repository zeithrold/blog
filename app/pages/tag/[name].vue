<script setup lang="ts">
import z from 'zod'
import { validateQueryParam } from '~/lib/validation'

const startCursor = useRoute().query.start_cursor as string
const tag = useRoute().params.name as string

const startCursorValidated = validateQueryParam(startCursor, 'start_cursor', z.uuid())
const tagValidated = validateQueryParam(tag, 'tag', z.string())
</script>

<template>
  <div class="flex-1 flex flex-col">
    <PageList :start-cursor="startCursorValidated" :tag="tagValidated" />
  </div>
</template>
