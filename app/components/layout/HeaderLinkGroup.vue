<script setup lang="ts">
const { links } = defineProps<{
  links: {
    label: string
    href: string
  }[]
}>()
</script>

<template>
  <div class="flex gap-2">
    <NuxtLink v-for="linkItem in links" :key="linkItem.href" :to="linkItem.href">
      <UiButton variant="link">
        {{ linkItem.label }}
      </UiButton>
    </NuxtLink>
  </div>
</template>
