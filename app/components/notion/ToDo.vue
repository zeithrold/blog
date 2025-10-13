<script setup lang="ts">
import type { ToDoBlockObjectResponse } from '@notionhq/client'

const { id, to_do } = defineProps<ToDoBlockObjectResponse>()
</script>

<template>
  <div class="items-top flex space-x-2">
    <UiCheckbox
      :id="id"
      disabled
      :model-value="to_do.checked"
    />
    <label
      :for="id"
      class="font-medium leading-none peer-disabled:cursor-not-allowed"
    >
      <NotionRichTextGroup :rich-text="to_do.rich_text" />
    </label>
  </div>
</template>
