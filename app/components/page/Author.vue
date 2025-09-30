<script setup lang="ts">
import { z } from 'zod'

const { id, createdAt } = defineProps<{
  id: string
  createdAt: string
}>()

const UUIDSchema = z.uuid()

if (!UUIDSchema.safeParse(id).success && typeof id !== 'string') {
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid ID',
  })
}

const { data, status } = await useFetch(`/api/user/${id}`)

const parsedDate = ref<string>()

onMounted(() => {
  parsedDate.value = new Date(createdAt).toLocaleString()
})
</script>

<template>
  <PageSkeleton v-if="status === 'pending'" />
  <div v-else-if="data && status === 'success'" class="flex flex-row gap-2 items-center">
    <UiAvatar>
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
      <span class="font-bold">{{ data.name }}</span>
      <span class="text-sm text-muted-foreground">
        Created at {{ parsedDate || createdAt }}
      </span>
    </div>
  </div>
</template>
