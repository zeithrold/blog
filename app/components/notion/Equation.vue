<script setup lang="ts">
import type { EquationBlockObjectResponse } from '@notionhq/client'

const props = defineProps<EquationBlockObjectResponse>()
</script>

<template>
  <KaTeX :expression="props.equation.expression" type="block" />
</template>
