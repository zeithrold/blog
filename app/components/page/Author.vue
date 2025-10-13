<script setup lang="ts">
import { z } from 'zod'
import { cn } from '~/lib/utils'
import { validateMainParam } from '~/lib/validation'

const { id, createdAt } = defineProps<{
  id: string
  createdAt: string
  size?: 'sm'
}>()

const idValidated = validateMainParam(id, 'id', z.uuid())

const { data, status } = await useFetch(`/api/user/${idValidated}`)

const parsedDate = ref<string>()

onMounted(() => {
  parsedDate.value = new Date(createdAt).toLocaleString()
})
</script>

<template>
  <PageSkeleton v-if="status === 'pending'" />
  <div v-else-if="data && status === 'success'" class="flex flex-row gap-2 items-center">
    <UiAvatar :class="cn('size-8', size === 'sm' && 'size-6')">
      <UiAvatarImage
        v-if="data.avatar_url"
        :src="data.avatar_url"
        :alt="data.name"
        loading="lazy"
      />
      <UiAvatarFallback>
        Z
      </UiAvatarFallback>
    </UiAvatar>
    <div class="flex flex-col gap-1">
      <span :class="cn('font-bold', size === 'sm' && 'text-sm')">{{ data.name }}</span>
      <span :class="cn('text-sm text-muted-foreground', size === 'sm' && 'text-xs')">
        Created at {{ parsedDate || createdAt }}
      </span>
    </div>
  </div>
</template>
