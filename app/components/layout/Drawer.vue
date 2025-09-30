<script setup lang="ts">
import { Menu } from 'lucide-vue-next'
import menu from './menu'

const { site } = useAppConfig()
const isOpen = ref(false)
</script>

<template>
  <UiDrawer v-model:open="isOpen">
    <UiDrawerTrigger>
      <UiButton variant="ghost" size="icon">
        <Menu />
      </UiButton>
    </UiDrawerTrigger>
    <UiDrawerContent>
      <UiDrawerHeader>
        <UiDrawerTitle>
          <h1>{{ site.title }}</h1>
        </UiDrawerTitle>
        <UiDrawerDescription>
          {{ site.description }}
        </UiDrawerDescription>
      </UiDrawerHeader>
      <div class="flex flex-col gap-1">
        <LayoutDrawerLink
          v-for="item in menu"
          :key="item.href"
          :href="item.href"
          :label="item.label"
          @click="isOpen = false"
        />
      </div>
      <UiDrawerFooter>
        <div class="text-sm text-muted-foreground">
          Made with ❤️ by Zeithrold
        </div>
      </UiDrawerFooter>
    </UiDrawerContent>
  </UiDrawer>
</template>
