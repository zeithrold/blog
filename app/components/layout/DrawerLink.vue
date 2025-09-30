<script setup lang="ts">
const { href, label } = defineProps<{
  href: string
  label: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <div>
    <NuxtLink :to="href" @click="emit('click')">
      <UiButton variant="link">
        {{ label }}
      </UiButton>
    </NuxtLink>
  </div>
</template>
