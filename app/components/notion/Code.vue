<script setup lang="ts">
import type { CodeBlockObjectResponse } from '@notionhq/client'
import type { HighlightResult, HLJSApi } from 'highlight.js'

const props = defineProps<CodeBlockObjectResponse>()

const plainText = computed(() => {
  return props.code.rich_text.map(text => text.plain_text).join('')
})

declare global {
  interface Window {
    hljs: HLJSApi
  }
}

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css',
    },
  ],
})

const { onLoaded } = useScriptNpm<{ hljs: HLJSApi }>({
  packageName: 'highlight.js',
  version: '11.11.1',
  provider: 'cdnjs',
  file: 'highlight.min.js',
  scriptOptions: {
    /**
     *
     */
    use() {
      return { hljs: window.hljs }
    },
  },
})

const highlightResult = ref<HighlightResult>()

onLoaded(({ hljs }) => {
  highlightResult.value = hljs.highlight(plainText.value, {
    language: props.code.language,
  })
})
</script>

<template>
  <pre
    v-if="highlightResult"
    class="font-mono shadow rounded-2xl p-4 border border-black/5"
    v-html="highlightResult.value"
  />
  <NotionCaption :caption="props.code.caption" />
</template>
