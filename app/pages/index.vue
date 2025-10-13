<script setup lang="ts">
import z from 'zod'
import { validateQueryParam } from '~/lib/validation'

const startCursor = useRoute().query.start_cursor as string

const startCursorValidated = validateQueryParam(startCursor, 'start_cursor', z.uuid())
</script>

<template>
  <div class="flex-1 flex flex-col">
    <PageIdentity />
    <PageList :start-cursor="startCursorValidated" />
  </div>
</template>
