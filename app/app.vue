<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtLoadingIndicator
      color="black"
    />
    <NuxtPage />
  </NuxtLayout>
  <Toaster />
</template>
