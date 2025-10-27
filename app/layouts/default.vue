<script setup lang="ts">
const { site } = useAppConfig()
</script>

<template>
  <div class="font-sans min-h-screen w-full flex flex-col selection:bg-black/10">
    <Head>
      <Title>{{ site.description }}</Title>
      <Meta name="description" :content="site.description" />
    </Head>
    <LayoutHeader />
    <main class="flex-1 flex mt-13">
      <slot />
    </main>
    <LayoutFooter />
  </div>
</template>
