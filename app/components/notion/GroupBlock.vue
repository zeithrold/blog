<script setup lang="ts">
import type { GroupBlockResponse } from '#shared/notion'
import type { BlockObjectResponse } from '@notionhq/client'
import { cn } from '~/lib/utils'

const { block_list, level } = defineProps<GroupBlockResponse & {
  level?: number
}>()

const firstBlock = computed(() => block_list[0] as BlockObjectResponse)
</script>

<template>
  <ul
    :class="cn(
      {
        'list-disc': firstBlock.type === 'bulleted_list_item',
        'list-decimal': firstBlock.type !== 'bulleted_list_item',
        'list-inside': level && level > 0,
      },
      'ml-4',
      'space-y-1',
    )"
  >
    <li v-for="block in block_list" :key="block.id">
      <NotionRichTextGroup v-if="block.type === 'bulleted_list_item'" :rich-text="block.bulleted_list_item.rich_text" />
      <NotionRichTextGroup v-if="block.type === 'numbered_list_item'" :rich-text="block.numbered_list_item.rich_text" />
      <LazyNotionRemoteBlock
        v-if="block.has_children"
        :id="block.id"
        :level="level !== undefined ? level + 1 : 1"
      />
    </li>
  </ul>
</template>
