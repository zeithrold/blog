<script setup lang="ts">
import type { PageItem } from '#shared/types/list'
import { ArrowRightIcon } from 'lucide-vue-next'

const { id, title, created_time, author, summary, cover } = defineProps<PageItem>()

const parsedDate = ref<string>()

onMounted(() => {
  parsedDate.value = new Date(created_time).toLocaleString()
})
</script>

<template>
  <UiCard class="hover:shadow-lg transition duration-300 ease-in-out hover:transform-[scale(1.01)]">
    <UiCardHeader>
      <NuxtLink :to="`/-/${id}`">
        <UiCardTitle class="hover:underline text-xl">
          {{ title }}
        </UiCardTitle>
      </NuxtLink>
      <UiCardDescription>
        Created By {{ author.name }} at {{ parsedDate === '' ? created_time : parsedDate }}
      </UiCardDescription>
    </UiCardHeader>
    <UiCardContent
      class="flex flex-col gap-4 flex-1"
    >
      <div
        v-if="cover"
        class="w-full h-48 rounded overflow-hidden flex items-center justify-center"
      >
        <NuxtImg
          :src="cover"
        />
      </div>
      <p class="text-muted-foreground text-sm flex-1 overflow-hidden line-clamp-3">
        {{ summary }}
      </p>
      <div v-if="tags.length > 0" class="flex flex-wrap gap-2">
        <PageTag v-for="tag in tags" :key="tag.id" v-bind="tag" />
      </div>
    </UiCardContent>
    <UiCardFooter class="justify-end">
      <NuxtLink :to="`/-/${id}`">
        <UiButton variant="outline" size="sm">
          Continue <ArrowRightIcon />
        </UiButton>
      </NuxtLink>
    </UiCardFooter>
  </UiCard>
</template>
