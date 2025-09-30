<script setup lang="ts">
import type katex from 'katex'

const {
  expression,
  type,
} = defineProps<{
  expression: string
  type: 'inline' | 'block'
}>()

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
    },
  ],
})

const { onLoaded } = useScriptNpm<{ katex: typeof katex }>({
  packageName: 'KaTeX',
  version: '0.16.9',
  provider: 'cdnjs',
  file: 'katex.min.js',
  scriptOptions: {
    /**
     * @returns {typeof katex} The KaTeX instance
     */
    use() {
      return { katex: window.katex }
    },
  },
})

const element = ref<HTMLElement>()

onLoaded(({ katex }) => {
  if (!element.value) {
    return
  }
  if (type === 'block') {
    katex.render(expression, element.value, {
      displayMode: true,
    })
  }
  else {
    katex.render(expression, element.value)
  }
})
</script>

<template>
  <div v-if="type === 'block'" ref="element" />
  <span v-if="type === 'inline'" ref="element" />
</template>
