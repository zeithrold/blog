<script setup lang="ts">
import menu from './menu'

const isMobile = useMediaQuery('(max-width: 768px)')
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50"
  >
    <div class="flex justify-between items-center p-2">
      <div class="flex gap-0.5 items-center">
        <NuxtLink to="/">
          <UiButton variant="link" class="text-lg font-bold">
            @Zeithrold
          </UiButton>
        </NuxtLink>
        <span class="text-sm text-muted-foreground">
          Ahead Every Moment
        </span>
      </div>
      <div v-if="isMobile">
        <LayoutDrawer />
      </div>
      <LayoutHeaderLinkGroup v-else :links="menu" />
    </div>
  </header>
</template>
