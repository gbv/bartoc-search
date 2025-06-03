<template>
  <div class="result-card">
    <h2 class="result-title">
      {{ title || fallbackTitle }}
    </h2>
    <p class="result-description">
      {{ shortDescription || "No description available." }}
    </p>

    <ul class="result-details">
      <li v-if="doc.publisher_label">
        <strong>Publisher:</strong> {{ doc.publisher_label }}
      </li>
      <li v-if="doc.languages_ss?.length">
        <strong>Languages:</strong> {{ doc.languages_ss.join(", ") }}
      </li>
      <li v-if="typeLabel.length">
        <strong>Type:</strong> {{ typeLabel.join(', ') }}
      </li>
      <li v-if="subjectList.length">
        <strong>Subjects:</strong> {{ subjectList.join(", ") }}
      </li>
    </ul>

    <div class="result-links">
      <a
        v-if="doc.id"
        :href="`https://bartoc.org/api/data?uri=${doc.id}`"
        target="_blank"
        class="result-link"
      >
        Full JSKOS Record
      </a>
      <a
        :href="getSolrRecord(doc.id)"
        target="_blank"
        class="result-link"
      >
        Solr raw Index Record
      </a>
      <a
        v-if="doc.url_s"
        :href="doc.url_s"
        target="_blank"
        class="result-link"
      >
        Open Resource →
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SolrDocument } from "../../server/types/solr"
import { SupportedLang } from "../../server/types/lang"
import { computed } from "vue"


const props = defineProps<{ doc: SolrDocument; lang?: SupportedLang }>()

// Helper to safely access dynamic fields on SolrDocument
const rawDoc = props.doc as Record<string, any>;

// Computed values for display
const title = computed<string>(() => rawDoc[`title_${props.lang ?? "en"}`] || rawDoc.id);
const description = computed<string>(() => rawDoc[`description_${props.lang ?? "en"}`] || "No description available.");
const typeLabel = computed<string[]>(() => {
  const key = `type_label_${props.lang ?? "en"}`;
  const val = rawDoc[key] as string[];
  if (Array.isArray(val)) {
    return val as string[];
  } else if (typeof val === 'string') {
    return [val];
  }
  return [];
});
const fallbackTitle = computed<string>(() => rawDoc.id);

// Extract subjects list safely using type assertion
const subjectList = computed<string[]>(() => {
  const key = `subject_${props.lang ?? "en"}`;
  return (rawDoc[key] as string[]) || [];
});

// Abbreviate description to first 50 characters
const shortDescription = computed<string>(() => {
  const desc = description.value;
  return desc.length > 150 ? desc.slice(0, 150) + '...' : desc;
});

function getSolrRecord(id: string): string {
  return `/api/solr?id=${encodeURIComponent(id)}`;
}

</script>

<style scoped>
.result-card {
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 16px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
  margin-bottom: 16px;
}
.result-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.result-title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1a202c;
  margin-bottom: 8px;
}

.result-description {
  font-size: 0.9rem;
  color: #4a5568;
  margin-bottom: 12px;
  display: -webkit-box;
  overflow: hidden;
}

.result-details {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
}
.result-details li {
  font-size: 0.85rem;
  color: #4a5568;
  margin-bottom: 4px;
}

.result-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.result-link {
  font-size: 0.85rem;
  color: #2b6cb0;
  text-decoration: underline;
}
.result-link:hover {
  color: #2c5282;
}
</style>
