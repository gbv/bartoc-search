<template>
    <div class="rounded-2xl shadow-md p-4 border bg-white hover:shadow-lg transition-all">
      <h2 class="text-xl font-bold text-blue-800 mb-2">
        {{ title || fallbackTitle }}
      </h2>
      <p class="text-gray-700 text-sm mb-3 line-clamp-3">
        {{ description || "No description available." }}
      </p>
  
       <ul class="text-sm text-gray-600 space-y-1">
        <li v-if="doc.publisher_label">
          <strong>Publisher:</strong> {{ doc.publisher_label }}
        </li>
        <li v-if="doc.languages_ss?.length">
          <strong>Languages:</strong> {{ doc.languages_ss.join(", ") }}
        </li>
        <li v-if="typeLabel">
          <strong>Type:</strong> {{ typeLabel }}
        </li>
        <li v-if="doc.subject_notation?.length">
          <strong>Subjects:</strong> {{ doc.subject_notation.join(", ") }}
        </li>
      </ul>

    
      <div class="mt-4">
        <a
          v-if="doc.url_s"
          :href="doc.url_s"
          target="_blank"
          class="text-blue-600 underline text-sm"
        >
          Open Resource →
        </a>
      </div>
      
    </div>
  </template>
  
  <script setup lang="ts">
  import type { SolrDocument } from "./../../../src/types/solr"
  import { SupportedLang } from "./../../../src/types/lang"
  import { computed } from "vue"
  
  const props = defineProps<{ doc: SolrDocument; lang?: SupportedLang }>()
  
  const title = computed(() => props.doc[`title_${props.lang ?? "en"}`])
  const description = computed(() => props.doc[`description_${props.lang ?? "en"}`])
  const typeLabel = computed(() => props.doc[`type_label_${props.lang ?? "en"}`])
  const fallbackTitle = computed(() => props.doc.id)
  </script>
  
  <style scoped>
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  </style>
  