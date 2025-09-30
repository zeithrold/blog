<script setup lang="ts">
import type { RichTextItemResponse } from '@notionhq/client'

const { equation } = defineProps<RichTextItemResponse & { type: 'equation' }>()
</script>

<template>
  <KaTeX :expression="equation.expression" type="inline" />
</template>
